/**
 * M3 — Meta campaign import, read-only (fake Graph only).
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m3.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MetaError } from "@/lib/meta/errors";
import { mapGraphErrorToMetaError } from "@/lib/meta/graph";
import { mapMetaObjectiveToAffianco } from "@/lib/meta/campaign-objective";
import {
  META_CAMPAIGN_FIELDS,
  META_CAMPAIGNS_MAX_PAGES,
  fetchCampaignPages,
  graphCampaignsEdge,
  normalizeMetaCampaign,
  parseCampaignsPage,
} from "@/lib/meta/campaigns";

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

console.log("\n=== M3 normalize / historical ===");
const paused = normalizeMetaCampaign(
  {
    id: "111",
    name: "Pausa",
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    effective_status: "PAUSED",
  },
  "act_1",
);
assert(paused?.effectiveStatus === "PAUSED", "I paused preserved");
const archived = normalizeMetaCampaign(
  {
    id: "222",
    name: "Archivio",
    objective: "LEADS",
    status: "ARCHIVED",
    effective_status: "ARCHIVED",
  },
  "act_1",
);
assert(archived?.effectiveStatus === "ARCHIVED", "H inactive/archived preserved");
const historical = normalizeMetaCampaign(
  {
    id: "333",
    name: "Storica",
    objective: "CONVERSIONS",
    status: "PAUSED",
    effective_status: "CAMPAIGN_PAUSED",
    start_time: "2023-01-01T00:00:00+0000",
    stop_time: "2023-02-01T00:00:00+0000",
  },
  "act_1",
);
assert(historical?.stopAt?.startsWith("2023-02-01"), "J historical dates preserved");

const page = parseCampaignsPage(
  {
    data: [
      { id: "111", name: "A", objective: "LEADS", effective_status: "ACTIVE" },
      { id: "222", name: "A", objective: "LEADS", effective_status: "PAUSED" },
    ],
  },
  "act_9",
);
assert(page.campaigns.length === 2, "G multiple campaigns");
assert(
  page.campaigns[0]?.name === "A" &&
    page.campaigns[1]?.name === "A" &&
    page.campaigns[0]?.metaCampaignId !== page.campaigns[1]?.metaCampaignId,
  "N same name different Meta IDs",
);

console.log("\n=== M3 objective mapping ===");
const leads = mapMetaObjectiveToAffianco("OUTCOME_LEADS");
assert(leads.rawObjective === "OUTCOME_LEADS", "P raw preserved");
assert(leads.affiancoObjectiveCandidate === "LEADS" && leads.mappingConfidence === "CONFIDENT", "LEADS confident");
const sales = mapMetaObjectiveToAffianco("OUTCOME_SALES");
assert(sales.mappingConfidence === "AMBIGUOUS", "Q sales ambiguous");
assert(sales.affiancoObjectiveCandidate === "ECOMMERCE", "Q candidate ecommerce not proven");
const traffic = mapMetaObjectiveToAffianco("OUTCOME_TRAFFIC");
assert(traffic.affiancoObjectiveCandidate == null, "Q traffic not INSTORE");
assert(traffic.mappingConfidence === "UNKNOWN", "Q traffic unknown");
assert(mapMetaObjectiveToAffianco("RETARGETING").affiancoObjectiveCandidate == null, "R no fake retargeting");
assert(
  !["RETARGETING", "BOOKINGS", "IN_STORE"].includes(
    String(mapMetaObjectiveToAffianco("OUTCOME_TRAFFIC").affiancoObjectiveCandidate),
  ),
  "R no RETARGETING/BOOKINGS/INSTORE from traffic",
);

console.log("\n=== M3 pagination / graph ===");
assert(graphCampaignsEdge("act_123") === "act_123/campaigns", "D act_ path");
assert(graphCampaignsEdge("123") === "act_123/campaigns", "D numeric account");
assert(!META_CAMPAIGN_FIELDS.includes("insights"), "X no insights fields");
assert(!META_CAMPAIGN_FIELDS.includes("adset"), "Y no adset fields");

void (async () => {
  let calls = 0;
  const result = await fetchCampaignPages(
    "FAKE_TOKEN_DO_NOT_LOG",
    "v21.0",
    "act_55",
    async (url, init) => {
      calls += 1;
      assert(!url.includes("FAKE_TOKEN_DO_NOT_LOG"), "S token not in URL");
      assert(url.includes("/act_55/campaigns"), "D mapped account in path");
      assert(url.includes("effective_status"), "H status filter present");
      assert(decodeURIComponent(url).includes("ARCHIVED"), "H ARCHIVED requested");
      assert(!decodeURIComponent(url).includes("DELETED"), "no DELETED filter");
      assert(!url.includes("paging.next"), "K no arbitrary next URL");
      const auth = String(
        (init?.headers as Record<string, string> | undefined)?.Authorization ?? "",
      );
      assert(auth === "Bearer FAKE_TOKEN_DO_NOT_LOG", "S token only Authorization");
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: `c${calls}`,
              name: "Camp",
              effective_status: calls === 1 ? "ARCHIVED" : "PAUSED",
            },
          ],
          paging: { cursors: { after: `c${calls}` } },
        }),
      };
    },
  );
  assert(calls === META_CAMPAIGNS_MAX_PAGES, "L cap pagine");
  assert(result.campaigns.length === META_CAMPAIGNS_MAX_PAGES, "K collected to cap");
  assert(result.truncated === true, "L truncated flag");

  assert(
    mapGraphErrorToMetaError({ error: { message: "secret-xyz", code: 1 } }, "META_CAMPAIGN_DISCOVERY_FAILED")
      .message !== "secret-xyz",
    "T no raw Meta error",
  );
  assert(
    mapGraphErrorToMetaError({ error: { code: 190 } }, "META_CAMPAIGN_DISCOVERY_FAILED")
      .code === "META_TOKEN_EXPIRED",
    "token expired normalized",
  );

  console.log("\n=== M3 routes / SQL / scopes ===");
  const campSrc = read("src/lib/meta/campaigns.ts");
  const impSrc = read("src/lib/meta/campaign-import.ts");
  const objSrc = read("src/lib/meta/campaign-objective.ts");
  const getSrc = read("src/app/api/meta/campaigns/route.ts");
  const postSrc = read("src/app/api/meta/campaigns/import/route.ts");
  const uiSrc = read("src/components/clienti/PannelloAccountMetaCliente.tsx");
  const sql = read("supabase/migrations/20260905_meta_campaigns.sql");

  assert(getSrc.includes("requireRouteUserId"), "A GET auth");
  assert(postSrc.includes("requireRouteUserId"), "A POST auth");
  assert(getSrc.includes("clientId"), "B GET clientId");
  assert(postSrc.includes("body.clientId"), "B POST clientId");
  assert(!postSrc.includes("body.userId"), "A no userId from client");
  assert(!postSrc.includes("metaAdAccountId"), "D no trusted ad account from body");
  assert(campSrc.includes("getMetaConnectionForClient(userId, clientId)"), "C client connection");
  assert(campSrc.includes("getDecryptedMetaAccessToken(userId, clientId)"), "C client token");
  assert(campSrc.includes("getClientMetaAccount(userId, clientId)"), "D mapping required");
  assert(campSrc.includes("META_AD_ACCOUNT_NOT_SELECTED"), "mapped account required");
  assert(campSrc.includes("findAccessibleAccount"), "D account still accessible");
  assert(campSrc.includes("META_AD_ACCOUNT_ACCESS_LOST"), "access lost");
  assert(!campSrc.includes("getMetaConnectionForUser"), "E no global fallback");
  assert(!impSrc.includes("getMetaConnectionForUser"), "E no fallback import");
  assert(campSrc.includes("assertMetaConnectionReadyForAdsRead"), "F ads_read gate");
  assert(impSrc.includes('onConflict: "user_id,client_id,meta_campaign_id"'), "M/O upsert identity");
  assert(!impSrc.includes(".delete("), "no destructive sync");
  assert(!objSrc.includes("RETARGETING"), "R mapper no RETARGETING");
  assert(!objSrc.includes('"BOOKINGS"'), "R no bookings map");
  assert(!objSrc.includes("IN_STORE"), "R no instore map");
  assert(!getSrc.includes("access_token"), "S GET no token");
  assert(!postSrc.includes("access_token"), "S POST no token");
  assert(!uiSrc.includes("decryptMetaToken"), "S UI no decrypt");
  assert(sql.includes("enable row level security"), "V RLS");
  assert(sql.includes("revoke all on table public.meta_campaigns from anon"), "V anon");
  assert(sql.includes("writes are server-only"), "W server-only writes");
  assert(sql.includes("unique (user_id, client_id, meta_campaign_id)"), "O unique");
  assert(sql.includes("connection scope mismatch"), "U connection scope");
  assert(sql.includes("mapping account mismatch"), "U mapping account");
  assert(!campSrc.includes("/insights"), "X no insights path");
  assert(!campSrc.includes("/adsets"), "Z no adsets");
  assert(!campSrc.includes("ads_management"), "Y ads_management absent");
  assert(!campSrc.includes("business_management"), "Z business_management absent");
  assert(!postSrc.includes("ads_management"), "Y import no ads_management");
  assert(uiSrc.includes("Importa campagne Meta"), "campaign UI CTA");
  assert(uiSrc.includes("Campagne Meta importate"), "campaign list");
  assert(!uiSrc.includes("Strategic Score"), "no fake score");
  assert(!uiSrc.includes("Launch Readiness"), "no launch readiness");
  assert(uiSrc.includes("Seleziona prima un account pubblicitario Meta."), "not selected copy");
  assert(campSrc.includes("JSON.stringify([...META_CAMPAIGN_EFFECTIVE_STATUSES])"), "H documented filter");

  if (falliti > 0) {
    console.error(`\nM3 FALLITO: ${falliti} assert`);
    process.exit(1);
  }
  console.log("\nM3 OK");
})();
