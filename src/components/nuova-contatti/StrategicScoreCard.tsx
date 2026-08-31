"use client";

import type { StrategicScoreResult } from "@/lib/strategic-score";
import {
  CAVEAT_STIMA,
  LABEL_RISCHIO_SPRECO_BUDGET,
  PESI_STRATEGIC_SCORE,
} from "@/lib/strategic-score";
import { etichettaConversionRateSource } from "@/lib/conversion-rate";

type Props = {
  result: StrategicScoreResult;
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
  neutral: {
    card: "border-[var(--border)] bg-white",
    score: "text-[var(--ink)]",
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

export function StrategicScoreCard({ result }: Props) {
  const stile = TONE_STYLES[result.tone];
  const b = result.breakdown;
  const eco = result.economia;

  const fattori = [
    {
      ok: b.economia >= PESI_STRATEGIC_SCORE.economia * 0.75,
      label: eco.maxCplCalcolabile
        ? `Economia (soglia sostenibile ${eco.maxSustainableCpl}€)`
        : "Economia",
      punti: b.economia,
      max: PESI_STRATEGIC_SCORE.economia,
    },
    {
      ok: b.offerta === PESI_STRATEGIC_SCORE.offerta,
      label: "Offerta e brief",
      punti: b.offerta,
      max: PESI_STRATEGIC_SCORE.offerta,
    },
    {
      ok: b.targeting === PESI_STRATEGIC_SCORE.targeting,
      label: "Targeting",
      punti: b.targeting,
      max: PESI_STRATEGIC_SCORE.targeting,
    },
    {
      ok: b.copy === PESI_STRATEGIC_SCORE.copy,
      label: "Copy",
      punti: b.copy,
      max: PESI_STRATEGIC_SCORE.copy,
    },
    {
      ok: b.creativita === PESI_STRATEGIC_SCORE.creativita,
      label: "Creatività",
      punti: b.creativita,
      max: PESI_STRATEGIC_SCORE.creativita,
    },
  ];

  const suggestionsVisibili = result.suggestions.filter(
    (s) => !s.includes(LABEL_RISCHIO_SPRECO_BUDGET) || result.avvisoSprecoBudget,
  );

  return (
    <section
      className={`rounded-[var(--radius)] border p-5 shadow-[var(--shadow-soft)] ${stile.card}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Strategic Score
      </p>
      {result.mostraPunteggio ? (
        <p
          className={`mt-2 text-4xl font-medium tracking-tight tabular-nums ${stile.score}`}
        >
          {result.score}
          <span className="text-lg font-normal text-[var(--ink-muted)]">
            {" "}
            / 100
          </span>
        </p>
      ) : (
        <p className="mt-2 text-lg font-medium text-[var(--ink)]">
          {result.label}
        </p>
      )}
      {result.mostraPunteggio ? (
        <p className="mt-2 text-sm font-medium text-[var(--ink)]">
          {result.label}
        </p>
      ) : null}

      {eco.conversionRateSource === "REAL" ? (
        <p className="mt-2 text-xs font-medium text-[#1f7a3a]">Dato reale</p>
      ) : null}
      {eco.conversionRateSource === "ESTIMATED" ? (
        <p className="mt-2 text-xs leading-relaxed text-[#9a6700]">
          {CAVEAT_STIMA}
        </p>
      ) : null}
      {eco.conversionRateSource === "UNKNOWN" ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
          Tasso di conversione non disponibile — i numeri non sono ancora
          certi.
        </p>
      ) : null}

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

      {eco.benchmarkBudgetMin != null ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          Per realtà simili a {eco.citta || "questa zona"} il benchmark
          indicativo parte da circa {eco.benchmarkBudgetMin}€/giorno.
        </p>
      ) : null}

      {result.avvisoSprecoBudget ? (
        <p className="mt-3 text-xs font-medium leading-relaxed text-[#c2410c]">
          {LABEL_RISCHIO_SPRECO_BUDGET}: il CPL di mercato tipico supera la
          soglia sostenibile.
        </p>
      ) : null}

      {suggestionsVisibili.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
          {suggestionsVisibili
            .filter(
              (s) =>
                !s.includes("benchmark indicativo") &&
                !s.includes(CAVEAT_STIMA),
            )
            .map((suggerimento) => (
              <li
                key={suggerimento}
                className="text-xs leading-relaxed text-[var(--ink-muted)]"
              >
                {suggerimento}
              </li>
            ))}
        </ul>
      ) : null}

      {eco.conversionRateSource ? (
        <p className="mt-3 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
          Fonte conversione:{" "}
          {etichettaConversionRateSource(eco.conversionRateSource)}
        </p>
      ) : null}
    </section>
  );
}
