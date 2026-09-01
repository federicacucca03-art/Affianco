"use client";

import type { StrategicScoreResult } from "@/lib/strategic-score";
import {
  CAVEAT_STIMA,
  LABEL_RISCHIO_SPRECO_BUDGET,
  PESI_STRATEGIC_SCORE,
} from "@/lib/strategic-score";
import { etichettaConversionRateSource } from "@/lib/conversion-rate";
import { RigaDiagnostica, StatoChip } from "@/components/nuova-contatti/StatoChip";

type Props = {
  result: StrategicScoreResult;
};

function chipDaTone(tone: StrategicScoreResult["tone"]) {
  if (tone === "green") return "ok" as const;
  if (tone === "yellow") return "watch" as const;
  if (tone === "orange") return "critico" as const;
  return "info" as const;
}

export function StrategicScoreCard({ result }: Props) {
  const b = result.breakdown;
  const eco = result.economia;
  const chip = chipDaTone(result.tone);

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
    <section className="aff-panel-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium text-[var(--primary)]">
          Strategic Score
        </p>
        <StatoChip kind={chip} label={result.label} />
      </div>
      {result.mostraPunteggio ? (
        <p className="mt-3 text-4xl font-medium tracking-tight tabular-nums text-[var(--ink)]">
          {result.score}
          <span className="text-lg font-normal text-[var(--ink-muted)]">
            {" "}
            / 100
          </span>
        </p>
      ) : (
        <p className="mt-3 text-lg font-medium text-[var(--ink)]">
          {result.label}
        </p>
      )}

      {eco.conversionRateSource === "REAL" ? (
        <p className="mt-2">
          <StatoChip kind="ok" label="Dato reale" />
        </p>
      ) : null}
      {eco.conversionRateSource === "ESTIMATED" ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {CAVEAT_STIMA}
        </p>
      ) : null}
      {eco.conversionRateSource === "UNKNOWN" ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          Tasso di conversione non disponibile — i numeri non sono ancora
          certi.
        </p>
      ) : null}

      <ul className="mt-4 overflow-hidden rounded-[16px] bg-[var(--lavender-muted)] px-4">
        {fattori.map((f) => (
          <RigaDiagnostica
            key={f.label}
            voce={f.label}
            kind={f.ok ? "ok" : "watch"}
            spiegazione={`+${f.punti}/${f.max}`}
          />
        ))}
      </ul>

      {eco.benchmarkBudgetMin != null ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          Per realtà simili a {eco.citta || "questa zona"} il benchmark
          indicativo parte da circa {eco.benchmarkBudgetMin}€/giorno.
        </p>
      ) : null}

      {result.avvisoSprecoBudget ? (
        <p className="mt-3 flex flex-wrap items-start gap-2 text-[13px] font-medium leading-relaxed text-[var(--ink)]">
          <StatoChip kind="critico" />
          <span>
            {LABEL_RISCHIO_SPRECO_BUDGET}: il CPL di mercato tipico supera la
            soglia sostenibile.
          </span>
        </p>
      ) : null}

      {suggestionsVisibili.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3">
          {suggestionsVisibili
            .filter(
              (s) =>
                !s.includes("benchmark indicativo") &&
                !s.includes(CAVEAT_STIMA),
            )
            .map((suggerimento) => (
              <li
                key={suggerimento}
                className="text-[13px] leading-relaxed text-[var(--ink-muted)]"
              >
                {suggerimento}
              </li>
            ))}
        </ul>
      ) : null}

      {eco.conversionRateSource ? (
        <p className="mt-3 text-[11px] text-[var(--ink-muted)]">
          Fonte conversione:{" "}
          {etichettaConversionRateSource(eco.conversionRateSource)}
        </p>
      ) : null}
    </section>
  );
}
