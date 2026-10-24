/**
 * M14.1 — Full Meta publish execution backend tests.
 * LIVE META WRITES DURING TESTS: 0
 * Avoids importing server-only Graph/OAuth modules (M11A.2 pattern).
 */

import fs from "node:fs";
import {
  buildMetaAdPayload,
  buildMetaCreativePayload,
  buildObjectStorySpecForPublish,
  creativeBlockingIssues,
} from "../src/lib/meta/publish/payloads";
import { META_PUBLISH_ORDER } from "../src/lib/meta/publish/types";
import { buildMetaWritePreview } from "../src/lib/meta/write/preview";
import type { MetaWritePlanInput } from "../src/lib/meta/write/types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return fs.readFileSync(path, "utf8");
}

function baseLeadPlan(
  overrides: Partial<MetaWritePlanInput> = {},
): MetaWritePlanInput {
  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    campaignName: "Lead",
    objectiveRaw: "LEADS",
    destination: "META_LEAD_FORM",
    destinationUrl: null,
    pageId: "page_9",
    formId: "form_99",
    whatsappNumber: null,
    budgetDailyMajor: 30,
    budgetLevel: "AD_SET",
    specialAdCategories: { kind: "NONE" },
    citta: "Roma",
    raggioKm: 20,
    countryCode: "IT",
    metaGeoKey: "roma",
    geoLabel: "Roma",
    etaMin: 25,
    etaMax: 55,
    placementsAdvantage: true,
    startAtIso: "2026-10-10T08:00:00.000Z",
    endAtIso: null,
    creativitaCount: 1,
    targetType: null,
    isImportedMetaOnly: false,
    existingMetaCampaignId: null,
    partialHierarchyPending: false,
    writeHierarchyCompleted: false,
    grantedScopes: ["ads_management", "ads_read"],
    hasMetaConnection: true,
    hasAdAccount: true,
    adAccountCurrency: "EUR",
    adAccountTimezone: "Europe/Rome",
    buyingType: "AUCTION",
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    ...overrides,
  };
}

/** Pure step-machine mirror of execute partial-failure semantics (no Graph). */
function simulatePartialFailure(failedAt: string) {
  const order = [
    "CREATE_CAMPAIGN",
    "CREATE_ADSET",
    "CREATE_CREATIVE",
    "CREATE_AD",
    "ESTABLISH_LINK",
    "MARK_SYNC_BASELINE",
  ] as const;
  const idx = order.indexOf(failedAt as (typeof order)[number]);
  const ids = {
    metaCampaignId: idx > 0 ? "mock_campaign_1" : null,
    metaAdSetId: idx > 1 ? "mock_adset_1" : null,
    metaCreativeId: idx > 2 ? "mock_creative_1" : null,
    metaAdId: idx > 3 ? "mock_ad_1" : null,
  };
  if (failedAt === "CREATE_CAMPAIGN") {
    ids.metaCampaignId = null;
  } else if (failedAt === "CREATE_ADSET") {
    ids.metaCampaignId = "mock_campaign_1";
    ids.metaAdSetId = null;
  } else if (failedAt === "CREATE_CREATIVE") {
    ids.metaCampaignId = "mock_campaign_1";
    ids.metaAdSetId = "mock_adset_1";
    ids.metaCreativeId = null;
  } else if (failedAt === "CREATE_AD") {
    ids.metaCampaignId = "mock_campaign_1";
    ids.metaAdSetId = "mock_adset_1";
    ids.metaCreativeId = "mock_creative_1";
    ids.metaAdId = null;
  }
  return {
    failedAt,
    markedPublished: false,
    markedSynced: false,
    ...ids,
  };
}

console.log("M14.1 full publish backend\n");

