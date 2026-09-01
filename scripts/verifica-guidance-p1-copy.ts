/**
 * Verifica Guidance P1 — raccomandazione copy A/B/C (LEADS).
 * Esegui: npx tsx scripts/verifica-guidance-p1-copy.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analizzaControlloMessaggioLeads } from "@/lib/controllo-messaggio";
import { raccomandaCopy } from "@/lib/raccomanda-copy";
import type { CampagnaObjective } from "@/types/campagne";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "B CONSIGLIATA": true,
  TIE: true,
  "HARD FAIL TUTTE": true,
  "TESTO VUOTO": true,
  MISMATCH: true,
  "CTA ASSENTE": true,
  "TERMINE INVENTATO": true,
  "NO PERFORMANCE": true,
  "SOLO LEADS": true,
  "CHECKER STEP 3 A": true,
  RANKING: true,
};

function mark(sezione: keyof typeof esiti, ok: boolean, msg: string) {
  if (!ok) {
    falliti += 1;
    esiti[sezione] = false;
    console.error(`FAIL  [${sezione}] ${msg}`);
  } else {
    console.log(`PASS  [${sezione}] ${msg}`);
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

const BASE = {
  titoloAnnuncio: "Prima visita implantologica a Roma",
  offerta: AURORA_OFFERTA,
  brief: AURORA_BRIEF,
  citta: "Roma",
  settore: "Dentista",
  objective: "LEADS" as const,
};

const TESTO_B =
  "Stai valutando una soluzione per uno o più denti mancanti? Richiedi una prima visita implantologica con valutazione del caso e piano di trattamento personalizzato.";
const TESTO_A_GENERICO =
  "Siamo uno studio di qualità. Scopri di più sulla nostra esperienza.";
const TESTO_C_INVENTATO =
  "Stai valutando una soluzione per denti mancanti? Richiedi una prima visita implantologica con scansione 3D e tasso zero.";
const TESTO_SOLIDO =
  "Stai valutando una soluzione per uno o più denti mancanti a Roma? Richiedi una prima visita implantologica con valutazione del caso e piano di trattamento personalizzato.";
const TESTO_SOLIDO_SENZA_CITTA =
  "Stai valutando una soluzione per uno o più denti mancanti? Richiedi una prima visita implantologica con valutazione del caso e piano di trattamento personalizzato.";
const TESTO_SENZA_CTA =
  "Siamo a Roma da anni. Il trattamento implantologico è pensato per chi ha perso uno o più denti.";
const TESTO_MISMATCH =
  "Siamo uno studio di qualità a Roma. Richiedi informazioni sulla nostra esperienza professionale.";

const LINGUAGGIO_PERFORMANCE = [
  "converte meglio",
  "performa meglio",
  "cpl più basso",
  "ctr più alto",
  "più efficace",
  "performerà meglio",
  "performera meglio",
];

function testoHaPerformance(t: string): boolean {
  const lower = t.toLowerCase();
  return LINGUAGGIO_PERFORMANCE.some((p) => lower.includes(p));
}

const srcHelper = src("src/lib/raccomanda-copy.ts");
const srcCard = src("src/components/nuova-contatti/CopyRecommendationCard.tsx");
const srcForm = src("src/components/nuova-contatti/FormConfigurazione.tsx");
const srcChecker = src("src/lib/controllo-messaggio.ts");
const srcControlloUi = src(
  "src/components/nuova-contatti/ControlloMessaggio.tsx",
);

console.log("=== B CONSIGLIATA (Aurora) ===");
const aurora = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_A_GENERICO,
  varianteB: TESTO_B,
  varianteC: TESTO_C_INVENTATO,
});
mark("B CONSIGLIATA", aurora != null, "recommendation presente per LEADS");
mark(
  "B CONSIGLIATA",
  JSON.stringify(aurora?.recommendedVariants) === JSON.stringify(["B"]),
  `recommendedVariants = ["B"] (got ${JSON.stringify(aurora?.recommendedVariants)})`,
);
mark(
  "B CONSIGLIATA",
  aurora?.title === "Variante B",
  `title Variante B (got ${aurora?.title})`,
);
const motiviJoin = (aurora?.reasons ?? []).join(" | ").toLowerCase();
mark(
  "B CONSIGLIATA",
  motiviJoin.includes("coerent") &&
    motiviJoin.includes("cta") &&
    motiviJoin.includes("incoerent"),
  `motivi coerente/CTA/incoerente: ${aurora?.reasons.join(" | ")}`,
);
mark(
  "B CONSIGLIATA",
  !testoHaPerformance(
    `${aurora?.title} ${aurora?.description} ${(aurora?.reasons ?? []).join(" ")}`,
  ),
  "nessun claim di performance in output Aurora",
);
mark(
  "B CONSIGLIATA",
  aurora?.profiles.find((p) => p.variant === "B")?.status === "RECOMMENDED" &&
    aurora?.profiles.find((p) => p.variant === "A")?.hardFail === true &&
    aurora?.profiles.find((p) => p.variant === "C")?.hardFail === true,
  "B RECOMMENDED, A e C hard fail",
);

console.log("\n=== TIE A/B ===");
const tie = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_INVENTATO,
});
mark(
  "TIE",
  JSON.stringify(tie?.recommendedVariants) === JSON.stringify(["A", "B"]),
  `recommendedVariants ["A","B"] (got ${JSON.stringify(tie?.recommendedVariants)})`,
);
mark(
  "TIE",
  tie?.description === "Varianti A e B sono entrambe solide.",
  `description tie (got ${tie?.description})`,
);
mark(
  "TIE",
  tie?.title === "Varianti A e B",
  `title Varianti A e B (got ${tie?.title})`,
);
mark(
  "TIE",
  tie?.profiles.find((p) => p.variant === "A")?.status === "RECOMMENDED" &&
    tie?.profiles.find((p) => p.variant === "B")?.status === "RECOMMENDED" &&
    tie?.profiles.find((p) => p.variant === "C")?.status === "REVIEW",
  "A e B Consigliata, C Da rivedere",
);

console.log("\n=== HARD FAIL TUTTE ===");
const tutteFail = raccomandaCopy({
  ...BASE,
  varianteA: "",
  varianteB: TESTO_MISMATCH,
  varianteC: TESTO_SENZA_CTA,
});
mark(
  "HARD FAIL TUTTE",
  tutteFail != null && tutteFail.recommendedVariants.length === 0,
  "nessuna variante consigliata",
);
mark(
  "HARD FAIL TUTTE",
  tutteFail?.title === "Nessuna variante è ancora pronta.",
  "title nessuna pronta",
);
mark(
  "HARD FAIL TUTTE",
  tutteFail?.description ===
    "Rivedi i testi segnalati prima di scegliere quale usare.",
  "description rivedi i testi",
);
mark(
  "HARD FAIL TUTTE",
  tutteFail?.profiles.every((p) => p.hardFail && p.status === "REVIEW") ===
    true,
  "tutti i profili REVIEW / hardFail",
);

console.log("\n=== TESTO VUOTO ===");
const vuoto = raccomandaCopy({
  ...BASE,
  varianteA: "   ",
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_INVENTATO,
});
mark(
  "TESTO VUOTO",
  vuoto?.profiles.find((p) => p.variant === "A")?.hardFail === true,
  "A vuota esclusa",
);
mark(
  "TESTO VUOTO",
  JSON.stringify(vuoto?.recommendedVariants) === JSON.stringify(["B"]),
  "solo B consigliata se A è vuota",
);

console.log("\n=== MISMATCH ===");
const mismatch = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_MISMATCH,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_SOLIDO,
});
const profiloMismatch = mismatch?.profiles.find((p) => p.variant === "A");
mark(
  "MISMATCH",
  profiloMismatch?.hardFail === true &&
    profiloMismatch?.coherence === "yellow",
  "mismatch offerta → hard fail",
);
mark(
  "MISMATCH",
  !mismatch?.recommendedVariants.includes("A"),
  "A mismatch non è consigliata",
);

console.log("\n=== CTA ASSENTE ===");
const noCta = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_SENZA_CTA,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_INVENTATO,
});
const profiloNoCta = noCta?.profiles.find((p) => p.variant === "A");
mark(
  "CTA ASSENTE",
  profiloNoCta?.hardFail === true && profiloNoCta?.cta === "missing",
  "CTA assente → hard fail",
);
mark(
  "CTA ASSENTE",
  !noCta?.recommendedVariants.includes("A"),
  "variante senza CTA non consigliata",
);

console.log("\n=== TERMINE INVENTATO ===");
const checkerInventato = analizzaControlloMessaggioLeads({
  testoVarianteA: TESTO_C_INVENTATO,
  headline: BASE.titoloAnnuncio,
  citta: BASE.citta,
  frontEndOffer: BASE.offerta,
  brief: BASE.brief,
  settore: BASE.settore,
});
const coerenzaInventato = checkerInventato.voci.find((v) => v.id === "coerenza");
mark(
  "TERMINE INVENTATO",
  coerenzaInventato?.emoji === "🟡",
  "checker attuale intercetta scansione 3D / tasso zero",
);
const inventato = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_SOLIDO,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_INVENTATO,
});
mark(
  "TERMINE INVENTATO",
  inventato?.profiles.find((p) => p.variant === "C")?.hardFail === true &&
    inventato?.profiles.find((p) => p.variant === "C")?.status === "REVIEW",
  "termine inventato → Da rivedere",
);

console.log("\n=== RANKING ===");
const ranking = raccomandaCopy({
  ...BASE,
  varianteA: TESTO_SOLIDO_SENZA_CITTA,
  varianteB: TESTO_SOLIDO,
  varianteC: TESTO_C_INVENTATO,
});
mark(
  "RANKING",
  JSON.stringify(ranking?.recommendedVariants) === JSON.stringify(["B"]),
  `hook migliore vince tra valide (got ${JSON.stringify(ranking?.recommendedVariants)})`,
);
mark(
  "RANKING",
  ranking?.profiles.find((p) => p.variant === "A")?.hardFail === false &&
    ranking?.profiles.find((p) => p.variant === "A")?.status === "ALTERNATIVE",
  "A valida ma alternativa (tie-break hook, non ordine A/B/C)",
);

console.log("\n=== NO PERFORMANCE ===");
mark(
  "NO PERFORMANCE",
  !testoHaPerformance(srcHelper) && !testoHaPerformance(srcCard),
  "helper e card senza linguaggio performance",
);
mark(
  "NO PERFORMANCE",
  srcHelper.includes("analizzaControlloMessaggioLeads") &&
    !srcHelper.includes("TERMINI_RISCHIO_INVENTATI") &&
    !srcHelper.includes("CTA_VERBO"),
  "riusa il checker, non duplica le regole",
);
mark(
  "NO PERFORMANCE",
  srcHelper.includes("promesse di risultato non coperte dal checker") &&
    !srcHelper.includes("tono") &&
    !srcHelper.includes("TonoVoce"),
  "limite promesse documentato; tono assente dal ranking",
);

console.log("\n=== SOLO LEADS ===");
const altri: CampagnaObjective[] = [
  "BOOKINGS",
  "IN_STORE",
  "AWARENESS",
  "ECOMMERCE",
  "RETARGETING",
];
for (const objective of altri) {
  mark(
    "SOLO LEADS",
    raccomandaCopy({
      ...BASE,
      objective,
      varianteA: TESTO_SOLIDO,
      varianteB: TESTO_SOLIDO,
      varianteC: TESTO_SOLIDO,
    }) === null,
    `nessuna recommendation per ${objective}`,
  );
}
mark(
  "SOLO LEADS",
  srcForm.includes("{isPercorsoLeads ? (") &&
    srcForm.includes("<CopyRecommendationCard") &&
    srcForm.indexOf("<CopyRecommendationCard") >
      srcForm.indexOf("Troviamo il messaggio") &&
    srcForm.indexOf("<CopyRecommendationCard") <
      srcForm.indexOf("Usata per il lancio"),
  "card solo in Step 3 LEADS, sopra le varianti",
);

console.log("\n=== CHECKER STEP 3 A ===");
const idxCheckerA = srcForm.indexOf(
  "isPercorsoLeads && controlloMessaggioLeads",
);
const idxDetails = srcForm.indexOf("Hai esigenze particolari?");
const bloccoA = srcForm.slice(0, idxDetails);
const bloccoBC = srcForm.slice(idxDetails);
mark(
  "CHECKER STEP 3 A",
  srcForm.includes("testoVarianteA: valoriVarianti[0]") &&
    idxCheckerA > 0 &&
    idxCheckerA < idxDetails &&
    bloccoA.includes("<ControlloMessaggio") &&
    !bloccoBC.includes("<ControlloMessaggio"),
  "checker visuale ancora solo sotto Variante A",
);
mark(
  "CHECKER STEP 3 A",
  bloccoA.includes("Usata per il lancio"),
  "badge Usata per il lancio invariato su A",
);
mark(
  "CHECKER STEP 3 A",
  srcCard.includes("Consigliata") &&
    srcCard.includes("Alternativa") &&
    srcCard.includes("Da rivedere"),
  "badge Consigliata / Alternativa / Da rivedere",
);
mark(
  "CHECKER STEP 3 A",
  !srcChecker.includes("raccomanda-copy") &&
    srcHelper.includes('from "@/lib/controllo-messaggio"') &&
    srcControlloUi.includes("Controllo messaggio"),
  "controllo-messaggio.ts e UI checker non dipendono dalla recommendation",
);

console.log("\n=== REGRESSIONI STATICHE ===");
let regressioniOk = true;
function markReg(ok: boolean, msg: string) {
  if (!ok) {
    falliti += 1;
    regressioniOk = false;
    console.error(`FAIL  [REGRESSIONS] ${msg}`);
  } else {
    console.log(`PASS  [REGRESSIONS] ${msg}`);
  }
}

markReg(
  srcForm.includes("onCambiaTonoVoce") && srcForm.includes("Rigenera varianti"),
  "tono e rigenera varianti ancora nello Step 3",
);
markReg(
  !srcHelper.includes("supabase") && !srcCard.includes("supabase"),
  "recommendation non salva nel DB",
);
markReg(
  !src("src/lib/guidance.ts").includes("raccomanda-copy") &&
    !src("src/lib/strategic-score.ts").includes("raccomanda-copy") &&
    !src("src/lib/launch-readiness.ts").includes("raccomanda-copy"),
  "guidance P0, Strategic Score e Launch Readiness non importano la recommendation copy",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite`);
  process.exit(1);
}
console.log(
  `\nTutti i test Guidance P1 copy sono passati.${regressioniOk ? "" : ""}`,
);
