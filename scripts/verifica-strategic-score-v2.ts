/**
 * Verifica Strategic Score V2 + Launch Readiness + persistenza fonte CR.
 * Esegui: npx tsx scripts/verifica-strategic-score-v2.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
import { calculateMaxSustainableCpl, getBenchmarkForNiche } from "@/lib/benchmarks";
import {
  CAVEAT_STIMA,
  LABEL_RISCHIO_SPRECO_BUDGET,
  LABEL_VALUTAZIONE_IN_CORSO,
  calculateStrategicScore,
  type StrategicScoreInput,
} from "@/lib/strategic-score";
import { calculateLaunchReadiness } from "@/lib/launch-readiness";
import { normalizzaConversionRateSource } from "@/lib/conversion-rate";

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
const COPY_INCOERENTE =
  "Scopri i nostri servizi locali. Clicca qui per saperne di più.";

function auroraBase(
  extra: Partial<StrategicScoreInput> = {},
): StrategicScoreInput {
  const maxCpl = calculateMaxSustainableCpl(1500, 15, 50);
  const benchmark = getBenchmarkForNiche("Studio dentistico", "Roma");
  return {
    budgetGiornaliero: 20,
    recommendedDailyBudgetMin: benchmark.recommendedDailyBudgetMin,
    cplMercatoMin: benchmark.cplMin,
    settore: "Studio dentistico",
    citta: "Roma",
    ticket: 1500,
    conversionRate: 15,
    conversionRateSource: "REAL",
    targetMargin: 50,
    maxSustainableCpl: maxCpl,
    frontEndOffer: "Prima visita con preventivo chiaro in giornata",
    elevatorPitch: "Studio dentistico a Roma, prima visita con preventivo chiaro",
    targetType: "B2C",
    targetAge: "25-50",
    raggioKm: 15,
    haCopySelezionato: true,
    copyVarianteA: COPY_COERENTE,
    titoloAnnuncio: "Prima visita a Roma",
    fotoCaricata: true,
    objective: "LEADS",
    ...extra,
  };
}

console.log("\n=== CASO A — Aurora REAL ===");
const auroraStep2 = calculateStrategicScore(
  auroraBase({
    fase: "provvisoria",
    haCopySelezionato: false,
    copyVarianteA: "",
    fotoCaricata: false,
  }),
);
assert(
  auroraStep2.label === LABEL_VALUTAZIONE_IN_CORSO,
  "A Step 2: label Valutazione in corso",
);
assert(!auroraStep2.mostraPunteggio, "A Step 2: niente punteggio /100");
assert(
  !auroraStep2.suggestions.some((s) => s.includes(LABEL_RISCHIO_SPRECO_BUDGET)) &&
    !auroraStep2.avvisoSprecoBudget,
  "A Step 2: niente Rischio spreco budget",
);
assert(
  auroraStep2.economia.conversionRateSource === "REAL",
  "A Step 2: fonte REAL",
);
assert(
  auroraStep2.economia.maxSustainableCpl === 113,
  `A Step 2: soglia sostenibile 113 (got ${auroraStep2.economia.maxSustainableCpl})`,
);
assert(
  auroraStep2.economia.budgetSostenibile === true,
  "A Step 2: budget 20 coerente con economia reale",
);

const auroraStep6 = calculateStrategicScore(auroraBase({ fase: "completa" }));
assert(auroraStep6.mostraPunteggio, "A Step 6: punteggio visibile (dati completi)");
assert(
  !auroraStep6.suggestions.some((s) => s.includes(CAVEAT_STIMA)),
  "A Step 6: niente caveat stima su REAL",
);
assert(
  auroraStep6.label !== LABEL_RISCHIO_SPRECO_BUDGET,
  "A Step 6: label non è Rischio spreco budget",
);

const readinessA = calculateLaunchReadiness({
  fotoCaricata: true,
  clienteHaApprovato: false,
  paginaFacebookId: "",
  moduloContattiId: "",
  haCopySelezionato: true,
  haTitoloAnnuncio: true,
  objective: "LEADS",
});
assert(
  readinessA.items.some(
    (i) => !i.ok && i.mancante === "ID Pagina Facebook mancante",
  ),
  "A Step 6: Launch Readiness segnala ID Pagina Facebook mancante",
);
assert(
  readinessA.items.some(
    (i) => !i.ok && i.mancante === "ID Modulo Contatti mancante",
  ),
  "A Step 6: Launch Readiness segnala ID Modulo Contatti mancante",
);
assert(!readinessA.isReady, "A Step 6: Launch Readiness incompleta");

console.log("\n=== CASO B — persistenza REAL ===");
assert(
  normalizzaConversionRateSource("REAL") === "REAL",
  "B: normalizza REAL",
);
assert(
  normalizzaConversionRateSource("estimated") === "ESTIMATED",
  "B: normalizza ESTIMATED case-insensitive",
);
assert(
  normalizzaConversionRateSource("UNKNOWN") === "UNKNOWN",
  "B: normalizza UNKNOWN",
);

async function verificaPersistenzaDb() {
  const { mappaCampagnaDaRow, costruisciPayloadCampagna } = await import(
    "@/lib/campagne-db"
  );
  const mappata = mappaCampagnaDaRow({
    id: "aurora-test",
    created_at: "2026-08-31T00:00:00.000Z",
    client_id: "c1",
    name: "Studio Dentistico Aurora",
    objective: "LEADS",
    status: "DRAFT",
    daily_budget: 20,
    max_sustainable_cpa: 113,
    conversion_rate_source: "REAL",
    clients: {
      id: "c1",
      name: "Studio Dentistico Aurora",
      elevator_pitch: "Prima visita",
      average_ticket_value: 1500,
      closing_rate: 15,
    },
  });
  assert(
    mappata.conversionRateSource === "REAL",
    `B: mappaCampagnaDaRow conserva REAL (got ${mappata.conversionRateSource})`,
  );
  const payload = costruisciPayloadCampagna({
    clientId: "c1",
    name: "Aurora",
    dailyBudget: 20,
    conversionRateSource: "REAL",
  });
  assert(
    payload.conversion_rate_source === "REAL",
    "B: payload save include conversion_rate_source REAL",
  );
}

console.log("\n=== CASO C — ESTIMATED ===");
const stimata = calculateStrategicScore(
  auroraBase({ conversionRateSource: "ESTIMATED", fase: "completa" }),
);
assert(
  stimata.suggestions.some((s) => s.includes(CAVEAT_STIMA)),
  "C: caveat stima presente",
);

console.log("\n=== CASO D — UNKNOWN ===");
const sconosciuta = calculateStrategicScore(
  auroraBase({
    conversionRateSource: "UNKNOWN",
    conversionRate: null,
    maxSustainableCpl: null,
    fase: "completa",
  }),
);
assert(!sconosciuta.mostraPunteggio, "D: niente punteggio presentato come certo");
assert(
  sconosciuta.label === LABEL_VALUTAZIONE_IN_CORSO,
  "D: Valutazione in corso",
);
assert(!sconosciuta.economia.numeriAffidabili, "D: numeri non affidabili");
assert(
  !sconosciuta.avvisoSprecoBudget,
  "D: niente Rischio spreco budget da assunzioni",
);

console.log("\n=== CASO E — budget 20 vs benchmark 24 ===");
const benchmarkRoma = getBenchmarkForNiche("Studio dentistico", "Roma");
assert(
  benchmarkRoma.recommendedDailyBudgetMin === 24,
  `E: benchmark Roma è 24 (got ${benchmarkRoma.recommendedDailyBudgetMin})`,
);
assert(
  auroraStep6.economia.budgetGiornaliero === 20,
  "E: budget reale 20",
);
assert(
  auroraStep6.breakdown.economia === 40,
  `E: economia piena 40/40, non 0 (got ${auroraStep6.breakdown.economia})`,
);
assert(
  auroraStep6.suggestions.some((s) =>
    s.includes("benchmark indicativo parte da circa 24€/giorno"),
  ),
  "E: benchmark mostrato come riferimento indicativo",
);
assert(
  auroraStep6.economia.budgetSostenibile === true,
  "E: economia reale prevale sul benchmark città",
);

console.log("\n=== CASO F — Page/Form assenti non toccano lo score ===");
const conId = calculateStrategicScore(auroraBase({ fase: "completa" }));
const senzaId = calculateStrategicScore(auroraBase({ fase: "completa" }));
assert(
  conId.score === senzaId.score,
  "F: Strategic Score invariato (Page/Form non sono input)",
);
assert(
  !("pageId" in conId.breakdown) && !("formId" in conId.breakdown),
  "F: breakdown senza pageId/formId",
);
const readinessF = calculateLaunchReadiness({
  fotoCaricata: true,
  clienteHaApprovato: true,
  paginaFacebookId: "",
  moduloContattiId: "",
  haCopySelezionato: true,
  haTitoloAnnuncio: true,
  objective: "LEADS",
});
assert(!readinessF.isReady, "F: Launch Readiness incompleta senza Page/Form");
assert(readinessF.completati === 3, `F: 3/5 (got ${readinessF.completati}/5)`);

console.log("\n=== CASO G — early wizard ===");
const early = calculateStrategicScore(
  auroraBase({
    fase: "provvisoria",
    haCopySelezionato: false,
    copyVarianteA: "",
    fotoCaricata: false,
    frontEndOffer: "Prima visita",
    elevatorPitch: "Brief",
  }),
);
assert(early.label === LABEL_VALUTAZIONE_IN_CORSO, "G: Valutazione in corso");
assert(!early.mostraPunteggio, "G: niente 35/100");
assert(!early.avvisoSprecoBudget, "G: niente Rischio spreco budget");

console.log("\n=== Copy coerente ≠ incoerente ===");
const coerente = calculateStrategicScore(auroraBase({ fase: "completa" }));
const incoerente = calculateStrategicScore(
  auroraBase({
    fase: "completa",
    copyVarianteA: COPY_INCOERENTE,
  }),
);
assert(
  coerente.breakdown.copy > incoerente.breakdown.copy,
  `Copy: coerente ${coerente.breakdown.copy} > incoerente ${incoerente.breakdown.copy}`,
);

void verificaPersistenzaDb().then(() => {
  if (falliti > 0) {
    console.error(`\n${falliti} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nTutti i casi A–G sono PASS.");
});
