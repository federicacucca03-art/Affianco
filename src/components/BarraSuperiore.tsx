"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchUnreadNotificationCount } from "@/lib/campaign-notifications/inbox-client";
import { supabase } from "@/lib/supabase";

const STROKE = 1.75;

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

function nomeDaEmail(email: string | null): string | null {
  if (!email) return null;
  const locale = (email.split("@")[0] ?? "").trim();
  if (!locale) return null;
  const part = locale.split(/[._-]/)[0] ?? locale;
  if (!part) return null;
  return part.charAt(0).toUpperCase() + part.slice(1);
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

function pageCopy(
  pathname: string,
  firstName: string | null,
): { title: string; subtitle: string } {
  if (pathname === "/home" || pathname === "/") {
    return {
      title: firstName ? `Buongiorno, ${firstName}` : "Buongiorno",
      subtitle: "Vediamo cosa richiede attenzione oggi.",
    };
  }
  if (pathname.startsWith("/risultati")) {
    return {
      title: "Risultati",
      subtitle: "Monitora le campagne e individua cosa controllare.",
    };
  }
  if (pathname.startsWith("/notifiche")) {
    return {
      title: "Notifiche",
      subtitle: "Solo i cambiamenti che meritano attenzione.",
    };
  }
  if (pathname.startsWith("/campagne")) {
    return {
      title: "Campagne",
      subtitle: "Crea, organizza e apri le campagne dei tuoi clienti.",
    };
  }
  if (pathname.startsWith("/clienti")) {
    return {
      title: "Clienti",
      subtitle: "Gestisci i clienti e le loro campagne.",
    };
  }
  if (pathname.startsWith("/impostazioni")) {
    return {
      title: "Impostazioni",
      subtitle: "Connessioni e preferenze del workspace.",
    };
  }
  return {
    title: "Ally",
    subtitle: "Workspace operativo per campagne Meta.",
  };
}

export function BarraSuperiore({ onApriMenu }: Props) {
  const pathname = usePathname();
  const { email, user } = useAuth();
  const [unread, setUnread] = useState(0);
  const firstName = useMemo(() => nomeDaEmail(email), [email]);
  const copy = useMemo(
    () => pageCopy(pathname, firstName),
    [pathname, firstName],
  );

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
      setUnread(0);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  const badge = badgeLabel(unread);

  return (
    <header className="flex h-[74px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border-header)] bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Apri menu"
          className="rounded-[8px] p-1.5 text-[var(--ink)] hover:bg-[var(--surface-hover)] md:hidden"
          onClick={onApriMenu}
        >
          <Menu className="h-5 w-5" strokeWidth={STROKE} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold tracking-[-0.02em] text-[var(--ink)] sm:text-[22px]">
            {copy.title}
          </h1>
          <p className="mt-0.5 max-w-xl truncate text-[12.5px] leading-snug text-[var(--ink-muted)] sm:text-[13px]">
            {copy.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <Link
          href="/notifiche"
          aria-label={
            unread > 0 ? `Notifiche, ${unread} non lette` : "Notifiche"
          }
          className="aff-header-icon relative"
        >
          <Bell className="h-5 w-5" strokeWidth={STROKE} />
          {badge ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ally-violet)] px-1 text-[10px] font-semibold text-white">
              {badge}
            </span>
          ) : null}
        </Link>

        <div
          className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white py-1.5 pl-1.5 pr-2.5"
          title={email ?? undefined}
          aria-label={email ? `Account ${email}` : "Profilo utente"}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ally-violet-soft)] text-[11px] font-semibold text-[var(--ally-violet)]">
            {inizialiDaEmail(email)}
          </span>
          <div className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="max-w-[12rem] truncate text-[13px] font-semibold text-[var(--ink)]">
              {firstName ?? "Account"}
            </span>
            <span className="max-w-[12rem] truncate text-[11px] text-[var(--ink-muted)]">
              {email ?? ""}
            </span>
          </div>
          <ChevronDown
            className="hidden h-4 w-4 text-[var(--ink-muted)] md:block"
            strokeWidth={STROKE}
            aria-hidden
          />
        </div>
      </div>
    </header>
  );
}
