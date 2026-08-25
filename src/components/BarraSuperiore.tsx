"use client";

import { Bell, ChevronDown, Menu, Plus, Search } from "lucide-react";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";

type Props = {
  onApriMenu: () => void;
};

export function BarraSuperiore({ onApriMenu }: Props) {
  const { apriModaleCampagna } = useOnboardingCampagna();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-[var(--background)] px-4 pt-2 sm:px-6 lg:px-8">
      <button
        type="button"
        aria-label="Apri menu"
        className="rounded-xl p-1.5 text-[var(--ink-muted)] hover:bg-white md:hidden"
        onClick={onApriMenu}
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Cerca un cliente o una campagna</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          placeholder="Cerca un cliente o una campagna"
          className="w-full max-w-lg rounded-full border border-[var(--border)] bg-white py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]"
        />
      </label>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Notifiche"
          className="relative rounded-full p-2 text-[var(--ink-muted)] hover:bg-white"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ef4444]" />
        </button>

        <button
          type="button"
          onClick={apriModaleCampagna}
          className="hidden items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Crea nuova campagna
        </button>

        <button
          type="button"
          className="flex items-center gap-1 rounded-full hover:opacity-90"
          aria-label="Profilo utente"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
            FC
          </span>
          <ChevronDown
            className="hidden h-4 w-4 text-[var(--ink-muted)] sm:block"
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
      </div>
    </header>
  );
}
