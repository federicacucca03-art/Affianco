import "server-only";
import { getMetaServerConfig } from "@/lib/meta/config";
import {
  getAccessibleMetaAdAccounts,
  assertMetaConnectionReadyForAdsRead,
  isSafeMetaPagingCursor,
} from "@/lib/meta/accounts";
import {
  findAccessibleAccount,
  getClientMetaAccount,
} from "@/lib/meta/client-accounts";
import { getOwnedImportedMetaCampaign } from "@/lib/meta/campaign-import";
import {
  getDecryptedMetaAccessToken,
  getMetaConnectionForClient,
} from "@/lib/meta/connections";
import { MetaError } from "@/lib/meta/errors";
import { graphApiBase, mapGraphErrorToMetaError } from "@/lib/meta/graph";
import { resolveInsightDateRange } from "@/lib/meta/insight-dates";
import {
  actionsToJson,
  normalizeInsightRow,
  parseInsightsPage,
  type NormalizedDailyInsight,
} from "@/lib/meta/insight-normalize";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const META_HIERARCHY_INSIGHT_FIELDS = [
  "date_start",
  "date_stop",
  "campaign_id",
  "adset_id",
  "ad_id",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "frequency",
  "actions",
  "action_values",
  "outbound_clicks",
  "inline_link_clicks",
].join(",");

export const META_HIERARCHY_INSIGHTS_PAGE_LIMIT = 50;
export const META_HIERARCHY_INSIGHTS_MAX_PAGES = 5;

export type NormalizedHierarchyInsight = NormalizedDailyInsight & {
  metaAdSetId: string | null;
  metaAdId: string | null;
};

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeActId(adAccountId: string): string {
  const raw = adAccountId.trim();
  if (!raw || raw.includes("/") || raw.includes("?")) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Account pubblicitario non valido.",
    );
  }
  const numeric = raw.replace(/^act_/i, "");
  if (!/^\d+$/.test(numeric)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Account pubblicitario non valido.",
    );
  }
  return `act_${numeric}`;
}

export function graphAccountInsightsEdge(adAccountId: string): string {
  return `${normalizeActId(adAccountId)}/insights`;
}

export function normalizeHierarchyInsightRow(
  raw: unknown,
  options?: { rawObjective?: string | null },
): NormalizedHierarchyInsight | null {
  const base = normalizeInsightRow(raw, options);
  if (!base) return null;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    ...base,
    metaAdSetId: asText(row.adset_id),
    metaAdId: asText(row.ad_id),
  };
}

async function fetchAccountLevelInsights(
  accessToken: string,
  version: string,
  adAccountId: string,
  params: {
    level: "adset" | "ad";
    campaignId: string;
    since: string;
    until: string;
  },
  fetchImpl: FetchLike,
): Promise<unknown[]> {
  const collected: unknown[] = [];
  let after: string | null = null;
  const edge = graphAccountInsightsEdge(adAccountId);
  const filtering = JSON.stringify([
    {
      field: "campaign.id",
      operator: "IN",
      value: [params.campaignId.trim()],
    },
  ]);

  for (let page = 0; page < META_HIERARCHY_INSIGHTS_MAX_PAGES; page += 1) {
    const url = new URL(graphApiBase(version, edge));
    url.searchParams.set("fields", META_HIERARCHY_INSIGHT_FIELDS);
    url.searchParams.set("limit", String(META_HIERARCHY_INSIGHTS_PAGE_LIMIT));
    url.searchParams.set("level", params.level);
    url.searchParams.set("time_increment", "1");
    url.searchParams.set(
      "time_range",
      JSON.stringify({ since: params.since, until: params.until }),
    );
    url.searchParams.set("filtering", filtering);
    if (after) {
      if (!isSafeMetaPagingCursor(after)) break;
      url.searchParams.set("after", after);
    }

    let json: unknown;
    let ok = false;
    try {
      const res = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      json = await res.json();
      ok = res.ok;
    } catch (error) {
      if (error instanceof MetaError) throw error;
      throw new MetaError(
        "META_INSIGHTS_DISCOVERY_FAILED",
        "Lettura Insights gerarchia Meta non riuscita.",
      );
    }

    if (!ok) {
      throw mapGraphErrorToMetaError(json, "META_INSIGHTS_DISCOVERY_FAILED");
    }

    collected.push(...parseInsightsPage(json));
    const paging =
      json && typeof json === "object"
        ? (json as { paging?: { cursors?: { after?: unknown } } }).paging
        : undefined;
    const nextAfter =
      paging &&
      paging.cursors &&
      typeof paging.cursors.after === "string" &&
      paging.cursors.after.trim()
        ? paging.cursors.after.trim()
        : null;
    if (!nextAfter || nextAfter === after) {
      return collected;
    }
    after = nextAfter;
  }

  return collected;
}

