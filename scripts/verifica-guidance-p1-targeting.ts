/**
 * Verifica Guidance P1 targeting contestuale.
 * Esegui: npx tsx scripts/verifica-guidance-p1-targeting.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  guidanceInlineBudgetRaggio,
  guidanceInlineCitta,
  guidanceInlineRaggio,
  guidanceInlineTargetType,
  guidanceStep1NonInline,
} from "@/components/nuova-contatti/InlineGuidance";
import {
  generaGuidanceStep1,
  generaGuidanceTargeting,
} from "@/lib/guidance";
import {
  budgetRaggioDispersivo,
  cittaLocaleMancante,
  raggioMoltoStretto,
  rilevaMismatchTargetType,
} from "@/lib/qualita-targeting";

let falliti = 0;
const esiti: Record<string, boolean> = {
  "CITY GUIDANCE": true,
  "RADIUS GUIDANCE": true,
  "BUDGET/RADIUS GUIDANCE": true,
  "B2C/B2B GUIDANCE": true,
  "INLINE PLACEMENT": true,
  "AURORA SILENT": true,
  "NEGATIVE TESTS": true,
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

const srcForm = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/FormConfigurazione.tsx"),
  "utf8",
);
const srcTargeting = readFileSync(
  join(process.cwd(), "src/lib/qualita-targeting.ts"),
  "utf8",
);
const srcPreLancio = readFileSync(
  join(process.cwd(), "src/lib/pre-lancio-check.ts"),
  "utf8",
);
const srcQualita = readFileSync(
  join(process.cwd(), "src/lib/qualita-step1.ts"),
  "utf8",
);

console.log("=== CITY GUIDANCE ===");
mark(
  "CITY GUIDANCE",
  cittaLocaleMancante("LEADS", "") &&
    cittaLocaleMancante("LEADS", "   ") &&
    !cittaLocaleMancante("LEADS", "Milano") &&
    !cittaLocaleMancante("ECOMMERCE", ""),
  "città vuota solo su objective locale",
);
const gCity = generaGuidanceTargeting({
  objective: "LEADS",
  citta: "",
  raggioKm: 20,
  budgetGiornaliero: 41,
  targetType: "B2C",
  elevatorPitch: AURORA_BRIEF,
});
mark(
  "CITY GUIDANCE",
  gCity.some(
    (i) =>
      i.id === "step1-citta-assente" &&
      i.title === "Manca la zona della campagna." &&
      i.field === "citta" &&
      i.step === 1,
  ),
  "TEST G: copy e field/step città",
);

console.log("\n=== RADIUS GUIDANCE ===");
mark(
  "RADIUS GUIDANCE",
  raggioMoltoStretto("LEADS", 2) &&
    raggioMoltoStretto("IN_STORE", 3) &&
    !raggioMoltoStretto("LEADS", 4) &&
    !raggioMoltoStretto("ECOMMERCE", 2),
  "raggio <= 3 solo locale",
);
const gRaggio = generaGuidanceTargeting({
  objective: "LEADS",
  citta: "Milano",
  raggioKm: 2,
  budgetGiornaliero: 41,
  targetType: "B2C",
  elevatorPitch: AURORA_BRIEF,
});
mark(
  "RADIUS GUIDANCE",
  gRaggio.some(
    (i) =>
      i.id === "targeting-raggio-stretto" &&
      i.title === "Il raggio è molto ristretto." &&
      i.field === "raggioKm" &&
      i.step === 2,
  ),
  "TEST C: LEADS raggio stretto → Step 2",
);
const gRaggioInstore = generaGuidanceTargeting({
  objective: "IN_STORE",
  citta: "Milano",
  raggioKm: 2,
  budgetGiornaliero: 41,
});
mark(
  "RADIUS GUIDANCE",
  gRaggioInstore.some(
    (i) => i.id === "targeting-raggio-stretto" && i.step === 1,
  ),
  "INSTORE raggio stretto → Step 1",
);

console.log("\n=== BUDGET/RADIUS GUIDANCE ===");
mark(
  "BUDGET/RADIUS GUIDANCE",
  budgetRaggioDispersivo("LEADS", 15, 60) &&
    !budgetRaggioDispersivo("LEADS", 40, 60) &&
    !budgetRaggioDispersivo("LEADS", 15, 20) &&
    !budgetRaggioDispersivo("ECOMMERCE", 15, 60),
  "dispersivo solo 15€ + 50km+ locale",
);
const gDisp = generaGuidanceTargeting({
  objective: "LEADS",
  citta: "Milano",
  raggioKm: 60,
  budgetGiornaliero: 15,
  targetType: "B2C",
});
mark(
  "BUDGET/RADIUS GUIDANCE",
  gDisp.some(
    (i) =>
      i.id === "targeting-budget-raggio" &&
      i.title ===
        "Il pubblico potrebbe essere dispersivo rispetto al budget." &&
      i.field === "budgetGiornaliero" &&
      i.step === 2,
  ) && !gDisp.some((i) => i.id === "targeting-raggio-stretto"),
  "TEST D: un solo messaggio, niente raggio ampio duplicato",
);
mark(
  "BUDGET/RADIUS GUIDANCE",
  generaGuidanceTargeting({
    objective: "LEADS",
    citta: "Milano",
    raggioKm: 60,
    budgetGiornaliero: 40,
  }).every((i) => i.id !== "targeting-budget-raggio"),
  "TEST E: 40€ / 60 km → niente",
);
mark(
  "BUDGET/RADIUS GUIDANCE",
  generaGuidanceTargeting({
    objective: "LEADS",
    citta: "Milano",
    raggioKm: 20,
    budgetGiornaliero: 15,
  }).every((i) => i.id !== "targeting-budget-raggio"),
  "TEST F: 15€ / 20 km → niente",
);

console.log("\n=== B2C/B2B GUIDANCE ===");
mark(
  "B2C/B2B GUIDANCE",
  rilevaMismatchTargetType(
    "B2C",
    "Target responsabili acquisti e buyer di aziende manifatturiere",
  ) === "B2B",
  "TEST A: B2C + brief B2B",
);
mark(
  "B2C/B2B GUIDANCE",
  rilevaMismatchTargetType(
    "B2B",
    "Genitori e famiglie con bambini piccoli",
  ) === "B2C",
  "TEST B: B2B + brief B2C",
);
mark(
  "B2C/B2B GUIDANCE",
  rilevaMismatchTargetType("B2C", AURORA_BRIEF) === null &&
    rilevaMismatchTargetType("B2C", "Comunicazione professionale e chiara") ===
      null,
  "niente mismatch su tono professionale / Aurora",
);
const gA = generaGuidanceTargeting({
  objective: "LEADS",
  citta: "Milano",
  raggioKm: 20,
  budgetGiornaliero: 41,
  targetType: "B2C",
  elevatorPitch:
    "Target responsabili acquisti e buyer di aziende manifatturiere",
});
mark(
  "B2C/B2B GUIDANCE",
  gA.some(
    (i) =>
      i.id === "step1-target-type-mismatch" &&
      i.title === "Il brief sembra descrivere un pubblico B2B." &&
      i.field === "targetType" &&
      i.step === 1,
  ),
  "TEST A: copy SUGGESTION sotto tipo cliente",
);

console.log("\n=== INLINE PLACEMENT ===");
mark(
  "INLINE PLACEMENT",
  srcForm.includes("<InlineGuidance item={guidanceCitta} />") &&
    srcForm.includes("<InlineGuidance item={guidanceTipoCliente} />") &&
    srcForm.includes("<InlineGuidance item={guidanceRaggio} />") &&
    srcForm.includes("<InlineGuidance item={guidanceBudgetRaggio} />"),
  "inline città, tipo cliente, raggio, budget",
);
mark(
  "INLINE PLACEMENT",
  srcForm.includes("<AffiancoSuggerisce items={guidanceEconomica} />") &&
    !srcForm.includes("<AffiancoSuggerisce items={guidanceTargeting} />"),
  "targeting non va nella card generale",
);
mark(
  "INLINE PLACEMENT",
  guidanceStep1NonInline(gCity).length === 0 &&
    guidanceStep1NonInline(gA).length === 0 &&
    guidanceInlineCitta(gCity)?.id === "step1-citta-assente" &&
    guidanceInlineTargetType(gA)?.id === "step1-target-type-mismatch" &&
    guidanceInlineRaggio(gRaggio)?.id === "targeting-raggio-stretto" &&
    guidanceInlineBudgetRaggio(gDisp)?.id === "targeting-budget-raggio",
  "un item per campo, esclusi dalla card Step 1",
);

console.log("\n=== AURORA SILENT ===");
const auroraT = generaGuidanceTargeting({
  objective: "LEADS",
  citta: "Milano",
  raggioKm: 20,
  budgetGiornaliero: 41,
  targetType: "B2C",
  elevatorPitch: AURORA_BRIEF,
});
const auroraS1 = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
mark(
  "AURORA SILENT",
  auroraT.length === 0 && auroraS1.length === 0,
  "Aurora: nessuna guidance targeting / offerta / brief / età",
);

console.log("\n=== NEGATIVE TESTS ===");
mark(
  "NEGATIVE TESTS",
  gA[0]?.title === "Il brief sembra descrivere un pubblico B2B." ||
    gA.some((i) => i.title.includes("pubblico B2B")),
  "A: suggestion B2B",
);
const gB = generaGuidanceTargeting({
  objective: "LEADS",
  citta: "Milano",
  raggioKm: 20,
  budgetGiornaliero: 41,
  targetType: "B2B",
  elevatorPitch: "Genitori e famiglie con bambini piccoli",
});
mark(
  "NEGATIVE TESTS",
  gB.some((i) => i.title === "Il brief sembra descrivere un pubblico B2C."),
  "B: suggestion B2C",
);
mark(
  "NEGATIVE TESTS",
  gRaggio.some((i) => i.title === "Il raggio è molto ristretto."),
  "C: raggio 2 km",
);
mark(
  "NEGATIVE TESTS",
  gDisp.some((i) =>
    i.title.includes("dispersivo rispetto al budget"),
  ),
  "D: 15€ / 60 km",
);
const gH = generaGuidanceTargeting({
  objective: "ECOMMERCE",
  citta: "",
  raggioKm: 2,
  budgetGiornaliero: 15,
  targetType: "B2C",
  elevatorPitch:
    "Target responsabili acquisti e buyer di aziende manifatturiere",
});
mark(
  "NEGATIVE TESTS",
  !gH.some(
    (i) =>
      i.id === "step1-citta-assente" ||
      i.id === "targeting-raggio-stretto" ||
      i.id === "targeting-budget-raggio",
  ),
  "H: ECOMMERCE nessuna guidance locale (mismatch tipo può restare)",
);

mark(
  "NEGATIVE TESTS",
  !srcTargeting.includes("stimaSaturazione") &&
    !srcTargeting.includes("900") &&
    !srcPreLancio.includes("qualita-targeting") &&
    !srcQualita.includes("rilevaMismatchTargetType"),
  "nessuna saturazione; pre-lancio e qualita-step1 intatti",
);

if (falliti > 0) {
  console.error(`\n${falliti} asserzioni fallite`);
  process.exit(1);
}
console.log("\nTutti i test Guidance P1 targeting sono passati.");
