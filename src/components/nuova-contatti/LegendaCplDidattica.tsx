"use client";

import { StatoChip } from "@/components/nuova-contatti/StatoChip";

/** Legenda interpretativa — guida visiva, non calcolo automatico. */
export function LegendaCplDidattica() {
  return (
    <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-[13px] leading-relaxed text-[var(--ink-muted)]">
      <li className="flex items-start gap-2">
        <StatoChip kind="ok" />
        <span>
          Sotto il CPL target → situazione economicamente sana rispetto alla
          soglia definita
        </span>
      </li>
      <li className="flex items-start gap-2">
        <StatoChip kind="watch" />
        <span>Vicino al CPL target → da monitorare</span>
      </li>
      <li className="flex items-start gap-2">
        <StatoChip kind="critico" />
        <span>
          Sopra il break-even → situazione critica rispetto alla soglia
          economica
        </span>
      </li>
    </ul>
  );
}
