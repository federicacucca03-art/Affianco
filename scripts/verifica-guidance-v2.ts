/**
 * Verifica Guidance Layer V2 P0.
 * Esegui: npx tsx scripts/verifica-guidance-v2.ts
 *
 * Env dummy PRIMA di qualsiasi import che tocca supabase-js.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateMaxSustainableCpl } from "@/lib/benchmarks";
import {
  BUDGET_PRUDENTE_RAPPORTO,
  generaGuidanceEconomica,
  generaGuidanceStep1,
  haGuidanceDaMostrare,
  raccomandaLancio,
  selezionaGuidanceDaMostrare,
  type GuidanceItem,
} from "@/lib/guidance";
import { calculateLaunchReadiness } from "@/lib/launch-readiness";
import {
  LABEL_STRATEGIA_SOLIDA,
  calculateStrategicScore,
  type StrategicScoreInput,
} from "@/lib/strategic-score";

let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

const COPY_COERENTE =
  "A Roma la prima visita con preventivo chiaro in giornata. Prenota dal modulo.";

const AURORA_OFFERTA =
  "Prima visita implantologica con valutazione del caso e piano di trattamento personalizzato";
const AURORA_BRIEF =
  "Studio dentistico a Roma che vuole aumentare le richieste di contatto per implantologia. Target adulti che hanno perso uno o più denti o stanno valutando una soluzione fissa. Comunicazione rassicurante e professionale, senza promesse aggressive.";

function auroraScoreInput(
  extra: Partial<StrategicScoreInput> = {},
): StrategicScoreInput {
  const maxCpl = calculateMaxSustainableCpl(1500, 15, 50);
  return {
    budgetGiornaliero: 20,
    settore: "Studio dentistico",
    citta: "Roma",
    ticket: 1500,
    conversionRate: 15,
    conversionRateSource: "REAL",
    targetMargin: 50,
    maxSustainableCpl: maxCpl,
    frontEndOffer: AURORA_OFFERTA,
    elevatorPitch: AURORA_BRIEF,
    targetType: "B2C",
    targetAge: "25-50",
    raggioKm: 15,
    haCopySelezionato: true,
    copyVarianteA: COPY_COERENTE,
    titoloAnnuncio: "Prima visita implantologica a Roma",
    fotoCaricata: true,
    objective: "LEADS",
    fase: "completa",
    ...extra,
  };
}

function readinessCompleta(
  extra: Parameters<typeof calculateLaunchReadiness>[0] extends infer T
    ? Partial<T>
    : never = {},
) {
  return calculateLaunchReadiness({
    fotoCaricata: true,
    clienteHaApprovato: true,
    paginaFacebookId: "102938475610293",
    moduloContattiId: "238512345678901",
    haCopySelezionato: true,
    haTitoloAnnuncio: true,
    objective: "LEADS",
    ...extra,
  });
}

const sogliaAurora = calculateMaxSustainableCpl(1500, 15, 50);

console.log("\n=== TEST 1 — threshold presente → INFO soglia ===");
const t1 = generaGuidanceEconomica({
  ticket: 1500,
  conversionRate: 15,
  conversionRateSource: "REAL",
  margine: 50,
  budgetGiornaliero: 20,
  maxSustainableCpl: sogliaAurora,
  objective: "LEADS",
});
const t1soglia = t1.find((i) => i.id === "economia-soglia");
assert(t1soglia?.level === "INFO", "T1: livello INFO");
assert(
  t1soglia?.title === `Puoi sostenere fino a circa ${sogliaAurora}€ per lead.`,
  `T1: titolo soglia (got ${t1soglia?.title})`,
);
assert(
  t1soglia?.description.includes("soglia economica massima stimata"),
  "T1: description soglia",
);

console.log("\n=== TEST 2 — CR REAL → niente warning stima ===");
assert(
  !t1.some((i) => i.level === "WARNING"),
  "T2: nessun WARNING con fonte REAL",
);
assert(
  !t1.some((i) => i.id === "economia-cr-estimated"),
  "T2: niente warning stima",
);
assert(
  !t1.some((i) => i.id === "economia-cr-unknown"),
  "T2: niente warning unknown",
);
assert(
  t1.some((i) => i.id === "economia-cr-real"),
  "T2: INFO lieve dato reale presente nel set",
);

console.log("\n=== TEST 3 — CR ESTIMATED → WARNING ===");
const t3 = generaGuidanceEconomica({
  ticket: 1500,
  conversionRate: 15,
  conversionRateSource: "ESTIMATED",
  margine: 50,
  budgetGiornaliero: 20,
  maxSustainableCpl: sogliaAurora,
  objective: "LEADS",
});
const t3set = selezionaGuidanceDaMostrare(t3);
assert(
  t3.some(
    (i) =>
      i.id === "economia-cr-estimated" &&
      i.level === "WARNING" &&
      i.title.includes("tasso di conversione"),
  ),
  "T3: WARNING tasso fragile",
);
assert(
  t3set.principale?.id === "economia-cr-estimated",
  `T3: warning è insight principale (got ${t3set.principale?.id})`,
);

console.log("\n=== TEST 4 — CR UNKNOWN → WARNING forte ===");
const t4 = generaGuidanceEconomica({
  conversionRateSource: "UNKNOWN",
  budgetGiornaliero: 20,
  objective: "LEADS",
});
assert(
  t4.some(
    (i) =>
      i.id === "economia-cr-unknown" &&
      i.level === "WARNING" &&
      i.title.includes("Affidabilità economica limitata"),
  ),
  "T4: WARNING forte unknown",
);
assert(
  selezionaGuidanceDaMostrare(t4).principale?.id === "economia-cr-unknown",
  "T4: unknown è principale",
);

console.log("\n=== TEST 5 — budget molto sotto soglia → SUGGESTION ===");
assert(
  20 < sogliaAurora * BUDGET_PRUDENTE_RAPPORTO,
  `T5: 20 < ${sogliaAurora} * ${BUDGET_PRUDENTE_RAPPORTO}`,
);
const t5prudente = t1.find((i) => i.id === "economia-budget-prudente");
assert(t5prudente?.level === "SUGGESTION", "T5: livello SUGGESTION");
assert(t5prudente?.title === "Partenza prudente.", "T5: titolo partenza prudente");
assert(
  t5prudente?.description.includes("più tempo"),
  "T5: spiega i tempi, non 'budget sbagliato'",
);
assert(
  !t5prudente?.description.toLowerCase().includes("sbagliato"),
  "T5: non dice budget sbagliato",
);
const t5alto = generaGuidanceEconomica({
  ticket: 1500,
  conversionRate: 15,
  conversionRateSource: "REAL",
  margine: 50,
  budgetGiornaliero: 80,
  maxSustainableCpl: sogliaAurora,
  objective: "LEADS",
});
assert(
  !t5alto.some((i) => i.id === "economia-budget-prudente"),
  "T5: budget alto → niente partenza prudente",
);

console.log("\n=== TEST 6 — brief corto → SUGGESTION ===");
const t6 = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: "Troppo corto",
  targetAge: "25-50",
});
assert(
  t6.some(
    (i) =>
      i.id === "step1-brief-corto" &&
      i.level === "SUGGESTION" &&
      i.title.includes("brief"),
  ),
  "T6: SUGGESTION brief corto",
);
const t6vuoto = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: "",
  targetAge: "25-50",
});
assert(
  t6vuoto.some((i) => i.id === "step1-brief-corto"),
  "T6: brief assente → SUGGESTION",
);

console.log("\n=== TEST 7 — target età molto ampio → SUGGESTION ===");
const t7 = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "all",
});
assert(
  t7.some(
    (i) =>
      i.id === "step1-eta-ampia" &&
      i.level === "SUGGESTION" &&
      i.title.includes("molto ampio"),
  ),
  "T7: fascia all → SUGGESTION",
);
const t7eta = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  etaMin: 18,
  etaMax: 65,
});
assert(
  t7eta.some((i) => i.id === "step1-eta-ampia"),
  "T7: 18–65 → SUGGESTION",
);
const t7ok = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
assert(
  !t7ok.some((i) => i.id === "step1-eta-ampia"),
  "T7: 25–50 non è estremamente ampio",
);

console.log("\n=== TEST 8 — nessuna guidance utile → non mostrare ===");
const t8 = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
assert(t8.length === 0, "T8: step 1 Aurora senza guidance");
assert(!haGuidanceDaMostrare(t8), "T8: haGuidanceDaMostrare false");
assert(!haGuidanceDaMostrare([]), "T8: lista vuota → non renderizzare");
const srcComponente = readFileSync(
  join(process.cwd(), "src/components/nuova-contatti/AffiancoSuggerisce.tsx"),
  "utf8",
);
assert(
  srcComponente.includes("if (!haGuidanceDaMostrare(items)) return null"),
  "T8: componente ritorna null senza insight",
);

console.log("\n=== TEST 9 — Page/Form mancanti → non READY_TO_LAUNCH ===");
const scoreSolido = calculateStrategicScore(auroraScoreInput());
assert(
  scoreSolido.label === LABEL_STRATEGIA_SOLIDA,
  `T9: precondizione score solido (got ${scoreSolido.label})`,
);
const t9 = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readinessCompleta({
    paginaFacebookId: "",
    moduloContattiId: "",
  }),
  haErroriBloccantiPreLancio: false,
  objective: "LEADS",
});
assert(t9.stato !== "READY_TO_LAUNCH", "T9: non READY_TO_LAUNCH");
assert(t9.stato === "NOT_READY", `T9: NOT_READY (got ${t9.stato})`);
assert(t9.title === "Non lancerei ancora.", "T9: titolo Non lancerei ancora");
assert(
  t9.description.includes("elementi operativi") ||
    t9.description.includes("sistemerei"),
  `T9: description operativa (got ${t9.description})`,
);
assert(
  t9.reasons.some((r) => r.toLowerCase().includes("pagina facebook")),
  `T9: reason Page ID (got ${t9.reasons.join(" | ")})`,
);
assert(
  t9.reasons.some((r) => r.toLowerCase().includes("modulo")),
  `T9: reason Form ID (got ${t9.reasons.join(" | ")})`,
);

console.log("\n=== TEST 10 — readiness completa + strategia solida + no blocker ===");
const t10 = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readinessCompleta(),
  haErroriBloccantiPreLancio: false,
  objective: "LEADS",
});
assert(t10.stato === "READY_TO_LAUNCH", `T10: READY_TO_LAUNCH (got ${t10.stato})`);
assert(t10.title === "Puoi lanciare.", "T10: titolo Puoi lanciare");

console.log("\n=== TEST 11 — blocker → NOT_READY ===");
const blocker: GuidanceItem = {
  id: "test-blocker",
  level: "BLOCKER",
  title: "Manca un elemento bloccante di test.",
  description: "Non si può lanciare.",
  step: 5,
};
const t11 = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readinessCompleta(),
  haErroriBloccantiPreLancio: false,
  guidanceBlockers: [blocker],
  objective: "LEADS",
});
assert(t11.stato === "NOT_READY", `T11: NOT_READY (got ${t11.stato})`);
assert(
  t11.reasons.some((r) => r.includes("bloccante")),
  "T11: reason dal blocker",
);

const t11diagnosi = raccomandaLancio({
  strategicScore: scoreSolido,
  launchReadiness: readinessCompleta(),
  haErroriBloccantiPreLancio: true,
  objective: "LEADS",
});
assert(
  t11diagnosi.stato === "NOT_READY",
  "T11: errori diagnosi → NOT_READY",
);

console.log("\n=== TEST 12 — max 1 principale + 2 secondari ===");
const tanti: GuidanceItem[] = [
  {
    id: "a",
    level: "INFO",
    title: "Uno",
    description: "d",
    step: 1,
  },
  {
    id: "b",
    level: "SUGGESTION",
    title: "Due",
    description: "d",
    step: 1,
  },
  {
    id: "c",
    level: "WARNING",
    title: "Tre",
    description: "d",
    step: 1,
  },
  {
    id: "d",
    level: "INFO",
    title: "Quattro",
    description: "d",
    step: 2,
  },
];
const t12 = selezionaGuidanceDaMostrare(tanti);
assert(t12.principale != null, "T12: 1 principale");
assert(t12.secondari.length <= 2, `T12: max 2 secondari (got ${t12.secondari.length})`);
assert(
  t12.principale?.level === "WARNING",
  "T12: principale è il WARNING",
);
assert(
  1 + t12.secondari.length <= 3,
  "T12: totale visibile ≤ 3",
);
const auroraSet = selezionaGuidanceDaMostrare(t1);
assert(auroraSet.principale != null, "T12: Aurora ha principale");
assert(auroraSet.secondari.length <= 2, "T12: Aurora max 2 secondari");

console.log("\n=== AURORA — Step 2 ===");
assert(sogliaAurora === 113, `Aurora soglia 113 (got ${sogliaAurora})`);
assert(
  auroraSet.principale?.id === "economia-soglia",
  `Aurora principale soglia (got ${auroraSet.principale?.id})`,
);
assert(
  auroraSet.principale?.title.includes("113€ per lead"),
  `Aurora titolo 113€ (got ${auroraSet.principale?.title})`,
);
assert(
  auroraSet.secondari.some((i) => i.id === "economia-budget-prudente"),
  "Aurora secondario partenza prudente",
);
assert(
  auroraSet.principale?.id !== "economia-cr-estimated",
  "Aurora REAL: warning CR non principale",
);
assert(
  !t1.some((i) => i.level === "WARNING"),
  "Aurora REAL: nessun warning CR",
);

console.log("\n=== AURORA — Step 1 ===");
const auroraStep1 = generaGuidanceStep1({
  frontEndOffer: AURORA_OFFERTA,
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
assert(auroraStep1.length === 0, "Aurora step 1: nessuna guidance inutile");

console.log("\n=== AURORA — Pre-lancio Page/Form mancanti ===");
assert(t9.stato === "NOT_READY", "Aurora pre-lancio: NOT_READY");
assert(
  t9.description.includes("solida") || t9.title.includes("Non lancerei"),
  "Aurora copy: strategia vs elementi operativi",
);

const offertaCorta = generaGuidanceStep1({
  frontEndOffer: "Visita",
  elevatorPitch: AURORA_BRIEF,
  targetAge: "25-50",
});
assert(
  offertaCorta.some((i) => i.id === "step1-offerta-generica"),
  "extra: offerta corta → SUGGESTION",
);
assert(
  !generaGuidanceStep1({
    frontEndOffer: "",
    elevatorPitch: AURORA_BRIEF,
    targetAge: "25-50",
  }).some((i) => i.id === "step1-offerta-generica"),
  "extra: offerta vuota non duplica il BLOCKER",
);

if (falliti > 0) {
  console.error(`\n${falliti} test falliti`);
  process.exit(1);
}
console.log("\nTutti i test Guidance V2 P0 sono passati.");
