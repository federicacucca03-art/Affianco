/**
 * M7B.2 — Supabase admin persistence store (server-only).
 */

import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  NotificationInsertRow,
  NotificationPersistenceStore,
} from "@/lib/campaign-notifications/evaluate-persist";
import type { MonitoringStateRow } from "@/lib/campaign-notifications/snapshot";

async function loadMonitoringState(input: {
  userId: string;
  source: "NATIVE" | "META";
  campaignId: string | null;
  metaCampaignId: string | null;
}): Promise<MonitoringStateRow | null> {
  let q = createSupabaseAdmin()
    .from("notification_monitoring_state")
    .select(
      "user_id, client_id, source, campaign_id, meta_campaign_id, attention_state, urgency_level, health, trend, freshness, campaign_status, health_availability, configuration_kind, results_count, suppressed_by_link, href",
    )
    .eq("user_id", input.userId)
    .eq("source", input.source);

  if (input.source === "NATIVE") {
    q = q.eq("campaign_id", input.campaignId!);
  } else {
    q = q.eq("meta_campaign_id", input.metaCampaignId!);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as MonitoringStateRow;
}

export function createAdminNotificationStore(): NotificationPersistenceStore {
  return {
    loadMonitoringState,

    async upsertMonitoringState(row: MonitoringStateRow) {
      const existing = await loadMonitoringState({
        userId: row.user_id,
        source: row.source,
        campaignId: row.campaign_id,
        metaCampaignId: row.meta_campaign_id,
      });

      if (existing) {
        let q = createSupabaseAdmin()
          .from("notification_monitoring_state")
          .update({
            client_id: row.client_id,
            attention_state: row.attention_state,
            urgency_level: row.urgency_level,
            health: row.health,
            trend: row.trend,
            freshness: row.freshness,
            campaign_status: row.campaign_status,
            health_availability: row.health_availability,
            configuration_kind: row.configuration_kind,
            results_count: row.results_count,
            suppressed_by_link: row.suppressed_by_link,
            href: row.href,
          })
          .eq("user_id", row.user_id)
          .eq("source", row.source);
        if (row.source === "NATIVE") {
          q = q.eq("campaign_id", row.campaign_id!);
        } else {
          q = q.eq("meta_campaign_id", row.meta_campaign_id!);
        }
        const { error } = await q;
        if (error) throw error;
        return;
      }

      const { error } = await createSupabaseAdmin()
        .from("notification_monitoring_state")
        .insert(row);
      if (error) throw error;
    },

    async insertNotification(row: NotificationInsertRow) {
      const { error } = await createSupabaseAdmin()
        .from("notifications")
        .insert(row);
      if (!error) return "inserted";
      const msg = (error.message ?? "").toLowerCase();
      const code = (error as { code?: string }).code ?? "";
      if (
        code === "23505" ||
        msg.includes("duplicate") ||
        msg.includes("unique")
      ) {
        return "duplicate";
      }
      throw error;
    },
  };
}