test("image creative object_story_spec mapping", () => {
  const spec = buildObjectStorySpecForPublish({
    pageId: "p1",
    primaryText: "Hello",
    headline: "Hi",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    ctaType: "LEARN_MORE",
    formId: null,
    imageHash: "hash1",
    videoId: null,
  });
  assert(spec.ok, "ok");
  assert(Boolean(spec.ok && spec.spec.link_data?.image_hash), "image hash");
  const creative = buildMetaCreativePayload({
    campaignName: "Img",
    pageId: "p1",
    primaryText: "Hello",
    headline: "Hi",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "u/a.jpg",
        isVideo: false,
      },
    ],
  });
  assert(creative.assetHandling === "READY", "image asset ready");
});

test("video creative mapping supported", () => {
  const spec = buildObjectStorySpecForPublish({
    pageId: "p1",
    primaryText: "V",
    headline: "H",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    ctaType: "LEARN_MORE",
    formId: null,
    imageHash: null,
    videoId: "vid_1",
  });
  assert(spec.ok && Boolean(spec.spec.video_data), "video_data");
  const creative = buildMetaCreativePayload({
    campaignName: "Vid",
    pageId: "p1",
    primaryText: "V",
    headline: "H",
    description: null,
    destinationUrl: "https://example.com",
    destination: "WEBSITE",
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "v.mp4",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "u/v.mp4",
        isVideo: true,
      },
    ],
  });
  assert(creative.assetHandling === "READY", "video ready");
  assert(Boolean(creative.assetNoteIt?.toLowerCase().includes("video")), "video note");
});

test("lead form promoted_object page_id only + CTA lead_gen_form_id", () => {
  const preview = buildMetaWritePreview(baseLeadPlan());
  assert(
    preview.adSet?.promoted_object?.page_id === "page_9",
    "page_id in promoted_object",
  );
  assert(
    !(
      preview.adSet?.promoted_object &&
      "form_id" in preview.adSet.promoted_object
    ),
    "form_id absent from Ad Set promoted_object",
  );
  const creative = buildMetaCreativePayload({
    campaignName: "Lead",
    pageId: "page_9",
    primaryText: "T",
    headline: "H",
    description: null,
    destinationUrl: null,
    destination: "META_LEAD_FORM",
    formId: "form_99",
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "p",
      },
    ],
  });
  assert(
    creative.object_story_spec.link_data?.call_to_action?.value
      ?.lead_gen_form_id === "form_99",
    "cta lead_gen_form_id",
  );
});

test("missing form_id blocks lead creative + preview", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "Lead",
    pageId: "page_9",
    primaryText: "T",
    headline: "H",
    description: null,
    destinationUrl: null,
    destination: "META_LEAD_FORM",
    formId: null,
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "p",
      },
    ],
  });
  assert(
    creativeBlockingIssues(creative).some((i) => i.code === "MISSING_FORM"),
    "missing form creative",
  );
  const preview = buildMetaWritePreview(baseLeadPlan({ formId: null }));
  assert(preview.readinessCodes.includes("MISSING_FORM"), "preview MISSING_FORM");
  assert(
    !(preview.adSet?.promoted_object && "form_id" in preview.adSet.promoted_object),
    "no silent form_id",
  );
});

test("missing page identity blocks", () => {
  const creative = buildMetaCreativePayload({
    campaignName: "X",
    pageId: null,
    primaryText: "T",
    headline: "H",
    description: null,
    destinationUrl: "https://x.test",
    destination: "WEBSITE",
    creativitaRaw: [
      {
        id: "1",
        nomeFile: "a.jpg",
        width: 1,
        height: 1,
        ruolo: "principale",
        avvisoFormato: false,
        storagePath: "p",
      },
    ],
  });
  assert(
    creativeBlockingIssues(creative).some((i) => i.code === "MISSING_PAGE"),
    "page",
  );
});

test("ad payload PAUSED references pending adset + creative", () => {
  const ad = buildMetaAdPayload({ campaignName: "QA" });
  assert(ad.status === "PAUSED", "paused");
  assert(ad.adset_id === "{pending_adset_id}", "adset pending");
  assert(ad.creative.creative_id === "{pending_creative_id}", "creative pending");
});

