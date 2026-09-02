"use client";

import {
  etichettaConfidenza,
  etichettaHealth,
  type DiagnosisResult,
  type HealthStatus,
} from "@/lib/control-room";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";
import {
  evidenzeDiagnosiBrevi,
  testiCapTrend,
  testoAndamentoDiagnosi,
  type TrendEvaluation,
} from "@/lib/campaign-trend";

export function BloccoDiagnosiTrend({
  healthStatus,
  diagnosis,
  trend,
}: {
  healthStatus: HealthStatus;
  diagnosis: DiagnosisResult;
  trend: TrendEvaluation | null;
}) {
  const andamento = testoAndamentoDiagnosi(trend, diagnosis.trendSummary);
  const evidenze = evidenzeDiagnosiBrevi(diagnosis.evidence);
  const caps = trend ? testiCapTrend(trend.caps) : [];
  const noCausa = diagnosis.area === "NO_CLEAR_SIGNAL";
  const titoloDiagnosi = noCausa
    ? diagnosis.body
    : diagnosis.title;

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Stato
        </p>
        <div className="mt-1.5">
          <StatoChip
            kind={chipDaHealth(healthStatus)}
            label={etichettaHealth(healthStatus)}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Diagnosi
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
          {titoloDiagnosi}
        </p>
        {!noCausa && diagnosis.body && diagnosis.body !== diagnosis.title ? (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
            {diagnosis.body}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Andamento
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
          {andamento}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Confidenza
        </p>
        <p className="mt-1 text-sm text-[var(--ink)]">
          {etichettaConfidenza(diagnosis.confidence)}
        </p>
        {diagnosis.confidence === "HIGH" ? (
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Basata su più segnali coerenti
          </p>
        ) : null}
      </div>

      {evidenze.length > 0 ? (
        <ul className="space-y-1">
          {evidenze.map((riga) => (
            <li
              key={riga}
              className="text-xs leading-relaxed text-[var(--ink-muted)]"
            >
              {riga}
            </li>
          ))}
        </ul>
      ) : null}

      {caps.length > 0 ? (
        <div className="space-y-1">
          {caps.map((riga) => (
            <p key={riga} className="text-xs leading-relaxed text-[var(--ink-muted)]">
              {riga}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
