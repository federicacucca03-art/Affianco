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
import {
  resolveLinkedMonitoringTarget,
  type LinkedAffiancoCampaignSnapshot,
  type MetaCampaignLinkState,
  type MetaTargetSource,
} from "@/lib/meta/campaign-link-compatibility";
import type { ResultMappingConfidence } from "@/lib/meta/insight-actions";

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
  storedPrimaryKpi: MetaMonitoringKpi | null;
  storedTargetValue: number | null;
  targetSource: MetaTargetSource;
  linkState: MetaCampaignLinkState;
  linkedCampaignId: string | null;
  linkedCampaignName: string | null;
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
  affianco_campaign_id?: string | null;
};

export type MetaCampaignInsightAgg = {
  spend: number;
  impressions: number;
  linkClicks: number;
  primaryResults?: number | null;
  primaryResultType?: string | null;
  resultMappingConfidence?: ResultMappingConfidence;
};

function parseTargetValue(raw: number | string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStoredKpi(raw: string | null): MetaMonitoringKpi | null {
  if (
    raw === "CPL" ||
    raw === "CPA" ||
    raw === "CPM" ||
    raw === "CPC" ||
    raw === "ROAS" ||
    raw === "NONE"
  ) {
    return raw;
  }
  return null;
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
  const confidence = agg?.resultMappingConfidence ?? "UNKNOWN";
  const primaryResults =
    confidence === "CONFIDENT" ? (agg?.primaryResults ?? null) : null;
  const primaryResultType =
    confidence === "CONFIDENT" ? (agg?.primaryResultType ?? null) : null;
  const cpl =
    confidence === "CONFIDENT" &&
    spend != null &&
    primaryResults != null &&
    primaryResults > 0
      ? Math.round((spend / primaryResults) * 100) / 100
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
    primaryResultType,
    primaryResults,
    primaryResultValue: null,
    resultMappingConfidence: confidence,
    cpl,
    roas: null,
    dayCount: 0,
  };
}

export function mapMetaCampaignToMonitoringRow(
  c: MetaCampaignApiRow,
  agg: MetaCampaignInsightAgg | null,
  clientName: string,
  linkedCampaign?: LinkedAffiancoCampaignSnapshot | null,
): MetaCampaignMonitoringRow {
  const frequency = c.insights_period_frequency ?? null;
  const aggregate = buildAggregate(agg, frequency);
  const storedPrimaryKpi = parseStoredKpi(c.primary_kpi);
  const storedTargetValue = parseTargetValue(c.target_value);
  const since = c.insights_period_since ?? "";
  const until = c.insights_period_until ?? "";

  const resolved = resolveLinkedMonitoringTarget({
    affiancoCampaignId: c.affianco_campaign_id ?? null,
    linkedCampaign: linkedCampaign ?? null,
    metaRawObjective: c.raw_objective,
    storedPrimaryKpi,
    storedTargetValue,
    resultMappingConfidence: aggregate.resultMappingConfidence,
    primaryResultType: aggregate.primaryResultType,
  });

  const controlRoom = metaInsightsToControlRoomInput({
    aggregate,
    since,
    until,
    target:
      resolved.primaryKpi &&
      resolved.primaryKpi !== "NONE" &&
      resolved.targetValue != null
        ? { primaryKpi: resolved.primaryKpi, targetValue: resolved.targetValue }
        : resolved.primaryKpi === "NONE"
          ? { primaryKpi: "NONE", targetValue: null }
          : null,
    effectiveStatus: c.effective_status,
  });

  const incompatible = resolved.linkState === "LINKED_BUT_KPI_INCOMPATIBLE";

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
    primaryKpi: incompatible ? null : controlRoom.target.primaryKpi,
    targetValue: incompatible ? null : controlRoom.target.targetValue,
    storedPrimaryKpi: resolved.storedPrimaryKpi,
    storedTargetValue: resolved.storedTargetValue,
    targetSource: resolved.targetSource,
    linkState: resolved.linkState,
    linkedCampaignId: resolved.linkedCampaignId,
    linkedCampaignName: resolved.linkedCampaignName,
    mode: controlRoom.mode,
    healthAvailability: incompatible
      ? "LINKED_BUT_KPI_INCOMPATIBLE"
      : controlRoom.healthAvailability,
    healthStatus: incompatible ? null : (controlRoom.health?.status ?? null),
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
