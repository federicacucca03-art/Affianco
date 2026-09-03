"use client";

import Link from "next/link";

export function PannelloIntegrazioneMeta() {
  return (
    <section className="mt-8 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-base font-medium text-[var(--ink)]">Meta Ads</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--ink-muted)]">
        Le connessioni Meta vengono gestite per singolo cliente.
      </p>
      <p className="mt-2 max-w-md text-sm text-[var(--ink-muted)]">
        Apri un cliente per collegare il relativo account Meta.
      </p>
      <Link
        href="/clienti"
        className="mt-5 inline-block rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Apri i clienti
      </Link>
    </section>
  );
}
