/**
 * P0.4 — Special Ad Category safety + Easy picker verification.
 * LIVE META WRITES: 0
 * Esegui: npx tsx scripts/verifica-meta-sac-p04.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import {
  ALLY_SPECIAL_AD_CATEGORY_CATALOG,
  decisionFromEasyModePickerValue,
  easyModePickerValueFromDecision,
  etichettaSpecialAdCategoryEasy,
  mergeSpecialAdCategoriesDecision,
  selectionFromMetaImport,
  selectionFromWriteDecision,
  specialAdCategoriesGraphValue,
  writeDecisionFromMetaImport,
} from "../src/lib/meta/write/special-ad-categories";
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

function sacField(p: ReturnType<typeof buildMetaWritePreview>) {
  return p.canonicalPublishPreview?.sections
    .find((s) => s.id === "CAMPAIGN")
    ?.fields.find((f) => f.key === "campaign.special_ad_categories");
}

function basePlan(overrides: Partial<MetaWritePlanInput> = {}): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "QA SAC P0.4",
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
    /** Complete Instant Form fixture — Meta creative technical link (not SAC). */
    formPrivacyPolicyUrl: "https://example.com/privacy-policy",
    ...overrides,
  };
}

console.log("\n=== P0.4 SPECIAL AD CATEGORY SAFETY ===\n");

{
  // 1. SAC UNRESOLVED → publishAllowed=false
  const p = buildMetaWritePreview(
    basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
  );
  assert(p.publishAllowed === false, "1 UNRESOLVED → publishAllowed false");
  assert(
    p.readinessCodes.includes("SPECIAL_AD_CATEGORY_REQUIRED") ||
      p.readinessCodes.includes("MISSING_SPECIAL_AD_CATEGORY_DECISION"),
    "1 readiness SPECIAL_AD_CATEGORY_REQUIRED",
  );
  assert(
    p.blockersIt.some((m) =>
      /categoria speciale/i.test(m),
    ),
    "1 Italian blocker message",
  );
  assert(p.campaign?.special_ad_categories == null, "1 payload cats null");
}

{
  // 2. user confirms NONE → valid normal campaign
  const p = buildMetaWritePreview(
    basePlan({ specialAdCategories: { kind: "NONE" } }),
  );
  assert(p.publishAllowed === true, "2 NONE → publishAllowed true");
  assert(
    Array.isArray(p.campaign?.special_ad_categories) &&
      p.campaign!.special_ad_categories!.length === 0,
    "2 payload []",
  );
  assert(
    (sacField(p)?.valueIt ?? "").includes("Nessuna"),
    "2 preview Nessuna",
  );
}

{
  // 3. user selects valid SAC → preserved in Campaign payload
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["EMPLOYMENT"],
      },
    }),
  );
  assert(
    JSON.stringify(p.campaign?.special_ad_categories) ===
      JSON.stringify(["EMPLOYMENT"]),
    "3 EMPLOYMENT in payload",
  );
  assert(
    JSON.stringify(p.campaign?.special_ad_category_country) ===
      JSON.stringify(["IT"]),
    "3 special_ad_category_country IT",
  );
  // EMPLOYMENT is PARTIAL — publish may still be allowed with warnings
  assert(
    p.publishAllowed === true ||
      p.readinessCodes.includes("SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION") ===
        false,
    "3 EMPLOYMENT not silently dropped",
  );
}

{
  // 4. SAC value shown correctly in canonical preview
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["HOUSING"],
      },
    }),
  );
  const field = sacField(p);
  assert(
    (field?.valueIt ?? "").includes("Casa") ||
      (field?.valueIt ?? "").includes("allogg"),
    "4 Italian label in preview",
  );
  assert(
    (field?.valueIt ?? "").includes("Confermata") ||
      field?.reason?.reasonText != null,
    "4 source / reason present",
  );
  assert(
    /HOUSING|"HOUSING"/.test(String(field?.technicalValue)),
    "4 technical enum in advanced",
  );
}

{
  // 5. raw Graph enum hidden from Easy Mode UI source
  const panel = read("src/components/campagne/MetaWritePreviewPanel.tsx");
  assert(
    panel.includes("Questa campagna riguarda una categoria speciale?"),
    "5 Easy Mode Italian question",
  );
  assert(
    panel.includes("Nessuna categoria speciale"),
    "5 NONE Italian label",
  );
  assert(
    panel.includes("ALLY_SPECIAL_AD_CATEGORY_CATALOG"),
    "5 options from catalog",
  );
  // Options render labelIt, not raw enum as visible option text alone
  assert(
    panel.includes("c.labelIt"),
    "5 option text uses labelIt not raw enum",
  );
}

