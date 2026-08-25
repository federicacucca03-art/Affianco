"use client";

import type { StrategicScoreResult } from "@/lib/strategic-score";

type Props = {
  result: StrategicScoreResult;
  budgetMin?: number;
  /** Etichetta ultimo fattore (modulo vs URL store vs completamento). */
  etichettaAssetFinale?: string;
};

const TONE_STYLES = {
  green: {
    card: "border-[#c6e7c8] bg-[#f0faf1]",
    score: "text-[#1f7a3a]",
  },
  yellow: {
    card: "border-[#f5e0a8] bg-[#fff9e8]",
    score: "text-[#9a6700]",
  },
  orange: {
    card: "border-[#f5c9b8] bg-[#fff4f0]",
    score: "text-[#c2410c]",
  },
} as const;

function RigaFattore({
  ok,
  label,
  punti,
  max,
}: {
  ok: boolean;
  label: string;
  punti: number;
  max: number;
}) {
  return (
    <li className="flex items-start justify-between gap-3 text-xs leading-relaxed">
      <span className="text-[var(--ink-muted)]">
        <span className="mr-1.5" aria-hidden>
          {ok ? "✓" : "○"}
        </span>
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums ${ok ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
      >
        +{punti}/{max}
      </span>
    </li>
  );
}

export function StrategicScoreCard({
  result,
  budgetMin,
  etichettaAssetFinale = "ID Modulo Contatti",
}: Props) {
  const stile = TONE_STYLES[result.tone];
  const b = result.breakdown;

  const fattori = [
    {
      ok: b.strategyBudget > 0,
      label:
        budgetMin != null
          ? `Budget ≥ ${budgetMin}€/giorno`
          : "Budget giornaliero nella norma",
      punti: b.strategyBudget,
      max: 40,
    },
    {
      ok: b.copy > 0,
      label: "Copy varianti presenti",
      punti: b.copy,
      max: 20,
    },
    {
      ok: b.foto > 0,
      label: "Creatività caricata",
      punti: b.foto,
      max: 15,
    },
    {
      ok: b.pageId > 0,
      label: "ID Pagina Facebook",
      punti: b.pageId,
      max: 15,
    },
    {
      ok: b.formId > 0,
      label: etichettaAssetFinale,
      punti: b.formId,
      max: 10,
    },
  ];

  return (
    <section
      className={`rounded-[var(--radius)] border p-5 shadow-[var(--shadow-soft)] ${stile.card}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Strategic Score
      </p>
      <p
        className={`mt-2 text-4xl font-medium tracking-tight tabular-nums ${stile.score}`}
      >
        {result.score}
        <span className="text-lg font-normal text-[var(--ink-muted)]">
          {" "}
          / 100
        </span>
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--ink)]">
        {result.label}
      </p>

      <ul className="mt-4 space-y-2 border-t border-black/5 pt-3">
        {fattori.map((f) => (
          <RigaFattore
            key={f.label}
            ok={f.ok}
            label={f.label}
            punti={f.punti}
            max={f.max}
          />
        ))}
      </ul>

      {result.isComplete ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          Tutti gli asset richiesti sono inseriti.
        </p>
      ) : result.suggestions.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
          {result.suggestions.map((suggerimento) => (
            <li
              key={suggerimento}
              className="text-xs leading-relaxed text-[var(--ink-muted)]"
            >
              {suggerimento}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
