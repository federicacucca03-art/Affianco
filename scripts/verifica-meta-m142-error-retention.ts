/**
 * M14.2 — Graph Ad Set error retention + validate_only before create.
 * LIVE META WRITES: 0 (mocked transport only).
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m142-error-retention.ts
 *
 * Bootstrap: process-local dummy env + dynamic imports so server-only / Supabase
 * module construction never needs real credentials or network.
 */

import { readFileSync } from "node:fs";
import type { MetaPublishPlan } from "../src/lib/meta/publish/types";
import type { MetaWritePreviewResult } from "../src/lib/meta/write/types";
import type { MetaGraphWriteTransport } from "../src/lib/meta/write/graph-write";

/** Harmless client construction only — no network/DB. */
function ensureTestOnlyBootstrapEnv(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only-placeholder";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-placeholder";
  process.env.META_GRAPH_API_VERSION ||= "v26.0";
  process.env.META_APP_ID ||= "test-app";
  process.env.META_APP_SECRET ||= "test-secret";
  process.env.META_LOGIN_CONFIG_ID ||= "test-config-read";
  process.env.META_WRITE_LOGIN_CONFIG_ID ||= "test-config-write";
  process.env.META_REDIRECT_URI ||= "https://example.com/callback";
  process.env.META_TOKEN_ENCRYPTION_KEY ||=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.META_WRITES_LIVE ||= "0";
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(
        `  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`,
      );
      failed++;
    }
  })();
}

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

const GRAPH_ERROR_JSON = {
  error: {
    message:
      "Invalid parameter: optimization_goal LINK_CLICKS is not valid for this combination",
    type: "OAuthException",
    code: 100,
    error_subcode: 1885272,
    error_user_title: "Invalid optimization goal",
    error_user_msg:
      "This optimization goal is not available for the selected objective and destination.",
    error_data: {
      blame_fields: ["optimization_goal", "destination_type"],
    },
    is_transient: false,
    fbtrace_id: "AaBbCcDdEeFfGgHh",
  },
};

function buildMockPlan(
  fingerprint: string,
  META_WRITE_SAFE_STATUS: "PAUSED",
  META_PUBLISH_ORDER: MetaPublishPlan["publishOrder"],
): MetaPublishPlan {
  const writePreview: MetaWritePreviewResult = {
    operationType: "FULL_PUBLISH_PAUSED",
    readinessCodes: [],
    canPreview: true,
    canWrite: true,
    resumeMode: null,
    writeAlreadyCompleted: false,
    adsManagementPresent: true,
    fingerprint,
    idempotencyKey: `idem-${fingerprint}`,
    campaign: {
      name: "QA Test Campaign",
      objective: "OUTCOME_LEADS",
      status: META_WRITE_SAFE_STATUS,
      special_ad_categories: [],
      buying_type: "AUCTION",
      daily_budget: null,
      lifetime_budget: null,
      is_adset_budget_sharing_enabled: false,
      fieldStatus: {},
    },
    adSet: {
      name: "Gruppo principale",
      campaign_id: "{pending_campaign_id}",
      optimization_goal: "LINK_CLICKS",
      billing_event: "IMPRESSIONS",
      daily_budget: 500,
      lifetime_budget: null,
      start_time: null,
      end_time: null,
      targeting: {
        geo_locations: { countries: ["IT"] },
        targeting_automation: { advantage_audience: 1 },
        age_min: 18,
      },
      destination_type: "WEBSITE",
      promoted_object: { page_id: "860417880482575" },
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      bid_amount: null,
      status: META_WRITE_SAFE_STATUS,
      placementsNote: null,
      fieldStatus: {},
    },
    creative: { enabled: false, reason: "DEFERRED_SLICE" },
    ad: { enabled: false, reason: "DEFERRED_SLICE" },
    blockersIt: [],
    summaryIt: {
      campaignLines: [],
      adSetLines: [],
      missingLines: [],
      footnote: "",
    },
    safePayloadSummary: {
      destination: "WEBSITE",
      formId: null,
    },
  };

  return {
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    fingerprint,
    idempotencyKey: `idem-${fingerprint}`,
    ready: true,
    blockingIssues: [],
    warnings: [],
    writePreview,
    creative: {
      name: "Creative",
      object_story_spec: {
        page_id: "860417880482575",
        link_data: {
          message: "test",
          name: "test",
          description: null,
          link: "https://example.com",
          call_to_action: { type: "LEARN_MORE", value: { link: "https://example.com" } },
          image_hash: null,
          video_id: null,
          ally_storage_path: "u/a.png",
        },
      },
      status: META_WRITE_SAFE_STATUS,
      fieldStatus: {},
      assetHandling: "READY",
      assetNoteIt: "ready",
    },
    ad: {
      name: "Ad",
      adset_id: "{pending_adset_id}",
      creative: { creative_id: "{pending_creative_id}" },
      status: META_WRITE_SAFE_STATUS,
      fieldStatus: {},
    },
    review: {
      productStatus: "pronta",
      productStatusLabelIt: "Pronta",
      headlineIt: "Pronta",
      campaignLine: "c",
      adSetLine: "a",
      creativeLine: "cr",
      adLine: "ad",
      initialStatusLine: "IN PAUSA",
      productRequirementLines: [],
      metaRequirementLines: [],
      adAccountLine: "act_***",
      objectiveLine: "OUTCOME_LEADS",
      budgetLine: "5",
      audienceLine: "18",
      destinationLine: "WEBSITE",
      pageLine: "page",
      creativeAssetLine: "asset",
      blockingIssues: [],
      warnings: [],
      canReview: true,
      readyForLiveWrite: true,
      liveWritesEnabled: false,
      ctaState: "ENABLED",
      ctaLabelIt: "Pubblica",
      gatedNoteIt: null,
      destinationKind: "WEBSITE",
    },
    publishOrder: META_PUBLISH_ORDER,
    objectiveMapping: {
      allyObjective: "contatti",
      metaObjective: "OUTCOME_LEADS",
      supported: true,
    },
  };
}

