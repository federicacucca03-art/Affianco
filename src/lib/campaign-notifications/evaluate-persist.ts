/**
 * M7B.2 — Evaluate transition + persist notification/snapshot.
 * Order: load previous → evaluate → insert if needed → upsert snapshot.
 * First observation: baseline only, no notify.
 */

import { resolveNotificationDecision } from "@/lib/campaign-notifications/resolve";
import {
  identityIds,
  monitoringRowFromSnapshot,
  snapshotFromMonitoringRow,
  type MonitoringStateRow,
} from "@/lib/campaign-notifications/snapshot";
import type {
  NotificationCampaignSnapshot,
  NotificationDecision,
  NotificationSeverity,
  NotificationType,
} from "@/lib/campaign-notifications/types";

export type NotificationInsertRow = {
  user_id: string;
  client_id: string | null;
  source: "NATIVE" | "META";
  campaign_id: string | null;
  meta_campaign_id: string | null;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  reason_code: string;
  title: string;
  message: string;
  dedupe_key: string;
  recommended_href: string | null;
  cta_label: string | null;
  client_name: string | null;
  campaign_name: string | null;
};

export type NotificationPersistenceStore = {
  loadMonitoringState(input: {
    userId: string;
    source: "NATIVE" | "META";
    campaignId: string | null;
    metaCampaignId: string | null;
  }): Promise<MonitoringStateRow | null>;
  upsertMonitoringState(row: MonitoringStateRow): Promise<void>;
  insertNotification(
    row: NotificationInsertRow,
  ): Promise<"inserted" | "duplicate">;
};

export type EvaluatePersistResult = {
  decision: NotificationDecision;
  persisted: boolean;
  firstObservation: boolean;
  duplicateSuppressed: boolean;
};

export async function evaluateAndPersistCampaignNotification(input: {
  store: NotificationPersistenceStore;
  current: NotificationCampaignSnapshot;
  clientName?: string | null;
  campaignName?: string | null;
}): Promise<EvaluatePersistResult> {
  const { store, current } = input;
  const ids = identityIds(current);

  const previousRow = await store.loadMonitoringState({
    userId: current.userId,
    source: current.source,
    campaignId: ids.campaignId,
    metaCampaignId: ids.metaCampaignId,
  });

  const previous = previousRow
    ? snapshotFromMonitoringRow(previousRow)
    : null;

  // First observation: store baseline, never notify (M7B.1 + M7B.2).
  if (!previous) {
    await store.upsertMonitoringState(monitoringRowFromSnapshot(current));
    const decision = resolveNotificationDecision({
      previous: null,
      current,
    });
    return {
      decision,
      persisted: false,
      firstObservation: true,
      duplicateSuppressed: false,
    };
  }

  const decision = resolveNotificationDecision({ previous, current });

  let persisted = false;
  let duplicateSuppressed = false;

  if (
    decision.shouldNotify &&
    decision.notificationType &&
    decision.severity &&
    decision.title &&
    decision.message &&
    decision.dedupeKey
  ) {
    // Failure-safe: unexpected insert errors must NOT advance the snapshot,
    // or the transition would be permanently lost. Duplicate conflicts may advance.
    let insertResult: "inserted" | "duplicate";
    try {
      insertResult = await store.insertNotification({
        user_id: current.userId,
        client_id: current.clientId,
        source: current.source,
        campaign_id: ids.campaignId,
        meta_campaign_id: ids.metaCampaignId,
        notification_type: decision.notificationType,
        severity: decision.severity,
        reason_code: decision.reasonCode,
        title: decision.title,
        message: decision.message,
        dedupe_key: decision.dedupeKey,
        recommended_href: decision.recommendedHref,
        cta_label: decision.ctaLabel,
        client_name: input.clientName ?? null,
        campaign_name: input.campaignName ?? null,
      });
    } catch (err) {
      throw err;
    }
    persisted = insertResult === "inserted";
    duplicateSuppressed = insertResult === "duplicate";
  }

  await store.upsertMonitoringState(monitoringRowFromSnapshot(current));

  return {
    decision,
    persisted,
    firstObservation: false,
    duplicateSuppressed,
  };
}

/** In-memory store for unit tests (no DB). */
export function createMemoryNotificationStore(): NotificationPersistenceStore & {
  notifications: NotificationInsertRow[];
  states: MonitoringStateRow[];
} {
  const states: MonitoringStateRow[] = [];
  const notifications: NotificationInsertRow[] = [];

  return {
    notifications,
    states,
    async loadMonitoringState(input) {
      return (
        states.find((s) => {
          if (s.user_id !== input.userId || s.source !== input.source) {
            return false;
          }
          if (input.source === "NATIVE") {
            return s.campaign_id === input.campaignId;
          }
          return s.meta_campaign_id === input.metaCampaignId;
        }) ?? null
      );
    },
    async upsertMonitoringState(row) {
      const idx = states.findIndex((s) => {
        if (s.user_id !== row.user_id || s.source !== row.source) return false;
        if (row.source === "NATIVE") return s.campaign_id === row.campaign_id;
        return s.meta_campaign_id === row.meta_campaign_id;
      });
      if (idx >= 0) states[idx] = { ...row };
      else states.push({ ...row });
    },
    async insertNotification(row) {
      if (
        notifications.some(
          (n) =>
            n.user_id === row.user_id && n.dedupe_key === row.dedupe_key,
        )
      ) {
        return "duplicate";
      }
      notifications.push({ ...row });
      return "inserted";
    },
  };
}
