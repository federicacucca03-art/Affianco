"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#funzionalita", label: "Funzionalità" },
  { href: "#per-chi-e", label: "Per chi è" },
  { href: "#faq", label: "FAQ" },
];

type Props = {
  menuAperto: boolean;
  onToggleMenu: () => void;
  onChiudiMenu: () => void;
};

export function LandingNavbar({
  menuAperto,
  onToggleMenu,
  onChiudiMenu,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)]/80 bg-[var(--background)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="#top"
          className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--ink)]"
        >
          Affianco
        </a>

        <nav className="hidden items-center gap-6 text-sm text-[var(--ink-muted)] md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-[var(--ink)]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/login"
            className="rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-hover)]"
          >
            Accedi
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-[var(--ink)] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Inizia con Affianco →
          </Link>
        </div>

        <button
          type="button"
          className="rounded-xl p-2 text-[var(--ink-muted)] md:hidden"
          aria-label={menuAperto ? "Chiudi menu" : "Apri menu"}
          onClick={onToggleMenu}
        >
          {menuAperto ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {menuAperto ? (
        <div className="border-t border-[var(--border)] bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={onChiudiMenu}>
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="rounded-full border border-[var(--border)] px-4 py-2.5 text-center"
              onClick={onChiudiMenu}
            >
              Accedi
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[var(--ink)] px-4 py-2.5 text-center text-white"
              onClick={onChiudiMenu}
            >
              Inizia con Affianco →
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
