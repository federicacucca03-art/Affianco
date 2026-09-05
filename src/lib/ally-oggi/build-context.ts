/**
 * M9.1B — build compact Ally oggi context.
 * Workspace aggregates + bounded Control Room performance facts.
 * Pure. No AI. No secrets.
 */

import { isSmallSample, resolveNextAction } from "@/lib/campaign-next-action";
import {
  buildMondayControlRoom,
  type ControlRoomAttentionItem,
} from "@/lib/monday-control-room";
import type { Campagna } from "@/types/campagne";
import {
  ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT,
  emptyAllyOggiWorkspaceSummary,
  type AllyOggiBriefContext,
  type AllyOggiCampaignFact,
} from "@/lib/ally-oggi/types";
import {
  buildAllyOggiWorkspaceSummary,
  isPerformanceEligibleAttentionItem,
} from "@/lib/ally-oggi/workspace-summary";

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

export type BuildAllyOggiBriefContextInput = {
  attentionItems: readonly ControlRoomAttentionItem[];
  nativeCampaigns: readonly Pick<Campagna, "id" | "status">[];
  metaItems: readonly ControlRoomAttentionItem[];
  linkedNativeIds: ReadonlySet<string>;
  nowMs?: number;
};

function isBriefContextInput(
  input: BuildAllyOggiBriefContextInput | readonly ControlRoomAttentionItem[],
): input is BuildAllyOggiBriefContextInput {
  return (
    Boolean(input) &&
    !Array.isArray(input) &&
    typeof input === "object" &&
    "attentionItems" in input
  );
}

/**
 * Truncation: Control Room sort first, then take top N *performance-eligible* facts.
 * Workspace aggregates always cover the full inventory (after link dedupe).
 */
export function buildAllyOggiBriefContext(
  input: BuildAllyOggiBriefContextInput | readonly ControlRoomAttentionItem[],
  nowMsArg?: number,
): AllyOggiBriefContext {
  // Back-compat: tests that pass only attention items get derived workspace.
  if (!isBriefContextInput(input)) {
    const items = input;
    const nowMs = nowMsArg ?? Date.now();
    const monday = buildMondayControlRoom([...items]);
    const workspace = emptyAllyOggiWorkspaceSummary();
    workspace.totalWorkspaceCampaigns = monday.items.length;
    workspace.configurationRequiredCampaigns =
      monday.counts.CONFIGURATION_REQUIRED;
    workspace.insufficientDataCampaigns = monday.counts.INSUFFICIENT_DATA;
    workspace.historicalCampaigns = monday.counts.HISTORICAL;
    workspace.monitorableCampaigns = monday.items.filter((item) => {
      if (!isPerformanceEligibleAttentionItem(item)) return false;
      if (item.attentionState === "HISTORICAL") return false;
      if (item.attentionState === "CONFIGURATION_REQUIRED") return false;
      return true;
    }).length;
    workspace.nativeCampaigns = monday.items.filter(
      (i) => i.source === "NATIVE",
    ).length;
    workspace.metaCampaigns = monday.items.filter(
      (i) => i.source === "META",
    ).length;

    const staleMetaCount = monday.items.filter((i) =>
      isStaleMetaInsights(i, nowMs),
    ).length;
    const campaigns = monday.items
      .filter(isPerformanceEligibleAttentionItem)
      .slice(0, ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT)
      .map((i) => toFact(i, nowMs));

    return {
      workspace,
      totalMonitored: monday.items.length,
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

  const nowMs = input.nowMs ?? Date.now();
  const monday = buildMondayControlRoom([...input.attentionItems]);
  const workspace = buildAllyOggiWorkspaceSummary({
    nativeCampaigns: input.nativeCampaigns,
    metaItems: input.metaItems,
    linkedNativeIds: input.linkedNativeIds,
    attentionItems: input.attentionItems,
  });

  const staleMetaCount = monday.items.filter((i) =>
    isStaleMetaInsights(i, nowMs),
  ).length;

  const campaigns = monday.items
    .filter(isPerformanceEligibleAttentionItem)
    .slice(0, ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT)
    .map((i) => toFact(i, nowMs));

  return {
    workspace,
    totalMonitored: monday.items.length,
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
