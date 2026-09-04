/**
 * M7B.2 — Map Control Room items ↔ monitoring snapshots.
 * No AI. No Meta payloads.
 */

import { resolveMetaDataFreshness } from "@/lib/meta/freshness";
import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";
import type { NotificationCampaignSnapshot } from "@/lib/campaign-notifications/types";

export type MonitoringStateRow = {
  user_id: string;
  client_id: string | null;
  source: "NATIVE" | "META";
  campaign_id: string | null;
  meta_campaign_id: string | null;
  attention_state: string;
  urgency_level: string;
  health: string | null;
  trend: string | null;
  freshness: string | null;
  campaign_status: string | null;
  health_availability: string | null;
  configuration_kind: string | null;
  results_count: number | null;
  suppressed_by_link: boolean;
  href: string | null;
};

export function identityIds(snapshot: NotificationCampaignSnapshot): {
  campaignId: string | null;
  metaCampaignId: string | null;
} {
  if (snapshot.source === "META") {
    return { campaignId: null, metaCampaignId: snapshot.campaignId };
  }
  return { campaignId: snapshot.campaignId, metaCampaignId: null };
}

export function snapshotFromAttentionItem(
  userId: string,
  item: ControlRoomAttentionItem,
  options?: { clientIdOverride?: string | null; nowMs?: number },
): NotificationCampaignSnapshot {
  const freshness =
    item.source === "META"
      ? resolveMetaDataFreshness(
          item.insightsLastSyncedAt,
          options?.nowMs ?? Date.now(),
        )
      : null;

  return {
    userId,
    clientId: options?.clientIdOverride ?? item.clientId,
    campaignId: item.campaignId,
    source: item.source,
    campaignStatus: item.campaignStatus,
    attentionState: item.attentionState,
    urgencyLevel: item.urgencyLevel,
    health: item.healthStatus,
    trend: item.trend,
    healthAvailability: item.healthAvailability,
    configurationKind: item.configurationKind,
    freshness,
    resultsCount: item.resultsCount,
    suppressedByLink: item.suppressedByLink,
    href: item.href,
    nextActionType: null,
  };
}

export function monitoringRowFromSnapshot(
  snapshot: NotificationCampaignSnapshot,
): MonitoringStateRow {
  const ids = identityIds(snapshot);
  return {
    user_id: snapshot.userId,
    client_id: snapshot.clientId,
    source: snapshot.source,
    campaign_id: ids.campaignId,
    meta_campaign_id: ids.metaCampaignId,
    attention_state: snapshot.attentionState,
    urgency_level: snapshot.urgencyLevel,
    health: snapshot.health,
    trend: snapshot.trend,
    freshness: snapshot.freshness,
    campaign_status: snapshot.campaignStatus,
    health_availability: snapshot.healthAvailability,
    configuration_kind: snapshot.configurationKind,
    results_count: snapshot.resultsCount,
    suppressed_by_link: snapshot.suppressedByLink,
    href: snapshot.href,
  };
}

export function snapshotFromMonitoringRow(
  row: MonitoringStateRow,
): NotificationCampaignSnapshot {
  const campaignId =
    row.source === "META"
      ? (row.meta_campaign_id as string)
      : (row.campaign_id as string);

  return {
    userId: row.user_id,
    clientId: row.client_id,
    campaignId,
    source: row.source,
    campaignStatus: row.campaign_status,
    attentionState: row.attention_state as NotificationCampaignSnapshot["attentionState"],
    urgencyLevel: row.urgency_level as NotificationCampaignSnapshot["urgencyLevel"],
    health: row.health as NotificationCampaignSnapshot["health"],
    trend: (row.trend ?? "UNKNOWN") as NotificationCampaignSnapshot["trend"],
    healthAvailability: row.health_availability,
    configurationKind:
      row.configuration_kind as NotificationCampaignSnapshot["configurationKind"],
    freshness: row.freshness as NotificationCampaignSnapshot["freshness"],
    resultsCount:
      row.results_count == null ? null : Number(row.results_count),
    suppressedByLink: row.suppressed_by_link,
    href: row.href ?? "",
    nextActionType: null,
  };
}