function adminClient() {
  try {
    return createSupabaseAdmin();
  } catch {
    throw new MetaError(
      "META_CONFIG_MISSING",
      "Persistenza server non configurata.",
    );
  }
}

async function persistAdSetInsights(input: {
  userId: string;
  clientId: string;
  metaConnectionId: string;
  metaAdAccountId: string;
  metaCampaignId: string;
  rows: NormalizedHierarchyInsight[];
}): Promise<void> {
  const usable = input.rows.filter((r) => r.metaAdSetId);
  if (usable.length === 0) return;
  const now = new Date().toISOString();
  const payloads = usable.map((d) => ({
    user_id: input.userId,
    client_id: input.clientId,
    meta_connection_id: input.metaConnectionId,
    meta_ad_account_id: input.metaAdAccountId,
    meta_campaign_id: input.metaCampaignId,
    meta_ad_set_id: d.metaAdSetId as string,
    date_start: d.dateStart,
    date_stop: d.dateStop,
    spend: d.spend,
    impressions: d.impressions,
    reach: d.reach,
    clicks: d.clicks,
    link_clicks: d.linkClicks,
    meta_ctr: d.metaCtr,
    meta_cpc: d.metaCpc,
    meta_cpm: d.metaCpm,
    frequency: d.frequency,
    actions: actionsToJson(d.actions),
    action_values: actionsToJson(d.actionValues),
    primary_result_type: d.primaryResultType,
    primary_results: d.primaryResults,
    primary_result_value: d.primaryResultValue,
    result_mapping_confidence: d.resultMappingConfidence,
    last_synced_at: now,
  }));
  const { error } = await adminClient()
    .from("meta_ad_set_insights_daily")
    .upsert(payloads, {
      onConflict: "user_id,client_id,meta_ad_set_id,date_start",
    });
  if (error) {
    throw new MetaError(
      "META_INSIGHTS_DISCOVERY_FAILED",
      "Salvataggio Insights gruppi non riuscito.",
    );
  }
}

async function persistAdInsights(input: {
  userId: string;
  clientId: string;
  metaConnectionId: string;
  metaAdAccountId: string;
  metaCampaignId: string;
  rows: NormalizedHierarchyInsight[];
}): Promise<void> {
  const usable = input.rows.filter((r) => r.metaAdId && r.metaAdSetId);
  if (usable.length === 0) return;
  const now = new Date().toISOString();
  const payloads = usable.map((d) => ({
    user_id: input.userId,
    client_id: input.clientId,
    meta_connection_id: input.metaConnectionId,
    meta_ad_account_id: input.metaAdAccountId,
    meta_campaign_id: input.metaCampaignId,
    meta_ad_set_id: d.metaAdSetId as string,
    meta_ad_id: d.metaAdId as string,
    date_start: d.dateStart,
    date_stop: d.dateStop,
    spend: d.spend,
    impressions: d.impressions,
    reach: d.reach,
    clicks: d.clicks,
    link_clicks: d.linkClicks,
    meta_ctr: d.metaCtr,
    meta_cpc: d.metaCpc,
    meta_cpm: d.metaCpm,
    frequency: d.frequency,
    actions: actionsToJson(d.actions),
    action_values: actionsToJson(d.actionValues),
    primary_result_type: d.primaryResultType,
    primary_results: d.primaryResults,
    primary_result_value: d.primaryResultValue,
    result_mapping_confidence: d.resultMappingConfidence,
    last_synced_at: now,
  }));
  const { error } = await adminClient()
    .from("meta_ad_insights_daily")
    .upsert(payloads, {
      onConflict: "user_id,client_id,meta_ad_id,date_start",
    });
  if (error) {
    throw new MetaError(
      "META_INSIGHTS_DISCOVERY_FAILED",
      "Salvataggio Insights inserzioni non riuscito.",
    );
  }
}