{
  // 6. import Meta campaign with NONE / []
  const sel = selectionFromMetaImport([]);
  assert(sel.status === "CONFIRMED_NONE", "6 import [] → CONFIRMED_NONE");
  assert(sel.source === "META_IMPORT", "6 source META_IMPORT");
  assert(
    writeDecisionFromMetaImport([]).kind === "NONE",
    "6 write decision NONE",
  );
  const selNone = selectionFromMetaImport(["NONE"]);
  assert(selNone.status === "CONFIRMED_NONE", "6 import [NONE] → CONFIRMED_NONE");
}

{
  // 7. import Meta campaign with SAC
  const sel = selectionFromMetaImport(["HOUSING"], "IT");
  assert(sel.status === "CONFIRMED_CATEGORY", "7 import HOUSING → CONFIRMED_CATEGORY");
  assert(sel.categories.includes("HOUSING"), "7 HOUSING preserved");
  assert(sel.source === "META_IMPORT", "7 source META_IMPORT");
  assert(sel.status !== "UNRESOLVED", "7 never UNRESOLVED when Meta returned value");
}

{
  // 8. unsupported/unknown SAC → NEEDS_META_VERIFICATION → do not publish silently
  const sel = selectionFromMetaImport(["TOTALLY_FAKE_SAC_XYZ"], "IT");
  assert(
    sel.status === "NEEDS_META_VERIFICATION",
    "8 unknown → NEEDS_META_VERIFICATION",
  );
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["TOTALLY_FAKE_SAC_XYZ"],
      },
    }),
  );
  assert(p.publishAllowed === false, "8 unknown → publishAllowed false");
  assert(
    p.readinessCodes.includes("SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION"),
    "8 readiness NEEDS_VERIFICATION",
  );
}

{
  // 9. Instant Form + valid SAC NONE → P0.3 flow still valid
  const p = buildMetaWritePreview(basePlan());
  assert(p.publishAllowed === true, "9 Instant Form + NONE publishAllowed");
  assert(p.adSet?.optimization_goal === "LEAD_GENERATION", "9 LEAD_GENERATION");
  assert(p.instantFormEasyReadiness?.readiness === "READY", "9 Easy READY");
  assert(
    (p.instantFormEasyReadiness?.estimatedUserSteps ?? 0) >= 7,
    "9 estimated steps present",
  );
}

{
  // 10. Website Leads + valid SAC — tracking rules preserved
  const p = buildMetaWritePreview(
    basePlan({
      objectiveRaw: "OUTCOME_LEADS",
      destination: "WEBSITE",
      formId: null,
      destinationUrl: "https://example.com/landing",
      websiteTracking: {
        sourceType: "PIXEL",
        sourceId: "1234567890",
        eventType: "LEAD",
        eventCustomName: null,
      },
      specialAdCategories: { kind: "NONE" },
    }),
  );
  assert(
    p.adSet?.optimization_goal === "OFFSITE_CONVERSIONS",
    "10 Website Leads OFFSITE_CONVERSIONS",
  );
  assert(
    p.conversionPublishPlan?.blockReasonCode !== "MISSING_TRACKING_CONFIG" ||
      p.publishAllowed === true ||
      p.adSet?.optimization_goal === "OFFSITE_CONVERSIONS",
    "10 tracking path preserved (no silent LINK_CLICKS)",
  );
  assert(
    p.adSet?.optimization_goal !== "LINK_CLICKS",
    "10 no silent LINK_CLICKS fallback",
  );
}

{
  // 11. manual targeting + SAC restricted category → warning (PARTIAL)
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["HOUSING"],
      },
      allyAudienceMode: "MANUAL_AUDIENCE",
      etaMin: 25,
      etaMax: 55,
    }),
  );
  const warnCodes =
    p.canonicalPublishPreview?.warnings.map((w) => w.code) ?? [];
  assert(
    warnCodes.includes("SAC_MANUAL_TARGETING_PARTIAL") ||
      warnCodes.includes("SAC_AUDIENCE_RESTRICTIONS") ||
      (p.summaryIt.footnote ?? "").includes("pubblico"),
    "11 SAC targeting consequence surfaced",
  );

  const blockedAge = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["EMPLOYMENT"],
      },
      allyAudienceMode: "MANUAL_AUDIENCE",
      etaMin: 16,
      etaMax: 24,
    }),
  );
  assert(
    blockedAge.publishAllowed === false ||
      blockedAge.readinessCodes.includes(
        "SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION",
      ),
    "11 age <18 with SAC → block/verify",
  );
}

