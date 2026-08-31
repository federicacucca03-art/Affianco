/**
 * Verifica Guidance P1 — qualità offerta/brief Step 1 (deterministico, no AI).
 * Esegui: npx tsx scripts/verifica-guidance-p1-step1.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generaGuidanceStep1,
  haGuidanceDaMostrare,
  selezionaGuidanceDaMostrare,
} from "@/lib/guidance";
import {
  rilevaMismatchOffertaBrief,
  valutaQualitaBrief,
  valutaQualitaOfferta,
} from "@/lib/qualita-step1";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "OFFER QUALITY": true,
  "BRIEF QUALITY": true,
  "OFFER/BRIEF MISMATCH": true,
  "AURORA SILENT": true,
  "NEGATIVE TESTS": true,
  "GUIDANCE PRIORITY": true,
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

const AURORA_OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const AURORA_BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia. Il target principale sono adulti che hanno perso uno o più denti o stanno valutando una soluzione fissa. L’obiettivo è generare richieste di prima visita qualificate, con una comunicazione rassicurante e professionale, evitando promesse di risultato o toni troppo aggressivi.";

console.log("=== OFFER QUALITY ===");
mark(
  "OFFER QUALITY",
  valutaQualitaOfferta(AURORA_OFFERTA) === "GOOD",
  "Aurora → GOOD",
);
mark(
  "OFFER QUALITY",
  valutaQualitaOfferta("Servizi di qualità") === "GENERIC",
  "Servizi di qualità → GENERIC",
);
mark(
  "OFFER QUALITY",
  valutaQualitaOfferta("Dentista") === "TOO_SHORT",
  "Dentista → TOO_SHORT",
);
mark(
  "OFFER QUALITY",
  valutaQualitaOfferta("Sbiancamento dentale") === "GOOD",
  "Sbiancamento dentale → GOOD (non penalizzata solo perché corta)",
);
mark(
  "OFFER QUALITY",
  valutaQualitaOfferta("Prima visita implantologica") === "GOOD",
  "Prima visita implantologica → GOOD",
);

console.log("\n=== BRIEF QUALITY ===");
mark(
  "BRIEF QUALITY",
  valutaQualitaBrief(AURORA_BRIEF) === "GOOD",
  "Aurora → GOOD",
);
mark(
  "BRIEF QUALITY",
  valutaQualitaBrief("Voglio più clienti") === "TOO_SHORT" ||
    valutaQualitaBrief("Voglio più clienti") === "INCOMPLETE",
  "Voglio più clienti → TOO_SHORT o INCOMPLETE",
);
mark(
  "BRIEF QUALITY",
  valutaQualitaBrief("Voglio più clienti") === "TOO_SHORT",
  "Voglio più clienti (< 8 parole) → TOO_SHORT",
);
mark(
  "BRIEF QUALITY",
  valutaQualitaBrief("") === "TOO_SHORT",
  "Brief vuoto → TOO_SHORT",
);

console.log("\n=== OFFER/BRIEF MISMATCH ===");
mark(
  "OFFER/BRIEF MISMATCH",
  rilevaMismatchOffertaBrief(AURORA_OFFERTA, AURORA_BRIEF) === false,
  "Aurora: implantologia in entrambi → mismatch false",
);
mark(
  "OFFER/BRIEF MISMATCH",
  rilevaMismatchOffertaBrief(
    "Prima visita implantologica",
    "Campagna per sbiancamento dentale",
  ) === true,
  "implantologica vs sbiancamento → mismatch true",
);
mark(
  "OFFER/BRIEF MISMATCH",
  rilevaMismatchOffertaBrief("Dentista", AURORA_BRIEF) === false,
  "offerta TOO_SHORT → nessun mismatch",
);

console.log("\n=== AURORA SILENT ===");
const auroraStep1 = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
mark(
  "AURORA SILENT",
  auroraStep1.length === 0,
  "nessuna guidance offerta/brief",
);
mark(
  "AURORA SILENT",
  !haGuidanceDaMostrare(auroraStep1),
  "card Step 1 non visibile (età non universale)",
);
mark(
  "AURORA SILENT",
  !auroraStep1.some((i) => i.id.startsWith("step1-offerta") || i.id === "step1-brief-corto" || i.id === "step1-mismatch"),
  "nessun item offerta/brief/mismatch",
);

console.log("\n=== NEGATIVE TESTS ===");
const negA = generaGuidanceStep1({
  frontEndOffer: "Servizi di qualità",
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
mark(
  "NEGATIVE TESTS",
  valutaQualitaOfferta("Servizi di qualità") === "GENERIC" &&
    negA.some(
      (i) =>
        i.id === "step1-offerta-generica" &&
        i.title === "Rendi l'offerta più specifica.",
    ),
  "A: GENERIC + Rendi l'offerta più specifica.",
);

const negB = generaGuidanceStep1({
  frontEndOffer: "Dentista",
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
mark(
  "NEGATIVE TESTS",
  valutaQualitaOfferta("Dentista") === "TOO_SHORT" &&
    negB.some(
      (i) =>
        i.id === "step1-offerta-poco-chiara" &&
        i.title === "Chiarisci meglio l'offerta.",
    ),
  "B: TOO_SHORT + Chiarisci meglio l'offerta.",
);

const negC = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: "Voglio più clienti",
  targetAge: "25-50",
});
mark(
  "NEGATIVE TESTS",
  (valutaQualitaBrief("Voglio più clienti") === "TOO_SHORT" ||
    valutaQualitaBrief("Voglio più clienti") === "INCOMPLETE") &&
    negC.some(
      (i) =>
        i.id === "step1-brief-corto" &&
        i.title === "Il brief può guidare meglio Affianco.",
    ),
  "C: brief corto/incompleto + Il brief può guidare meglio Affianco.",
);

const negD = generaGuidanceStep1({
  frontEndOffer: "Prima visita implantologica",
  elevatorPitch: "Campagna per sbiancamento dentale",
  targetAge: "25-50",
});
const visD = selezionaGuidanceDaMostrare(negD);
mark(
  "NEGATIVE TESTS",
  rilevaMismatchOffertaBrief(
    "Prima visita implantologica",
    "Campagna per sbiancamento dentale",
  ) === true &&
    visD.principale?.level === "WARNING" &&
    visD.principale?.title === "Offerta e brief non sembrano allineati.",
  "D: mismatch WARNING principale",
);

const negE = generaGuidanceStep1({
  frontEndOffer: "Sbiancamento dentale",
  elevatorPitch: AURORA_BRIEF.replace(/implantologia/g, "sbiancamento dentale"),
  targetAge: "25-50",
});
mark(
  "NEGATIVE TESTS",
  valutaQualitaOfferta("Sbiancamento dentale") === "GOOD" &&
    !negE.some(
      (i) =>
        i.id === "step1-offerta-generica" || i.id === "step1-offerta-poco-chiara",
    ),
  "E: Sbiancamento dentale GOOD, nessuna guidance offerta",
);

console.log("\n=== GUIDANCE PRIORITY ===");
const priorita = generaGuidanceStep1({
  frontEndOffer: "Servizi di qualità per lo sbiancamento",
  elevatorPitch: "Campagna per implantologia dentale",
  targetAge: "all",
});
const visP = selezionaGuidanceDaMostrare(priorita);
mark(
  "GUIDANCE PRIORITY",
  visP.principale?.id === "step1-mismatch" && visP.principale.level === "WARNING",
  "1. WARNING mismatch è principale",
);
mark(
  "GUIDANCE PRIORITY",
  visP.secondari[0]?.id === "step1-offerta-generica" ||
    visP.secondari[0]?.id === "step1-offerta-poco-chiara",
  "2. offerta qualità prima dei secondari",
);
mark(
  "GUIDANCE PRIORITY",
  visP.secondari.some((i) => i.id === "step1-brief-corto"),
  "3. brief qualità tra i secondari",
);
mark(
  "GUIDANCE PRIORITY",
  visP.secondari.length <= 2,
  "max 2 secondari",
);
mark(
  "GUIDANCE PRIORITY",
  !visP.secondari.some((i) => i.id === "step1-eta-ampia"),
  "4. target età ampia dopo offerta/brief (non entra nei 2 secondari)",
);

const soloEta = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "all",
});
const visEta = selezionaGuidanceDaMostrare(soloEta);
mark(
  "GUIDANCE PRIORITY",
  visEta.principale?.id === "step1-eta-ampia",
  "senza offerta/brief/mismatch resta la guidance P0 età",
);

const srcSuggerisce = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/AffiancoSuggerisce.tsx"),
  "utf8",
);
mark(
  "GUIDANCE PRIORITY",
  srcSuggerisce.includes("if (!haGuidanceDaMostrare(items)) return null") &&
    !srcSuggerisce.includes("Tutto ok"),
  "nessuna card Tutto ok",
);

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

console.log("\n=== REGRESSIONI (statiche) ===");
const srcPercorso = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/PercorsoContatti.tsx"),
  "utf8",
);
markReg(
  srcPercorso.includes("const offertaOk = Boolean(frontEndOffer.trim())") &&
    srcPercorso.includes(
      "const briefOk = !isEcommerce || Boolean(elevatorPitch.trim())",
    ),
  "Step 1 Continua: LEADS ancora nome + offerta (brief solo e-commerce)",
);

const srcPitch = readFileSync(
  join(process.cwd(), "src/lib/validate-elevator-pitch.ts"),
  "utf8",
);
markReg(
  srcPitch.includes("ECOMMERCE_DETTAGLIO_REGEX") &&
    srcPitch.includes("export function validateElevatorPitch"),
  "validateElevatorPitch e-commerce invariato nel file",
);

const srcChecker = readFileSync(
  join(process.cwd(), "src/lib/controllo-messaggio.ts"),
  "utf8",
);
markReg(
  !srcChecker.includes("qualita-step1") &&
    !srcChecker.includes("valutaQualitaOfferta"),
  "semantic checker Step 3 non importa qualità Step 1",
);

const srcScore = readFileSync(
  join(process.cwd(), "src/lib/strategic-score.ts"),
  "utf8",
);
const srcReady = readFileSync(
  join(process.cwd(), "src/lib/launch-readiness.ts"),
  "utf8",
);
markReg(
  !srcScore.includes("qualita-step1") && !srcReady.includes("qualita-step1"),
  "Strategic Score e Launch Readiness non usano qualità Step 1",
);

const srcGuidance = readFileSync(
  join(process.cwd(), "src/lib/guidance.ts"),
  "utf8",
);
markReg(
  srcGuidance.includes("raccomandaLancio") &&
    !srcGuidance.includes("OFFERTA_CORTA_MAX_CHARS") &&
    !srcGuidance.includes("length < 24") &&
    !srcGuidance.includes("length < 40"),
  "euristiche 24/40 caratteri rimosse da guidance Step 1",
);

const srcQualita = readFileSync(
  join(process.cwd(), "src/lib/qualita-step1.ts"),
  "utf8",
);
markReg(
  !srcQualita.includes('from "@/lib/controllo-messaggio"') &&
    !srcQualita.includes("campaign_checks"),
  "qualità Step 1 isolata da checker e campaign_checks",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite`);
  process.exit(1);
}
console.log(
  `\nTutti i test Guidance P1 Step 1 sono passati.${regressioniOk ? "" : ""}`,
);
