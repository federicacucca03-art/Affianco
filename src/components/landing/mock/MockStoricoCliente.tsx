import { MockBrowser } from "@/components/landing/mock/MockBrowser";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

const STORIA = [
  {
    titolo: "Campagna Contatti · Marzo",
    dettaglio: "Approvata · Collegata a Meta · Stato: stabile",
    meta: "CPL storico €24 · target €30",
  },
  {
    titolo: "Campagna Contatti · Gennaio",
    dettaglio: "Approvata · Conclusa · Revisione creatività",
    meta: "CPL storico €31 · target €30",
  },
  {
    titolo: "Brief e obiettivi",
    dettaglio: "Ticket, margine e conversione aggiornati",
    meta: "Contesto economico attivo",
  },
];

/** Illustrative client memory — campaigns, approvals, states, CPL history. */
export function MockStoricoCliente() {
  return (
    <MockBrowser titolo="Cliente">
      <div className="flex items-start gap-3 border-b border-[var(--border)] pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
          SR
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">
            Studio Dentistico Rossi
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Contesto collegato nel tempo
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {STORIA.map((voce) => (
          <li
            key={voce.titolo}
            className="rounded-xl bg-[var(--surface-hover)] px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--ink)]">
                  {voce.titolo}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                  {voce.dettaglio}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ink)]">{voce.meta}</p>
              </div>
              <StatoChip kind="info" label="Contesto" />
            </div>
          </li>
        ))}
      </ul>
    </MockBrowser>
  );
}
