import type { Metadata } from "next";
import { PaginaLegale } from "@/components/legal/PaginaLegale";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Eliminazione dati — Affianco",
  description:
    "Come richiedere la cancellazione dell'account Affianco e cosa succederà, in futuro, se disconnetti Meta.",
};

export default function PaginaEliminazioneDati() {
  return (
    <PaginaLegale
      titolo="Eliminazione dati"
      aggiornamento="Istruzioni attuali. La disconnessione Meta e l'auto-cancellazione account non sono funzioni disponibili oggi."
    >
      <p>
        Qui distinguiamo due cose diverse: (A) una futura disconnessione
        dell&apos;integrazione Meta, e (B) la richiesta di cancellare
        l&apos;account Affianco e i dati del workspace.
      </p>

      <h2>A. Integrazione Meta (futura)</h2>
      <p>
        Oggi non esiste un collegamento OAuth a Meta né un archivio di token
        Marketing API in Affianco.
      </p>
      <p>
        Quando la connessione Meta sarà disponibile, disconnetterla
        rimuoverà o revocherà le credenziali di connessione memorizzate,
        secondo il comportamento dell&apos;integrazione. Disconnettere
        Meta non equivale a cancellare l&apos;account Affianco: clienti,
        campagne e materiali che hai creato o importato nel workspace
        restano tuoi finché non chiedi la cancellazione dell&apos;account
        o non li elimini tu dalle funzioni di prodotto, se disponibili.
      </p>

      <h2>B. Account e dati Affianco (oggi)</h2>
      <p>
        Non c&apos;è ancora un flusso self-service per cancellare
        l&apos;intero account dall&apos;interfaccia. Per chiedere la
        cancellazione dei dati associati al tuo utente Affianco (account,
        clienti, campagne, creatività caricate, import di risultati),
        scrivi a:{" "}
        <a
          className="text-[var(--accent)] underline-offset-2 hover:underline"
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
      <p>
        Indica l&apos;email dell&apos;account Affianco e che chiedi la
        cancellazione.
      </p>

      <h2>Cosa non facciamo automaticamente</h2>
      <p>
        Logout (Esci) chiude la sessione: non cancella l&apos;account.
        L&apos;export CSV verso Ads Manager non crea un collegamento API e
        non implica una revoca di permessi Meta da parte di Affianco.
      </p>
    </PaginaLegale>
  );
}
