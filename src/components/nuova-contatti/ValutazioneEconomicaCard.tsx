"use client";

import {
  CAVEAT_STIMA,
  LABEL_VALUTAZIONE_IN_CORSO,
  type StrategicScoreResult,
} from "@/lib/strategic-score";
import { etichettaConversionRateSource } from "@/lib/conversion-rate";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

type Props = {
  result: StrategicScoreResult;
};

export function ValutazioneEconomicaCard({ result }: Props) {
  const eco = result.economia;
  const fonte = eco.conversionRateSource;

  return (
    <section className="aff-panel-white p-5 sm:p-6">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Strategic Score
      </p>
      <p className="mt-2 text-lg font-medium text-[var(--ink)]">
        {LABEL_VALUTAZIONE_IN_CORSO}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        Sintesi della parte economica già disponibile. Copy, creatività e
        identificativi Meta si valutano più avanti.
      </p>

      <ul className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-3 text-[13px]">
        <li className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <span className="text-[var(--ink-muted)]">Soglia sostenibile</span>
          <span className="tabular-nums text-[var(--ink)]">
            {fonte === "UNKNOWN" || !eco.numeriAffidabili
              ? "Non ancora calcolabile"
              : eco.maxSustainableCpl != null
                ? `${eco.maxSustainableCpl}€`
                : "—"}
          </span>
        </li>
        <li className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <span className="text-[var(--ink-muted)]">Budget</span>
          <span className="tabular-nums text-[var(--ink)]">
            {eco.budgetGiornaliero > 0
              ? `${eco.budgetGiornaliero}€/giorno`
              : "—"}
          </span>
        </li>
        <li className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <span className="text-[var(--ink-muted)]">Fonte conversion rate</span>
          <span className="text-[var(--ink)]">
            {fonte ? etichettaConversionRateSource(fonte) : "—"}
          </span>
        </li>
      </ul>

      {eco.budgetSostenibile === true && eco.numeriAffidabili ? (
        <p className="mt-3">
          <StatoChip kind="ok" label="Budget coerente" />
          <span className="ml-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            Il budget è coerente con la soglia sostenibile calcolata.
          </span>
        </p>
      ) : null}

      {eco.benchmarkBudgetMin != null ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          Per realtà simili a {eco.citta || "questa zona"} il benchmark
          indicativo parte da circa {eco.benchmarkBudgetMin}€/giorno.
        </p>
      ) : null}

      {fonte === "REAL" ? (
        <p className="mt-3">
          <StatoChip kind="ok" label="Dato reale" />
        </p>
      ) : null}
      {fonte === "ESTIMATED" ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {CAVEAT_STIMA}
        </p>
      ) : null}
      {fonte === "UNKNOWN" ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          Senza un tasso di conversione i numeri economici non sono ancora
          certi.
        </p>
      ) : null}
    </section>
  );
}
