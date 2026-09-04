/**
 * M7B.2 — Server-side Meta + Native evaluation runners.
 * Meta: after M7A cron. Native: on authenticated evaluate API (no Native scheduler).
 */

import "server-only";

import type { Campagna, CampagnaObjective, CampagnaStatus } from "@/types/campagne";
import type {
  CampaignCheck,
  CampaignCheckRow,
} from "@/lib/campaign-checks-db";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { loadMetaMondayBundleAdmin } from "@/lib/campaign-notifications/meta-loader-admin";
import {
  applyLinkedCampaignSuppression,
  buildMetaAttentionItem,
  buildNativeAttentionItem,
  collectActiveLinkedNativeIds,
} from "@/lib/monday-control-room";
import { snapshotFromAttentionItem } from "@/lib/campaign-notifications/snapshot";
import { evaluateAndPersistCampaignNotification } from "@/lib/campaign-notifications/evaluate-persist";
import { createAdminNotificationStore } from "@/lib/campaign-notifications/store-admin";

function mapCheckRow(row: CampaignCheckRow): CampaignCheck | null {
  const health = row.health_status;
  if (
    health !== "GREEN" &&
    health !== "YELLOW" &&
    health !== "RED" &&
    health !== "INSUFFICIENT"
  ) {
    return null;
  }
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    createdAt: row.created_at,
    daysActive: row.days_active == null ? null : Number(row.days_active),
    spend: row.spend == null ? null : Number(row.spend),
    resultsCount:
      row.results_count == null ? null : Number(row.results_count),
    primaryCost:
      row.primary_cost == null ? null : Number(row.primary_cost),
    ctr: row.ctr == null ? null : Number(row.ctr),
    cpm: row.cpm == null ? null : Number(row.cpm),
    cpc: row.cpc == null ? null : Number(row.cpc),
    frequency: row.frequency == null ? null : Number(row.frequency),
    roas: row.roas == null ? null : Number(row.roas),
    clicks: row.clicks == null ? null : Number(row.clicks),
    impressions:
      row.impressions == null ? null : Number(row.impressions),
    healthStatus: health,
    signal: row.signal,
    actions: Array.isArray(row.actions)
      ? (row.actions as CampaignCheck["actions"])
      : [],
    note: row.note,
    objective: row.objective,
    threshold: row.threshold == null ? null : Number(row.threshold),
    thresholdMode:
      row.threshold_mode === "BREAK_EVEN" ||
      row.threshold_mode === "EFFICIENCY" ||
      row.threshold_mode === "OTHER"
        ? row.threshold_mode
        : null,
    source:
      row.source === "MANUAL" ||
      row.source === "SCREENSHOT" ||
      row.source === "CSV"
        ? row.source
        : "MANUAL",
  };
}

export type EvaluateUserSummary = {
  userId: string;
  campaignsEvaluated: number;
  notificationsCreated: number;
  errors: number;
};

export async function evaluateMetaNotificationsForUser(
  userId: string,
  options?: { nowMs?: number },
): Promise<EvaluateUserSummary> {
  const store = createAdminNotificationStore();
  const bundle = await loadMetaMondayBundleAdmin(userId);

  let notificationsCreated = 0;
  let errors = 0;
  let campaignsEvaluated = 0;

  for (const row of bundle.rows) {
    campaignsEvaluated += 1;
    try {
      const t = bundle.trends.get(row.id);
      const item = buildMetaAttentionItem({
        row,
        trendDirection: t?.direction ?? null,
        trendLevel: t?.level,
      });
      const current = snapshotFromAttentionItem(userId, item, {
        clientIdOverride: row.clientId,
        nowMs: options?.nowMs,
      });
      const result = await evaluateAndPersistCampaignNotification({
        store,
        current,
        clientName: item.clientName,
        campaignName: item.campaignName,
      });
      if (result.persisted) notificationsCreated += 1;
    } catch {
      errors += 1;
      console.error("[NOTIF_EVAL] META_ERROR");
    }
  }

  return { userId, campaignsEvaluated, notificationsCreated, errors };
}

