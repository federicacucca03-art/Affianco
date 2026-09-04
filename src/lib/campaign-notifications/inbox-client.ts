/**
 * M7B.2 — Browser inbox helpers (RLS-backed). No creation.
 */

import { supabase } from "@/lib/supabase";
import type {
  NotificationSeverity,
  NotificationType,
} from "@/lib/campaign-notifications/types";

export type InboxNotification = {
  id: string;
  clientId: string | null;
  source: "NATIVE" | "META";
  campaignId: string | null;
  metaCampaignId: string | null;
  notificationType: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  recommendedHref: string | null;
  ctaLabel: string | null;
  clientName: string | null;
  campaignName: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
};

type NotificationRow = {
  id: string;
  client_id: string | null;
  source: string;
  campaign_id: string | null;
  meta_campaign_id: string | null;
  notification_type: string;
  severity: string;
  title: string;
  message: string;
  recommended_href: string | null;
  cta_label: string | null;
  client_name: string | null;
  campaign_name: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};

function mapRow(row: NotificationRow): InboxNotification {
  return {
    id: row.id,
    clientId: row.client_id,
    source: row.source === "META" ? "META" : "NATIVE",
    campaignId: row.campaign_id,
    metaCampaignId: row.meta_campaign_id,
    notificationType: row.notification_type as NotificationType,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    message: row.message,
    recommendedHref: row.recommended_href,
    ctaLabel: row.cta_label,
    clientName: row.client_name,
    campaignName: row.campaign_name,
    isRead: row.is_read,
    isDismissed: row.is_dismissed,
    createdAt: row.created_at,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
  };
}

const INBOX_SELECT =
  "id, client_id, source, campaign_id, meta_campaign_id, notification_type, severity, title, message, recommended_href, cta_label, client_name, campaign_name, is_read, is_dismissed, created_at, read_at, dismissed_at";

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .eq("is_dismissed", false);
  if (error) throw error;
  return count ?? 0;
}

/** Latest active (non-dismissed) notifications — unread first. */
export async function fetchInboxNotifications(
  limit = 50,
): Promise<InboxNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(INBOX_SELECT)
    .eq("is_dismissed", false)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_dismissed", false);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false)
    .eq("is_dismissed", false);
  if (error) throw error;
}

export async function dismissNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_dismissed: true,
      dismissed_at: new Date().toISOString(),
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export function formatRelativeCreatedAt(
  iso: string,
  nowMs: number = Date.now(),
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, nowMs - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Adesso";
  if (mins === 1) return "1 min fa";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 ora fa";
  if (hours < 24) return `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ieri";
  return `${days} giorni fa`;
}

export function etichettaSeverityUi(severity: NotificationSeverity): string {
  switch (severity) {
    case "HIGH":
      return "Priorità alta";
    case "MEDIUM":
      return "Da vedere";
    case "LOW":
      return "Info";
  }
}