export async function importClientCampaignHierarchyInsights(
  userId: string,
  clientId: string,
  campaignUuid: string,
  options?: { fetchImpl?: FetchLike },
): Promise<{
  adSetInsightRows: number;
  adInsightRows: number;
  metaCampaignId: string;
}> {
  const campaign = await getOwnedImportedMetaCampaign(
    userId,
    clientId,
    campaignUuid,
  );
  const connection = assertMetaConnectionReadyForAdsRead(
    await getMetaConnectionForClient(userId, clientId),
  );
  // Allow reconnect: campaign row may still reference a prior connection id
  // as long as ownership + current account mapping remain valid.
  const mapping = await getClientMetaAccount(userId, clientId);
  if (!mapping) {
    throw new MetaError(
      "META_AD_ACCOUNT_NOT_SELECTED",
      "Seleziona prima un account pubblicitario Meta.",
    );
  }
  if (mapping.metaAdAccountId !== campaign.metaAdAccountId) {
    throw new MetaError(
      "META_AD_ACCOUNT_ACCESS_LOST",
      "Account pubblicitario Meta non più accessibile.",
    );
  }
  const accessible = await getAccessibleMetaAdAccounts(userId, clientId, {
    fetchImpl: options?.fetchImpl,
  });
  const account = findAccessibleAccount(accessible, mapping.metaAdAccountId);
  if (!account) {
    throw new MetaError(
      "META_AD_ACCOUNT_ACCESS_LOST",
      "Account pubblicitario Meta non più accessibile.",
    );
  }

  const token = await getDecryptedMetaAccessToken(userId, clientId);
  const config = getMetaServerConfig();
  const fetchImpl = options?.fetchImpl ?? fetch;
  const dateRange = resolveInsightDateRange({
    metaStartAt: campaign.startAt,
    metaStopAt: campaign.stopAt,
    metaCreatedAt: campaign.createdAt,
  });

  const [adSetRaw, adRaw] = await Promise.all([
    fetchAccountLevelInsights(
      token,
      config.graphApiVersion,
      campaign.metaAdAccountId,
      {
        level: "adset",
        campaignId: campaign.metaCampaignId,
        since: dateRange.since,
        until: dateRange.until,
      },
      fetchImpl,
    ),
    fetchAccountLevelInsights(
      token,
      config.graphApiVersion,
      campaign.metaAdAccountId,
      {
        level: "ad",
        campaignId: campaign.metaCampaignId,
        since: dateRange.since,
        until: dateRange.until,
      },
      fetchImpl,
    ),
  ]);

  const adSetRows = adSetRaw
    .map((row) =>
      normalizeHierarchyInsightRow(row, {
        rawObjective: campaign.rawObjective,
      }),
    )
    .filter((r): r is NormalizedHierarchyInsight => r != null);

  const adRows = adRaw
    .map((row) =>
      normalizeHierarchyInsightRow(row, {
        rawObjective: campaign.rawObjective,
      }),
    )
    .filter((r): r is NormalizedHierarchyInsight => r != null);

  await persistAdSetInsights({
    userId,
    clientId,
    metaConnectionId: connection.id,
    metaAdAccountId: campaign.metaAdAccountId,
    metaCampaignId: campaign.metaCampaignId,
    rows: adSetRows,
  });
  await persistAdInsights({
    userId,
    clientId,
    metaConnectionId: connection.id,
    metaAdAccountId: campaign.metaAdAccountId,
    metaCampaignId: campaign.metaCampaignId,
    rows: adRows,
  });

  return {
    adSetInsightRows: adSetRows.length,
    adInsightRows: adRows.length,
    metaCampaignId: campaign.metaCampaignId,
  };
}
