"use client";

import { MockBrowser } from "@/components/landing/mock/MockBrowser";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

type RigaCliente = {
  iniziali: string;
  nome: string;
  cplAttuale: number;
  cplTarget: number;
  stato: "ok" | "attenzione";
  statoLabel: string;
};

const CLIENTI: RigaCliente[] = [
  {
    iniziali: "SR",
    nome: "Studio Dentistico Rossi",
    cplAttuale: 18,
    cplTarget: 25,
    stato: "ok",
    statoLabel: "Nella norma",
  },
  {
    iniziali: "CF",
    nome: "Centro Fitness Milano",
    cplAttuale: 29,
    cplTarget: 24,
    stato: "attenzione",
    statoLabel: "Richiede attenzione",
  },
  {
    iniziali: "AB",
    nome: "Autoscuola Bianchi",
    cplAttuale: 14,
    cplTarget: 22,
    stato: "ok",
    statoLabel: "Nella norma",
  },
];

export function MockDashboardHero() {
  return (
    <MockBrowser titolo="affianco.app/campagne">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
            Control room
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">
            I tuoi clienti attivi
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <StatoChip kind="ok" label="6 ok" />
          <StatoChip kind="critico" label="1 att." />
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {CLIENTI.map((cliente) => (
          <li
            key={cliente.nome}
            className="flex items-center gap-3 rounded-xl bg-[var(--surface-hover)] px-3 py-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-medium text-[var(--accent)]">
              {cliente.iniziali}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--ink)]">
                {cliente.nome}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                CPL attuale: €{cliente.cplAttuale} · CPL target: €
                {cliente.cplTarget}
              </p>
            </div>
            <StatoChip
              kind={cliente.stato === "ok" ? "ok" : "critico"}
              label={cliente.statoLabel}
            />
          </li>
        ))}
      </ul>
    </MockBrowser>
  );
}
