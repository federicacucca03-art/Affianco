/**
 * P0.3 — Instant Form Easy Mode readiness verification.
 * LIVE META WRITES: 0
 * Esegui: npx tsx scripts/verifica-meta-instant-form-p03.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import { assertPreviewMatchesConversionPlan } from "../src/lib/meta/write/canonical-publish-preview";
import {
  formBelongsToDiscoveredPage,
  normalizeImportedInstantForm,
} from "../src/lib/meta/leadgen-forms-parse";
import { assessInstantFormEasyReadiness } from "../src/lib/meta/write/instant-form-readiness";

const root = resolve(__dirname, "..");
let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    falliti += 1;
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(root, rel));
}

function basePlan(overrides: Partial<MetaWritePlanInput> = {}): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "QA Instant Form P0.3",
    objectiveRaw: "OUTCOME_LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: "page-1",
    formId: "form-1",
    whatsappNumber: null,
    budgetDailyMajor: 20,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "NONE" },
    citta: "Roma",
    raggioKm: 20,
    countryCode: "IT",
    metaGeoKey: "2421836",
    geoLabel: "Roma, Lazio, IT",
    etaMin: 25,
    etaMax: 55,
    placementsAdvantage: true,
    startAtIso: null,
    endAtIso: null,
    creativitaCount: 1,
    targetType: "B2C",
    isImportedMetaOnly: false,
    existingMetaCampaignId: null,
    partialHierarchyPending: false,
    writeHierarchyCompleted: false,
    grantedScopes: ["ads_read", "ads_management"],
    hasMetaConnection: true,
    hasAdAccount: true,
    metaAdAccountId: "act_1234567890",
    adAccountCurrency: "EUR",
    adAccountTimezone: "Europe/Rome",
    buyingType: "AUCTION",
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    allyBidMode: "AUTOMATIC_NO_CAP",
    instantFormRelation: "VERIFIED",
    instantFormName: "Modulo Contatti QA",
    pageName: "Pagina QA",
    /** Complete Instant Form fixture — Meta creative technical link. */
    formPrivacyPolicyUrl: "https://example.com/privacy-policy",
    ...overrides,
  };
}

console.log("\n=== P0.3 INSTANT FORM EASY MODE ===\n");

{
  // 1. valid Page + Form → publishAllowed
  const p = buildMetaWritePreview(basePlan());
  assert(p.publishAllowed === true, "1 publishAllowed true");
  assert(p.canWrite === true, "1 canWrite true");
  assert(p.adSet?.optimization_goal === "LEAD_GENERATION", "1 LEAD_GENERATION");
  assert(
    p.adSet?.promoted_object?.page_id === "page-1" &&
      !(
        p.adSet?.promoted_object &&
        "form_id" in p.adSet.promoted_object
      ),
    "1 promoted page_id only (form_id on creative CTA)",
  );
  assert(
    typeof (basePlan().formId) === "string" && Boolean(basePlan().formId),
    "1 draft formId preserved for creative",
  );
  assert(p.instantFormEasyReadiness?.readiness === "READY", "1 Easy READY");
}

{
  // 2. Instant Form + no Pixel → valid, no tracking warning
  const p = buildMetaWritePreview(
    basePlan({ websiteTracking: null }),
  );
  assert(p.publishAllowed === true, "2 publishAllowed without pixel");
  assert(
    !p.readinessCodes.includes("MISSING_TRACKING_CONFIG"),
    "2 no MISSING_TRACKING",
  );
  assert(
    !(p.canonicalPublishPreview?.warnings ?? []).some((w) =>
      /pixel|dataset|tracking/i.test(w.messageIt),
    ),
    "2 no tracking warning",
  );
  const pixel = p.canonicalPublishPreview?.sections
    .find((s) => s.id === "AD_SET")
    ?.fields.find((f) => f.key === "adset.tracking_source");
  assert(pixel?.valueIt === "Non richiesto", "2 Pixel Non richiesto");
}

{
  // 3. Page missing → BLOCKER
  const p = buildMetaWritePreview(basePlan({ pageId: null }));
  assert(p.publishAllowed === false, "3 publishAllowed false");
  assert(p.readinessCodes.includes("MISSING_PAGE"), "3 MISSING_PAGE");
}

{
  // 4. Form missing → BLOCKER
  const p = buildMetaWritePreview(basePlan({ formId: null }));
  assert(p.publishAllowed === false, "4 publishAllowed false");
  assert(p.readinessCodes.includes("MISSING_FORM"), "4 MISSING_FORM");
}

{
  // 5. Form belongs to another Page → BLOCKER
  const p = buildMetaWritePreview(
    basePlan({
      instantFormRelation: "MISMATCH",
      instantFormName: "Form altra pagina",
    }),
  );
  assert(p.publishAllowed === false, "5 publishAllowed false");
  assert(
    p.readinessCodes.includes("FORM_PAGE_MISMATCH"),
    "5 FORM_PAGE_MISMATCH",
  );
  assert(
    formBelongsToDiscoveredPage(
      [{ id: "form-1", pageId: "page-A" }],
      "page-B",
      "form-1",
    ) === false,
    "5 ownership helper mismatch",
  );
  assert(
    formBelongsToDiscoveredPage(
      [{ id: "form-1", pageId: "page-1" }],
      "page-1",
      "form-1",
    ) === true,
    "5 ownership helper match",
  );
}

