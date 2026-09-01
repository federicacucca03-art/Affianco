"use client";

import type { LaunchReadinessResult } from "@/lib/launch-readiness";
import { RigaDiagnostica } from "@/components/nuova-contatti/StatoChip";

type Props = {
  result: LaunchReadinessResult;
};

export function LaunchReadinessCard({ result }: Props) {
  const mancanti = result.items.filter((item) => !item.ok);
  const okItems = result.items.filter((item) => item.ok);

  return (
    <section className="aff-panel-white p-5 sm:p-6">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Prontezza al lancio
      </p>
      <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums text-[var(--ink)]">
        {result.completati}
        <span className="text-lg font-normal text-[var(--ink-muted)]">
          /{result.totale}
        </span>
      </p>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
        {result.percentuale}% completato — quanto manca per esportare o
        lanciare.
      </p>

      {mancanti.length > 0 ? (
        <ul className="mt-4 overflow-hidden rounded-[16px] bg-[var(--lavender-muted)] px-4">
          {mancanti.map((item) => (
            <RigaDiagnostica
              key={item.id}
              voce={item.label}
              kind="watch"
              spiegazione={item.mancante ?? item.label}
            />
          ))}
        </ul>
      ) : null}

      {okItems.length > 0 ? (
        <details className="mt-3 rounded-[16px] bg-[var(--lavender-muted)] px-4 py-2">
          <summary className="cursor-pointer text-[13px] font-medium text-[var(--ink)]">
            {okItems.length}{" "}
            {okItems.length === 1 ? "controllo OK" : "controlli OK"}
          </summary>
          <ul className="mt-1">
            {okItems.map((item) => (
              <RigaDiagnostica
                key={item.id}
                voce={item.label}
                kind="ok"
                spiegazione="Completato"
              />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
