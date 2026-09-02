/**
 * Verifica Step 6 launch consistency (header / stepper / export ≠ lancio).
 * Esegui: npx tsx scripts/verifica-step6-consistency.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateMaxSustainableCpl } from "@/lib/benchmarks";
import {
  csvMetaHaCopyEsportabile,
  generaCodiceImportMeta,
} from "@/data/meta-import-tsv";
import {
  LABEL_EXPORT_BOZZA,
  LABEL_EXPORT_PRONTA,
  MICROCOPY_EXPORT_PAGE_FORM,
  MICROCOPY_EXPORT_PRONTA,
  copyHeaderStep6,
  etichettaStepperStep6,
  etichetteExportMeta,
  raccomandaLancio,
} from "@/lib/guidance";
import { calculateLaunchReadiness } from "@/lib/launch-readiness";
import {
  LABEL_STRATEGIA_SOLIDA,
  calculateStrategicScore,
  type StrategicScoreInput,
} from "@/lib/strategic-score";
import type { ConfigurazioneContatti } from "@/types/campagne";

let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

const COPY =
  "A Roma la prima visita con preventivo chiaro in giornata. Prenota dal modulo.";
const OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia. Target adulti che hanno perso uno o più denti o stanno valutando una soluzione fissa.";

function auroraScore(
  extra: Partial<StrategicScoreInput> = {},
): StrategicScoreInput {
  return {
    budgetGiornaliero: 20,
    settore: "Studio dentistico",
    citta: "Roma",
    ticket: 1500,
    conversionRate: 15,
    conversionRateSource: "REAL",
    targetMargin: 50,
    maxSustainableCpl: calculateMaxSustainableCpl(1500, 15, 50),
    frontEndOffer: OFFERTA,
    elevatorPitch: BRIEF,
    targetType: "B2C",
    targetAge: "25-50",
    raggioKm: 15,
    haCopySelezionato: true,
    copyVarianteA: COPY,
    titoloAnnuncio: "Prima visita implantologica a Roma",
    fotoCaricata: true,
    objective: "LEADS",
    fase: "completa",
    ...extra,
  };
}

function readiness(extra: {
  paginaFacebookId?: string;
  moduloContattiId?: string;
  clienteHaApprovato?: boolean;
  haCopySelezionato?: boolean;
  haTitoloAnnuncio?: boolean;
  fotoCaricata?: boolean;
} = {}) {
  return calculateLaunchReadiness({
    fotoCaricata: extra.fotoCaricata ?? true,
    clienteHaApprovato: extra.clienteHaApprovato ?? true,
    paginaFacebookId: extra.paginaFacebookId ?? "102938475610293",
    moduloContattiId: extra.moduloContattiId ?? "238512345678901",
    haCopySelezionato: extra.haCopySelezionato ?? true,
    haTitoloAnnuncio: extra.haTitoloAnnuncio ?? true,
    objective: "LEADS",
  });
}

const configBase: ConfigurazioneContatti = {
  nomeCliente: "Studio Dentistico Aurora",
  nomeCampagna: "Aurora - Richieste Contatto",
  budgetGiornaliero: 20,
  cboAttivo: true,
  raggioKm: 15,
  etaMin: 25,
  etaMax: 50,
  genere: "Tutti",
  targetingBroad: true,
  posizionamentiAdvantage: true,
  varianteA: COPY,
  varianteB: COPY,
  varianteC: COPY,
  titoloAnnuncio: "Prima visita implantologica a Roma",
  scontrinoMedio: 1500,
  tassoConversionePercent: 15,
};

const srcPercorso = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/PercorsoContatti.tsx"),
  "utf8",
);
const srcPannello = readFileSync(
  join(process.cwd(), "src/components/campagne/PannelloAssetStrategia.tsx"),
  "utf8",
);

console.log("\n=== TEST 1 — NOT_READY Page/Form mancanti, CSV generabile ===");
const scoreSolido = calculateStrategicScore(auroraScore());
assert(scoreSolido.label === LABEL_STRATEGIA_SOLIDA, "T1: score solido");
const recNotReady = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readiness({
    paginaFacebookId: "",
    moduloContattiId: "",
    clienteHaApprovato: true,
  }),
  haErroriBloccantiPreLancio: false,
  objective: "LEADS",
});
assert(recNotReady.stato === "NOT_READY", `T1: NOT_READY (got ${recNotReady.stato})`);
assert(recNotReady.title === "Non lancerei ancora.", "T1: guidance Non lancerei ancora");
const headerNr = copyHeaderStep6(recNotReady.stato);
assert(headerNr.titolo === "Configurazione da completare", "T1: header");
assert(
  etichettaStepperStep6(recNotReady.stato) === "Da completare",
  "T1: stepper Da completare",
);
assert(csvMetaHaCopyEsportabile(configBase), "T1: CSV generabile (copy presente)");
const exportNr = etichetteExportMeta({
  statoLancio: recNotReady.stato,
  haCopyExport: true,
  pageIdMancante: true,
  formIdMancante: true,
});
assert(exportNr.labelCta === LABEL_EXPORT_BOZZA, "T1: CTA bozza");
assert(exportNr.exportAbilitato, "T1: CTA enabled");
assert(
  exportNr.microcopy === MICROCOPY_EXPORT_PAGE_FORM,
  `T1: warning Page/Form (got ${exportNr.microcopy})`,
);
assert(
  !exportNr.labelCta.toLowerCase().includes("pronta"),
  "T1: CTA non dice pronta",
);

console.log("\n=== TEST 2 — READY_WITH_CAUTION, CSV generabile ===");
const recCaution = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readiness({ clienteHaApprovato: false }),
  haErroriBloccantiPreLancio: false,
  objective: "LEADS",
});
assert(
  recCaution.stato === "READY_WITH_CAUTION",
  `T2: READY_WITH_CAUTION (got ${recCaution.stato})`,
);
const headerC = copyHeaderStep6(recCaution.stato);
assert(headerC.titolo === "Configurazione quasi pronta", "T2: header");
assert(
  etichettaStepperStep6(recCaution.stato) === "Da verificare",
  "T2: stepper Da verificare",
);
const exportC = etichetteExportMeta({
  statoLancio: recCaution.stato,
  haCopyExport: true,
  pageIdMancante: false,
  formIdMancante: false,
});
assert(exportC.labelCta === LABEL_EXPORT_BOZZA, "T2: CTA bozza");
assert(exportC.exportAbilitato, "T2: CTA enabled");
assert(!exportC.labelCta.toLowerCase().includes("pronta"), "T2: non dice Campagna pronta");

console.log("\n=== TEST 3 — READY_TO_LAUNCH ===");
const recReady = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readiness(),
  haErroriBloccantiPreLancio: false,
  objective: "LEADS",
});
assert(recReady.stato === "READY_TO_LAUNCH", `T3: READY_TO_LAUNCH (got ${recReady.stato})`);
const headerR = copyHeaderStep6(recReady.stato);
assert(headerR.titolo === "Campagna pronta", "T3: header");
assert(etichettaStepperStep6(recReady.stato) === "Pronta", "T3: stepper Pronta");
const exportR = etichetteExportMeta({
  statoLancio: recReady.stato,
  haCopyExport: true,
});
assert(exportR.labelCta === LABEL_EXPORT_PRONTA, "T3: CTA pronta");
assert(exportR.microcopy === MICROCOPY_EXPORT_PRONTA, "T3: microcopy completa");
assert(exportR.exportAbilitato, "T3: CTA enabled");

console.log("\n=== TEST 4 — APPROVED + NOT_READY: approval ≠ ready ===");
assert(recNotReady.stato === "NOT_READY", "T4: lancio NOT_READY");
assert(
  readiness({
    paginaFacebookId: "",
    moduloContattiId: "",
    clienteHaApprovato: true,
  }).items.find((i) => i.id === "approvazione")?.ok === true,
  "T4: approval item ok",
);
assert(
  srcPercorso.includes("statoApprovazioneLeads") &&
    srcPercorso.includes("copyHeaderStep6"),
  "T4: PercorsoContatti tiene approval e header separati",
);

console.log("\n=== TEST 5 — Page/Form vuoti: CSV si genera ===");
const csvVuoto = generaCodiceImportMeta(configBase, "Roma", "", "", "LEADS");
assert(!csvVuoto.trim(), "T5: senza Form ID il CSV non è un export valido");
assert(csvMetaHaCopyEsportabile(configBase), "T5: ha copy esportabile");
const exportT5 = etichetteExportMeta({
  statoLancio: "NOT_READY",
  haCopyExport: true,
  pageIdMancante: true,
  formIdMancante: true,
});
assert(exportT5.exportAbilitato, "T5: etichette lancio ancora distinte dall'export CSV");

console.log("\n=== TEST 6 — vero blocker: copy assente ===");
assert(
  !csvMetaHaCopyEsportabile({
    varianteA: "",
    varianteB: "  ",
    varianteC: "",
  }),
  "T6: senza copy il generatore userebbe placeholder",
);
const exportBlocco = etichetteExportMeta({
  statoLancio: "READY_TO_LAUNCH",
  haCopyExport: false,
});
assert(!exportBlocco.exportAbilitato, "T6: CTA disabled");
assert(
  exportBlocco.motivoBlocco?.includes("testo annuncio"),
  "T6: motivo copy mancante",
);

console.log("\n=== TEST 7 — PannelloAssetStrategia stessa regola ===");
assert(
  srcPannello.includes("etichetteExportMeta"),
  "T7: dettaglio usa etichetteExportMeta",
);
assert(
  srcPannello.includes("raccomandaLancio"),
  "T7: dettaglio usa raccomandaLancio, non un secondo motore",
);
assert(
  srcPannello.includes("BloccoPreExport"),
  "T7: dettaglio mostra readiness pre-export",
);
assert(
  !srcPannello.includes("🚀 Esporta Campagna Pronta per Meta"),
  "T7: niente CTA pronta hardcoded",
);
assert(
  srcPercorso.includes("copyHeaderStep6") &&
    srcPercorso.includes("etichettaStepperStep6"),
  "T7: wizard usa gli stessi helper di copy",
);

if (falliti > 0) {
  console.error(`\n${falliti} test falliti`);
  process.exit(1);
}
console.log("\nTutti i test Step 6 consistency sono passati.");
