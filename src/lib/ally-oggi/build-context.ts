/**
 * M9.1 — build compact Ally oggi context from Control Room items.
 * Pure. No AI. No secrets.
 */

import { isSmallSample, resolveNextAction } from "@/lib/campaign-next-action";
import {
  buildMondayControlRoom,
  type ControlRoomAttentionItem,
} from "@/lib/monday-control-room";
import {
  ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT,
  type AllyOggiBriefContext,
  type AllyOggiCampaignFact,
} from "@/lib/ally-oggi/types";

const STALE_META_MS = 48 * 60 * 60 * 1000;

export function isStaleMetaInsights(
  item: ControlRoomAttentionItem,
  nowMs = Date.now(),
): boolean {
  if (item.source !== "META" || !item.insightsLastSyncedAt) return false;
  const t = Date.parse(item.insightsLastSyncedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t > STALE_META_MS;
}

function toFact(
  item: ControlRoomAttentionItem,
  nowMs: number,
): AllyOggiCampaignFact {
  const next = resolveNextAction({
    campaignId: item.campaignId,
    source: item.source,
    campaignStatus: item.campaignStatus,
    attentionState: item.attentionState,
    health: item.healthStatus,
    trend: item.trend,
    healthAvailability: item.healthAvailability,
    configurationKind: item.configurationKind,
    resultsCount: item.resultsCount,
    rowHref: item.href,
    diagnosis: null,
  });

  return {
    campaignId: item.campaignId,
    source: item.source,
    clientName: item.clientName,
    campaignName: item.campaignName,
    attentionState: item.attentionState,
    urgencyLevel: item.urgencyLevel,
    healthStatus: item.healthStatus,
    trend: item.trend,
    configurationKind: item.configurationKind,
    resultsCount: item.resultsCount,
    primaryMetric: item.primaryMetric,
    primaryMetricValue: item.primaryMetricValue,
    targetValue: item.targetValue,
    nextActionType: next.actionType,
    nextActionTitle: next.title,
    smallSample: isSmallSample(item.resultsCount),
    staleMeta: isStaleMetaInsights(item, nowMs),
    href: item.href,
  };
}

/**
 * Build AI-safe brief context from attention items (already ownership-scoped).
 *
 * Truncation rule: sort via canonical `buildMondayControlRoom` /
 * `sortAttentionItems` (urgency → attention → freshness → name) FIRST,
 * then take the top N. Never truncate by load/query order.
 */
export function buildAllyOggiBriefContext(
  items: readonly ControlRoomAttentionItem[],
  nowMs = Date.now(),
): AllyOggiBriefContext {
  const monday = buildMondayControlRoom([...items]);
  const visible = monday.items;
  const staleMetaCount = visible.filter((i) =>
    isStaleMetaInsights(i, nowMs),
  ).length;

  const campaigns = visible
    .slice(0, ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT)
    .map((i) => toFact(i, nowMs));

  return {
    totalMonitored: visible.length,
    counts: {
      critical: monday.counts.CRITICAL,
      needsAttention: monday.counts.NEEDS_ATTENTION,
      monitor: monday.counts.MONITOR,
      stable: monday.counts.STABLE,
      configurationRequired: monday.counts.CONFIGURATION_REQUIRED,
      insufficientData: monday.counts.INSUFFICIENT_DATA,
      historical: monday.counts.HISTORICAL,
    },
    staleMetaCount,
    campaigns,
  };
}

/** Rough JSON size estimate for cost reporting / tests. */
export function estimateAllyOggiPromptChars(
  context: AllyOggiBriefContext,
): number {
  return JSON.stringify(context).length;
}