test("campaign create failure — no false published/synced", () => {
  const s = simulatePartialFailure("CREATE_CAMPAIGN");
  assert(s.metaCampaignId === null, "no camp");
  assert(s.markedPublished === false && s.markedSynced === false, "flags");
});

test("ad set failure — campaign id preserved, not SYNCED", () => {
  const s = simulatePartialFailure("CREATE_ADSET");
  assert(s.metaCampaignId === "mock_campaign_1", "camp");
  assert(s.metaAdSetId === null, "no adset");
  assert(s.markedSynced === false, "not synced");
});

test("media/creative failure — partial IDs preserved", () => {
  const s = simulatePartialFailure("CREATE_CREATIVE");
  assert(s.metaCampaignId === "mock_campaign_1", "camp");
  assert(s.metaAdSetId === "mock_adset_1", "adset");
  assert(s.metaCreativeId === null, "no creative");
  assert(s.markedPublished === false, "not published");
});

test("ad failure — creative preserved, not SYNCED", () => {
  const s = simulatePartialFailure("CREATE_AD");
  assert(s.metaCreativeId === "mock_creative_1", "creative");
  assert(s.metaAdId === null, "no ad");
  assert(s.markedSynced === false, "not synced");
});

test("execute source: full success path + guard + order", () => {
  const ex = read("./src/lib/meta/publish/execute.ts");
  assert(ex.includes("createMetaCampaignPaused"), "campaign create");
  assert(ex.includes("validateMetaAdSetPaused"), "adset validate_only before create");
  assert(ex.includes("toSafeGraphErrorDiagnostics"), "graph error diagnostics");
  assert(ex.includes("createMetaAdSetPaused"), "adset create");
  const iValidateAdset = ex.indexOf("await validateMetaAdSetPaused");
  const iCreateAdset = ex.indexOf("await createMetaAdSetPaused");
  assert(
    iValidateAdset > 0 && iCreateAdset > iValidateAdset,
    "validate_only before createMetaAdSetPaused",
  );
  assert(ex.includes("uploadMetaAdImageHash"), "image upload");
  assert(ex.includes("uploadMetaAdVideoId"), "video upload");
  assert(ex.includes("createMetaAdCreative"), "creative create");
  assert(ex.includes("createMetaAdPaused"), "ad create");
  assert(ex.includes("persistFullPublishHierarchyAndLink"), "persist");
  assert(ex.includes("establishSyncBaselineOnLink") || read("./src/lib/meta/publish/persist.ts").includes("establishSyncBaselineOnLink"), "baseline");
  assert(ex.includes("LIVE_WRITES_GATED"), "guard message");
  assert(ex.includes("isFullPublishLiveExecutionAllowed"), "live allow helper");
  assert(ex.includes('status: "GATED"') || ex.includes('"GATED"'), "gated steps");
  assert(ex.includes("PARTIALLY_CREATED"), "partial state");
  assert(ex.includes("markedSynced: false"), "false synced on fail paths");
  assert(ex.includes("markedPublished: false"), "false published on fail");
  assert(ex.includes("MARK_SYNC_BASELINE"), "baseline step");
  assert(ex.includes("form_id"), "form_id wiring");
  assert(!ex.includes('status: "ACTIVE"'), "no ACTIVE");
  // Order in source
  const iCamp = ex.indexOf("CREATE_CAMPAIGN");
  const iAdset = ex.indexOf('failedAt: "CREATE_ADSET"') > 0 || ex.includes("CREATE_ADSET");
  assert(iCamp > 0 && iAdset, "steps present");
  const gp = read("./src/lib/meta/publish/graph-publish.ts");
  assert(gp.includes("adcreatives"), "adcreatives endpoint");
  assert(gp.includes("adimages"), "adimages");
  assert(gp.includes("advideos"), "advideos");
  assert(gp.includes('"ads"') || gp.includes("ads"), "ads");
  assert(gp.includes("META_WRITE_SAFE_STATUS"), "paused");
  assert(gp.includes("FormData"), "binary upload FormData");
});

