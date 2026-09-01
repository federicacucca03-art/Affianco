"use client";

import { Bell, ChevronDown, Menu, Plus, Search } from "lucide-react";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import { useAuth } from "@/components/auth/AuthProvider";

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

export function BarraSuperiore({ onApriMenu }: Props) {
  const { apriModaleCampagna } = useOnboardingCampagna();
  const { email } = useAuth();

  return (
    <header className="flex h-[4.25rem] shrink-0 items-center gap-3 px-4 sm:px-2 lg:px-3">
      <button
        type="button"
        aria-label="Apri menu"
        className="rounded-2xl p-1.5 text-white hover:bg-white/15 md:hidden"
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
          className="w-full max-w-xl rounded-full border-0 bg-[var(--workspace)] py-2.5 pl-11 pr-4 text-sm text-[var(--ink)] shadow-[var(--shadow-card)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-2 focus:ring-white/70"
        />
      </label>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Notifiche"
          className="relative rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--pink-soft)]" />
        </button>

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
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-medium text-[var(--primary)] shadow-[var(--shadow-card)]">
            {inizialiDaEmail(email)}
          </span>
          <ChevronDown
            className="hidden h-4 w-4 text-white/80 sm:block"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      </div>
    </header>
  );
}
