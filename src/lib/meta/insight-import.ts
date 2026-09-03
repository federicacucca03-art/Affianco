import "server-only";
import { aggregateDailyInsights } from "@/lib/meta/insight-aggregate";
import { discoverClientCampaignInsights } from "@/lib/meta/insights";
import { actionsToJson, classifyInsightUpsert } from "@/lib/meta/insight-normalize";
import { MetaError } from "@/lib/meta/errors";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getClientMetaAccount } from "@/lib/meta/client-accounts";
import { getOwnedImportedMetaCampaign } from "@/lib/meta/campaign-import";
import type { AggregatedMetaInsights } from "@/lib/meta/insight-aggregate";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";
import type { InsightDateRange } from "@/lib/meta/insight-dates";

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

type DailyRow = {
  date_start: string;
  date_stop: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  link_clicks: number | null;
  meta_ctr: number | null;
  meta_cpc: number | null;
  meta_cpm: number | null;
  frequency: number | null;
  actions: { action_type: string; value: number }[] | null;
  action_values: { action_type: string; value: number }[] | null;
  primary_result_type: string | null;
  primary_results: number | null;
  primary_result_value: number | null;
  result_mapping_confidence: string | null;
};

function rowToNormalized(
  row: DailyRow,
  metaCampaignId: string,
): NormalizedDailyInsight {
  const actions = Array.isArray(row.actions)
    ? row.actions.map((a) => ({
        actionType: a.action_type,
        value: a.value,
      }))
    : [];
  const actionValues = Array.isArray(row.action_values)
    ? row.action_values.map((a) => ({
        actionType: a.action_type,
        value: a.value,
      }))
    : [];
  return {
    metaCampaignId,
    dateStart: row.date_start,
    dateStop: row.date_stop,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    linkClicks: row.link_clicks,
    metaCtr: row.meta_ctr,
    metaCpc: row.meta_cpc,
    metaCpm: row.meta_cpm,
    frequency: row.frequency,
    actions,
    actionValues,
    primaryResultType: row.primary_result_type,
    primaryResults: row.primary_results,
    primaryResultValue: row.primary_result_value,
    resultMappingConfidence:
      row.result_mapping_confidence === "CONFIDENT" ||
      row.result_mapping_confidence === "AMBIGUOUS"
        ? row.result_mapping_confidence
        : "UNKNOWN",
  };
}

export type CampaignInsightsSummary = {
  metaCampaignId: string;
  syncedAt: string | null;
  emptyValid: boolean;
  lookbackTruncated: boolean;
  dateRangeFallback: InsightDateRange["fallback"] | null;
  since: string | null;
  until: string | null;
  currency: string | null;
  inserted: number;
  updated: number;
  aggregate: AggregatedMetaInsights | null;
};