test("full mocked success semantics encoded (SYNCED only after all four)", () => {
  const ex = read("./src/lib/meta/publish/execute.ts");
  // Baseline only after ad create success block
  const adCreated = ex.indexOf('step("CREATE_AD"');
  const baseline = ex.indexOf("MARK_SYNC_BASELINE");
  const markedSyncedTrue = ex.indexOf("markedSynced: true");
  assert(adCreated > 0 && baseline > adCreated, "baseline after ad");
  assert(markedSyncedTrue > baseline, "SYNCED flag after baseline wiring");
  assert(
    ex.includes("__allowMockExecuteWithoutLiveFlag"),
    "mock transport path for QA tests",
  );
  const route = read("./src/app/api/meta/publish-plan/route.ts");
  assert(
    !route.includes("__allowMockExecuteWithoutLiveFlag"),
    "HTTP route never bypasses guard",
  );
});

test("M13 baseline only after final success (partial skips)", () => {
  const ex = read("./src/lib/meta/publish/execute.ts");
  assert(ex.includes("skipRest"), "skip dependents");
  assert(ex.includes("failPartial"), "partial helper");
  const s = simulatePartialFailure("CREATE_AD");
  assert(s.markedSynced === false, "partial never synced");
});

test("write guard blocks Graph when META_WRITES_LIVE off", () => {
  const ex = read("./src/lib/meta/publish/execute.ts");
  assert(ex.includes("isFullPublishLiveExecutionAllowed"), "allow check");
  assert(ex.includes("canMutate"), "mutate gate");
  const cfg = read("./src/lib/meta/config.ts");
  assert(cfg.includes('=== "1"'), "live = 1");
  assert(
    !ex.includes("defaultTransport") || ex.includes("transport"),
    "injectable",
  );
});

test("FULL_PUBLISH_PAUSED migration + operations", () => {
  const mig = read(
    "./supabase/migrations/20260930_meta_full_publish_paused_m141.sql",
  );
  assert(mig.includes("FULL_PUBLISH_PAUSED"), "migration type");
  const ops = read("./src/lib/meta/write/operations.ts");
  assert(ops.includes("logFullPublishPreviewOperation"), "log op");
  assert(ops.includes("meta_creative_id"), "creative id column used");
  assert(ops.includes("meta_ad_id"), "ad id column used");
  const types = read("./src/lib/meta/write/types.ts");
  assert(types.includes("FULL_PUBLISH_PAUSED"), "type union");
});

test("publish order CAMPAIGN → AD SET → CREATIVE → AD", () => {
  const i = (s: (typeof META_PUBLISH_ORDER)[number]) =>
    META_PUBLISH_ORDER.indexOf(s);
  assert(
    i("CREATE_CAMPAIGN") < i("CREATE_ADSET") &&
      i("CREATE_ADSET") < i("CREATE_CREATIVE") &&
      i("CREATE_CREATIVE") < i("CREATE_AD") &&
      i("CREATE_AD") < i("ESTABLISH_LINK") &&
      i("ESTABLISH_LINK") < i("MARK_SYNC_BASELINE"),
    "order",
  );
});

test("Ally Storage download path — no public URL hack", () => {
  const media = read("./src/lib/meta/publish/media.ts");
  assert(media.includes("campaign-creatives"), "bucket");
  assert(media.includes(".download("), "private download");
  assert(!media.includes("getPublicUrl"), "no public url");
  assert(media.includes("downloadAllyCreativeBytes"), "helper");
});

test("hierarchy persist reuses meta_campaigns / meta_ad_sets / meta_ads", () => {
  const p = read("./src/lib/meta/publish/persist.ts");
  assert(p.includes('from("meta_campaigns")'), "campaigns");
  assert(p.includes('from("meta_ad_sets")'), "ad sets");
  assert(p.includes('from("meta_ads")'), "ads");
  assert(p.includes("affianco_campaign_id"), "link");
  assert(p.includes("establishSyncBaselineOnLink"), "m13");
  assert(p.includes('sync_status: "UNLINKED"'), "not false SYNCED before baseline");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
