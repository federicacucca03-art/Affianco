/**
 * M10B / M10B.1 — Guided campaign architecture + provenance hardening.
 * Esegui: npx tsx scripts/verifica-meta-m10b.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGuidedMetaPlan,
  etichettaGuidedProvenance,
  mapBusinessIntentToMetaArchitecture,
  resolveGuidedDestination,
} from "@/lib/meta/guided-plan";
import { richiedeModuloContatti } from "@/lib/launch-readiness";
import { calcolaDiagnosiPreLancioLeads } from "@/lib/pre-lancio-check";

let falliti = 0;
function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  return true;
}

function test(name: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    falliti += 1;
    console.error(`FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

const root = join(import.meta.dirname, "..");
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function dentalNoDestination(extra: Record<string, unknown> = {}) {
  return buildGuidedMetaPlan({
    objective: "LEADS",
    nomeCampagna: "Implantologia Roma",
    citta: "Roma",
    raggioKm: 15,
    etaMin: 35,
    etaMax: 65,
    budgetGiornaliero: 25,
    bookingChannel: null,
    destinationUrl: null,
    whatsappNumber: null,
    pageId: null,
    formId: null,
    targetType: "B2C",
    retargetingAudienceSource: null,
    cboAttivo: true,
    posizionamentiAdvantage: true,
    varianteA: "Prima visita gratuita per implantologia",
    varianteB: null,
    varianteC: null,
    titoloAnnuncio: "Prima visita gratuita",
    creativitaCount: 1,
    fromBrief: {
      budgetGiornaliero: true,
      citta: true,
      raggioKm: true,
      etaMin: true,
      etaMax: true,
      objective: true,
    },
    ...extra,
  });
}

console.log("\n=== M10B.1 provenance matrix ===");

test("A: dental brief — no destination invented", () => {
  const plan = dentalNoDestination();
  assert(plan.metaObjective.value === "OUTCOME_LEADS", "A Meta Contatti");
  assert(plan.metaObjective.provenance === "INFERRED", "A objective INFERRED");
  assert(plan.destination.provenance === "MISSING", "A dest MISSING");
  assert(plan.destination.value === "UNKNOWN", "A dest UNKNOWN");
  assert(
    etichettaGuidedProvenance(plan.destination.provenance) === "Da completare",
    "A badge Da completare",
  );
  assert(plan.audienceStrategy.value === "LOCAL", "A audience LOCAL");
  assert(plan.audienceStrategy.provenance === "INFERRED", "A audience INFERRED");
  assert(
    plan.audienceStrategy.provenance !== "EXPLICIT",
    "A audience not SCELTA TUA",
  );
  assert(plan.budgetDaily.value === 25, "A budget 25");
  assert(plan.budgetDaily.provenance === "BRIEF", "A budget BRIEF");
  assert(plan.budgetLevel.value === "CAMPAIGN", "A level campaign");
  assert(plan.budgetLevel.provenance === "INFERRED", "A level INFERRED");
  assert(
    plan.placementsStrategy.provenance === "INFERRED",
    "A placements INFERRED",
  );
  assert(plan.optimizationGoal.value == null, "A opt null");
  assert(plan.optimizationGoal.provenance === "MISSING", "A opt MISSING");
  assert(
    !plan.missingRequirements.some((m) => m.id === "lead-form"),
    "A no lead form req",
  );
  assert(
    plan.adSets[0]?.nameBeginner?.includes("Nuovi potenziali clienti"),
    "A beginner ad set name",
  );
  assert(plan.bidStrategy.provenance === "META_MANAGED", "A bid META_MANAGED");
  assert(
    plan.attribution.provenance === "META_MANAGED",
    "A attribution META_MANAGED",
  );
});

test("A2: formId alone does NOT invent Modulo Meta", () => {
  const plan = dentalNoDestination({ formId: "123456789" });
  assert(plan.destination.provenance === "MISSING", "A2 still MISSING");
  assert(plan.destination.value === "UNKNOWN", "A2 still UNKNOWN");
  assert(
    !plan.missingRequirements.some((m) => m.id === "lead-form"),
    "A2 no form req without dest choice",
  );
});

test("B: user chooses Modulo Meta → EXPLICIT + form req", () => {
  const plan = dentalNoDestination({
    explicitDestination: "META_LEAD_FORM",
    formId: null,
  });
  assert(plan.destination.value === "META_LEAD_FORM", "B dest form");
  assert(plan.destination.provenance === "EXPLICIT", "B EXPLICIT");
  assert(
    etichettaGuidedProvenance(plan.destination.provenance) === "Scelta tua",
    "B Scelta tua",
  );
  assert(
    plan.missingRequirements.some((m) => m.id === "lead-form"),
    "B lead form req",
  );
  assert(
    plan.missingRequirements.some((m) => m.id === "page"),
    "B page req",
  );
  assert(plan.optimizationGoal.value === "LEAD_GENERATION", "B LEAD_GENERATION");
  assert(
    plan.optimizationGoalLabel.value === "Generazione contatti",
    "B Italian opt label",
  );
  assert(
    plan.optimizationGoal.provenance === "INFERRED",
    "B opt INFERRED not EXPLICIT",
  );
  assert(
    !plan.missingRequirements.some(
      (m) => m.id === "website-url" || m.id === "whatsapp" || m.id === "phone",
    ),
    "B no wrong destination requirements",
  );
});

test("C: website destination — no lead form", () => {
  const plan = dentalNoDestination({
    explicitDestination: "WEBSITE",
    destinationUrl: null,
  });
  assert(plan.destination.value === "WEBSITE", "C website");
  assert(
    !plan.missingRequirements.some((m) => m.id === "lead-form"),
    "C no lead form",
  );
  assert(
    plan.missingRequirements.some((m) => m.id === "website-url"),
    "C url req",
  );
});

test("D: WhatsApp — no lead form", () => {
  const plan = dentalNoDestination({
    explicitDestination: "WHATSAPP",
  });
  assert(plan.destination.value === "WHATSAPP", "D WA");
  assert(
    !plan.missingRequirements.some((m) => m.id === "lead-form"),
    "D no lead form",
  );
  assert(
    plan.missingRequirements.some((m) => m.id === "whatsapp"),
    "D whatsapp req",
  );
});

test("E: bid/attribution META_MANAGED badges", () => {
  const plan = dentalNoDestination();
  assert(
    etichettaGuidedProvenance(plan.bidStrategy.provenance) === "Gestita su Meta",
    "E bid badge",
  );
  assert(
    etichettaGuidedProvenance(plan.attribution.provenance) === "Gestita su Meta",
    "E attr badge",
  );
});

test("F: retargeting ≠ objective", () => {
  const mapped = mapBusinessIntentToMetaArchitecture({
    objective: "RETARGETING",
  });
  assert(mapped.audienceStrategy === "RETARGETING", "F audience");
  assert(mapped.metaObjective === "OUTCOME_SALES", "F sales");
});

test("G: richiedeModuloContatti gated", () => {
  assert(
    richiedeModuloContatti("LEADS", undefined, null) === false,
    "G LEADS no dest → false",
  );
  assert(
    richiedeModuloContatti("LEADS", undefined, "META_LEAD_FORM") === true,
    "G form dest → true",
  );
  assert(
    richiedeModuloContatti("LEADS", undefined, "WEBSITE") === false,
    "G website → false",
  );
  assert(
    richiedeModuloContatti("BOOKINGS", "LEAD_FORM") === true,
    "G bookings form",
  );
});

test("H: pre-lancio LEADS no CSV / no form without dest", () => {
  const d = calcolaDiagnosiPreLancioLeads({
    raggioKm: 15,
    titoloAnnuncio: "Prima visita",
    budgetGiornaliero: 25,
    settore: "Studio dentistico",
    citta: "Roma",
    haCopy: true,
    haCreativita: true,
    objective: "LEADS",
    pageId: "",
    formId: "",
    guidedDestination: "UNKNOWN",
  });
  assert(
    !d.checks.some((c) => /CSV/i.test(c.motivazione ?? "")),
    "H no CSV language",
  );
  assert(
    !d.checks.some((c) => c.id === "form-id"),
    "H no form-id without dest",
  );
  assert(
    d.checks.some((c) => c.id === "destinazione-guidata"),
    "H asks destination",
  );
});

test("I: pre-lancio LEADS form only after Modulo Meta", () => {
  const d = calcolaDiagnosiPreLancioLeads({
    raggioKm: 15,
    titoloAnnuncio: "Prima visita",
    budgetGiornaliero: 25,
    settore: "Studio dentistico",
    citta: "Roma",
    haCopy: true,
    haCreativita: true,
    objective: "LEADS",
    pageId: "",
    formId: "",
    guidedDestination: "META_LEAD_FORM",
  });
  assert(d.checks.some((c) => c.id === "form-id"), "I form-id present");
  assert(d.checks.some((c) => c.id === "page-id"), "I page-id present");
  assert(
    !d.checks.some((c) => /CSV/i.test(c.motivazione ?? "")),
    "I no CSV",
  );
});

test("J: resolve never invents form from formId", () => {
  const dest = resolveGuidedDestination({
    businessIntent: "LEADS",
    formId: "999",
    hint: null,
  });
  assert(dest.provenance === "MISSING", "J MISSING");
  assert(dest.kind === "UNKNOWN", "J UNKNOWN");
});

test("K: budget level user chosen → EXPLICIT", () => {
  const plan = dentalNoDestination({ budgetLevelUserChosen: true });
  assert(plan.budgetLevel.provenance === "EXPLICIT", "K EXPLICIT");
});

test("L: placements default never EXPLICIT", () => {
  const plan = dentalNoDestination({
    posizionamentiAdvantage: true,
    placementsUserChosen: false,
  });
  assert(plan.placementsStrategy.provenance === "INFERRED", "L INFERRED");
});

console.log("\n=== M10B.2 final hardening ===");

test("M10B.2 provenance contract without destination", () => {
  const plan = dentalNoDestination();
  assert(
    etichettaGuidedProvenance(plan.metaObjective.provenance) ===
      "Proposto da Ally",
    "obj Proposto",
  );
  assert(
    etichettaGuidedProvenance(plan.destination.provenance) === "Da completare",
    "dest Da completare",
  );
  assert(
    etichettaGuidedProvenance(plan.audienceStrategy.provenance) ===
      "Proposto da Ally",
    "aud Proposto",
  );
  assert(
    etichettaGuidedProvenance(plan.geographyFacts.provenance) === "Dal brief",
    "geo Dal brief",
  );
  assert(
    etichettaGuidedProvenance(plan.ageFacts.provenance) === "Dal brief",
    "age Dal brief",
  );
  assert(
    etichettaGuidedProvenance(plan.budgetDaily.provenance) === "Dal brief",
    "budget Dal brief",
  );
  assert(
    etichettaGuidedProvenance(plan.budgetLevel.provenance) ===
      "Proposto da Ally",
    "level Proposto",
  );
  assert(
    etichettaGuidedProvenance(plan.placementsStrategy.provenance) ===
      "Proposto da Ally",
    "placements Proposto",
  );
  assert(
    etichettaGuidedProvenance(plan.optimizationGoal.provenance) ===
      "Da completare",
    "opt Da completare",
  );
  assert(
    etichettaGuidedProvenance(plan.bidStrategy.provenance) === "Gestita su Meta",
    "bid Gestita",
  );
  assert(
    etichettaGuidedProvenance(plan.attribution.provenance) === "Gestita su Meta",
    "attr Gestita",
  );
});

test("M10B.2 explicit destination persistence (forward/back simulation)", () => {
  // 1) missing
  const missing = dentalNoDestination();
  assert(missing.destination.provenance === "MISSING", "persist: missing");

  // 2) user chooses Modulo Meta
  const chosen = dentalNoDestination({
    explicitDestination: "META_LEAD_FORM",
  });
  assert(chosen.destination.value === "META_LEAD_FORM", "persist: chosen");
  assert(chosen.destination.provenance === "EXPLICIT", "persist: EXPLICIT");

  // 3–5) navigate away and back: remount rebuilds from same explicit choice
  const remount = dentalNoDestination({
    explicitDestination: "META_LEAD_FORM",
  });
  assert(remount.destination.value === "META_LEAD_FORM", "persist: remount value");
  assert(remount.destination.provenance === "EXPLICIT", "persist: remount EXPLICIT");
  assert(
    etichettaGuidedProvenance(remount.destination.provenance) === "Scelta tua",
    "persist: Scelta tua",
  );
  assert(remount.destination.provenance !== "MISSING", "persist: not MISSING");
  assert(remount.destination.provenance !== "INFERRED", "persist: not INFERRED");

  const percorso = read("src/components/nuova-contatti/PercorsoContatti.tsx");
  assert(
    percorso.includes("persistiGuidedDestSessione") &&
      percorso.includes("leggiGuidedDestSessione") &&
      percorso.includes("affianco-guided-destination-v1:"),
    "persist: session wiring",
  );
});

test("M10B.2 Modulo Meta pre-lancio product language", () => {
  const d = calcolaDiagnosiPreLancioLeads({
    raggioKm: 15,
    titoloAnnuncio: "Prima visita",
    budgetGiornaliero: 25,
    settore: "Implantologia",
    citta: "Roma",
    haCopy: true,
    haCreativita: false,
    objective: "LEADS",
    pageId: "",
    formId: "",
    guidedDestination: "META_LEAD_FORM",
  });
  const form = d.checks.find((c) => c.id === "form-id");
  const page = d.checks.find((c) => c.id === "page-id");
  assert(form != null, "form check");
  assert(page != null, "page check");
  assert(!/ID Modulo/i.test(form?.titolo ?? ""), "no ID Modulo title");
  assert(!/ID Pagina/i.test(page?.titolo ?? ""), "no ID Pagina title");
  assert(!/CSV/i.test(form?.motivazione ?? ""), "no CSV in form");
  assert(!/CSV/i.test(page?.motivazione ?? ""), "no CSV in page");
  const budget = d.checks.find((c) => c.id === "budget");
  assert(
    !/minimo consigliato/i.test(budget?.motivazione ?? ""),
    "no minimo consigliato",
  );
  assert(
    /benchmark indicativo/i.test(budget?.motivazione ?? "") ||
      budget?.severita === "ok",
    "benchmark language or ok",
  );
});

test("M10B.2 message naming + strategic score IT", () => {
  const copyOnly = dentalNoDestination({ creativitaCount: 0 });
  assert(
    copyOnly.ads[0]?.name === "Variante messaggio A",
    "copy-only variante messaggio",
  );
  const withCreative = dentalNoDestination({ creativitaCount: 2 });
  assert(
    withCreative.ads[0]?.name === "Bozza inserzione A",
    "with creative bozza inserzione",
  );
  const scoreCard = read(
    "src/components/nuova-contatti/StrategicScoreCard.tsx",
  );
  assert(scoreCard.includes("Valutazione strategica"), "score IT");
  assert(!scoreCard.includes("Strategic Score"), "no EN Strategic Score UI");
  const diag = read("src/components/nuova-contatti/DiagnosiPreLancio.tsx");
  assert(diag.includes("Completezza bozza"), "completezza bozza");
  assert(!diag.includes("Prontezza campagna"), "no Prontezza campagna");
  assert(
    /non certifica il lancio/i.test(diag),
    "draft ≠ launch claim",
  );
});

console.log("\n=== M10B static guards ===");

test("UI wired + session persistence", () => {
  const src = read("src/components/nuova-contatti/PercorsoContatti.tsx");
  assert(src.includes("MetaStrutturaGuidata"), "UI panel");
  assert(src.includes("persistiGuidedDestSessione"), "session persist");
  assert(src.includes("fromBriefFlags"), "brief flags");
});

test("no Meta writes", () => {
  for (const f of [
    "src/lib/meta/guided-plan/build-plan.ts",
    "src/lib/meta/guided-plan/map-intent.ts",
    "src/components/nuova-contatti/MetaStrutturaGuidata.tsx",
  ]) {
    const src = read(f);
    assert(!/graph\.facebook\.com/i.test(src), `${f} no Graph`);
    assert(!/ads_management/i.test(src), `${f} no ads_management`);
  }
});

test("CSV language removed from LEADS pre-lancio", () => {
  const src = read("src/lib/pre-lancio-check.ts");
  const leadsFn = src.slice(
    src.indexOf("export function calcolaDiagnosiPreLancioLeads"),
    src.indexOf("export function calcolaDiagnosiPreLancioBookings"),
  );
  assert(!/Mancante nel CSV/i.test(leadsFn), "no Mancante nel CSV in LEADS");
});

test("M10A preserved", () => {
  assert(read("src/lib/meta/hierarchy-load.ts").length > 100, "M10A load");
});

if (falliti > 0) {
  console.error(`\nM10B.1: ${falliti} FAIL`);
  process.exit(1);
}
console.log("\nM10B.1: all checks PASS");
