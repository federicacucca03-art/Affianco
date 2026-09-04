"use client";

import Link from "next/link";

export function PannelloIntegrazioneMeta() {
  return (
    <section className="aff-panel-white mt-8 overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Meta Ads
        </h2>
        <p className="mt-1 aff-muted">
          Le connessioni Meta vengono gestite per singolo cliente.
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="aff-muted">
          Apri un cliente per collegare il relativo account Meta.
        </p>
        <Link href="/clienti" className="aff-btn-primary mt-5">
          Apri i clienti
        </Link>
      </div>
    </section>
  );
}
