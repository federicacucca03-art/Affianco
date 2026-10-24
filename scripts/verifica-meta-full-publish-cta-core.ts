/**
 * COMMIT 2 — FULL_PUBLISH_PAUSED CTA / plan / execute core (no Easy mount).
 * LIVE META WRITES: 0 | DB MUTATIONS: 0
 * Self-contained on HEAD + Meta FULL_PUBLISH core (no InstantFormEasyBuilder).
 * Esegui: npx tsx scripts/verifica-meta-full-publish-cta-core.ts
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildMetaCreativePayload,
  buildMetaAdPayload,
  creativeBlockingIssues,
  normalizeMetaLeadFormTechnicalUrl,
} from "../src/lib/meta/publish/payloads";
import { META_PUBLISH_ORDER } from "../src/lib/meta/publish/types";
import { resolveConversionPublishPlan } from "../src/lib/meta/write/conversion-resolver";

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

const PRIVACY = "https://sites.google.com/view/example-privacy/home";
const PAGE_ID = "860417880482575";
const FORM_ID = "4566325510297689";

console.log("FULL_PUBLISH_PAUSED CTA core (COMMIT 2 — no Easy mount)\n");

// A — full META_LEAD_FORM publish plan contains Campaign → Ad Set → Creative → Ad
{
  assert(
    META_PUBLISH_ORDER.includes("CREATE_CAMPAIGN") &&
      META_PUBLISH_ORDER.includes("CREATE_ADSET") &&
      META_PUBLISH_ORDER.includes("CREATE_CREATIVE") &&
      META_PUBLISH_ORDER.includes("CREATE_AD"),
    "A publish order has Campaign+AdSet+Creative+Ad",
  );
  const iCamp = META_PUBLISH_ORDER.indexOf("CREATE_CAMPAIGN");
  const iAdset = META_PUBLISH_ORDER.indexOf("CREATE_ADSET");
  const iCreative = META_PUBLISH_ORDER.indexOf("CREATE_CREATIVE");
  const iAd = META_PUBLISH_ORDER.indexOf("CREATE_AD");
  assert(
    iCamp < iAdset && iAdset < iCreative && iCreative < iAd,
    "A order Campaign → AdSet → Creative → Ad",
  );
  const planSrc = read("src/lib/meta/publish/plan.ts");
  assert(planSrc.includes('kind: "FULL_PUBLISH_PAUSED"'), "A FULL_PUBLISH_PAUSED plan kind");
  assert(
    planSrc.includes("normalizeWritePreviewForFullPublish"),
    "A GET plan normalizes writePreview to FULL_PUBLISH",
  );
  const adapterSrc = read("src/lib/meta/publish/full-publish-preview.ts");
  assert(
    adapterSrc.includes('operationType: "FULL_PUBLISH_PAUSED"') &&
      adapterSrc.includes("FULL_PUBLISH_INCLUDED"),
    "A full-publish preview adapter sets FULL_PUBLISH + included creative/ad",
  );
  const execSrc = read("src/lib/meta/publish/execute.ts");
  assert(
    execSrc.includes("CREATE_CAMPAIGN") &&
      execSrc.includes("CREATE_ADSET") &&
      execSrc.includes("CREATE_CREATIVE") &&
      execSrc.includes("CREATE_AD"),
    "A execute supports all four creates",
  );
}

// B — delivery-capable objects PAUSED
{
  const execSrc = read("src/lib/meta/publish/execute.ts");
  const payloadsSrc = read("src/lib/meta/publish/payloads.ts");
  const typesSrc = read("src/lib/meta/write/types.ts");
  assert(
    typesSrc.includes("META_WRITE_SAFE_STATUS") ||
      payloadsSrc.includes("PAUSED") ||
      execSrc.includes("PAUSED"),
    "B PAUSED delivery status present",
  );
  const ad = buildMetaAdPayload({ campaignName: "QA Lead" });
  assert(
    (ad as { status?: string }).status === "PAUSED" ||
      String(JSON.stringify(ad)).includes("PAUSED"),
    "B ad payload PAUSED",
  );
}

// C — privacy_policy_url used in Creative link_data.link
{
  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Test QA Lead Ads",
    description: null,
    destinationUrl: "https://ally-qa-landing.vercel.app",
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: PRIVACY,
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "qa/a.jpg",
      },
    ],
  });
  assert(
    creative.object_story_spec.link_data?.link ===
      normalizeMetaLeadFormTechnicalUrl(PRIVACY),
    "C link_data.link = privacy_policy_url",
  );
  assert(
    !String(creative.object_story_spec.link_data?.link).includes("facebook.com"),
    "C no Page fallback",
  );
  assert(
    !String(creative.object_story_spec.link_data?.link).includes("ally-qa-landing"),
    "C no clients.website / ally-qa-landing",
  );
}

// D — lead_gen_form_id preserved
{
  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: null,
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: PRIVACY,
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "qa/a.jpg",
      },
    ],
  });
  assert(
    creative.object_story_spec.link_data?.call_to_action?.value
      ?.lead_gen_form_id === FORM_ID,
    "D lead_gen_form_id preserved",
  );
}

// E — Ad Set form_id absent
{
  const plan = resolveConversionPublishPlan({
    metaObjective: "OUTCOME_LEADS",
    destination: "META_LEAD_FORM",
    pageId: PAGE_ID,
    formId: FORM_ID,
  });
  assert(plan.promotedObject?.page_id === PAGE_ID, "E page_id present");
  assert(
    !(plan.promotedObject && "form_id" in plan.promotedObject),
    "E form_id absent from promoted_object",
  );
}

// F — missing privacy_policy_url blocks before execution
{
  const creative = buildMetaCreativePayload({
    campaignName: "QA Lead",
    pageId: PAGE_ID,
    primaryText: "Ciao",
    headline: "Titolo",
    description: null,
    destinationUrl: null,
    destination: "META_LEAD_FORM",
    formId: FORM_ID,
    formPrivacyPolicyUrl: null,
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "qa/a.jpg",
      },
    ],
  });
  assert(
    creativeBlockingIssues(creative).some(
      (i) => i.code === "MISSING_FORM_TECHNICAL_URL",
    ),
    "F MISSING_FORM_TECHNICAL_URL blocks",
  );
  const cta = read("src/components/campagne/MetaFullPublishCta.tsx");
  assert(
    cta.includes("MISSING_FORM_TECHNICAL_URL") ||
      cta.includes("privacyBlocked"),
    "F CTA respects privacy URL blocker",
  );
}

// G — CTA / panel / route execute path (no Instant Form Easy mount)
{
  const cta = read("src/components/campagne/MetaFullPublishCta.tsx");
  const panel = read("src/components/campagne/MetaPublishPanel.tsx");
  const review = read("src/components/campagne/CanonicalCampaignReviewPanel.tsx");
  const route = read("src/app/api/meta/publish-plan/route.ts");

  assert(cta.includes("/api/meta/publish-plan"), "G CTA uses publish-plan API");
  assert(cta.includes('action: "execute"'), "G CTA action execute");
  assert(cta.includes("humanConfirmed: true"), "G CTA humanConfirmed");
  assert(
    !cta.includes(
      "Pubblicazione Meta non ancora attiva in QA. Nessuna mutazione inviata.",
    ),
    "G CTA stub message removed",
  );
  assert(
    panel.includes("onExecuteFullPublish") &&
      panel.includes('action: "execute"'),
    "G MetaPublishPanel execute wired",
  );
  assert(
    !panel.includes(
      "Pubblicazione Meta non ancora attiva in QA. Nessuna mutazione inviata.",
    ),
    "G MetaPublishPanel stub removed",
  );
  assert(
    review.includes("publishControls"),
    "G CanonicalCampaignReviewPanel accepts publishControls",
  );
  assert(
    route.includes("executeMetaPublishPlan") &&
      route.includes("META_QA_WRITE_CONFIRM_TOKEN"),
    "G route executes + server injects QA confirm token",
  );
}

// H — temporary QA create routes NOT used (CTA + panel only)
{
  const cta = read("src/components/campagne/MetaFullPublishCta.tsx");
  const panel = read("src/components/campagne/MetaPublishPanel.tsx");
  for (const [name, src] of [
    ["MetaFullPublishCta", cta],
    ["MetaPublishPanel", panel],
  ] as const) {
    assert(
      !src.includes("/api/internal/qa/"),
      `H ${name} does not call internal QA routes`,
    );
    assert(
      !src.includes("phase1-controlled-write") &&
        !src.includes("adset-resume-create") &&
        !src.includes("creative-resume-create") &&
        !src.includes("ad-resume-create"),
      `H ${name} does not reference QA create routes`,
    );
  }
}

// I — returned Meta IDs persisted by normal operation model
{
  const ops = read("src/lib/meta/write/operations.ts");
  const exec = read("src/lib/meta/publish/execute.ts");
  assert(
    ops.includes("meta_campaign_id") &&
      ops.includes("meta_adset_id") &&
      ops.includes("meta_creative_id") &&
      ops.includes("meta_ad_id"),
    "I operation model has all four ID columns",
  );
  assert(
    ops.includes('operation_type: "FULL_PUBLISH_PAUSED"') ||
      ops.includes('operation_type", "FULL_PUBLISH_PAUSED"'),
    "I FULL_PUBLISH_PAUSED operation type",
  );
  assert(
    exec.includes("meta_creative_id:") && exec.includes("meta_ad_id:"),
    "I execute patches creative + ad IDs",
  );
  assert(
    exec.includes('kind: "FULL_PUBLISH_PAUSED"') ||
      exec.includes("FULL_PUBLISH_PAUSED"),
    "I execute uses FULL_PUBLISH_PAUSED",
  );
}

console.log(
  falliti === 0
    ? "\n=== FULL_PUBLISH_PAUSED CTA CORE: TUTTI I CHECK PASS ===\n"
    : `\n=== FULL_PUBLISH_PAUSED CTA CORE: ${falliti} FAIL ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
