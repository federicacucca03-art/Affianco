import { StatoChip } from "@/components/nuova-contatti/StatoChip";

/** Compact client approval mock — one shared version + clear status. */
export function MockApprovazioneCliente() {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
      <div className="grid sm:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-[var(--border)] p-4 sm:border-b-0 sm:border-r sm:p-5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Cliente
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            Studio Dentistico Rossi
          </p>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Obiettivo
          </p>
          <p className="mt-1 text-sm text-[var(--ink)]">Richieste di contatto</p>

          <p className="mt-4 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Copy
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
            Prima visita di controllo a Milano — valutazione gratuita, senza
            impegno.
          </p>

          <p className="mt-4 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Creatività
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 rounded-lg bg-[#e8f0fe]" />
            <p className="text-xs text-[var(--ink-muted)]">Video testimonial</p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 bg-[var(--surface-hover)]/50 p-4 sm:p-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Stato
            </p>
            <div className="mt-2">
              <StatoChip kind="pending" label="In attesa di approvazione" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
              Una sola versione condivisa. Approvazione tracciata.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="w-full rounded-full bg-[var(--ink)] py-2.5 text-sm font-medium text-white"
            >
              Approva
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-[var(--border)] bg-white py-2.5 text-sm text-[var(--ink)]"
            >
              Richiedi modifiche
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
            <StatoChip kind="ok" label="Approvata" />
            <StatoChip kind="watch" label="Modifiche richieste" />
          </div>
        </div>
      </div>
    </div>
  );
}
