import { MockBrowser } from "@/components/landing/mock/MockBrowser";

/** Illustrative Ask Ally conversation — contextual, not a generic chatbot. */
export function MockAskAlly() {
  return (
    <MockBrowser titolo="Chiedi nel contesto">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
        Campagna · Technon
      </p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Contesto già disponibile: cliente, obiettivo, risultati collegati.
      </p>

      <div className="mt-4 space-y-3">
        <div className="ml-8 rounded-2xl rounded-tr-md bg-[var(--ink)] px-3.5 py-2.5 text-sm text-white">
          Cambieresti qualcosa oggi?
        </div>
        <div className="mr-6 rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--surface-hover)] px-3.5 py-3 text-sm leading-relaxed text-[var(--ink)]">
          <p className="font-medium">Non ancora.</p>
          <p className="mt-2 text-[var(--ink-muted)]">
            La campagna ha solo 1 risultato e non ci sono abbastanza dati per
            valutare il CPL.
          </p>
          <p className="mt-2 text-[var(--ink-muted)]">
            Aspetterei prima di intervenire.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[var(--ink-muted)]">
        <span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1">
          Fatti
        </span>
        <span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1">
          Ipotesi
        </span>
        <span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1">
          Informazioni mancanti
        </span>
      </div>
    </MockBrowser>
  );
}
