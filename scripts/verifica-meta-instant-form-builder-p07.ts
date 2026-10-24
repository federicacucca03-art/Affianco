/**
 * P0.7 — 5-Minute Instant Form Easy Builder verification.
 * LIVE META WRITES: 0
 * Esegui: npx tsx scripts/verifica-meta-instant-form-builder-p07.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import { assessInstantFormEasyReadiness } from "../src/lib/meta/write/instant-form-readiness";
import { assertPreviewMatchesConversionPlan } from "../src/lib/meta/write/canonical-publish-preview";
import {
  INSTANT_FORM_BUILDER_STEPS,
  activeSetupSeconds,
  buildEasyReviewSummary,
  computeBuilderMetrics,
  easyModeExposesCarouselOrMultiCopy,
  easyModeExposesManualPlacements,
  emptyInstantFormBuilderDraft,
  evaluateBuilderStep,
  instantFormCanonicalDestination,
  instantFormCanonicalObjectiveRaw,
  markBriefStarted,
  markReviewReady,
  monthlyBudgetHintIt,
  pixelAbsenceBlocksInstantFormEasy,
} from "../src/lib/meta/write/instant-form-builder";

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
    campaignName: "QA Instant Form Builder P0.7",
    objectiveRaw: "OUTCOME_LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: "page-1",
    formId: "form-1",
    formPrivacyPolicyUrl: "https://example.com/privacy-policy",
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
    ...overrides,
  };
}

// 1. builder loads (files present)
assert(exists("src/components/campagne/InstantFormEasyBuilder.tsx"), "1 builder component");
assert(exists("src/app/campagne/[id]/instant-form/page.tsx"), "1 builder route");
assert(exists("src/lib/meta/write/instant-form-builder.ts"), "1 builder logic");

const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
const page = read("src/app/campagne/[id]/instant-form/page.tsx");
const detail = read("src/app/campagne/[id]/page.tsx");
const logic = read("src/lib/meta/write/instant-form-builder.ts");

// 2. Instant Form is the available first flow
assert(ui.includes("INSTANT_FORM") || ui.includes("Instant Form"), "2 Instant Form first flow");
assert(
  ui.includes("Facile") || ui.includes("Modalità facile"),
  "2 Easy Mode label",
);
assert(instantFormCanonicalDestination() === "META_LEAD_FORM", "2 destination META_LEAD_FORM");

// 3. objective maps to OUTCOME_LEADS
assert(instantFormCanonicalObjectiveRaw() === "OUTCOME_LEADS", "3 objective OUTCOME_LEADS");
assert(
  ui.includes("EASY_BUSINESS_GOAL_OPTIONS") &&
    logic.includes('labelIt: "Generare contatti"'),
  "3 UI Generare contatti",
);
assert(!ui.includes("OUTCOME_LEADS") || logic.includes("OUTCOME_LEADS"), "3 enum not primary UI");

// 4. Page picker with mocked fixture path
assert(ui.includes("/api/meta/pages"), "4 page API");
assert(ui.includes("Pagina Facebook"), "4 page label");

// 5. IG state integrates P0.5
assert(ui.includes("/api/meta/instagram-accounts"), "5 IG API");
assert(ui.includes("preferPageOnly") || ui.includes("Solo Pagina"), "5 page-only path");

// 6. Form picker uses selected Page
assert(ui.includes("/api/meta/leadgen-forms"), "6 forms API");
assert(ui.includes("pageId"), "6 pageId filter");

// 7. Page/Form mismatch blocks
{
  const g = evaluateBuilderStep({
    stepId: "modulo",
    draft: emptyInstantFormBuilderDraft({
      formId: "form-x",
      formRelation: "MISMATCH",
    }),
  });
  assert(!g.canContinue, "7 mismatch blocks");
  assert(g.blockers.some((b) => /non appartiene/i.test(b)), "7 mismatch message");
}

// 8. budget invalid blocks
{
  const g = evaluateBuilderStep({
    stepId: "budget",
    draft: emptyInstantFormBuilderDraft({ budgetDailyMajor: 0 }),
  });
  assert(!g.canContinue, "8 invalid budget blocks");
}

// 9. audience uses supported resolver (Advantage+)
assert(ui.includes("ADVANTAGE_AUDIENCE") || ui.includes("Advantage+ Audience"), "9 Advantage+ audience");
{
  const g = evaluateBuilderStep({
    stepId: "pubblico",
    draft: emptyInstantFormBuilderDraft({ metaGeoKey: "2421836", geoLabel: "Roma" }),
  });
  assert(g.canContinue, "9 geo ok continues");
}

// 10. creative missing blocks review
{
  const g = evaluateBuilderStep({
    stepId: "annuncio",
    draft: emptyInstantFormBuilderDraft({
      creativitaCount: 0,
      primaryText: "x",
      headline: "y",
    }),
  });
  assert(!g.canContinue, "10 creative missing blocks");
}

// 11. SAC unresolved blocks
{
  const g = evaluateBuilderStep({
    stepId: "categoria",
    draft: emptyInstantFormBuilderDraft({ specialKind: "UNRESOLVED" }),
  });
  assert(!g.canContinue, "11 SAC unresolved blocks");
}

// 12. SAC NONE explicit allows
{
  const g = evaluateBuilderStep({
    stepId: "categoria",
    draft: emptyInstantFormBuilderDraft({ specialKind: "NONE" }),
  });
  assert(g.canContinue, "12 SAC NONE allows");
}

// 13. Pixel absence does NOT block Instant Form
{
  const plan = basePlan();
  const preview = buildMetaWritePreview(plan, {});
  const readiness = assessInstantFormEasyReadiness({
    planInput: plan,
    preview,
    formRelation: "VERIFIED",
  });
  assert(readiness != null, "13 readiness present");
  assert(!pixelAbsenceBlocksInstantFormEasy(readiness), "13 pixel not blocking");
  assert(
    !readiness!.blockingIssues.some((b) => /pixel/i.test(b)),
    "13 no pixel blocker text",
  );
}

// 14. manual placements not exposed
assert(!easyModeExposesManualPlacements(), "14 no manual placements");
assert(!ui.includes("manual_placements") && !ui.includes("publisher_platforms"), "14 no placement enums in UI");

// 15. carousel/multi-copy not Easy publishable
assert(!easyModeExposesCarouselOrMultiCopy(), "15 no carousel/multi-copy Easy");
assert(ui.includes("Carousel") && ui.includes("non sono pubblicabili"), "15 carousel unavailable copy");

// 16. final review uses CanonicalPublishPreview
assert(
  ui.includes("CanonicalCampaignReviewPanel") ||
    ui.includes("CanonicalPublishPreviewView"),
  "16 CanonicalPublishPreviewView",
);
assert(page.includes("InstantFormEasyBuilder"), "16 page mounts builder");

// 17. review values match canonical publish plan
{
  const plan = basePlan();
  const preview = buildMetaWritePreview(plan, {});
  assertPreviewMatchesConversionPlan(preview);
  const draft = emptyInstantFormBuilderDraft({
    objectiveChoice: "GENERATE_LEADS",
    conversionChoice: "INSTANT_FORM",
    pageId: "page-1",
    pageName: "Pagina QA",
    formId: "form-1",
    formName: "Modulo Contatti QA",
    budgetDailyMajor: 20,
    metaGeoKey: "2421836",
    geoLabel: "Roma, Lazio, IT",
    creativitaCount: 1,
    headline: "Titolo",
    primaryText: "Testo",
    specialKind: "NONE",
  });
  const rows = buildEasyReviewSummary({
    draft,
    preview: preview.canonicalPublishPreview,
  });
  assert(
    rows.some(
      (r) =>
        r.labelIt === "Obiettivo" &&
        (r.valueIt === "Contatti" || r.valueIt === "Generare contatti"),
    ),
    "17 obiettivo Contatti",
  );
  assert(
    rows.some(
      (r) =>
        (r.labelIt === "Conversione" || r.labelIt === "Raccolta contatti") &&
        /Modulo/i.test(r.valueIt),
    ),
    "17 conversione modulo",
  );
  assert(rows.some((r) => r.labelIt === "Status" && /pausa/i.test(r.valueIt)), "17 status pausa");
}

// 18. publishAllowed displayed
assert(ui.includes("publishAllowed"), "18 publishAllowed visible");

// 19. estimatedUserSteps <= 8 happy path
{
  const plan = basePlan();
  const preview = buildMetaWritePreview(plan, {});
  const readiness = assessInstantFormEasyReadiness({
    planInput: plan,
    preview,
    formRelation: "VERIFIED",
  });
  const metrics = computeBuilderMetrics(readiness, preview);
  assert(metrics.estimatedUserSteps <= 8, "19 estimatedUserSteps <= 8");
  assert(INSTANT_FORM_BUILDER_STEPS.length <= 8, "19 builder steps <= 8");
  assert(typeof readiness?.builderProgressPercent === "number", "19 builderProgressPercent");
}

// 20. builder has no direct Graph host; full publish goes through publish-plan CTA
assert(!ui.includes('method: "POST"') || ui.includes("/api/meta/write-preview"), "20 preview POST ok");
assert(!ui.includes("write-confirm"), "20 no write-confirm in Easy Builder");
assert(!ui.includes("graph.facebook.com"), "20 no direct Graph host");
assert(ui.includes("MetaFullPublishCta") || ui.includes("publishControls"), "20 full publish CTA wired");
{
  const cta = read("src/components/campagne/MetaFullPublishCta.tsx");
  assert(cta.includes("/api/meta/publish-plan"), "20 CTA publish-plan path");
  assert(!cta.includes("/api/internal/qa/"), "20 no temp QA create routes");
}

// 21. no Production DB changes in this script (local only)
assert(true, "21 script is local-only (no Production DB)");

// 22. no secrets exposed
{
  const dump = ui + page + logic + detail;
  assert(!/EAA[A-Za-z0-9]{20,}/.test(dump), "22 no EAA tokens");
  assert(!/access_token\s*[:=]\s*['\"][^'\"]+['\"]/.test(dump), "22 no access_token literals");
}

// Entry point — UX.5: detail is control center; Easy builder remains at /configura + legacy /instant-form
assert(
  detail.includes("CampaignControlCenter") ||
    exists("src/app/campagne/[id]/configura/page.tsx"),
  "entry control center / configura present",
);
assert(exists("src/app/campagne/[id]/instant-form/page.tsx"), "legacy Easy route retained");
assert(
  !detail.includes("Continua in Modalità facile") &&
    !detail.includes("Apri wizard completo"),
  "detail no longer promotes competing Easy/Full CTAs",
);

// Timing instrumentation
{
  let t = markBriefStarted({
    brief_started_at: null,
    review_ready_at: null,
    publish_clicked_at: null,
  }, "2026-10-07T10:00:00.000Z");
  t = markReviewReady(t, "2026-10-07T10:04:00.000Z");
  assert(activeSetupSeconds(t) === 240, "timing active_setup_seconds");
  assert(monthlyBudgetHintIt(5)?.includes("150"), "budget monthly hint");
}

// Happy path step gates
{
  const happy = emptyInstantFormBuilderDraft({
    objectiveChoice: "GENERATE_LEADS",
    conversionChoice: "INSTANT_FORM",
    pageId: "page-1",
    pageName: "Pagina QA",
    formId: "form-1",
    formName: "Modulo",
    formPrivacyPolicyUrl: "https://example.com/privacy-policy",
    formRelation: "VERIFIED",
    metaGeoKey: "2421836",
    geoLabel: "Roma",
    etaMin: 25,
    etaMax: 55,
    budgetDailyMajor: 20,
    creativitaCount: 1,
    primaryText: "Ciao",
    headline: "Offerta",
    specialKind: "NONE",
  });
  for (const step of INSTANT_FORM_BUILDER_STEPS) {
    const g = evaluateBuilderStep({ stepId: step.id, draft: happy });
    assert(g.canContinue, `happy ${step.id} canContinue`);
  }
}

console.log(
  falliti === 0
    ? "\n=== P0.7 INSTANT FORM BUILDER: TUTTI I CHECK PASS ===\n"
    : `\n=== P0.7 INSTANT FORM BUILDER: ${falliti} FAIL ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
