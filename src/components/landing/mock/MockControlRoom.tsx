import { MockBrowser } from "@/components/landing/mock/MockBrowser";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

/** Illustrative Control Room mock — priority, evidence, next action. */
export function MockControlRoom() {
  return (
    <MockBrowser titolo="Monitoraggio">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
        Non tutte le campagne meritano attenzione oggi
      </p>

      <div className="mt-4 space-y-3">
        <article className="rounded-xl border border-[#f0d0d0] bg-[#fff8f8] px-3.5 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#b42318]">
                Richiede attenzione
              </p>
              <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                Studio Dentistico Rossi
              </p>
            </div>
            <StatoChip kind="critico" label="Attenzione" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div>
              <p className="text-[var(--ink-muted)]">CPL attuale</p>
              <p className="font-medium text-[var(--ink)]">€34</p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">CPL target</p>
              <p className="font-medium text-[var(--ink)]">€25</p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Risultati</p>
              <p className="font-medium text-[var(--ink)]">12</p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Giorni</p>
              <p className="font-medium text-[var(--ink)]">8</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            Perché: il costo è sopra la soglia e ci sono abbastanza dati per
            valutarlo.
          </p>
          <p className="mt-2 text-[11px] font-medium text-[var(--ink)]">
            Prossima azione: Controlla la creatività principale.
          </p>
        </article>

        <article className="rounded-xl border border-[var(--border)] bg-white px-3.5 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                Dati insufficienti
              </p>
              <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                Autoscuola Bianchi
              </p>
            </div>
            <StatoChip kind="pending" label="Dati insufficienti" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <div>
              <p className="text-[var(--ink-muted)]">CPL attuale</p>
              <p className="font-medium text-[var(--ink)]">€22</p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Risultati</p>
              <p className="font-medium text-[var(--ink)]">1</p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Giorni</p>
              <p className="font-medium text-[var(--ink)]">2</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            Non c&apos;è ancora abbastanza evidenza per giudicare il CPL. Non
            viene forzata una conclusione verde o rossa.
          </p>
          <p className="mt-2 text-[11px] font-medium text-[var(--ink)]">
            Prossima azione: Aspetta altri dati.
          </p>
        </article>
      </div>
    </MockBrowser>
  );
}