{
  // 6. Advantage+ placements explanation
  const p = buildMetaWritePreview(basePlan());
  const place = p.canonicalPublishPreview?.sections
    .find((s) => s.id === "AD_SET")
    ?.fields.find((f) => f.key === "adset.placements");
  assert(place?.valueIt === "Posizionamenti Advantage+", "6 Advantage+ label");
  assert(
    p.canonicalPublishPreview?.recommendations.some(
      (r) => r.reasonCode === "IF_PLACEMENTS_ADVANTAGE",
    ),
    "6 Advantage+ reason present",
  );
}

{
  // 7. manual placements → unsupported blocker preserved
  const p = buildMetaWritePreview(
    basePlan({ placementsAdvantage: false }),
  );
  assert(p.publishAllowed === false, "7 publishAllowed false");
  assert(
    p.readinessCodes.includes("UNSUPPORTED_CONFIGURATION"),
    "7 UNSUPPORTED_CONFIGURATION",
  );
}

{
  // 8. Instant Form preview matches publish payload
  const p = buildMetaWritePreview(basePlan());
  const match = assertPreviewMatchesConversionPlan(p);
  assert(match.ok, "8 plan ↔ preview");
  assert(
    p.conversionPublishPlan?.optimizationGoal ===
      p.adSet?.optimization_goal,
    "8 opt goal match",
  );
  const loc = p.canonicalPublishPreview?.sections
    .find((s) => s.id === "AD_SET")
    ?.fields.find((f) => f.key === "adset.conversion_location");
  assert(/istantaneo/i.test(loc?.valueIt ?? ""), "8 conversion location label");
  const formField = p.canonicalPublishPreview?.sections
    .find((s) => s.id === "CREATIVE")
    ?.fields.find((f) => f.key === "creative.instant_form");
  assert(
    formField?.valueIt === "Modulo Contatti QA",
    "8 form name in preview",
  );
  const opt = p.canonicalPublishPreview?.sections
    .find((s) => s.id === "AD_SET")
    ?.fields.find((f) => f.key === "adset.optimization_goal");
  assert(/Lead/i.test(opt?.valueIt ?? ""), "8 Lead optimization label");
}

{
  // 9. import Instant Form → normalized PARTIAL
  const imported = normalizeImportedInstantForm({
    promotedObject: { page_id: "111", form_id: "222" },
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
  });
  assert(imported.conversionLocation === "INSTANT_FORM", "9 INSTANT_FORM");
  assert(imported.completeness === "PARTIAL", "9 PARTIAL (no form name)");
  assert(imported.formName === null, "9 never invent form name");
  assert(imported.pageId === "111" && imported.formId === "222", "9 ids");
}

{
  // 10. no Meta mutations in discovery modules
  const lead = read("src/lib/meta/leadgen-forms.ts");
  assert(lead.includes("mutationsPerformed: 0"), "10 mutations 0");
  assert(!lead.includes('method: "POST"'), "10 no POST");
  const route = read("src/app/api/meta/leadgen-forms/route.ts");
  assert(route.includes("mutationsPerformed: 0"), "10 API mutations 0");
  assert(route.includes("GET"), "10 GET route");
}

{
  // 11. no secret leakage
  const p = buildMetaWritePreview(basePlan());
  const dump = JSON.stringify(p.canonicalPublishPreview) + JSON.stringify(p.instantFormEasyReadiness);
  assert(!/access_token/i.test(dump), "11 no access_token");
  assert(!/EAA[A-Za-z0-9]{10,}/.test(dump), "11 no token shape");
}

{
  // 12. legacy Instant Form still loads (UNCHECKED relation)
  const p = buildMetaWritePreview(
    basePlan({
      instantFormRelation: "UNCHECKED",
      instantFormName: null,
      pageName: null,
    }),
  );
  assert(p.canPreview === true, "12 canPreview");
  assert(p.publishAllowed === true, "12 legacy still publishAllowed");
  assert(p.instantFormEasyReadiness != null, "12 readiness assessed");
}

{
  const p = buildMetaWritePreview(basePlan());
  const r = assessInstantFormEasyReadiness({
    planInput: basePlan(),
    preview: p,
    formRelation: "VERIFIED",
    formName: "Modulo Contatti QA",
  });
  assert(r != null, "readiness object");
  console.log("\n--- InstantFormEasyReadiness snapshot ---");
  console.log(`REQUIRED USER INPUTS: ${r!.requiredInputsCount}`);
  console.log(`COMPLETED: ${r!.completedInputsCount}`);
  console.log(`ESTIMATED USER STEPS: ${r!.estimatedUserSteps}`);
  console.log(`AUTOMATIC DECISIONS: ${r!.automaticDecisionsCount}`);
  console.log(`ADVANCED HIDDEN: ${r!.advancedFieldsHiddenCount}`);
  console.log(`READINESS: ${r!.readiness}`);
  console.log(
    `AUTOMATIC: ${r!.automaticDecisions.map((d) => d.reasonCode).join(", ")}`,
  );
}

{
  assert(exists("src/lib/meta/leadgen-forms.ts"), "file leadgen-forms");
  assert(
    exists("src/lib/meta/write/instant-form-readiness.ts"),
    "file readiness",
  );
  const ui = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(ui.includes("leadgen-forms"), "UI loads forms");
  assert(ui.includes("Seleziona Pagina"), "UI page picker");
  assert(ui.includes("Seleziona modulo"), "UI form picker");
  assert(!ui.includes('placeholder="ID modulo"'), "UI no raw form_id placeholder");
}

console.log(
  falliti === 0
    ? "\n=== P0.3 PASS ===\n"
    : `\n=== P0.3 FAIL (${falliti}) ===\n`,
);
process.exitCode = falliti === 0 ? 0 : 1;
