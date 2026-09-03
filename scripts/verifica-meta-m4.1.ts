/**
 * M4.1 — Meta campaign Insights, daily persist, fake Graph only.
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m4.1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MetaError } from "@/lib/meta/errors";
import { mapGraphErrorToMetaError } from "@/lib/meta/graph";
import {
  extractPrimaryLeadResult,
  extractPurchaseValue,
  normalizeMetaActions,
} from "@/lib/meta/insight-actions";
import { aggregateDailyInsights } from "@/lib/meta/insight-aggregate";
import {
  META_INSIGHTS_MAX_LOOKBACK_DAYS,
  resolveInsightDateRange,
} from "@/lib/meta/insight-dates";
import {
  classifyInsightUpsert,
  normalizeInsightRow,
  parseNonNegNumber,
  resolveLinkClicks,
} from "@/lib/meta/insight-normalize";
import { metaInsightsToControlRoomInput } from "@/lib/meta/insights-control-room";
import {
  META_INSIGHT_FIELDS,
  fetchInsightsPages,
  graphCampaignInsightsEdge,
} from "@/lib/meta/insights";

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

const root = join(import.meta.dirname, "..");
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

process.env.META_GRAPH_API_VERSION = "v21.0";

console.log("\n=== M4.1 parse / link clicks / actions ===");
assert(parseNonNegNumber("12.50") === 12.5, "I spend parsing");
assert(parseNonNegNumber("0") === 0, "I spend zero is real zero");
const day = normalizeInsightRow(
  {
    date_start: "2026-06-08",
    date_stop: "2026-06-08",
    campaign_id: "999",
    impressions: "1000",
    reach: "800",
    clicks: "40",
    inline_link_clicks: "12",
    spend: "25.10",
    frequency: "1.25",
    ctr: "4.0",
    cpc: "0.6275",
    cpm: "25.1",
    actions: [
      { action_type: "lead", value: "3" },
      { action_type: "link_click", value: "12" },
    ],
    action_values: [{ action_type: "purchase", value: "90" }],
    outbound_clicks: [{ action_type: "outbound_click", value: "10" }],
  },
  { rawObjective: "OUTCOME_LEADS" },
);
assert(day?.impressions === 1000, "J impressions parsing");
assert(day?.clicks === 40, "K clicks parsing");
assert(day?.linkClicks === 12, "L inline link clicks preferred");
assert(day?.linkClicks !== day?.clicks, "L clicks ≠ link clicks");
assert(day?.frequency === 1.25, "M frequency parsing");
assert(day?.actions.some((a) => a.actionType === "lead" && a.value === 3), "N actions preserved");
assert(
  day?.actionValues.some((a) => a.actionType === "purchase" && a.value === 90),
  "O action_values preserved",
);
assert(day?.primaryResults === 3 && day.resultMappingConfidence === "CONFIDENT", "P lead allowlist confident");
assert(day?.metaCtr === 4.0, "Meta ctr stored separately");

assert(
  resolveLinkClicks(undefined, [{ action_type: "outbound_click", value: 7 }]) === 7,
  "L outbound_click fallback",
);
assert(resolveLinkClicks(undefined, [{ action_type: "link_click", value: 9 }]) == null, "L no generic click fallback");

const summed = normalizeMetaActions([
  { action_type: "lead", value: 2 },
  { action_type: "omni_lead", value: 5 },
]);
assert(
  extractPrimaryLeadResult(summed).mappingConfidence === "AMBIGUOUS" &&
    extractPrimaryLeadResult(summed).primaryResults == null,
  "Q ambiguous + S no fake sum",
);
assert(
  extractPrimaryLeadResult([{ actionType: "complete_registration", value: 4 }])
    .mappingConfidence === "UNKNOWN",
  "R unknown stays null",
);
assert(
  extractPrimaryLeadResult([{ actionType: "complete_registration", value: 4 }])
    .primaryResults == null,
  "R no fabricated result",
);
assert(extractPrimaryLeadResult(summed).primaryResults == null, "S do not sum allowlisted types");
assert(
  extractPurchaseValue([{ actionType: "omni_purchase", value: 40 }]).primaryResultValue ===
    40,
  "purchase value recognized",
);
assert(
  extractPurchaseValue([
    { actionType: "purchase", value: 10 },
    { actionType: "omni_purchase", value: 20 },
  ]).mappingConfidence === "AMBIGUOUS",
  "ambiguous purchase value",
);

console.log("\n=== M4.1 date range ===");
const technon = resolveInsightDateRange({
  metaStartAt: "2026-06-08T00:00:00.000Z",
  metaStopAt: "2026-06-28T00:00:00.000Z",
  metaCreatedAt: null,
  now: new Date("2026-09-03T12:00:00.000Z"),
});
assert(technon.since === "2026-06-08" && technon.until === "2026-06-28", "campaign dates used");
assert(technon.truncated === false, "Technon window not truncated");
assert(technon.fallback === "campaign_dates", "campaign_dates fallback label");
const missing = resolveInsightDateRange({
  metaStartAt: null,
  metaStopAt: null,
  metaCreatedAt: null,
  now: new Date("2026-09-03T12:00:00.000Z"),
});
assert(missing.fallback === "lookback", "missing dates use bounded lookback");
assert(META_INSIGHTS_MAX_LOOKBACK_DAYS === 90, "90-day cap");
const long = resolveInsightDateRange({
  metaStartAt: "2024-01-01T00:00:00.000Z",
  metaStopAt: "2026-06-28T00:00:00.000Z",
  metaCreatedAt: null,
  now: new Date("2026-09-03T12:00:00.000Z"),
});
assert(long.truncated === true, "truncation is explicit");
assert(long.since !== "2024-01-01", "lookback cap applied");

console.log("\n=== M4.1 daily / aggregate ===");
const first = classifyInsightUpsert(new Set(), ["2026-06-08", "2026-06-09"]);
assert(first.inserted === 2 && first.updated === 0, "T first import inserts");
const second = classifyInsightUpsert(new Set(["2026-06-08", "2026-06-09"]), [
  "2026-06-08",
  "2026-06-09",
]);
assert(second.inserted === 0 && second.updated === 2, "U second import updates");
assert(
  classifyInsightUpsert(new Set(["2026-06-08"]), ["2026-06-08", "2026-06-08"]).updated === 1,
  "V no duplicate date counts",
);

const agg = aggregateDailyInsights(
  [
    {
      ...day!,
      dateStart: "2026-06-08",
      reach: 100,
      frequency: 1,
      linkClicks: 10,
      impressions: 1000,
      spend: 20,
      clicks: 30,
    },
    {
      ...day!,
      dateStart: "2026-06-09",
      reach: 80,
      frequency: 3,
      linkClicks: 5,
      impressions: 500,
      spend: 10,
      clicks: 12,
    },
  ],
  { reach: 150, frequency: 1.4 },
);
assert(agg.spend === 30, "sum spend");
assert(agg.impressions === 1500, "sum impressions");
assert(agg.periodReach === 150, "AG reach not summed");
assert(agg.periodFrequency === 1.4, "AH frequency not averaged");
assert(Math.abs((agg.ctr ?? 0) - 1) < 1e-9, "CTR from link clicks / impressions");

const adapter = metaInsightsToControlRoomInput({
  aggregate: agg,
  since: "2026-06-08",
  until: "2026-06-28",
});
assert(adapter.source === "META_API", "adapter source META_API");
assert(adapter.metrics.frequency === 1.4, "adapter uses period frequency");

console.log("\n=== M4.1 graph fake Insights ===");
assert(graphCampaignInsightsEdge("12345") === "12345/insights", "campaign insights edge");
assert(!META_INSIGHT_FIELDS.includes("campaign_name"), "no unnecessary campaign_name");
assert(META_INSIGHT_FIELDS.includes("inline_link_clicks"), "inline_link_clicks requested");
assert(META_INSIGHT_FIELDS.includes("outbound_clicks"), "outbound_clicks requested");

void (async () => {
  let calls = 0;
  const rows = await fetchInsightsPages(
    "FAKE_TOKEN_DO_NOT_LOG",
    "v21.0",
    "555",
    { since: "2026-06-08", until: "2026-06-28", timeIncrement: "1" },
    async (url, init) => {
      calls += 1;
      assert(!url.includes("FAKE_TOKEN_DO_NOT_LOG"), "Y token never in URL");
      assert(url.includes("/v21.0/555/insights"), "versioned insights path");
      assert(url.includes("time_increment=1"), "daily increment");
      assert(!url.includes("date_preset"), "no unlimited date_preset");
      assert(!url.includes("action_attribution_windows"), "default attribution");
      assert(!url.includes("/adsets"), "AF no adset");
      assert(!url.includes("/ads"), "AF no ads edge");
      const auth = String(
        (init?.headers as Record<string, string> | undefined)?.Authorization ?? "",
      );
      assert(auth === "Bearer FAKE_TOKEN_DO_NOT_LOG", "Y token Authorization only");
      return {
        ok: true,
        json: async () => ({ data: [] }),
      };
    },
  );
  assert(rows.length === 0, "W empty Insights valid page");
  assert(calls === 1, "single page when empty");

  const failed = mapGraphErrorToMetaError(
    { error: { message: "secret-xyz", code: 99 } },
    "META_INSIGHTS_DISCOVERY_FAILED",
  );
  assert(failed.code === "META_INSIGHTS_DISCOVERY_FAILED", "X discovery failed code");
  assert(failed.message !== "secret-xyz", "Z no raw Graph error");
  assert(
    mapGraphErrorToMetaError({ error: { code: 190 } }, "META_INSIGHTS_DISCOVERY_FAILED")
      .code === "META_TOKEN_EXPIRED",
    "token expired normalized",
  );
  assert(
    mapGraphErrorToMetaError({ error: { code: 10 } }, "META_INSIGHTS_DISCOVERY_FAILED")
      .code === "META_PERMISSION_MISSING",
    "permission missing normalized",
  );
  assert(
    mapGraphErrorToMetaError({ error: { code: 4 } }, "META_INSIGHTS_DISCOVERY_FAILED")
      .code === "META_RATE_LIMIT",
    "rate limit normalized",
  );

  console.log("\n=== M4.1 routes / SQL / scoping ===");
  const insSrc = read("src/lib/meta/insights.ts");
  const impSrc = read("src/lib/meta/insight-import.ts");
  const getSrc = read("src/app/api/meta/campaign-insights/route.ts");
  const postSrc = read("src/app/api/meta/campaign-insights/import/route.ts");
  const uiSrc = read("src/components/clienti/PannelloAccountMetaCliente.tsx");
  const sql = read("supabase/migrations/20260906_meta_campaign_insights_daily.sql");
  const adapterSrc = read("src/lib/meta/insights-control-room.ts");
  const checksSrc = read("src/lib/campaign-checks-db.ts");
  const campPub = read("src/lib/meta/campaigns.ts");

  assert(getSrc.includes("requireRouteUserId"), "A GET auth");
  assert(postSrc.includes("requireRouteUserId"), "A POST auth");
  assert(getSrc.includes("clientId"), "B GET clientId");
  assert(postSrc.includes("body.clientId"), "B POST clientId");
  assert(!postSrc.includes("body.userId"), "A no userId from client");
  assert(!postSrc.includes("metaAdAccountId"), "E no trusted ad account from body");
  assert(insSrc.includes("getOwnedImportedMetaCampaign"), "C campaign ownership");
  assert(insSrc.includes("getMetaConnectionForClient(userId, clientId)"), "D client token path");
  assert(insSrc.includes("getDecryptedMetaAccessToken(userId, clientId)"), "D client token");
  assert(insSrc.includes("getClientMetaAccount(userId, clientId)"), "E mapped account");
  assert(insSrc.includes("findAccessibleAccount"), "E account still accessible");
  assert(!insSrc.includes("getMetaConnectionForUser"), "F no global fallback");
  assert(!impSrc.includes("getMetaConnectionForUser"), "F no fallback import");
  assert(insSrc.includes("assertMetaConnectionReadyForAdsRead"), "G ads_read required");
  assert(impSrc.includes('onConflict: "user_id,client_id,meta_campaign_id,date_start"'), "V unique upsert");
  assert(read("src/lib/meta/insight-aggregate.ts").includes("never sum"), "AG aggregate comments");
  assert(read("src/lib/meta/insight-aggregate.ts").includes("never average"), "AH frequency comments");
  assert(!impSrc.includes(".delete("), "do not delete omitted days");
  assert(!getSrc.includes("access_token"), "Y GET no token");
  assert(!postSrc.includes("access_token"), "Y POST no token");
  assert(sql.includes("enable row level security"), "RLS");
  assert(sql.includes("revoke all on table public.meta_campaign_insights_daily from anon"), "anon none");
  assert(sql.includes("writes are server-only"), "server-only writes");
  assert(sql.includes("unique (user_id, client_id, meta_campaign_id, date_start)"), "canonical unique");
  assert(sql.includes("connection scope mismatch"), "connection mismatch");
  assert(sql.includes("campaign mismatch"), "campaign mismatch");
  assert(!impSrc.includes('from("campaign_checks")'), "AA no campaign_checks write");
  assert(!insSrc.includes('from("campaign_checks")'), "AA insights no checks");
  assert(!adapterSrc.includes('from("campaign_checks")'), "AA adapter no writes");
  assert(!adapterSrc.includes("diagnosi"), "AB no Control Room mutation");
  assert(!impSrc.includes('from("campaigns")'), "AC no public.campaigns insights");
  assert(!insSrc.includes("ads_management"), "AD no ads_management");
  assert(!insSrc.includes("business_management"), "AE no business_management");
  assert(!postSrc.includes("ads_management"), "AD import no ads_management");
  assert(!insSrc.includes("/adsets"), "AF no adsets path");
  assert(!campPub.includes("/insights"), "campaign discovery still no insights");
  assert(uiSrc.includes("Importa dati Meta"), "INSIGHTS UI import CTA");
  assert(uiSrc.includes("Sincronizza dati"), "INSIGHTS UI sync CTA");
  assert(uiSrc.includes("Nessun dato di delivery disponibile per il periodo."), "empty copy");
  assert(uiSrc.includes("Clic sul link"), "link click label");
  assert(!uiSrc.includes("Strategic Score"), "no native score");
  assert(!uiSrc.includes("Launch Readiness"), "no launch readiness");
  assert(checksSrc.includes("campaign_checks"), "native checks file unchanged role");
  assert(!(failed instanceof MetaError && failed.message.includes("secret")), "Z message safe");

  if (falliti > 0) {
    console.error(`\nM4.1 FALLITO: ${falliti} assert`);
    process.exit(1);
  }
  console.log("\nM4.1 OK");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
