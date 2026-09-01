/**
 * Verifica P1.1B — Usa questa variante (swap slot A, solo React).
 * Esegui: npx tsx scripts/verifica-use-copy-variant.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultConfigurazioneContatti } from "@/data/defaults-contatti";
import { generaCodiceImportMeta } from "@/data/meta-import-tsv";
import {
  creaSnapshotConfigurazione,
  deveInvalidareApprovazione,
  diffConfigurazione,
  firmaSostanziale,
  haModificaSostanziale,
  testoLogAggiornamento,
} from "@/lib/campagna-edit";
import {
  ctaUsaVariantePrimaria,
  raccomandaCopy,
  scambiaVariantePrimaria,
} from "@/lib/raccomanda-copy";

let falliti = 0;

function mark(ok: boolean, msg: string) {
  if (!ok) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

const ROOT = process.cwd();
function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const AURORA_OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const AURORA_BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia. Il target principale sono adulti che hanno perso uno o più denti o stanno valutando una soluzione fissa. L’obiettivo è generare richieste di prima visita qualificate, con una comunicazione rassicurante e professionale, evitando promesse di risultato o toni troppo aggressivi.";

const BASE_REC = {
  titoloAnnuncio: "Prima visita implantologica a Roma",
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
  citta: "Roma",
  settore: "Dentista",
  objective: "LEADS" as const,
};

const TESTO_SOLIDO =
  "Stai valutando una soluzione per uno o più denti mancanti a Roma? Richiedi una prima visita implantologica con valutazione del caso e piano di trattamento personalizzato.";
const TESTO_C_CLAIM =
  "Risultato garantito. Torna a sorridere subito.";
const TESTO_MISMATCH =
  "Siamo uno studio di qualità a Roma. Richiedi informazioni sulla nostra esperienza professionale.";

const SNAP_BASE = {
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  varianteA: "Copy A",
  varianteB: "Copy B",
  varianteC: "Copy C",
  titoloAnnuncio: "Headline",
  creativita: [{ id: "c1", storagePath: "user/c1.jpg" }],
  dailyBudget: 20,
  launchBudget: 0,
  citta: "Roma",
  raggioKm: 15,
  etaMin: 25,
  etaMax: 50,
  targetType: "B2C",
  targetAge: "25-50",
  ticket: 1500,
  conversionRate: 15,
  margine: 50,
  objective: "LEADS",
  destinationUrl: "",
  heroProduct: "",
  bookingChannel: undefined as string | undefined,
};

console.log("=== SWAP B→A / C→A ===");
const originali = {
  varianteA: "Testo A originale",
  varianteB: "Testo B originale",
  varianteC: "Testo C originale",
};
const swapB = scambiaVariantePrimaria(originali, "B");
mark(
  swapB.varianteA === "Testo B originale" &&
    swapB.varianteB === "Testo A originale" &&
    swapB.varianteC === "Testo C originale",
  "B→A: testi scambiati, C invariata",
);
const swapC = scambiaVariantePrimaria(originali, "C");
mark(
  swapC.varianteA === "Testo C originale" &&
    swapC.varianteB === "Testo B originale" &&
    swapC.varianteC === "Testo A originale",
  "C→A: testi scambiati, B invariata",
);

const insiemePrima = [
  originali.varianteA,
  originali.varianteB,
  originali.varianteC,
].sort();
const insiemeB = [swapB.varianteA, swapB.varianteB, swapB.varianteC].sort();
const insiemeC = [swapC.varianteA, swapC.varianteB, swapC.varianteC].sort();
mark(
  JSON.stringify(insiemePrima) === JSON.stringify(insiemeB) &&
    JSON.stringify(insiemePrima) === JSON.stringify(insiemeC),
  "nessun testo perso",
);
mark(
  new Set(insiemeB).size === 3 && new Set(insiemeC).size === 3,
  "nessun duplicato",
);
mark(
  originali.varianteA === "Testo A originale" &&
    originali.varianteB === "Testo B originale",
  "input immutato (swap puro)",
);

console.log("\n=== CTA LOGIC ===");
const soloA = raccomandaCopy({
  ...BASE_REC,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_C_CLAIM,
  varianteC: TESTO_C_CLAIM,
});
mark(
  JSON.stringify(soloA?.recommendedVariants) === JSON.stringify(["A"]) &&
    JSON.stringify(ctaUsaVariantePrimaria(soloA)) === JSON.stringify([]),
  "A consigliata → nessuna CTA",
);

const soloB = raccomandaCopy({
  ...BASE_REC,
  varianteA: TESTO_MISMATCH,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_CLAIM,
});
mark(
  JSON.stringify(soloB?.recommendedVariants) === JSON.stringify(["B"]) &&
    JSON.stringify(ctaUsaVariantePrimaria(soloB)) === JSON.stringify(["B"]),
  "B consigliata → CTA B",
);

console.log("\n=== TIE ===");
const tieAB = raccomandaCopy({
  ...BASE_REC,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_CLAIM,
});
mark(
  JSON.stringify(tieAB?.recommendedVariants) === JSON.stringify(["A", "B"]) &&
    JSON.stringify(ctaUsaVariantePrimaria(tieAB)) === JSON.stringify(["B"]),
  "tie A/B → CTA solo B",
);

const tieBC = raccomandaCopy({
  ...BASE_REC,
  varianteA: TESTO_MISMATCH,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_SOLIDO,
});
mark(
  JSON.stringify(tieBC?.recommendedVariants) === JSON.stringify(["B", "C"]) &&
    JSON.stringify(ctaUsaVariantePrimaria(tieBC)) === JSON.stringify(["B", "C"]),
  `tie B/C → CTA B e C (got ${JSON.stringify(tieBC?.recommendedVariants)} / ${JSON.stringify(ctaUsaVariantePrimaria(tieBC))})`,
);

const tieABC = raccomandaCopy({
  ...BASE_REC,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_SOLIDO,
});
mark(
  JSON.stringify(tieABC?.recommendedVariants) ===
    JSON.stringify(["A", "B", "C"]) &&
    JSON.stringify(ctaUsaVariantePrimaria(tieABC)) === JSON.stringify([]),
  "tie a tre → nessuna CTA",
);

console.log("\n=== CANCEL / NESSUNA PERSISTENZA AL CLICK ===");
const srcForm = src("src/components/nuova-contatti/FormConfigurazione.tsx");
const srcPercorso = src("src/components/nuova-contatti/PercorsoContatti.tsx");
const srcHelper = src("src/lib/raccomanda-copy.ts");
const srcCard = src(
  "src/components/nuova-contatti/CopyRecommendationCard.tsx",
);
mark(
  srcForm.includes("function usaVarianteComePrimaria") &&
    srcForm.includes("onCambia({") &&
    !srcForm.includes("salvaCampagnaCompleta") &&
    !srcHelper.includes("supabase") &&
    !srcCard.includes("supabase"),
  "swap solo onCambia / React, nessun DB nel click",
);
mark(
  srcPercorso.includes('onClick={() => router.push(`/campagne/${campaignIdEdit}`)}') &&
    srcPercorso.includes("Annulla"),
  "Annulla edit = navigate senza save",
);

console.log("\n=== DRAFT / APPROVED / REVISION ===");
const firmaPrima = firmaSostanziale(SNAP_BASE);
const dopoB = scambiaVariantePrimaria(
  {
    varianteA: SNAP_BASE.varianteA,
    varianteB: SNAP_BASE.varianteB,
    varianteC: SNAP_BASE.varianteC,
  },
  "B",
);
const firmaDopo = firmaSostanziale({
  ...SNAP_BASE,
  ...dopoB,
});
mark(haModificaSostanziale(firmaPrima, firmaDopo), "swap è modifica sostanziale");
mark(
  !deveInvalidareApprovazione("DRAFT", true),
  "DRAFT save → status invariato",
);
mark(
  deveInvalidareApprovazione("APPROVED", true),
  "APPROVED + sostanziale → invalida al save",
);
mark(
  !deveInvalidareApprovazione("REVISION_REQUESTED", true),
  "REVISION_REQUESTED → status invariato",
);

const srcDb = src("src/lib/campagne-db.ts");
mark(
  srcDb.includes("status: \"DRAFT\"") &&
    srcDb.includes("approved_at: null") &&
    srcDb.includes("NON tocca approval_token né revision_notes"),
  "invalidation: DRAFT + approved_at null + token intatto",
);

console.log("\n=== HISTORY ===");
const snapPrima = creaSnapshotConfigurazione(SNAP_BASE);
const snapDopoB = creaSnapshotConfigurazione({ ...SNAP_BASE, ...dopoB });
const diffB = diffConfigurazione(snapPrima, snapDopoB);
const descrB = diffB.map((d) => d.descrizione).join(" | ");
mark(
  descrB.includes("Variante A modificata") &&
    descrB.includes("Variante B modificata") &&
    !descrB.includes("Variante C modificata") &&
    !descrB.includes("Copy A") &&
    !descrB.includes("Copy B"),
  `swap B: history A+B senza dump (got ${descrB})`,
);
const dopoC = scambiaVariantePrimaria(
  {
    varianteA: SNAP_BASE.varianteA,
    varianteB: SNAP_BASE.varianteB,
    varianteC: SNAP_BASE.varianteC,
  },
  "C",
);
const diffC = diffConfigurazione(
  snapPrima,
  creaSnapshotConfigurazione({ ...SNAP_BASE, ...dopoC }),
);
const descrC = diffC.map((d) => d.descrizione).join(" | ");
mark(
  descrC.includes("Variante A modificata") &&
    descrC.includes("Variante C modificata") &&
    !descrC.includes("Variante B modificata"),
  `swap C: history A+C (got ${descrC})`,
);
const logApproved = testoLogAggiornamento(diffB, {
  richiestaNuovaApprovazione: true,
});
mark(
  logApproved.description.includes("Richiesta nuova approvazione"),
  "APPROVED save riusa frase approval esistente",
);

console.log("\n=== PREVIEW RESET ===");
const srcMock = src("src/components/nuova-contatti/MetaFeedMockup.tsx");
mark(
  srcMock.includes("tabResetKey") &&
    srcMock.includes('setTab("A")') &&
    srcPercorso.includes("tabResetKey={previewTabReset}") &&
    srcPercorso.includes("onDopoSwapVariante"),
  "preview torna su A dopo swap",
);

console.log("\n=== EXPORT / SCHEMA ===");
const csvPrima = generaCodiceImportMeta(
  {
    ...defaultConfigurazioneContatti,
    varianteA: "Copy A",
    varianteB: "Copy B",
    varianteC: "Copy C",
    titoloAnnuncio: "Headline",
    nomeCliente: "Studio",
  },
  "Roma",
);
const csvDopo = generaCodiceImportMeta(
  {
    ...defaultConfigurazioneContatti,
    ...dopoB,
    titoloAnnuncio: "Headline",
    nomeCliente: "Studio",
  },
  "Roma",
);
const righePrima = csvPrima.trim().split("\n");
const righeDopo = csvDopo.trim().split("\n");
mark(
  righePrima.length === righeDopo.length && righePrima.length === 4,
  "CSV: stessa struttura (header + 3 ads)",
);
mark(
  csvDopo.includes("Copy B") && csvDopo.includes("Copy A") && csvDopo.includes("Copy C"),
  "CSV dopo swap contiene ancora A/B/C come tre testi",
);
mark(
  csvDopo.indexOf("Copy B") < csvDopo.indexOf("Copy A"),
  "dopo swap B, il testo B è nella prima riga ads (slot A)",
);

const srcExport = src("src/data/meta-import-tsv.ts");
const srcEdit = src("src/lib/campagna-edit.ts");
const srcChecker = src("src/lib/controllo-messaggio.ts");
const srcRischio = src("src/lib/rischio-copy.ts");
mark(
  !srcExport.includes("scambiaVariantePrimaria") &&
    !srcEdit.includes("scambiaVariantePrimaria") &&
    !srcChecker.includes("scambiaVariantePrimaria") &&
    !srcRischio.includes("scambiaVariantePrimaria") &&
    !srcHelper.includes("primary_variant") &&
    !srcForm.includes("primary_variant"),
  "export, approval history, checker, rischio, schema non toccati dal modello swap",
);

const migrations = src("supabase/migrations/20260831_campaign_logs_event_updated.sql");
mark(
  !srcHelper.includes("alter table") &&
    !srcForm.includes("alter table") &&
    migrations.includes("campaign_logs"),
  "nessuna migration/schema change in questo slice",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite`);
  process.exit(1);
}
console.log("\nTutti i test P1.1B Usa questa variante sono passati.");
