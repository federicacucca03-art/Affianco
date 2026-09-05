import type { Metadata } from "next";
import { PaginaLegale } from "@/components/legal/PaginaLegale";
import {
  LEGAL_ADDRESS,
  LEGAL_CONTACT_EMAIL,
  LEGAL_SITE_URL,
  LEGAL_VAT_ID,
  titolareTrattamento,
} from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Privacy — Ally",
  description:
    "Informazioni sul trattamento dei dati in Ally: account, campagne, creatività, funzioni AI e futura integrazione Meta.",
};

export default function PaginaPrivacy() {
  return (
    <PaginaLegale
      titolo="Informativa privacy"
      aggiornamento="Testo riferito al prodotto attuale. Non descrive un collegamento Meta già attivo."
    >
      <p>
        Ally è un software di supporto al lavoro sulle campagne
        pubblicitarie. Questa pagina spiega quali dati trattiamo per erogare il
        servizio oggi, in modo proporzionato alle funzioni che usi.
      </p>

      <h2>Titolare e contatti</h2>
      <p>
        Titolare del trattamento: {titolareTrattamento()}. Sede:{" "}
        {LEGAL_ADDRESS}. Partita IVA: {LEGAL_VAT_ID}.
      </p>
      <p>
        Per richieste su privacy o cancellazione dati:{" "}
        <a
          className="text-[var(--accent)] underline-offset-2 hover:underline"
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
      <p>
        Sito di riferimento: {LEGAL_SITE_URL}.
      </p>

      <h2>Principio di minimizzazione</h2>
      <p>
        Ally tratta i dati necessari a fornire le funzioni che richiedi
        (account, pianificazione campagne, clienti, creatività, analisi e
        export). Non dichiariamo di raccogliere dati che il prodotto non usa.
      </p>

      <h2>Dati trattati oggi</h2>
      <ul>
        <li>
          <strong>Account e autenticazione.</strong> Email e credenziali gestite
          tramite il servizio di autenticazione (Supabase). Ally non chiede
          la password del tuo account Meta.
        </li>
        <li>
          <strong>Clienti e campagne.</strong> Informazioni che inserisci tu:
          anagrafica cliente, brief, obiettivi, budget, copy, targeting di
          pianificazione e altri campi del wizard.
        </li>
        <li>
          <strong>Risultati di campagna.</strong> Dati di performance che
          carichi tu (ad esempio screenshot o file CSV da Ads Manager), usati
          per salute, trend e diagnosi nel workspace.
        </li>
        <li>
          <strong>Creatività.</strong> File immagine che carichi, conservati per
          mostrare e associare gli asset alle campagne.
        </li>
        <li>
          <strong>Funzioni AI.</strong> Quando usi una funzione di generazione o
          analisi (copy, creatività, screenshot, brief), i contenuti che invii
          in quella richiesta possono essere trasmessi a un fornitore di
          servizi di intelligenza artificiale (attualmente Anthropic) per
          produrre la risposta. Non indichiamo tempi di conservazione o impegni
          contrattuali del fornitore che non risultano da questa applicazione.
        </li>
        <li>
          <strong>Dati tecnici.</strong> Quanto necessario al funzionamento
          (sessione di accesso, log di errore senza segreti). Non operiamo un
          tracciamento pubblicitario di terze parti descritto in questo
          prodotto.
        </li>
      </ul>

      <h2>Quando l&apos;integrazione Meta sarà attivata</h2>
      <p>
        Oggi Ally non collega l&apos;account pubblicitario Meta e non
        memorizza token di accesso Marketing API. L&apos;export CSV è uno
        strumento di bozza da completare in Ads Manager.
      </p>
      <p>
        Quando l&apos;integrazione Meta sarà attivata, il collegamento sarà
        volontario (un&apos;azione esplicita dell&apos;utente). Ally
        richiederà solo i dati necessari alla funzione prevista: selezione
        dell&apos;account pubblicitario e importazione di struttura campagne e
        metriche in lettura. Non raccoglieremo la password dell&apos;account
        Meta. Potrai disconnettere l&apos;integrazione. Le modalità esatte di
        conservazione delle credenziali di connessione saranno descritte quando
        quella funzione esisterà.
      </p>

      <h2>Finalità</h2>
      <p>
        I dati servono a farti usare Ally: autenticarti, salvare il lavoro
        su clienti e campagne, mostrare creatività, calcolare indicatori a
        partire da ciò che carichi, e — se le attivi — eseguire le funzioni AI.
      </p>

      <h2>Conservazione e destinatari</h2>
      <p>
        I dati del workspace restano associati al tuo account finché l&apos;account
        è attivo, salvo cancellazione descritta in{" "}
        <a className="text-[var(--accent)] underline-offset-2 hover:underline" href="/eliminazione-dati">
          Eliminazione dati
        </a>
        . Infrastruttura attuale: hosting dell&apos;applicazione e database di
        autenticazione/dati (Supabase); fornitore AI quando invochi quelle
        funzioni.
      </p>

      <h2>Diritti e richieste</h2>
      <p>
        Puoi chiedere informazioni, rettifica o cancellazione dei dati del
        tuo account usando il recapito indicato sopra. Oggi non esiste un
        pulsante di auto-cancellazione dell&apos;account in prodotto: le
        istruzioni operative sono nella pagina Eliminazione dati.
      </p>
    </PaginaLegale>
  );
}
