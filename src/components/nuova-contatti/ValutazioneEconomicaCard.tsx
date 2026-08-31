"use client";

import {
  CAVEAT_STIMA,
  LABEL_VALUTAZIONE_IN_CORSO,
  type StrategicScoreResult,
} from "@/lib/strategic-score";
import { etichettaConversionRateSource } from "@/lib/conversion-rate";

type Props = {
  result: StrategicScoreResult;
};

export function ValutazioneEconomicaCard({ result }: Props) {
  const eco = result.economia;
  const fonte = eco.conversionRateSource;

  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Strategic Score
      </p>
      <p className="mt-2 text-lg font-medium text-[var(--ink)]">
        {LABEL_VALUTAZIONE_IN_CORSO}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
        Sintesi della parte economica già disponibile. Copy, creatività e
        identificativi Meta si valutano più avanti.
      </p>

      <ul className="mt-4 space-y-2 border-t border-black/5 pt-3 text-sm">
        <li className="flex items-start justify-between gap-3">
          <span className="text-[var(--ink-muted)]">Soglia sostenibile</span>
          <span className="shrink-0 tabular-nums text-[var(--ink)]">
            {fonte === "UNKNOWN" || !eco.numeriAffidabili
              ? "Non ancora calcolabile"
              : eco.maxSustainableCpl != null
                ? `${eco.maxSustainableCpl}€`
                : "—"}
          </span>
        </li>
        <li className="flex items-start justify-between gap-3">
          <span className="text-[var(--ink-muted)]">Budget</span>
          <span className="shrink-0 tabular-nums text-[var(--ink)]">
            {eco.budgetGiornaliero > 0
              ? `${eco.budgetGiornaliero}€/giorno`
              : "—"}
          </span>
        </li>
        <li className="flex items-start justify-between gap-3">
          <span className="text-[var(--ink-muted)]">Fonte conversion rate</span>
          <span className="shrink-0 text-[var(--ink)]">
            {fonte ? etichettaConversionRateSource(fonte) : "—"}
          </span>
        </li>
        {eco.budgetSostenibile === true && eco.numeriAffidabili ? (
          <li className="text-xs leading-relaxed text-[#1f7a3a]">
            Il budget è coerente con la soglia sostenibile calcolata.
          </li>
        ) : null}
      </ul>

      {eco.benchmarkBudgetMin != null ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          Per realtà simili a {eco.citta || "questa zona"} il benchmark
          indicativo parte da circa {eco.benchmarkBudgetMin}€/giorno.
        </p>
      ) : null}

      {fonte === "REAL" ? (
        <p className="mt-3 text-xs font-medium text-[#1f7a3a]">Dato reale</p>
      ) : null}
      {fonte === "ESTIMATED" ? (
        <p className="mt-3 text-xs leading-relaxed text-[#9a6700]">
          {CAVEAT_STIMA}
        </p>
      ) : null}
      {fonte === "UNKNOWN" ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          Senza un tasso di conversione i numeri economici non sono ancora
          certi.
        </p>
      ) : null}
    </section>
  );
}
