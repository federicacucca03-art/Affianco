"use client";

import {
  etichettaHealth,
  etichettaSegnaleDiagnosi,
  formatDataCheck,
  formatEuro,
} from "@/lib/control-room";
import type { CampaignCheck } from "@/lib/campaign-checks-db";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";
import {
  direzionePrimaryTraDue,
  etichettaDirezioneRiga,
} from "@/lib/campaign-trend";
import type { CampagnaObjective } from "@/types/campagne";

export function StoricoControlli({
  checks,
  metricLabel,
  objective,
}: {
  checks: CampaignCheck[];
  metricLabel: string;
  objective: CampagnaObjective;
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
            const direzione = precedente
              ? direzionePrimaryTraDue(precedente, check, objective)
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
                  {direzione ? etichettaDirezioneRiga(direzione) : "—"}
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
