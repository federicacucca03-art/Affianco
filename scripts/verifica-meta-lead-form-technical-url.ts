/**
 * META_LEAD_FORM Creative technical link = Instant Form privacy_policy_url.
 * LIVE META WRITES: 0 | DB MUTATIONS: 0
 * Esegui: npx tsx scripts/verifica-meta-lead-form-technical-url.ts
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildMetaCreativePayload,
  buildObjectStorySpecForPublish,
  creativeBlockingIssues,
  isValidMetaLeadFormTechnicalUrl,
  normalizeMetaLeadFormTechnicalUrl,
} from "../src/lib/meta/publish/payloads";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";
import {
  LEADGEN_FORM_FIELDS,
  normalizeLeadgenPrivacyPolicyUrl,
  parseLeadgenFormsPage,
} from "../src/lib/meta/leadgen-forms-discovery";
import {
  emptyInstantFormBuilderDraft,
  evaluateBuilderStep,
  parseBuilderDraftSnapshot,
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

const PRIVACY =
  "https://sites.google.com/view/example-privacy/home";
const PAGE_ID = "860417880482575";
const FORM_ID = "4566325510297689";
const CLIENT_SITE = "https://ally-qa-landing.vercel.app";
const PAGE_FALLBACK = `https://www.facebook.com/${PAGE_ID}`;

function leadPlan(
  overrides: Partial<MetaWritePlanInput> = {},
): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "QA Lead Technical URL",
    objectiveRaw: "OUTCOME_LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: PAGE_ID,
    formId: FORM_ID,
    formPrivacyPolicyUrl: PRIVACY,
    whatsappNumber: null,
    budgetDailyMajor: 20,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "NONE" },
    citta: "Roma",
    raggioKm: 20,
    countryCode: "IT",
    metaGeoKey: "1188733",
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
    pageName: "Design Soup",
    ...overrides,
  };
}

const asset = [
  {
    id: "1",
    nomeFile: "a.jpg",
    width: 1080,
    height: 1080,
    ruolo: "principale" as const,
    avvisoFormato: false,
    storagePath: "qa/a.jpg",
  },
];

console.log("META_LEAD_FORM technical URL (privacy_policy_url)\n");

// A — valid privacy_policy_url
{
  assert(
    LEADGEN_FORM_FIELDS.includes("privacy_policy_url"),
    "A discovery fields include privacy_policy_url",
  );
  const parsed = parseLeadgenFormsPage(
    {
      data: [
        {
          id: FORM_ID,
          name: "QA Form",
          status: "ACTIVE",
          privacy_policy_url: PRIVACY,
        },
      ],
    },
    PAGE_ID,
  );
  assert(
    parsed.forms[0]?.privacyPolicyUrl ===
      normalizeLeadgenPrivacyPolicyUrl(PRIVACY),
    "A discovery preserves privacyPolicyUrl",
  );

  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: CLIENT_SITE,
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: PRIVACY,
    creativitaRaw: asset,
  });
  const link = creative.object_story_spec.link_data?.link ?? null;
  assert(link === normalizeMetaLeadFormTechnicalUrl(PRIVACY), "A link_data.link = privacy_policy_url");
  assert(
    creative.object_story_spec.link_data?.call_to_action?.value
      ?.lead_gen_form_id === FORM_ID,
    "A lead_gen_form_id present",
  );
  assert(!String(link).includes("facebook.com"), "A Facebook Page fallback absent");
  assert(!String(link).includes("ally-qa-landing"), "A clients.website absent");

  const spec = buildObjectStorySpecForPublish({
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: CLIENT_SITE,
    destination: "META_LEAD_FORM",
    ctaType: "SIGN_UP",
    formId: FORM_ID,
    imageHash: "hash1",
    videoId: null,
    formPrivacyPolicyUrl: PRIVACY,
  });
  assert(spec.ok, "A object_story_spec ok");
  if (spec.ok) {
    assert(
      String(spec.spec.link_data?.link) ===
        normalizeMetaLeadFormTechnicalUrl(PRIVACY),
      "A publish link = privacy_policy_url",
    );
  }

  const preview = buildMetaWritePreview(leadPlan());
  assert(
    preview.safePayloadSummary?.destination === "META_LEAD_FORM",
    "A destination META_LEAD_FORM",
  );
  assert(
    preview.safePayloadSummary?.formPrivacyPolicyUrl ===
      normalizeMetaLeadFormTechnicalUrl(PRIVACY),
    "A preview retains formPrivacyPolicyUrl",
  );
  assert(
    !preview.readinessCodes.includes("MISSING_FORM_TECHNICAL_URL"),
    "A no technical-url blocker when valid",
  );
}

// B — missing privacy_policy_url → safe blocker, no fallbacks
{
  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: CLIENT_SITE,
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: null,
    creativitaRaw: asset,
  });
  assert(creative.object_story_spec.link_data?.link == null, "B link null");
  assert(
    !String(creative.object_story_spec.link_data?.link ?? "").includes(
      "facebook.com",
    ),
    "B no Page fallback",
  );
  assert(
    !String(creative.object_story_spec.link_data?.link ?? "").includes(
      "ally-qa-landing",
    ),
    "B no clients.website fallback",
  );
  const issues = creativeBlockingIssues(creative);
  assert(
    issues.some((i) => i.code === "MISSING_FORM_TECHNICAL_URL"),
    "B MISSING_FORM_TECHNICAL_URL blocker",
  );
  assert(
    issues.some((i) =>
      /url esterno|informativa privacy/i.test(i.messageIt),
    ),
    "B user-safe Italian message",
  );
  assert(
    !issues.some((i) => /1815316|graph\.facebook|EAA/i.test(i.messageIt)),
    "B no raw Graph error in message",
  );

  const spec = buildObjectStorySpecForPublish({
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: CLIENT_SITE,
    destination: "META_LEAD_FORM",
    ctaType: "SIGN_UP",
    formId: FORM_ID,
    imageHash: "hash1",
    videoId: null,
  });
  assert(
    !spec.ok && spec.reason === "MISSING_FORM_TECHNICAL_URL",
    "B publish blocks missing privacy URL",
  );

  const preview = buildMetaWritePreview(
    leadPlan({ formPrivacyPolicyUrl: null, destinationUrl: CLIENT_SITE }),
  );
  assert(
    preview.readinessCodes.includes("MISSING_FORM_TECHNICAL_URL"),
    "B preview readiness blocker",
  );
  assert(
    preview.blockersIt.some((b) => /url esterno|informativa privacy/i.test(b)),
    "B preview user-safe blocker copy",
  );

  const modulo = evaluateBuilderStep({
    stepId: "modulo",
    draft: emptyInstantFormBuilderDraft({
      formId: FORM_ID,
      formRelation: "VERIFIED",
      formPrivacyPolicyUrl: null,
    }),
  });
  assert(!modulo.canContinue, "B builder blocks missing privacy URL");
}

// C — invalid privacy_policy_url → safe blocker
{
  assert(!isValidMetaLeadFormTechnicalUrl(PAGE_FALLBACK), "C Page URL invalid");
  assert(!isValidMetaLeadFormTechnicalUrl(CLIENT_SITE), "C ally-qa-landing invalid");
  assert(!isValidMetaLeadFormTechnicalUrl("not a url"), "C garbage invalid");
  assert(
    !isValidMetaLeadFormTechnicalUrl("ftp://example.com/x"),
    "C non-http invalid",
  );

  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: null,
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: PAGE_FALLBACK,
    creativitaRaw: asset,
  });
  assert(creative.object_story_spec.link_data?.link == null, "C invalid → link null");
  assert(
    creativeBlockingIssues(creative).some(
      (i) => i.code === "MISSING_FORM_TECHNICAL_URL",
    ),
    "C invalid → technical URL blocker",
  );

  const snap = parseBuilderDraftSnapshot({
    stepId: "modulo",
    draft: emptyInstantFormBuilderDraft({
      formId: FORM_ID,
      formPrivacyPolicyUrl: PAGE_FALLBACK,
      formRelation: "VERIFIED",
    }),
    creativeAssetId: null,
    creativeNomeFile: null,
    creativeStoragePath: null,
  });
  assert(
    snap?.draft.formPrivacyPolicyUrl == null,
    "C snapshot drops invalid privacy URL",
  );
}

// D — Ad Set promoted_object page_id only
{
  const preview = buildMetaWritePreview(leadPlan());
  assert(
    preview.adSet?.promoted_object?.page_id === PAGE_ID,
    "D promoted_object.page_id present",
  );
  assert(
    !(
      preview.adSet?.promoted_object &&
      "form_id" in preview.adSet.promoted_object
    ),
    "D promoted_object.form_id absent",
  );
}

// E — WEBSITE unchanged
{
  const web = buildMetaCreativePayload({
    campaignName: "Web",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: "https://example.com/landing",
    destination: "WEBSITE",
    formId: null,
    formPrivacyPolicyUrl: PRIVACY,
    creativitaRaw: asset,
  });
  assert(
    web.object_story_spec.link_data?.link === "https://example.com/landing",
    "E WEBSITE keeps destinationUrl",
  );
  assert(
    web.object_story_spec.link_data?.call_to_action?.type === "LEARN_MORE",
    "E WEBSITE CTA LEARN_MORE",
  );
  assert(
    web.object_story_spec.link_data?.call_to_action?.value?.lead_gen_form_id ==
      null,
    "E WEBSITE no lead_gen_form_id",
  );

  const webSpec = buildObjectStorySpecForPublish({
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: "https://example.com/landing",
    destination: "WEBSITE",
    ctaType: "LEARN_MORE",
    formId: null,
    imageHash: "hash1",
    videoId: null,
    formPrivacyPolicyUrl: PRIVACY,
  });
  assert(webSpec.ok, "E WEBSITE object_story_spec ok");
  if (webSpec.ok) {
    assert(
      String(webSpec.spec.link_data?.link) === "https://example.com/landing",
      "E WEBSITE publish link unchanged",
    );
  }
}

// F — human-facing copy / metadata sanitization (no regression)
{
  const modeSrc = read("src/lib/campagne-creation-mode.ts");
  assert(
    modeSrc.includes("export function userFacingCampaignText"),
    "F userFacingCampaignText present",
  );
  assert(
    modeSrc.includes("stripCreationModeFromFrontEndOffer") &&
      modeSrc.includes("ALLY_PATH") &&
      modeSrc.includes("ALLY_CANON"),
    "F PATH/CANON sanitizer intact",
  );
  const payloadsSrc = read("src/lib/meta/publish/payloads.ts");
  assert(
    !payloadsSrc.includes("www.facebook.com/${"),
    "F no Page URL template in payloads",
  );
  assert(
    payloadsSrc.includes("normalizeMetaLeadFormTechnicalUrl"),
    "F technical URL helper present",
  );
  const discoverySrc = read("src/lib/meta/leadgen-forms-discovery.ts");
  assert(
    discoverySrc.includes("privacy_policy_url"),
    "F discovery fetches privacy_policy_url",
  );
  assert(
    !payloadsSrc.toLowerCase().includes("access_token"),
    "F payloads does not log tokens",
  );
  const loadPreviewSrc = read("src/lib/meta/write/load-preview.ts");
  assert(
    loadPreviewSrc.includes("userFacingCampaignText"),
    "F load-preview still sanitizes creative copy",
  );
}

// Fixture dump (sanitized)
{
  const preview = buildMetaWritePreview(leadPlan());
  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: CLIENT_SITE,
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: PRIVACY,
    creativitaRaw: asset,
  });
  const link = String(creative.object_story_spec.link_data?.link ?? "");
  console.log("\n--- PAYLOAD_FIXTURE (sanitized) ---");
  console.log("destination:", preview.safePayloadSummary?.destination);
  console.log(
    "adSet.promoted_object:",
    JSON.stringify(preview.adSet?.promoted_object ?? null),
  );
  console.log("creative.link_data.link:", link);
  console.log(
    "creative CTA lead_gen_form_id present:",
    creative.object_story_spec.link_data?.call_to_action?.value
      ?.lead_gen_form_id
      ? "YES"
      : "NO",
  );
  console.log(
    "clients.website present:",
    link.includes("ally-qa-landing") ? "YES" : "NO",
  );
  console.log(
    "Facebook Page fallback present:",
    link.includes("facebook.com") ? "YES" : "NO",
  );
}

console.log(
  falliti === 0
    ? "\n=== META_LEAD_FORM TECHNICAL URL: TUTTI I CHECK PASS ===\n"
    : `\n=== META_LEAD_FORM TECHNICAL URL: ${falliti} FAIL ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
