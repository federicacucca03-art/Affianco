"use client";

import { Check, Link2, Loader2 } from "lucide-react";
import type { StatoApprovazioneLeads } from "@/components/nuova-contatti/StatoApprovazioneLeads";
import {
  etichettaStatoApprovazioneLeads,
  stileBadgeStatoApprovazione,
} from "@/components/nuova-contatti/StatoApprovazioneLeads";

type Props = {
  onCopia: () => void;
  inCorso?: boolean;
  copiato?: boolean;
  errore?: string | null;
  /** Override titolo (es. BOOKINGS). */
  titolo?: string;
  /** Override descrizione. */
  descrizione?: string;
  /** Override etichetta CTA (es. LEADS step 6). */
  etichettaCta?: string;
  /** Stato approvazione cliente (solo LEADS). */
  statoApprovazione?: StatoApprovazioneLeads;
};

export function CardLinkApprovazione({
  onCopia,
  inCorso = false,
  copiato = false,
  errore = null,
  titolo = "1. Invia al cliente per approvazione finale",
  descrizione = "Condividi questo link prima di lanciare. Il cliente vedrà l'anteprima dell'annuncio e il CPL sostenibile senza bisogno di login.",
  etichettaCta = "🔗 Copia Link Portale Approvazione",
  statoApprovazione,
}: Props) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        Portale cliente
      </p>
      <h2 className="mt-1 text-base font-medium text-[var(--ink)]">{titolo}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink)]">
        {descrizione}
      </p>

      {statoApprovazione ? (
        <p
          className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${stileBadgeStatoApprovazione(statoApprovazione)}`}
        >
          {etichettaStatoApprovazioneLeads(statoApprovazione)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onCopia}
        disabled={inCorso}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {inCorso ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Preparazione link…
          </>
        ) : copiato ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} />
            Link copiato!
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" strokeWidth={1.75} />
            {etichettaCta}
          </>
        )}
      </button>

      {errore ? (
        <p className="mt-3 text-sm text-[#C45C5C]">{errore}</p>
      ) : null}
    </section>
  );
}
