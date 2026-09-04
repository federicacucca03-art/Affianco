/**
 * Client-side loader for Monday Control Room Meta rows.
 * Reuses canonical monitoring mapper. No Meta tokens. No writes.
 */

import { supabase } from "@/lib/supabase";
import {
  mapMetaCampaignToMonitoringRow,
  type MetaCampaignApiRow,
  type MetaCampaignMonitoringRow,
} from "@/lib/meta/meta-campaign-monitoring-row";
import type { LinkedAffiancoCampaignSnapshot } from "@/lib/meta/campaign-link-compatibility";
import type { ResultMappingConfidence } from "@/lib/meta/insight-actions";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";
import {
  computeMetaTrend,
  type MetaTrendDirection,
  type MetaTrendLevel,
} from "@/lib/meta/meta-trend";

export type MetaMondayBundle = {
  rows: MetaCampaignMonitoringRow[];
  trends: Map<
    string,
    { direction: MetaTrendDirection | null; level: MetaTrendLevel }
  >;
};

function emptyInsight(date: string, metaCampaignId: string): NormalizedDailyInsight {
  return {
    metaCampaignId,
    dateStart: date,
    dateStop: date,
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    linkClicks: null,
    metaCtr: null,
    metaCpc: null,
    metaCpm: null,
    frequency: null,
    actions: [],
    actionValues: [],
    primaryResultType: null,
    primaryResults: null,
    primaryResultValue: null,
    resultMappingConfidence: "UNKNOWN",
  };
}

