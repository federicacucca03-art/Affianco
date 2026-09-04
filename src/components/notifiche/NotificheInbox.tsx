"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  dismissNotification,
  etichettaSeverityUi,
  fetchInboxNotifications,
  formatRelativeCreatedAt,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
} from "@/lib/campaign-notifications/inbox-client";
import { supabase } from "@/lib/supabase";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { AllyBadge } from "@/components/shell/AllyBadge";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import { Bell } from "lucide-react";

function severityBadge(severity: InboxNotification["severity"]) {
  switch (severity) {
    case "HIGH":
      return "danger" as const;
    case "MEDIUM":
      return "warning" as const;
    case "LOW":
      return "neutral" as const;
  }
}

function severitySurface(severity: InboxNotification["severity"]): string {
  switch (severity) {
    case "HIGH":
      return "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)]/80";
    case "MEDIUM":
      return "border-[var(--border-soft)] bg-[var(--ally-surface)]";
    case "LOW":
      return "border-transparent bg-[var(--lavender-muted)]/40";
  }
}

async function triggerNativeEvaluate(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/notifications/evaluate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scope: "native" }),
  });
}

export function NotificheInbox() {
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        await triggerNativeEvaluate();
      } catch {
        // Evaluation is best-effort; inbox still loads.
      }
      const list = await fetchInboxNotifications(50);
      setItems(list);
    } catch (e) {
      logErroreSupabaseDev("notifiche_inbox", e);
      setError(messaggioErroreSupabase(e, "lista"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkRead(id: string) {
    setBusy(true);
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
    } catch (e) {
      logErroreSupabaseDev("notifiche_mark_read", e);
    } finally {
      setBusy(false);
    }
  }

  async function onMarkAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? now })),
      );
    } catch (e) {
      logErroreSupabaseDev("notifiche_mark_all", e);
    } finally {
      setBusy(false);
    }
  }

  async function onDismiss(id: string) {
    setBusy(true);
    try {
      await dismissNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      logErroreSupabaseDev("notifiche_dismiss", e);
    } finally {
      setBusy(false);
    }
  }

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <main className="aff-page aff-page--narrow">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="aff-eyebrow">Inbox</p>
          <h2 className="aff-page-title mt-1.5">Notifiche</h2>
          <p className="aff-page-subtitle">Solo i cambiamenti che meritano attenzione.</p>
        </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {unread > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMarkAll()}
            className="aff-btn-secondary min-h-8 text-xs"
          >
            Segna tutte come lette
          </button>
        ) : null}
      </div>
      </div>

      {loading ? (
        <p className="mt-6 aff-muted">Caricamento…</p>
      ) : error ? (
        <p className="mt-6 text-sm aff-text-danger">{error}</p>
      ) : items.length === 0 ? (
        <AllyEmptyState
          className="mt-4"
          icon={Bell}
          title="Nessuna notifica"
          description="Quando una campagna richiede attenzione in modo significativo, la trovi qui."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-[var(--radius)] border px-4 py-3.5 ${severitySurface(n.severity)} ${
                n.isRead
                  ? "opacity-75"
                  : "border-[var(--ally-violet-border)] shadow-[var(--shadow-card)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AllyBadge variant={severityBadge(n.severity)}>
                      {etichettaSeverityUi(n.severity)}
                    </AllyBadge>
                    {!n.isRead ? (
                      <AllyBadge variant="violet">Nuova</AllyBadge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    {n.title}
                  </p>
                  <p className="mt-1 aff-muted">{n.message}</p>
                  <p className="mt-2 aff-meta">
                    {[n.clientName, n.campaignName].filter(Boolean).join(" · ")}
                    {n.clientName || n.campaignName ? " · " : ""}
                    {formatRelativeCreatedAt(n.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDismiss(n.id)}
                  className="aff-btn-tertiary shrink-0 min-h-8 text-xs text-[var(--ink-muted)]"
                  aria-label="Nascondi notifica"
                >
                  Nascondi
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {n.recommendedHref && n.ctaLabel ? (
                  <Link
                    href={n.recommendedHref}
                    onClick={() => {
                      if (!n.isRead) void onMarkRead(n.id);
                    }}
                    className="aff-btn-primary min-h-8 text-xs"
                  >
                    {n.ctaLabel}
                  </Link>
                ) : null}
                {!n.isRead ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onMarkRead(n.id)}
                    className="aff-btn-secondary min-h-8 text-xs"
                  >
                    Segna come letta
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
