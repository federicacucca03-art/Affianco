"use client";

import type { LaunchReadinessResult } from "@/lib/launch-readiness";
import type { LaunchReadinessWarning } from "@/lib/creative-semantic-fit";
import { RigaDiagnostica } from "@/components/nuova-contatti/StatoChip";

type Props = {
  result: LaunchReadinessResult & {
    warnings?: LaunchReadinessWarning[];
  };
};

/**
 * Technical launch readiness (completati/totale).
 * Semantic coherence warnings are separate — they do not rewrite %.
 */
export function LaunchReadinessCard({ result }: Props) {
  const mancanti = result.items.filter((item) => !item.ok);
  const okItems = result.items.filter((item) => item.ok);
  const warnings = result.warnings ?? [];

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
        {result.percentuale}% configurazione tecnica — quanto manca per
        esportare o lanciare.
      </p>

      {warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[12px] font-medium text-[var(--ink-muted)]">
            Coerenza creatività (non blocca il lancio tecnico)
          </p>
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li
                key={w.id}
                className="rounded-[16px] border border-[var(--border)] bg-[var(--lavender-muted)] px-4 py-3"
              >
                <p className="text-[13px] font-medium text-[var(--ink)]">
                  {w.title}
                </p>
                {w.description ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
                    {w.description}
                  </p>
                ) : null}
                {w.cta ? (
                  <p className="mt-1.5 text-[12px] font-medium text-[var(--primary)]">
                    {w.cta}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
