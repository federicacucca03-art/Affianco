import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const PASSI = [
  {
    n: "01",
    titolo: "Parti dal cliente",
    testo:
      "Organizza obiettivo, settore, offerta, pubblico e informazioni principali.",
  },
  {
    n: "02",
    titolo: "Fai i conti prima di spendere",
    testo:
      "Inserisci valore medio, margine e tasso di chiusura. Ally calcola il CPL target e le soglie economiche della campagna.",
  },
  {
    n: "03",
    titolo: "Costruisci la campagna",
    testo:
      "Definisci messaggio, angoli comunicativi, copy e creatività.",
  },
  {
    n: "04",
    titolo: "Fai approvare tutto al cliente",
    testo:
      "Condividi un link pulito e fai approvare strategia, copy e creatività.",
  },
  {
    n: "05",
    titolo: "Porta la campagna su Meta",
    testo:
      "Prepara i dati della campagna per l'importazione in Meta Ads Manager.",
  },
  {
    n: "06",
    titolo: "Controlla cosa sta succedendo",
    testo:
      "Confronta i risultati con gli obiettivi economici e individua cosa richiede attenzione.",
  },
];

export function LandingComeFunziona() {
  return (
    <section id="come-funziona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <LandingSectionHeader
        eyebrow="Come funziona"
        titolo="Un unico flusso. Dalla prima idea ai risultati."
      />

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PASSI.map((passo) => (
          <li
            key={passo.n}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <p className="text-xs font-medium text-[var(--accent)]">{passo.n}</p>
            <h3 className="mt-2 text-lg font-medium text-[var(--ink)]">
              {passo.titolo}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
              {passo.testo}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
