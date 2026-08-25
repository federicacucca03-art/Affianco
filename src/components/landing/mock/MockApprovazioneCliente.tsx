import { MockBrowser } from "@/components/landing/mock/MockBrowser";

export function MockApprovazioneCliente() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
      <MockBrowser titolo="affianco.app/approvazione · Vista cliente">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
            SR
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--ink)]">
              Studio Dentistico Rossi
            </p>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Obiettivo · Richieste di contatto
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Copy approvato
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
              Prima visita di controllo a Milano — scopri se sei un candidato
              per gli allineatori invisibili. Valutazione gratuita, senza
              impegno.
            </p>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Creatività
            </p>
            <div className="mt-2 overflow-hidden rounded-xl bg-[#e8f0fe]">
              <div className="flex aspect-[4/3] items-center justify-center text-xs text-[var(--accent)]">
                Video testimonial
              </div>
            </div>
          </div>

          <div className="mx-auto w-[140px] shrink-0">
            <div className="overflow-hidden rounded-[1.75rem] border-[3px] border-[var(--ink)] bg-white shadow-[var(--shadow-soft)]">
              <div className="bg-[var(--ink)] px-3 py-1.5 text-center text-[9px] text-white">
                Anteprima feed
              </div>
              <div className="p-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-[var(--accent-soft)]" />
                  <span className="text-[9px] font-medium text-[var(--ink)]">
                    Studio Rossi
                  </span>
                </div>
                <div className="mt-2 aspect-square rounded-lg bg-[#e8f0fe]" />
                <p className="mt-2 text-[8px] leading-snug text-[var(--ink)]">
                  Prima visita di controllo a Milano…
                </p>
                <span className="mt-2 block rounded-md bg-[var(--surface-hover)] py-1 text-center text-[8px] font-medium text-[var(--ink-muted)]">
                  Richiedi informazioni
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-5 w-full rounded-full bg-[var(--ink)] py-2.5 text-sm font-medium text-white"
        >
          Approva campagna
        </button>
      </MockBrowser>
    </div>
  );
}