async function main() {
  ensureTestOnlyBootstrapEnv();
  const {
    createMetaAdSetPaused,
    toSafeGraphErrorDiagnostics,
  } = await import("../src/lib/meta/write/graph-write");
  const {
    __peekFullPublishMemoryOpForTests,
    __resetFullPublishMemoryOpsForTests,
    executeMetaPublishPlan,
  } = await import("../src/lib/meta/publish/execute");
  const { META_PUBLISH_ORDER } = await import("../src/lib/meta/publish/types");
  const { META_WRITE_SAFE_STATUS } = await import("../src/lib/meta/write/types");

console.log("M14.2 Graph error retention\n");

await test("createMetaAdSetPaused retains Graph error bits", async () => {
  const transport: MetaGraphWriteTransport = async () => ({
    ok: false,
    status: 400,
    json: GRAPH_ERROR_JSON,
  });
  const res = await createMetaAdSetPaused({
    accessToken: "tok",
    adAccountId: "act_1",
    name: "G",
    campaignId: "120251580574110295",
    optimizationGoal: "LINK_CLICKS",
    billingEvent: "IMPRESSIONS",
    dailyBudgetMinor: 500,
    targeting: { geo_locations: { countries: ["IT"] } },
    transport,
  });
  assert(!res.ok, "failed");
  if (res.ok) return;
  assert(res.graphCode === 100, "code");
  assert(res.errorSubcode === 1885272, "subcode");
  assert(
    (res.metaMessageSafe || "").includes("Invalid parameter"),
    "message",
  );
  assert(res.metaErrorType === "OAuthException", "type");
  assert(res.metaUserTitle === "Invalid optimization goal", "user title");
  assert(
    (res.metaUserMsg || "").includes("not available"),
    "user msg",
  );
  assert(
    Array.isArray(res.blameFields) &&
      res.blameFields.includes("optimization_goal"),
    "blame",
  );
  assert(res.safeMessage.includes("Parametri non accettati"), "user-safe IT");
  const diag = toSafeGraphErrorDiagnostics(res, "create");
  assert(diag.source === "create", "source");
  assert(!JSON.stringify(diag).includes("tok"), "no token in diag");
  assert(!JSON.stringify(diag).includes("access_token"), "no access_token key");
});

await test("execute CREATE_ADSET validate_only failure persists diagnostics", async () => {
  __resetFullPublishMemoryOpsForTests();
  const fingerprint = "fp-error-retention-1";
  const plan = buildMockPlan(
    fingerprint,
    META_WRITE_SAFE_STATUS,
    META_PUBLISH_ORDER,
  );
  let campaignCreates = 0;
  let adsetPosts = 0;
  const transport: MetaGraphWriteTransport = async ({ url, body }) => {
    const bodyStr =
      body instanceof URLSearchParams ? body.toString() : "(form)";
    if (url.includes("/campaigns")) {
      campaignCreates += 1;
      return { ok: true, status: 200, json: { id: "120251580574110295" } };
    }
    if (url.includes("/adsets")) {
      adsetPosts += 1;
      assert(
        bodyStr.includes("validate_only") ||
          bodyStr.includes("execution_options"),
        "first adset call should be validate_only",
      );
      return { ok: false, status: 400, json: GRAPH_ERROR_JSON };
    }
    return { ok: false, status: 500, json: { error: { message: "unexpected" } } };
  };

  const result = await executeMetaPublishPlan({
    userId: "33333333-3333-4333-8333-333333333333",
    allyCampaignId: plan.allyCampaignId,
    fingerprint,
    humanConfirmed: true,
    transport,
    __allowMockExecuteWithoutLiveFlag: true,
    __memoryOps: true,
    __planOverride: plan,
    __skipPersist: true,
    __downloadAsset: async () => ({
      ok: false as const,
      reason: "MISSING_CREATIVE_ASSET" as const,
      messageIt: "n/a",
    }),
  });

  assert(result.failedAt === "CREATE_ADSET", "failed at adset");
  assert(result.metaCampaignId === "120251580574110295", "campaign id kept");
  assert(result.metaAdSetId == null, "no adset id");
  assert(result.markedSynced === false, "not synced");
  assert(result.graphError?.code === 100, "result code");
  assert(result.graphError?.subcode === 1885272, "result subcode");
  assert(
    (result.graphError?.message || "").includes("Invalid parameter"),
    "result message",
  );
  assert(result.graphError?.userTitle === "Invalid optimization goal", "title");
  assert(
    (result.graphError?.userMsg || "").includes("not available"),
    "user msg",
  );
  assert(result.graphError?.source === "validate_only", "validate source");
  assert(
    (result.errorSafeMessage || "").includes("Parametri non accettati"),
    "normalized user message kept",
  );
  assert(campaignCreates === 1, "one campaign create");
  assert(adsetPosts === 1, "one validate_only adset post, no create after fail");

  const mem = __peekFullPublishMemoryOpForTests({
    userId: "33333333-3333-4333-8333-333333333333",
    allyCampaignId: plan.allyCampaignId,
    idempotencyKey: plan.idempotencyKey,
  });
  assert(mem?.state === "PARTIALLY_CREATED", "partial state");
  assert(mem?.meta_campaign_id === "120251580574110295", "mem campaign");
  assert(mem?.meta_adset_id == null, "mem adset null");
  const summary = mem?.safe_payload_summary || {};
  assert(summary.failedAt === "CREATE_ADSET", "failed step");
  const ge = summary.graphError as Record<string, unknown>;
  assert(ge?.code === 100, "summary code");
  assert(ge?.subcode === 1885272, "summary subcode");
  assert(String(ge?.message || "").includes("Invalid parameter"), "summary msg");
  assert(ge?.userTitle === "Invalid optimization goal", "summary title");
  assert(String(ge?.userMsg || "").includes("not available"), "summary user msg");
  const dumped = JSON.stringify(mem);
  assert(!dumped.includes("mock-access-token"), "no mock token persisted");
  assert(!dumped.includes("access_token="), "no access_token persisted");
  assert(!dumped.includes("META_QA_WRITE_CONFIRM"), "no confirm token");
});

await test("resume skips CREATE_CAMPAIGN after PARTIALLY_CREATED", async () => {
  __resetFullPublishMemoryOpsForTests();
  const fingerprint = "fp-error-retention-resume";
  const plan = buildMockPlan(
    fingerprint,
    META_WRITE_SAFE_STATUS,
    META_PUBLISH_ORDER,
  );
  let campaignCreates = 0;
  let adsetPosts = 0;
  const transport: MetaGraphWriteTransport = async ({ url }) => {
    if (url.includes("/campaigns")) {
      campaignCreates += 1;
      return { ok: true, status: 200, json: { id: "120299999999999999" } };
    }
    if (url.includes("/adsets")) {
      adsetPosts += 1;
      return { ok: false, status: 400, json: GRAPH_ERROR_JSON };
    }
    return { ok: false, status: 500, json: { error: { message: "x" } } };
  };
  const common = {
    userId: "44444444-4444-4444-8444-444444444444",
    allyCampaignId: plan.allyCampaignId,
    fingerprint,
    humanConfirmed: true as const,
    transport,
    __allowMockExecuteWithoutLiveFlag: true as const,
    __memoryOps: true as const,
    __planOverride: plan,
    __skipPersist: true as const,
    __downloadAsset: async () => ({
      ok: false as const,
      reason: "MISSING_CREATIVE_ASSET" as const,
      messageIt: "n/a",
    }),
  };
  const first = await executeMetaPublishPlan(common);
  assert(first.metaCampaignId === "120299999999999999", "first campaign");
  assert(campaignCreates === 1, "first created campaign");
  const second = await executeMetaPublishPlan(common);
  assert(second.metaCampaignId === "120299999999999999", "reuse campaign");
  assert(campaignCreates === 1, "no second campaign create");
  assert(adsetPosts === 2, "adset validate retried");
  assert(second.failedAt === "CREATE_ADSET", "still adset");
  assert(second.graphError?.code === 100, "diag on resume fail");
});

await test("source wiring: graphFail + validate before create", () => {
  const gw = read("./src/lib/meta/write/graph-write.ts");
  assert(gw.includes("extractGraphErrorBits"), "extract bits");
  assert(gw.includes("toSafeGraphErrorDiagnostics"), "toSafe helper");
  assert(gw.includes("metaMessageSafe: bits.message"), "create keeps message");
  const ex = read("./src/lib/meta/publish/execute.ts");
  assert(ex.includes("validateMetaAdSetPaused"), "validate import");
  assert(ex.includes('source: "validate_only"') || ex.includes('"validate_only"'), "validate source");
  assert(ex.includes("graphError"), "persist graphError");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
