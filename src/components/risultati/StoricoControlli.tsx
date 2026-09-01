"use client";

import {
  etichettaHealth,
  etichettaSegnaleDiagnosi,
  etichettaTrend,
  formatDataCheck,
  formatEuro,
  trendVsPrecedente,
} from "@/lib/control-room";
import type { CampaignCheck } from "@/lib/campaign-checks-db";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";

export function StoricoControlli({
  checks,
  metricLabel,
}: {
  checks: CampaignCheck[];
  metricLabel: string;
}) {
  if (checks.length === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        Lo storico dei controlli sarà disponibile dopo il primo check salvato.
      </p>
    );
  }

  const visibili = checks.slice(0, 8);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Stato</th>
            <th className="px-3 py-2 font-medium">{metricLabel}</th>
            <th className="px-3 py-2 font-medium">Soglia</th>
            <th className="px-3 py-2 font-medium">Trend</th>
            <th className="px-3 py-2 font-medium">Diagnosi</th>
            <th className="px-3 py-2 font-medium">Nota</th>
          </tr>
        </thead>
        <tbody>
          {visibili.map((check, i) => {
            const precedente = visibili[i + 1];
            const trend = precedente
              ? trendVsPrecedente(precedente.primaryCost, check.primaryCost)
              : null;
            return (
              <tr
                key={check.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-3 py-2.5 text-[var(--ink)]">
                  {formatDataCheck(check.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <StatoChip
                    kind={chipDaHealth(check.healthStatus)}
                    label={etichettaHealth(check.healthStatus)}
                  />
                </td>
                <td className="px-3 py-2.5 font-medium text-[var(--ink)]">
                  {formatEuro(check.primaryCost)}
                </td>
                <td className="px-3 py-2.5 text-[var(--ink-muted)]">
                  {formatEuro(check.threshold)}
                </td>
                <td className="px-3 py-2.5 text-[var(--ink)]">
                  {i === 0 && trend ? etichettaTrend(trend) : trend ? etichettaTrend(trend) : "—"}
                </td>
                <td className="max-w-[220px] px-3 py-2.5 text-[var(--ink-muted)]">
                  {etichettaSegnaleDiagnosi(check.signal)}
                </td>
                <td className="max-w-[200px] px-3 py-2.5 text-[var(--ink-muted)]">
                  {check.note?.trim() || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
