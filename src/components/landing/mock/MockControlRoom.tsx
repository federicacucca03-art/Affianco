"use client";

import { ArrowRight } from "lucide-react";
import { MockBrowser } from "@/components/landing/mock/MockBrowser";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

const RIEPILOGO = [
  { kind: "ok" as const, label: "6 clienti nella norma" },
  { kind: "watch" as const, label: "2 da monitorare" },
  { kind: "critico" as const, label: "1 richiede attenzione" },
];

export function MockControlRoom() {
  return (
    <MockBrowser titolo="affianco.app/risultati">
      <div className="flex flex-wrap gap-2">
        {RIEPILOGO.map((item) => (
          <StatoChip key={item.label} kind={item.kind} label={item.label} />
        ))}
      </div>

      <article className="mt-4 rounded-xl border border-[#f5c6c6] bg-[#FDECEC] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">
              Studio Dentistico Rossi
            </p>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              CPL attuale: €34 · CPL target: €25 · Trend: +36%
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-[#C45C5C]">
            Richiede attenzione
          </span>
        </div>

        <div className="mt-4 space-y-2 text-xs leading-relaxed text-[var(--ink)]">
          <p>
            <span className="font-medium">Diagnosi:</span> Il CPL sta aumentando
            rispetto alla soglia definita.
          </p>
          <p>
            <span className="font-medium">Azione:</span> Controlla la creatività
            principale.
          </p>
        </div>

        <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
          Vedi diagnosi
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </p>
      </article>

      <p className="mt-4 text-[11px] text-[var(--ink-muted)]">
        Cosa sta succedendo → Perché → Cosa fare
      </p>
    </MockBrowser>
  );
}
