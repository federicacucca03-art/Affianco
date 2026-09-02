import type { Metadata } from "next";
import { PaginaLegale } from "@/components/legal/PaginaLegale";
import { LEGAL_CONTACT_EMAIL, titolareTrattamento } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Termini di utilizzo — Affianco",
  description:
    "Condizioni di utilizzo di Affianco: responsabilità sulle campagne, AI, export Meta e disponibilità del servizio.",
};

export default function PaginaTermini() {
  return (
    <PaginaLegale
      titolo="Termini di utilizzo"
      aggiornamento="Condizioni del software Affianco. Non costituiscono consulenza legale o pubblicitaria."
    >
      <p>
        Usando Affianco accetti queste condizioni. Il servizio è un software di
        supporto al flusso di lavoro (pianificazione, organizzazione, analisi e
        preparazione di materiali per campagne). Titolare indicato:{" "}
        {titolareTrattamento()}.
      </p>

      <h2>Cosa fa Affianco</h2>
      <p>
        Affianco ti aiuta a strutturare campagne, clienti, copy, creatività,
        controlli economici e un export di bozza per Ads Manager. Non sostituisce
        Meta Ads Manager e non pubblica le inserzioni al posto tuo.
      </p>

      <h2>Responsabilità sulle campagne</h2>
      <p>
        Restano tue le decisioni su targeting, budget, messaggi, creatività e
        pubblicazione. Affianco non garantisce risultati pubblicitari, volume di
        lead, vendite o un costo per risultato.
      </p>

      <h2>Intelligenza artificiale</h2>
      <p>
        Testi, analisi e suggerimenti generati da funzioni AI sono un aiuto.
        Vanno sempre rivisti da una persona prima di usarli con clienti o in
        Ads Manager.
      </p>

      <h2>Export verso Meta</h2>
      <p>
        L&apos;export CSV è una bozza strutturata (campagne in stato non
        attivo) da completare in Ads Manager. Ads Manager resta
        l&apos;ambiente di pubblicazione. Affianco non è oggi collegato alle
        API di gestione inserzioni di Meta.
      </p>

      <h2>Dati e materiali che carichi</h2>
      <p>
        Dichiari di avere il diritto di inserire e caricare i dati, i brief e
        i file (inclusi creatività e export da Ads Manager) che usi in
        Affianco, e di non violare diritti di terzi o regole delle piattaforme
        pubblicitarie.
      </p>

      <h2>Account e sicurezza</h2>
      <p>
        Sei responsabile delle credenziali Affianco e dell&apos;uso del tuo
        account. Non condividere la password. Segnala un uso non autorizzato
        al recapito:{" "}
        <a
          className="text-[var(--accent)] underline-offset-2 hover:underline"
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>

      <h2>Disponibilità e modifiche</h2>
      <p>
        Il servizio può essere aggiornato, interrotto in parte o modificato
        per manutenzione o evoluzione del prodotto. Non promettiamo
        disponibilità ininterrotta.
      </p>

      <h2>Cessazione e dati</h2>
      <p>
        Puoi smettere di usare Affianco in qualsiasi momento. Per la
        cancellazione dell&apos;account e la distinzione rispetto a una futura
        disconnessione Meta, vedi{" "}
        <a
          className="text-[var(--accent)] underline-offset-2 hover:underline"
          href="/eliminazione-dati"
        >
          Eliminazione dati
        </a>
        .
      </p>
    </PaginaLegale>
  );
}