export async function evaluateNativeNotificationsForUser(
  userId: string,
  options?: { nowMs?: number },
): Promise<EvaluateUserSummary> {
  const admin = createSupabaseAdmin();
  const store = createAdminNotificationStore();

  const { data: campRows, error: campErr } = await admin
    .from("campaigns")
    .select("id, client_id, name, objective, status, clients(id, name)")
    .eq("user_id", userId);
  if (campErr) throw campErr;

  const { data: checkRows, error: checkErr } = await admin
    .from("campaign_checks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (checkErr) throw checkErr;

  const latest = new Map<string, CampaignCheck>();
  const byCampaign = new Map<string, CampaignCheck[]>();
  for (const raw of (checkRows ?? []) as CampaignCheckRow[]) {
    const mapped = mapCheckRow(raw);
    if (!mapped) continue;
    if (!latest.has(mapped.campaignId)) {
      latest.set(mapped.campaignId, mapped);
    }
    const list = byCampaign.get(mapped.campaignId) ?? [];
    list.push(mapped);
    byCampaign.set(mapped.campaignId, list);
  }

  const metaBundle = await loadMetaMondayBundleAdmin(userId);
  const linkedNativeIds = collectActiveLinkedNativeIds(metaBundle.rows);

  let notificationsCreated = 0;
  let errors = 0;
  let campaignsEvaluated = 0;

  type CampRow = {
    id: string;
    client_id: string | null;
    name: string;
    objective: string | null;
    status: string | null;
    clients:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
  };

  for (const row of (campRows ?? []) as CampRow[]) {
    campaignsEvaluated += 1;
    try {
      const clientJoin = Array.isArray(row.clients)
        ? row.clients[0]
        : row.clients;
      const campagna: Campagna = {
        id: row.id,
        nomeCliente: clientJoin?.name ?? "Cliente",
        iniziali: "??",
        stato: row.status ?? "DRAFT",
        giudizio: "Ancora presto",
        objective: (row.objective as CampagnaObjective | null) ?? undefined,
        nomeCampagna: row.name,
        status: (row.status as CampagnaStatus | null) ?? undefined,
      };

      const item = buildNativeAttentionItem({
        campagna,
        check: latest.get(row.id) ?? null,
        checksForTrend: byCampaign.get(row.id) ?? [],
      });
      const [suppressed] = applyLinkedCampaignSuppression(
        [item],
        linkedNativeIds,
      );
      const current = snapshotFromAttentionItem(userId, suppressed, {
        clientIdOverride: row.client_id,
        nowMs: options?.nowMs,
      });
      const result = await evaluateAndPersistCampaignNotification({
        store,
        current,
        clientName: suppressed.clientName,
        campaignName: suppressed.campaignName,
      });
      if (result.persisted) notificationsCreated += 1;
    } catch {
      errors += 1;
      console.error("[NOTIF_EVAL] NATIVE_ERROR");
    }
  }

  return { userId, campaignsEvaluated, notificationsCreated, errors };
}

export async function evaluateAllMetaNotificationsAfterCron(options?: {
  nowMs?: number;
}): Promise<{
  usersEvaluated: number;
  notificationsCreated: number;
  errors: number;
}> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("meta_campaigns")
    .select("user_id")
    .limit(5000);
  if (error) throw error;

  const userIds = [
    ...new Set(
      ((data ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ),
  ];

  let notificationsCreated = 0;
  let errors = 0;

  for (const userId of userIds) {
    try {
      const summary = await evaluateMetaNotificationsForUser(userId, options);
      notificationsCreated += summary.notificationsCreated;
      errors += summary.errors;
    } catch {
      errors += 1;
      console.error("[NOTIF_EVAL] USER_META_FAILED");
    }
  }

  return {
    usersEvaluated: userIds.length,
    notificationsCreated,
    errors,
  };
}