export async function loadMetaMondayBundle(
  userId: string,
): Promise<MetaMondayBundle> {
  const { data: camps, error: campErr } = await supabase
    .from("meta_campaigns")
    .select(
      "id, client_id, meta_campaign_id, name, effective_status, raw_objective, last_synced_at, insights_period_since, insights_period_until, insights_period_frequency, insights_last_synced_at, primary_kpi, target_value, affianco_campaign_id",
    )
    .eq("user_id", userId)
    .order("last_synced_at", { ascending: false });

  if (campErr) throw campErr;
  const campRows = (camps ?? []) as MetaCampaignApiRow[];
  if (campRows.length === 0) {
    return { rows: [], trends: new Map() };
  }

  const clientIds = [...new Set(campRows.map((c) => c.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .in("id", clientIds);
  const clientName = new Map(
    ((clients ?? []) as { id: string; name: string }[]).map((c) => [
      c.id,
      c.name,
    ]),
  );

  const metaIds = campRows.map((c) => c.meta_campaign_id);
  const { data: insightData } = await supabase
    .from("meta_campaign_insights_daily")
    .select(
      "meta_campaign_id, date_start, date_stop, spend, impressions, link_clicks, primary_result_type, primary_results, result_mapping_confidence",
    )
    .eq("user_id", userId)
    .in("meta_campaign_id", metaIds);

  type InsightRow = {
    meta_campaign_id: string;
    date_start: string;
    date_stop: string | null;
    spend: number | null;
    impressions: number | null;
    link_clicks: number | null;
    primary_result_type: string | null;
    primary_results: number | null;
    result_mapping_confidence: string | null;
  };

  const dailyByMeta = new Map<string, NormalizedDailyInsight[]>();
  const aggMap = new Map<
    string,
    {
      spend: number;
      impressions: number;
      linkClicks: number;
      primaryResults: number | null;
      primaryResultType: string | null;
      resultMappingConfidence: ResultMappingConfidence;
    }
  >();
  const typeSets = new Map<string, Set<string>>();
  const ambiguous = new Set<string>();

  for (const ins of (insightData ?? []) as InsightRow[]) {
    const prev = aggMap.get(ins.meta_campaign_id) ?? {
      spend: 0,
      impressions: 0,
      linkClicks: 0,
      primaryResults: 0,
      primaryResultType: null,
      resultMappingConfidence: "UNKNOWN" as ResultMappingConfidence,
    };
    aggMap.set(ins.meta_campaign_id, {
      spend: prev.spend + (ins.spend ?? 0),
      impressions: prev.impressions + (ins.impressions ?? 0),
      linkClicks: prev.linkClicks + (ins.link_clicks ?? 0),
      primaryResults: prev.primaryResults,
      primaryResultType: prev.primaryResultType,
      resultMappingConfidence: prev.resultMappingConfidence,
    });

    if (ins.result_mapping_confidence === "AMBIGUOUS") {
      ambiguous.add(ins.meta_campaign_id);
    }
    if (
      ins.result_mapping_confidence === "CONFIDENT" &&
      ins.primary_result_type
    ) {
      const set = typeSets.get(ins.meta_campaign_id) ?? new Set();
      set.add(ins.primary_result_type);
      typeSets.set(ins.meta_campaign_id, set);
      const cur = aggMap.get(ins.meta_campaign_id)!;
      cur.primaryResults =
        (cur.primaryResults ?? 0) + (ins.primary_results ?? 0);
    }

    const day = emptyInsight(ins.date_start, ins.meta_campaign_id);
    day.dateStop = ins.date_stop ?? ins.date_start;
    day.spend = ins.spend;
    day.impressions = ins.impressions;
    day.linkClicks = ins.link_clicks;
    day.primaryResultType = ins.primary_result_type;
    day.primaryResults = ins.primary_results;
    day.resultMappingConfidence =
      ins.result_mapping_confidence === "CONFIDENT" ||
      ins.result_mapping_confidence === "AMBIGUOUS"
        ? ins.result_mapping_confidence
        : "UNKNOWN";
    const list = dailyByMeta.get(ins.meta_campaign_id) ?? [];
    list.push(day);
    dailyByMeta.set(ins.meta_campaign_id, list);
  }

  for (const [id, agg] of aggMap) {
    if (ambiguous.has(id)) {
      agg.resultMappingConfidence = "AMBIGUOUS";
      agg.primaryResultType = null;
      agg.primaryResults = null;
      continue;
    }
    const types = typeSets.get(id);
    if (!types || types.size === 0) {
      agg.resultMappingConfidence = "UNKNOWN";
      agg.primaryResultType = null;
      agg.primaryResults = null;
    } else if (types.size > 1) {
      agg.resultMappingConfidence = "AMBIGUOUS";
      agg.primaryResultType = null;
      agg.primaryResults = null;
    } else {
      agg.resultMappingConfidence = "CONFIDENT";
      agg.primaryResultType = [...types][0];
    }
  }

  const linkedIds = [
    ...new Set(
      campRows
        .map((c) => c.affianco_campaign_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const linkedMap = new Map<string, LinkedAffiancoCampaignSnapshot>();
  if (linkedIds.length > 0) {
    const { data: nativeRows } = await supabase
      .from("campaigns")
      .select(
        "id, name, objective, status, max_sustainable_cpa, estimated_cpm, target_margin, booking_service_value, show_up_rate, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin",
      )
      .eq("user_id", userId)
      .in("id", linkedIds);
    for (const n of (nativeRows ?? []) as {
      id: string;
      name: string;
      objective: string | null;
      status: string | null;
      max_sustainable_cpa: number | null;
      estimated_cpm: number | null;
      target_margin: number | null;
      booking_service_value: number | null;
      show_up_rate: number | null;
      average_order_value: number | null;
      product_margin: number | null;
      average_receipt: number | null;
      store_margin: number | null;
      recovery_value: number | null;
      recovery_margin: number | null;
    }[]) {
      linkedMap.set(n.id, {
        id: n.id,
        name: n.name,
        objective: n.objective,
        status: n.status,
        maxSustainableCpa: n.max_sustainable_cpa,
        estimatedCpm: n.estimated_cpm,
        targetMargin: n.target_margin,
        bookingServiceValue: n.booking_service_value,
        showUpRate: n.show_up_rate,
        averageOrderValue: n.average_order_value,
        productMargin: n.product_margin,
        averageReceipt: n.average_receipt,
        storeMargin: n.store_margin,
        recoveryValue: n.recovery_value,
        recoveryMargin: n.recovery_margin,
      });
    }
  }

  const rows = campRows.map((c) =>
    mapMetaCampaignToMonitoringRow(
      c,
      aggMap.get(c.meta_campaign_id) ?? null,
      clientName.get(c.client_id) ?? "Cliente",
      c.affianco_campaign_id
        ? (linkedMap.get(c.affianco_campaign_id) ?? null)
        : null,
    ),
  );

  const trends = new Map<
    string,
    { direction: MetaTrendDirection | null; level: MetaTrendLevel }
  >();
  for (const row of rows) {
    const daily = dailyByMeta.get(row.metaCampaignId) ?? [];
    const trend = computeMetaTrend(daily);
    trends.set(row.id, {
      direction: trend.primary?.direction ?? null,
      level: trend.level,
    });
  }

  return { rows, trends };
}
