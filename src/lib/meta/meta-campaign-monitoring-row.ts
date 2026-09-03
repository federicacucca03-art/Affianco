/**
 * Maps persisted Meta campaign + insight aggregates into Control Room list rows.
 * Health/mode come only from metaInsightsToControlRoomInput (canonical).
 */

import type { AggregatedMetaInsights } from "@/lib/meta/insight-aggregate";
import {
  metaInsightsToControlRoomInput,
  type MetaHealthAvailability,
  type MetaMonitoringMode,
} from "@/lib/meta/insights-control-room";
import type { MetaMonitoringKpi } from "@/lib/meta/campaign-target";
import type { HealthStatus } from "@/lib/control-room";

export type MetaCampaignMonitoringRow = {
  id: string;
  clientId: string;
  clientName: string;
  metaCampaignId: string;
  name: string;
  effectiveStatus: string | null;
  rawObjective: string | null;
  lastSyncedAt: string | null;
  insightsPeriodSince: string | null;
  insightsPeriodUntil: string | null;
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  primaryKpi: MetaMonitoringKpi | null;
  targetValue: number | null;
  mode: MetaMonitoringMode;
  healthAvailability: MetaHealthAvailability;
  healthStatus: HealthStatus | null;
};

export type MetaCampaignApiRow = {
  id: string;
  client_id: string;
  meta_campaign_id: string;
  name: string;
  effective_status: string | null;
  raw_objective: string | null;
  last_synced_at: string | null;
  insights_period_since: string | null;
  insights_period_until: string | null;
  insights_period_frequency: number | null;
  primary_kpi: string | null;
  target_value: number | string | null;
};

export type MetaCampaignInsightAgg = {
  spend: number;
  impressions: number;
  linkClicks: number;
};

function parseTargetValue(raw: number | string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildAggregate(
  agg: MetaCampaignInsightAgg | null,
  frequency: number | null,
): AggregatedMetaInsights {
  const spend = agg?.spend ?? null;
  const impressions = agg?.impressions ?? null;
  const linkClicks = agg?.linkClicks ?? null;
  const ctr =
    linkClicks != null && impressions != null && impressions > 0
      ? Math.round((linkClicks / impressions) * 10000) / 100
      : null;
  const cpc =
    spend != null && linkClicks != null && linkClicks > 0
      ? Math.round((spend / linkClicks) * 100) / 100
      : null;
  const cpm =
    spend != null && impressions != null && impressions > 0
      ? Math.round((spend / impressions) * 1000 * 100) / 100
      : null;

  return {
    spend,
    impressions,
    clicks: linkClicks,
    linkClicks,
    periodReach: null,
    periodFrequency: frequency,
    ctr,
    cpc,
    cpm,
    primaryResultType: null,
    primaryResults: null,
    primaryResultValue: null,
    resultMappingConfidence: "UNKNOWN",
    cpl: null,
    roas: null,
    dayCount: 0,
  };
}

export function mapMetaCampaignToMonitoringRow(
  c: MetaCampaignApiRow,
  agg: MetaCampaignInsightAgg | null,
  clientName: string,
): MetaCampaignMonitoringRow {
  const frequency = c.insights_period_frequency ?? null;
  const aggregate = buildAggregate(agg, frequency);
  const primaryKpi = (c.primary_kpi as MetaMonitoringKpi | null) ?? null;
  const targetValue = parseTargetValue(c.target_value);
  const since = c.insights_period_since ?? "";
  const until = c.insights_period_until ?? "";

  const controlRoom = metaInsightsToControlRoomInput({
    aggregate,
    since,
    until,
    target:
      primaryKpi && primaryKpi !== "NONE" && targetValue != null
        ? { primaryKpi, targetValue }
        : primaryKpi === "NONE"
          ? { primaryKpi: "NONE", targetValue: null }
          : null,
    effectiveStatus: c.effective_status,
  });

  return {
    id: c.id,
    clientId: c.client_id,
    clientName,
    metaCampaignId: c.meta_campaign_id,
    name: c.name,
    effectiveStatus: c.effective_status,
    rawObjective: c.raw_objective,
    lastSyncedAt: c.last_synced_at,
    insightsPeriodSince: c.insights_period_since,
    insightsPeriodUntil: c.insights_period_until,
    spend: controlRoom.metrics.spend,
    impressions: controlRoom.metrics.impressions,
    linkClicks: controlRoom.metrics.linkClicks,
    ctr: controlRoom.metrics.ctr,
    cpc: controlRoom.metrics.cpc,
    cpm: controlRoom.metrics.cpm,
    frequency: controlRoom.metrics.frequency,
    primaryKpi: controlRoom.target.primaryKpi,
    targetValue: controlRoom.target.targetValue,
    mode: controlRoom.mode,
    healthAvailability: controlRoom.healthAvailability,
    healthStatus: controlRoom.health?.status ?? null,
  };
}

/** Canonical post-mutation refresh: reload authoritative data, then refresh RSC tree. */
export async function refreshAfterMetaTargetMutation(
  reload: () => Promise<void>,
  refreshRoute: () => void,
): Promise<void> {
  await reload();
  refreshRoute();
}