export async function importClientCampaignInsights(
  userId: string,
  clientId: string,
  campaignId: string,
  options?: {
    fetchImpl?: (
      input: string,
      init?: { method?: string; headers?: Record<string, string> },
    ) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
  },
): Promise<CampaignInsightsSummary> {
  const discovered = await discoverClientCampaignInsights(
    userId,
    clientId,
    campaignId,
    options,
  );
  const existing = await adminClient()
    .from("meta_campaign_insights_daily")
    .select("date_start")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("meta_campaign_id", discovered.metaCampaignId);
  if (existing.error) {
    throw new MetaError(
      "META_INSIGHTS_DISCOVERY_FAILED",
      "Lettura Insights salvati non riuscita.",
    );
  }
  const known = new Set(
    ((existing.data ?? []) as { date_start: string }[]).map((r) => r.date_start),
  );
  const counts = classifyInsightUpsert(
    known,
    discovered.daily.map((d) => d.dateStart),
  );
  const now = new Date().toISOString();
  const payloads = discovered.daily.map((d) => ({
    user_id: userId,
    client_id: clientId,
    meta_connection_id: discovered.metaConnectionId,
    meta_ad_account_id: discovered.metaAdAccountId,
    meta_campaign_id: discovered.metaCampaignId,
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

  if (payloads.length > 0) {
    const { error } = await adminClient()
      .from("meta_campaign_insights_daily")
      .upsert(payloads, {
        onConflict: "user_id,client_id,meta_campaign_id,date_start",
      });
    if (error) {
      throw new MetaError(
        "META_INSIGHTS_DISCOVERY_FAILED",
        "Salvataggio Insights Meta non riuscito.",
      );
    }
  }

  const { error: periodError } = await adminClient()
    .from("meta_campaigns")
    .update({
      insights_period_since: discovered.dateRange.since,
      insights_period_until: discovered.dateRange.until,
      insights_period_reach: discovered.periodReach,
      insights_period_frequency: discovered.periodFrequency,
      insights_lookback_truncated: discovered.dateRange.truncated,
      insights_date_fallback: discovered.dateRange.fallback,
      insights_empty: discovered.daily.length === 0,
      insights_last_synced_at: now,
    })
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("meta_campaign_id", discovered.metaCampaignId);
  if (periodError) {
    throw new MetaError(
      "META_INSIGHTS_DISCOVERY_FAILED",
      "Salvataggio Insights Meta non riuscito.",
    );
  }

  const aggregate =
    discovered.daily.length > 0
      ? aggregateDailyInsights(discovered.daily, {
          reach: discovered.periodReach,
          frequency: discovered.periodFrequency,
        })
      : null;

  return {
    metaCampaignId: discovered.metaCampaignId,
    syncedAt: now,
    emptyValid: discovered.daily.length === 0,
    lookbackTruncated: discovered.dateRange.truncated,
    dateRangeFallback: discovered.dateRange.fallback,
    since: discovered.dateRange.since,
    until: discovered.dateRange.until,
    currency: discovered.currency,
    inserted: counts.inserted,
    updated: counts.updated,
    aggregate,
  };
}

export async function listClientCampaignInsights(
  userId: string,
  clientId: string,
  campaignId?: string,
): Promise<CampaignInsightsSummary[]> {
  const mapping = await getClientMetaAccount(userId, clientId);
  const currency = mapping?.currency ?? null;

  let campaignQuery = adminClient()
    .from("meta_campaigns")
    .select(
      "meta_campaign_id, insights_period_since, insights_period_until, insights_period_reach, insights_period_frequency, insights_lookback_truncated, insights_date_fallback, insights_empty, insights_last_synced_at",
    )
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (campaignId) {
    const owned = await getOwnedImportedMetaCampaign(
      userId,
      clientId,
      campaignId,
    );
    campaignQuery = campaignQuery.eq("meta_campaign_id", owned.metaCampaignId);
  }
  const campaigns = await campaignQuery;
  if (campaigns.error) {
    throw new MetaError(
      "META_INSIGHTS_DISCOVERY_FAILED",
      "Lettura Insights salvati non riuscita.",
    );
  }
  const campRows = (campaigns.data ?? []) as {
    meta_campaign_id: string;
    insights_period_since: string | null;
    insights_period_until: string | null;
    insights_period_reach: number | null;
    insights_period_frequency: number | null;
    insights_lookback_truncated: boolean | null;
    insights_date_fallback: string | null;
    insights_empty: boolean | null;
    insights_last_synced_at: string | null;
  }[];

  let dailyQuery = adminClient()
    .from("meta_campaign_insights_daily")
    .select(
      "meta_campaign_id, date_start, date_stop, spend, impressions, reach, clicks, link_clicks, meta_ctr, meta_cpc, meta_cpm, frequency, actions, action_values, primary_result_type, primary_results, primary_result_value, result_mapping_confidence",
    )
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (campaignId && campRows[0]) {
    dailyQuery = dailyQuery.eq("meta_campaign_id", campRows[0].meta_campaign_id);
  }
  const daily = await dailyQuery;
  if (daily.error) {
    throw new MetaError(
      "META_INSIGHTS_DISCOVERY_FAILED",
      "Lettura Insights salvati non riuscita.",
    );
  }
  const dailyRows = (daily.data ?? []) as (DailyRow & { meta_campaign_id: string })[];
  const byCampaign = new Map<string, NormalizedDailyInsight[]>();
  for (const row of dailyRows) {
    const list = byCampaign.get(row.meta_campaign_id) ?? [];
    list.push(rowToNormalized(row, row.meta_campaign_id));
    byCampaign.set(row.meta_campaign_id, list);
  }

  return campRows.map((camp) => {
    const rows = byCampaign.get(camp.meta_campaign_id) ?? [];
    const synced = Boolean(camp.insights_last_synced_at);
    const emptyValid = synced && rows.length === 0;
    const aggregate =
      rows.length > 0
        ? aggregateDailyInsights(rows, {
            reach: camp.insights_period_reach,
            frequency: camp.insights_period_frequency,
          })
        : null;
    return {
      metaCampaignId: camp.meta_campaign_id,
      syncedAt: camp.insights_last_synced_at,
      emptyValid,
      lookbackTruncated: Boolean(camp.insights_lookback_truncated),
      dateRangeFallback:
        camp.insights_date_fallback === "campaign_dates" ||
        camp.insights_date_fallback === "created_at" ||
        camp.insights_date_fallback === "lookback"
          ? camp.insights_date_fallback
          : null,
      since: camp.insights_period_since,
      until: camp.insights_period_until,
      currency,
      inserted: 0,
      updated: 0,
      aggregate,
    };
  });
}