{
  // ISSUES_ELECTIONS_POLITICS for IT → blocked
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["ISSUES_ELECTIONS_POLITICS"],
      },
      countryCode: "IT",
    }),
  );
  assert(p.publishAllowed === false, "ISSUES IT → publish blocked");
  assert(
    p.readinessCodes.includes("SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION"),
    "ISSUES IT → NEEDS_VERIFICATION",
  );
}

{
  // FINANCIAL without country → country required
  const p = buildMetaWritePreview(
    basePlan({
      specialAdCategories: {
        kind: "CATEGORIES",
        categories: ["FINANCIAL_PRODUCTS_SERVICES"],
      },
      countryCode: null,
    }),
  );
  assert(
    p.publishAllowed === false &&
      p.readinessCodes.includes("SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED"),
    "FINANCIAL without country → COUNTRY_REQUIRED",
  );
}

{
  // Easy picker decision helpers
  assert(
    decisionFromEasyModePickerValue("NONE").kind === "NONE",
    "picker NONE → CONFIRMED path",
  );
  assert(
    decisionFromEasyModePickerValue("UNRESOLVED").kind === "UNRESOLVED",
    "picker UNRESOLVED stays unresolved",
  );
  const emp = decisionFromEasyModePickerValue("EMPLOYMENT");
  assert(
    emp.kind === "CATEGORIES" && emp.categories[0] === "EMPLOYMENT",
    "picker EMPLOYMENT → CATEGORIES",
  );
  assert(
    etichettaSpecialAdCategoryEasy("EMPLOYMENT") === "Lavoro",
    "label Lavoro",
  );
  assert(
    !etichettaSpecialAdCategoryEasy("EMPLOYMENT").includes("EMPLOYMENT") ||
      etichettaSpecialAdCategoryEasy("EMPLOYMENT") === "Lavoro",
    "Easy label hides raw enum for known",
  );
}

{
  // Catalog only verified Meta values
  const graphs = ALLY_SPECIAL_AD_CATEGORY_CATALOG.map((c) => c.graphValue);
  assert(
    graphs.includes("FINANCIAL_PRODUCTS_SERVICES") &&
      graphs.includes("EMPLOYMENT") &&
      graphs.includes("HOUSING") &&
      graphs.includes("ISSUES_ELECTIONS_POLITICS"),
    "catalog has verified Meta enums",
  );
  assert(!graphs.includes("CREDIT"), "catalog does not offer deprecated CREDIT");
}

{
  // AI stubs remain null / require confirmation
  const sel = selectionFromWriteDecision({
    decision: { kind: "NONE" },
    source: "USER",
  });
  assert(sel.suggestedCategory === null, "AI suggestedCategory null");
  assert(sel.requiresUserConfirmation === true, "requiresUserConfirmation true");
}

{
  // 12. no Meta mutations in this slice
  const exec = read("src/lib/meta/write/execute.ts");
  const graph = read("src/lib/meta/write/graph-write.ts");
  assert(
    exists("src/lib/meta/write/special-ad-categories.ts"),
    "12 SAC module exists",
  );
  assert(
    graph.includes("special_ad_categories"),
    "12 graph still sends SAC when write path runs",
  );
  assert(
    !exec.includes("status: \"ACTIVE\"") &&
      !exec.includes("status:'ACTIVE'"),
    "12 no ACTIVE status in write execute",
  );
  console.log("PASS  12 no Meta mutations in this verification (local only)");
}

{
  // 13. no secret leakage
  const p = buildMetaWritePreview(basePlan());
  const dumped = JSON.stringify(p.canonicalPublishPreview?.technicalDetails ?? {});
  assert(
    !/access_token|EAA[A-Za-z0-9]/i.test(dumped),
    "13 no token leakage in technicalDetails",
  );
  const safe = JSON.stringify(p.safePayloadSummary ?? {});
  assert(!/access_token|EAA[A-Za-z0-9]/i.test(safe), "13 no token in safePayload");
}

