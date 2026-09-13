import { MockBrowser } from "@/components/landing/mock/MockBrowser";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

const RIGHE = [
  {
    tone: "critico" as const,
    fascia: "Da guardare ora",
    nome: "Centro Fitness Milano",
    motivo: "CPL sopra il target",
    evidenza: "14 risultati · dati sufficienti",
    azione: "Controlla la creatività principale",
    chip: "Attenzione",
  },
  {
    tone: "watch" as const,
    fascia: "Da monitorare",
    nome: "Studio Rossi",
    motivo: "CPL vicino alla soglia target",
    evidenza: null,
    azione: "Aspetta altri dati",
    chip: "Da monitorare",
  },
  {
    tone: "ok" as const,
    fascia: "Stabile",
    nome: "Autoscuola Bianchi",
    motivo: "Nessuna azione necessaria",
    evidenza: null,
    azione: null,
    chip: "Stabile",
  },
];

/** Illustrative prioritization dashboard mock — not live data. */
export function MockAllyOggi() {
  return (
    <MockBrowser titolo="Dashboard · Oggi">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Dove guardare adesso
      </p>

      <ul className="mt-3 space-y-2">
        {RIGHE.map((riga) => (
          <li
            key={riga.nome}
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  {riga.fascia}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-[var(--ink)]">
                  {riga.nome}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                  {riga.motivo}
                </p>
                {riga.evidenza ? (
                  <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                    {riga.evidenza}
                  </p>
                ) : null}
                {riga.azione ? (
                  <p className="mt-2 text-[11px] font-medium text-[var(--ink)]">
                    Prossima azione: {riga.azione}
                  </p>
                ) : null}
              </div>
              <StatoChip kind={riga.tone} label={riga.chip} />
            </div>
          </li>
        ))}
      </ul>
    </MockBrowser>
  );
}
