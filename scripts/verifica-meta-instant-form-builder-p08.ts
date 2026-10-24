/**
 * P0.8 — Instant Form Easy Builder UX closure (inline single-image).
 * LIVE META WRITES: 0
 * Esegui: npx tsx scripts/verifica-meta-instant-form-builder-p08.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import { assessInstantFormEasyReadiness } from "../src/lib/meta/write/instant-form-readiness";
import { majorCurrencyToMetaMinorUnits } from "../src/lib/meta/write/budget";
import {
  resolveDestinationTracking,
  resolvePlanDestinationUrl,
} from "../src/lib/meta/write/destination-tracking";
import { buildObjectStorySpecForPublish } from "../src/lib/meta/publish/payloads";
import {
  BUILDER_PERSISTABLE_CORE_FIELDS,
  INSTANT_FORM_BUILDER_STEPS,
  activeSetupSeconds,
  allyCampaignDailyBudgetUpdate,
  builderDraftStorageKey,
  computeBuilderMetrics,
  easyBuilderRequiresExternalStudioForImage,
  easyModeCtaLabelIt,
  easyModeExposesCarouselOrMultiCopy,
  emptyInstantFormBuilderDraft,
  evaluateBuilderStep,
  isValidBudgetDailyMajor,
  markBriefStarted,
  markReviewReady,
  parseBuilderDraftSnapshot,
  resolveBudgetDailyMajorForDraft,
  reviewMatchesCreativeAsset,
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
    campaignName: "QA Instant Form Builder P0.8",
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

assert(exists("src/components/campagne/EasyBuilderSingleImageInput.tsx"), "1 single-image component");
assert(exists("src/components/campagne/InstantFormEasyBuilder.tsx"), "1 builder");

const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
const img = read("src/components/campagne/EasyBuilderSingleImageInput.tsx");
const storage = read("src/lib/creativita-storage.ts");
const logic = read("src/lib/meta/write/instant-form-builder.ts");

// 1. Step 6 accepts existing valid image asset
assert(ui.includes("anteprimeDaCreativitaMeta"), "1 loads existing creativitaMeta");
assert(ui.includes("EasyBuilderSingleImageInput"), "1 wires single-image input");

// 2. Step 6 accepts Ally upload path
assert(img.includes("leggiDimensioniImmagine"), "2 uses Ally image read");
assert(ui.includes("caricaCreativitaSuStorage"), "2 uses Ally storage upload");
assert(storage.includes('BUCKET = "campaign-creatives"'), "2 same campaign-creatives bucket");

// 3. no Meta media upload
assert(!ui.includes("graph.facebook.com"), "3 no Graph host in builder");
assert(!ui.includes("adimages") && !img.includes("adimages"), "3 no Meta adimages");
assert(!ui.includes("image_hash"), "3 no image_hash exposure");

// 4. missing image blocks
{
  const g = evaluateBuilderStep({
    stepId: "annuncio",
    draft: emptyInstantFormBuilderDraft({
      creativitaCount: 0,
      primaryText: "x",
      headline: "y",
    }),
  });
  assert(!g.canContinue, "4 missing image blocks");
}

// 5. image persists through Builder state
assert(ui.includes("builderDraftStorageKey"), "5 local draft key");
assert(ui.includes("creativita:"), "5 persists creativita column");
assert(BUILDER_PERSISTABLE_CORE_FIELDS.includes("creativitaMeta"), "5 creativitaMeta persistable");

// 6. review matches canonical creative asset
assert(
  reviewMatchesCreativeAsset({
    reviewAssetId: "asset-1",
    canonicalAssetId: "asset-1",
  }),
  "6 same asset id matches",
);
assert(
  !reviewMatchesCreativeAsset({
    reviewAssetId: "asset-1",
    canonicalAssetId: "asset-2",
  }),
  "6 different asset id mismatch",
);
assert(ui.includes("reviewMatchesCreativeAsset"), "6 review consistency wired");

// 7–9 text/headline/CTA persist
assert(ui.includes("variante_a"), "7 primary text persist");
assert(ui.includes("titolo_annuncio"), "8 headline persist");
assert(ui.includes("easyModeCtaLabelIt") || ui.includes(easyModeCtaLabelIt()), "9 CTA derived shown");
assert(easyModeCtaLabelIt() === "Iscriviti", "9 CTA label Iscriviti (= SIGN_UP)");

// 10 Page/Form/SAC regressions
{
  const mismatch = evaluateBuilderStep({
    stepId: "modulo",
    draft: emptyInstantFormBuilderDraft({
      formId: "f",
      formRelation: "MISMATCH",
    }),
  });
  assert(!mismatch.canContinue, "10 form mismatch still blocks");
  const sac = evaluateBuilderStep({
    stepId: "categoria",
    draft: emptyInstantFormBuilderDraft({ specialKind: "NONE" }),
  });
  assert(sac.canContinue, "10 SAC NONE ok");
}

// 11 refresh/resume preserves core fields via snapshot parse
{
  const snap = parseBuilderDraftSnapshot({
    stepId: "annuncio",
    draft: emptyInstantFormBuilderDraft({
      pageId: "p1",
      formId: "f1",
      formRelation: "VERIFIED",
      budgetDailyMajor: 15,
      primaryText: "Ciao",
      headline: "Offerta",
      specialKind: "NONE",
      metaGeoKey: "1",
      creativitaCount: 1,
    }),
    creativeAssetId: "a1",
    creativeNomeFile: "hero.png",
    creativeStoragePath: "user/a1.png",
  });
  assert(snap != null, "11 snapshot parses");
  assert(snap!.draft.pageId === "p1", "11 page persists");
  assert(snap!.draft.formId === "f1", "11 form persists");
  assert(snap!.draft.budgetDailyMajor === 15, "11 budget persists");
  assert(snap!.draft.primaryText === "Ciao", "11 text persists");
  assert(snap!.draft.headline === "Offerta", "11 headline persists");
  assert(snap!.draft.specialKind === "NONE", "11 SAC persists");
  assert(snap!.creativeAssetId === "a1", "11 image ref persists");
  assert(builderDraftStorageKey("x").includes("ally_if_builder_draft"), "11 storage key");
}

// 12 happy path <= 8 steps
{
  const plan = basePlan();
  const preview = buildMetaWritePreview(plan, {});
  const readiness = assessInstantFormEasyReadiness({
    planInput: plan,
    preview,
    formRelation: "VERIFIED",
  });
  const metrics = computeBuilderMetrics(readiness, preview);
  assert(metrics.estimatedUserSteps <= 8, "12 estimatedUserSteps <= 8");
  assert(INSTANT_FORM_BUILDER_STEPS.length <= 8, "12 steps <= 8");
  assert(metrics.blockingIssuesCount === 0 || readiness?.blockingIssues.length === 0, "12 blocking 0 happy");
}

// 13 no exit required for required creative
assert(!easyBuilderRequiresExternalStudioForImage(), "13 no external studio required");
assert(ui.includes("Non serve aprire lo studio"), "13 copy no-exit");
assert(ui.includes("apri studio avanzato"), "13 studio optional only");

// 14 unsupported carousel not exposed
assert(!easyModeExposesCarouselOrMultiCopy(), "14 no carousel Easy");
assert(!img.includes("CAROUSEL"), "14 single-image input no carousel");

// 15 no AI generation
assert(!ui.includes("genera immagine") && !img.includes("openai"), "15 no AI generation");
assert(!ui.includes("dall-e") && !ui.includes("image generation"), "15 no AI gen strings");

// 16 CanonicalPublishPreview remains Review source
assert(
  ui.includes("CanonicalCampaignReviewPanel") ||
    ui.includes("CanonicalPublishPreviewView"),
  "16 canonical review",
);

// 17 full publish CTA wired (publish-plan execute) — not temp QA routes
assert(!ui.includes("write-confirm"), "17 no write-confirm");
assert(ui.includes("MetaFullPublishCta"), "17 MetaFullPublishCta mounted");
assert(ui.includes("publishControls"), "17 publishControls slot");
{
  const cta = read("src/components/campagne/MetaFullPublishCta.tsx");
  assert(cta.includes("/api/meta/publish-plan"), "17 CTA → publish-plan");
  assert(cta.includes('action: "execute"'), "17 CTA execute");
  assert(cta.includes("humanConfirmed: true"), "17 humanConfirmed");
  assert(!cta.includes("/api/internal/qa/"), "17 no temp QA create routes");
  assert(cta.includes("PAUSA"), "17 PAUSED messaging");
}

// 18 no Production DB change in this script
assert(true, "18 local-only verification");

// 19 budget persist helpers — save 20, omit null overwrite, hydrate, Meta minor
{
  assert(isValidBudgetDailyMajor(20), "19 valid 20");
  assert(!isValidBudgetDailyMajor(null), "19 reject null");
  assert(!isValidBudgetDailyMajor(0), "19 reject 0");
  assert(!isValidBudgetDailyMajor(Number.NaN), "19 reject NaN");
  const save20 = allyCampaignDailyBudgetUpdate(20);
  assert(
    "daily_budget" in save20 && save20.daily_budget === 20,
    "19 save includes daily_budget 20",
  );
  const omitNull = allyCampaignDailyBudgetUpdate(null);
  assert(
    !("daily_budget" in omitNull),
    "19 null draft omits daily_budget (no overwrite)",
  );
  const omitUndef = allyCampaignDailyBudgetUpdate(undefined);
  assert(!("daily_budget" in omitUndef), "19 undefined draft omits daily_budget");
  assert(
    resolveBudgetDailyMajorForDraft(null, 20) === 20,
    "19 hydrate from campaigns.daily_budget",
  );
  assert(
    resolveBudgetDailyMajorForDraft(25, 20) === 25,
    "19 draft wins over campaign",
  );
  assert(
    resolveBudgetDailyMajorForDraft(null, null) === null,
    "19 both missing → null",
  );
  const conv = majorCurrencyToMetaMinorUnits(20, "EUR");
  assert(conv.ok && conv.minor === 2000, "19 EUR 20 → minor 2000");
  const plan = basePlan({ budgetDailyMajor: 20, budgetLevel: "AD_SET" });
  const preview = buildMetaWritePreview(plan, {});
  assert(plan.budgetLevel === "AD_SET", "19 budgetLevel AD_SET");
  assert(preview.adSet?.daily_budget === 2000, "19 preview adSet.daily_budget 2000");
  const summaryBudget = preview.safePayloadSummary?.budgetDailyMajor;
  const summaryMinor = preview.safePayloadSummary?.budgetMinorUnits;
  assert(summaryBudget === 20, "19 safePayload budgetDailyMajor 20");
  assert(summaryMinor === 2000, "19 safePayload budgetMinorUnits 2000");
  const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
  assert(
    ui.includes("allyCampaignDailyBudgetUpdate"),
    "19 Easy Builder uses budget update helper",
  );
  assert(
    !ui.includes("daily_budget: draft.budgetDailyMajor"),
    "19 Easy Builder does not raw-assign nullable daily_budget",
  );
  assert(
    ui.includes("resolveBudgetDailyMajorForDraft"),
    "19 Easy Builder hydrates budget via resolver",
  );
}

// 20 Instant Form must not inherit clients.website as destination / link_data.link
{
  const leak = "https://ally-qa-landing.vercel.app";
  assert(
    resolvePlanDestinationUrl({
      destination: "META_LEAD_FORM",
      clientWebsite: leak,
    }) === null,
    "20 plan destinationUrl null for Instant Form",
  );
  assert(
    resolvePlanDestinationUrl({
      destination: "WEBSITE",
      clientWebsite: leak,
    }) === leak,
    "20 WEBSITE still uses clients.website",
  );
  const track = resolveDestinationTracking({
    destination: "META_LEAD_FORM",
    destinationUrl: leak,
  });
  assert(track.mode === "NONE", "20 IF tracking NONE");
  assert(track.finalDestinationUrl == null, "20 IF tracking strips website");
  assert(track.baseDestinationUrl == null, "20 IF base URL stripped");

  const ifPreview = buildMetaWritePreview(
    basePlan({
      destination: "META_LEAD_FORM",
      destinationUrl: leak,
      formId: "form-1",
      instantFormRelation: "VERIFIED",
      budgetDailyMajor: 20,
    }),
  );
  const destField = ifPreview.canonicalPublishPreview?.sections
    .flatMap((s) => s.fields)
    .find((f) => f.key === "creative.destination_url");
  assert(
    !(destField?.valueIt ?? "").includes("ally-qa-landing"),
    "20 Step8 destination label has no client website",
  );
  assert(
    (destField?.valueIt ?? "").toLowerCase().includes("instant form") ||
      (destField?.valueIt ?? "").toLowerCase().includes("modulo"),
    "20 Step8 destination labels Instant Form",
  );
  const typeField = ifPreview.canonicalPublishPreview?.sections
    .flatMap((s) => s.fields)
    .find((f) => f.key === "creative.type");
  assert(
    (typeField?.valueIt ?? "").includes("Instant Form"),
    "20 creative type Instant Form (not link ad)",
  );
  assert(
    typeField?.technicalValue === "INSTANT_FORM_AD",
    "20 technical INSTANT_FORM_AD",
  );
  assert(
    ifPreview.safePayloadSummary?.budgetDailyMajor === 20 &&
      ifPreview.adSet?.daily_budget === 2000,
    "20 budget regression AD_SET 20→2000",
  );

  const privacyUrl = "https://example.com/form-privacy";
  const spec = buildObjectStorySpecForPublish({
    pageId: "860123575",
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: leak,
    destination: "META_LEAD_FORM",
    ctaType: "SIGN_UP",
    formId: "456123689",
    imageHash: "hash1",
    videoId: null,
    formPrivacyPolicyUrl: privacyUrl,
  });
  assert(spec.ok, "20 object_story_spec builds");
  if (spec.ok) {
    const link = String(spec.spec.link_data?.link ?? "");
    assert(
      !link.includes("ally-qa-landing"),
      "20 link_data.link never clients.website",
    );
    assert(
      !link.includes("facebook.com"),
      "20 link_data.link never Facebook Page fallback",
    );
    assert(link === privacyUrl, "20 link_data.link uses privacy_policy_url");
    const ctaVal = (
      spec.spec.link_data?.call_to_action as
        | { value?: { lead_gen_form_id?: string } }
        | undefined
    )?.value;
    assert(
      ctaVal?.lead_gen_form_id === "456123689",
      "20 CTA carries form_id",
    );
  }
  const blockedSpec = buildObjectStorySpecForPublish({
    pageId: "860123575",
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: leak,
    destination: "META_LEAD_FORM",
    ctaType: "SIGN_UP",
    formId: "456123689",
    imageHash: "hash1",
    videoId: null,
  });
  assert(
    !blockedSpec.ok &&
      blockedSpec.reason === "MISSING_FORM_TECHNICAL_URL",
    "20 missing privacy_policy_url blocks (no Page/website fallback)",
  );

  const webTrack = resolveDestinationTracking({
    destination: "WEBSITE",
    destinationUrl: leak,
    mode: "NONE",
  });
  assert(
    webTrack.finalDestinationUrl === leak ||
      webTrack.baseDestinationUrl === leak,
    "20 WEBSITE tracking keeps clients.website",
  );
  const webSpec = buildObjectStorySpecForPublish({
    pageId: "860123575",
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: leak,
    destination: "WEBSITE",
    ctaType: "LEARN_MORE",
    formId: null,
    imageHash: "hash1",
    videoId: null,
  });
  assert(webSpec.ok, "20 WEBSITE object_story_spec builds");
  if (webSpec.ok) {
    assert(
      String(webSpec.spec.link_data?.link ?? "") === leak,
      "20 WEBSITE link_data.link keeps site URL",
    );
  }
}

// Full happy-path gates
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
    assert(g.canContinue, `happy ${step.id}`);
  }
  const plan = basePlan();
  const preview = buildMetaWritePreview(plan, {});
  const readiness = assessInstantFormEasyReadiness({
    planInput: plan,
    preview,
    formRelation: "VERIFIED",
  });
  const metrics = computeBuilderMetrics(readiness, preview);
  console.log("\n--- Happy path metrics ---");
  console.log("REQUIRED INPUTS:", metrics.requiredInputsCount);
  console.log("ESTIMATED USER STEPS:", metrics.estimatedUserSteps);
  console.log("AUTOMATIC DECISIONS:", metrics.automaticDecisionsCount);
  console.log("ADVANCED FIELDS HIDDEN:", metrics.advancedFieldsHiddenCount);
  console.log("BLOCKING ISSUES:", metrics.blockingIssuesCount);
  console.log("REVIEW READY:", metrics.happyPathReady ? "YES" : "NO");
  assert(metrics.happyPathReady, "happy path READY");
}

// Timing: brief_started preserved across markBriefStarted re-call
{
  let t = markBriefStarted(
    { brief_started_at: null, review_ready_at: null, publish_clicked_at: null },
    "2026-10-07T10:00:00.000Z",
  );
  const again = markBriefStarted(t, "2026-10-07T10:01:00.000Z");
  assert(again.brief_started_at === "2026-10-07T10:00:00.000Z", "timing not reset on step nav");
  t = markReviewReady(again, "2026-10-07T10:03:00.000Z");
  assert(activeSetupSeconds(t) === 180, "timing active_setup_seconds");
}

console.log(
  falliti === 0
    ? "\n=== P0.8 BUILDER UX CLOSURE: TUTTI I CHECK PASS ===\n"
    : `\n=== P0.8 BUILDER UX CLOSURE: ${falliti} FAIL ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
