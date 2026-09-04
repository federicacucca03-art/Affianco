"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Menu, Plus, Search } from "lucide-react";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchUnreadNotificationCount } from "@/lib/campaign-notifications/inbox-client";
import { supabase } from "@/lib/supabase";

type Props = {
  onApriMenu: () => void;
};

function inizialiDaEmail(email: string | null): string {
  if (!email) return "?";
  const locale = email.split("@")[0] ?? "";
  const pulito = locale.replace(/[^a-zA-Z0-9]/g, "");
  if (pulito.length >= 2) return pulito.slice(0, 2).toUpperCase();
  if (pulito.length === 1) return `${pulito}X`.toUpperCase();
  return "AF";
}

function badgeLabel(count: number): string {
  if (count <= 0) return "";
  if (count > 9) return "9+";
  return String(count);
}

async function triggerNativeEvaluateQuiet(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  try {
    await fetch("/api/notifications/evaluate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scope: "native" }),
    });
  } catch {
    // ignore
  }
}

export function BarraSuperiore({ onApriMenu }: Props) {
  const { apriModaleCampagna } = useOnboardingCampagna();
  const { email, user } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) {
      setUnread(0);
      return;
    }
    try {
      await triggerNativeEvaluateQuiet();
      const n = await fetchUnreadNotificationCount();
      setUnread(n);
    } catch {
      // Table may not exist until migration; keep badge quiet.
      setUnread(0);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  const badge = badgeLabel(unread);

  return (
    <header className="flex h-[4.25rem] shrink-0 items-center gap-3 px-4 sm:px-2 lg:px-3">
      <button
        type="button"
        aria-label="Apri menu"
        className="rounded-2xl p-1.5 text-[var(--ink)] hover:bg-[var(--lavender-muted)] md:hidden"
        onClick={onApriMenu}
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Cerca un cliente o una campagna</span>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          placeholder="Cerca un cliente o una campagna"
          className="w-full max-w-xl rounded-full border-0 bg-white py-2.5 pl-11 pr-4 text-sm text-[var(--ink)] shadow-[var(--shadow-card)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </label>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link
          href="/notifiche"
          aria-label={
            unread > 0
              ? `Notifiche, ${unread} non lette`
              : "Notifiche"
          }
          className="relative rounded-full bg-white p-2 text-[var(--ink-muted)] shadow-[var(--shadow-card)] hover:text-[var(--ink)]"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {badge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[10px] font-medium text-white">
              {badge}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={apriModaleCampagna}
          className="hidden items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Crea nuova campagna
        </button>

        <div
          className="flex items-center gap-1 rounded-full"
          title={email ?? undefined}
          aria-label={email ? `Account ${email}` : "Profilo utente"}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-medium text-[var(--primary)] shadow-[var(--shadow-card)]">
            {inizialiDaEmail(email)}
          </span>
          <ChevronDown
            className="hidden h-4 w-4 text-[var(--ink-muted)] sm:block"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      </div>
    </header>
  );
}
