"use client";

import type { LaunchReadinessResult } from "@/lib/launch-readiness";

type Props = {
  result: LaunchReadinessResult;
};

export function LaunchReadinessCard({ result }: Props) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Prontezza al lancio
      </p>
      <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums text-[var(--ink)]">
        {result.completati}
        <span className="text-lg font-normal text-[var(--ink-muted)]">
          /{result.totale}
        </span>
      </p>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        {result.percentuale}% completato — quanto manca per esportare o
        lanciare.
      </p>

      <ul className="mt-4 space-y-2 border-t border-black/5 pt-3">
        {result.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 text-xs leading-relaxed"
          >
            <span className="text-[var(--ink)]">
              <span className="mr-1.5" aria-hidden>
                {item.ok ? "✓" : "○"}
              </span>
              {item.ok ? item.label : (item.mancante ?? item.label)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