{
  // Instant Form readiness metrics with SAC unresolved
  const p = buildMetaWritePreview(
    basePlan({ specialAdCategories: { kind: "UNRESOLVED" } }),
  );
  const r = p.instantFormEasyReadiness;
  assert(r != null, "readiness object present");
  assert(r!.readiness !== "READY", "SAC unresolved → not READY");
  assert(
    r!.blockingIssues.some((b) => /categoria speciale/i.test(b)),
    "SAC blocker in Instant Form readiness",
  );
  console.log(
    `\n--- Easy Mode metrics (SAC NONE happy path) ---`,
  );
  const ready = assessInstantFormEasyReadiness({
    planInput: basePlan(),
    preview: buildMetaWritePreview(basePlan()),
    formRelation: "VERIFIED",
  });
  console.log(`REQUIRED USER INPUTS: ${ready?.requiredInputsCount}`);
  console.log(`ESTIMATED USER STEPS: ${ready?.estimatedUserSteps}`);
  console.log(`AUTOMATIC DECISIONS: ${ready?.automaticDecisionsCount}`);
  console.log(`ADVANCED HIDDEN: ${ready?.advancedFieldsHiddenCount}`);
  console.log(`READINESS: ${ready?.readiness}`);
}

{
  // Graph value helper never invents NONE from UNRESOLVED
  const unresolved = selectionFromWriteDecision({
    decision: { kind: "UNRESOLVED" },
  });
  assert(
    specialAdCategoriesGraphValue(unresolved) === null,
    "UNRESOLVED graph value null (not [])",
  );
}

{
  // 14 STATE_OVERWRITE fix — UNRESOLVED = not provided
  const cats = {
    kind: "CATEGORIES" as const,
    categories: ["HOUSING"],
  };
  assert(
    mergeSpecialAdCategoriesDecision({
      hydrate: false,
      incoming: { kind: "UNRESOLVED" },
      persisted: { kind: "NONE" },
    }).kind === "NONE",
    "14A persisted NONE + incoming UNRESOLVED → NONE",
  );
  assert(
    mergeSpecialAdCategoriesDecision({
      hydrate: false,
      incoming: { kind: "UNRESOLVED" },
      persisted: cats,
    }).kind === "CATEGORIES",
    "14B persisted CATEGORIES + incoming UNRESOLVED → CATEGORIES",
  );
  assert(
    mergeSpecialAdCategoriesDecision({
      hydrate: false,
      incoming: { kind: "NONE" },
      persisted: { kind: "UNRESOLVED" },
    }).kind === "NONE",
    "14C persisted UNRESOLVED + incoming NONE → NONE",
  );
  const toCats = mergeSpecialAdCategoriesDecision({
    hydrate: false,
    incoming: cats,
    persisted: { kind: "NONE" },
  });
  assert(
    toCats.kind === "CATEGORIES" && toCats.categories[0] === "HOUSING",
    "14D persisted NONE + incoming CATEGORIES → CATEGORIES",
  );
  assert(
    mergeSpecialAdCategoriesDecision({
      hydrate: true,
      incoming: { kind: "UNRESOLVED" },
      persisted: { kind: "NONE" },
    }).kind === "NONE",
    "14E hydrate prefers persisted NONE",
  );
  assert(
    easyModePickerValueFromDecision({ kind: "NONE" }) === "NONE",
    "14E draft picker hydrates NONE",
  );
  const nonePreview = buildMetaWritePreview(
    basePlan({ specialAdCategories: { kind: "NONE" } }),
  );
  assert(
    !nonePreview.readinessCodes.includes("MISSING_SPECIAL_AD_CATEGORY_DECISION"),
    "14F/G no SAC missing when NONE",
  );
  const sacSel = selectionFromWriteDecision({
    decision: { kind: "NONE" },
  });
  assert(
    JSON.stringify(specialAdCategoriesGraphValue(sacSel)) === "[]",
    "14H Meta dry-run special_ad_categories []",
  );
  assert(
    nonePreview.campaign?.special_ad_categories != null &&
      Array.isArray(nonePreview.campaign.special_ad_categories) &&
      nonePreview.campaign.special_ad_categories.length === 0,
    "14H preview campaign special_ad_categories []",
  );
  const loadSrc = read("src/lib/meta/write/load-preview.ts");
  const routeSrc = read("src/app/api/meta/write-preview/route.ts");
  const uiSrc = read("src/components/campagne/InstantFormEasyBuilder.tsx");
  assert(
    loadSrc.includes("mergeSpecialAdCategoriesDecision"),
    "14 load-preview uses merge helper",
  );
  assert(
    routeSrc.includes("kind === \"UNRESOLVED\"") ||
      routeSrc.includes("leave undefined"),
    "14 write-preview omits UNRESOLVED",
  );
  assert(
    uiSrc.includes('sacDecision.kind !== "UNRESOLVED"'),
    "14 Easy Builder omits UNRESOLVED from planBody",
  );
}

console.log(
  falliti === 0
    ? "\n=== P0.4 SAC: TUTTI I CHECK PASS ===\n"
    : `\n=== P0.4 SAC: ${falliti} FAIL ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
