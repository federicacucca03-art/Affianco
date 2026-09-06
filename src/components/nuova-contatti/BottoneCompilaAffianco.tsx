"use client";

import Link from "next/link";

type Props = {
  className?: string;
};

/** M9.3A — entry to brief-assisted setup (wizard fields still authoritative). */
export function BottoneCompilaAffianco({ className = "" }: Props) {
  return (
    <Link
      href="/campagne#obiettivi-campagna"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] ${className}`}
      aria-label="Compila con Ally dal brief"
    >
      ✨ Compila con Ally
    </Link>
  );
}
