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

function severityClass(severity: InboxNotification["severity"]): string {
  switch (severity) {
    case "HIGH":
      return "border-[var(--primary)]/35 bg-[var(--primary-soft)]/70";
    case "MEDIUM":
      return "border-black/5 bg-white";
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
    <main className="mx-auto w-full max-w-[720px] pb-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {unread > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMarkAll()}
            className="text-sm font-medium text-[var(--primary)] hover:opacity-80 disabled:opacity-50"
          >
            Segna tutte come lette
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-[#7a3d58]">{error}</p>
      ) : items.length === 0 ? (
        <section className="aff-panel-white mt-4 px-5 py-8">
          <p className="text-base font-medium text-[var(--ink)]">
            Nessuna notifica
          </p>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
            Quando una campagna richiede attenzione in modo significativo,
            la trovi qui.
          </p>
        </section>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-[12px] border px-4 py-3.5 ${severityClass(n.severity)} ${
                n.isRead ? "opacity-80" : "shadow-[var(--shadow-card)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--ink-muted)]">
                    {etichettaSeverityUi(n.severity)}
                    {!n.isRead ? " · Nuova" : ""}
                  </p>
                  <p className="mt-1 text-[15px] font-medium text-[var(--ink)]">
                    {n.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                    {n.message}
                  </p>
                  <p className="mt-2 text-xs text-[var(--ink-muted)]">
                    {[n.clientName, n.campaignName].filter(Boolean).join(" · ")}
                    {n.clientName || n.campaignName ? " · " : ""}
                    {formatRelativeCreatedAt(n.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDismiss(n.id)}
                  className="shrink-0 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50"
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
                    className="inline-flex rounded-[10px] bg-[var(--ink)] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    {n.ctaLabel}
                  </Link>
                ) : null}
                {!n.isRead ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onMarkRead(n.id)}
                    className="text-xs font-medium text-[var(--primary)] hover:opacity-80 disabled:opacity-50"
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
