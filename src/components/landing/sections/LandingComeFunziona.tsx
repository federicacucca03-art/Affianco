import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const PASSI = [
  {
    n: "01",
    titolo: "Pianifica",
    testo:
      "Parti dal brief o dal cliente. Organizza obiettivo, offerta, pubblico, economia e informazioni principali.",
  },
  {
    n: "02",
    titolo: "Prepara",
    testo:
      "Costruisci messaggio, copy e creatività. Controlla coerenza e configurazione prima di spendere.",
  },
  {
    n: "03",
    titolo: "Approva",
    testo:
      "Condividi la campagna con il cliente e tieni traccia di approvazioni e revisioni.",
  },
  {
    n: "04",
    titolo: "Monitora",
    testo:
      "Collega Meta e porta performance e contesto nello stesso workspace.",
  },
  {
    n: "05",
    titolo: "Decidi",
    testo:
      "Distingui ciò che è stabile, da monitorare o richiede attenzione.",
  },
  {
    n: "06",
    titolo: "Migliora",
    testo:
      "Capisci cosa sta succedendo e qual è la prossima azione sensata.",
  },
] as const;

export function LandingComeFunziona() {
  return (
    <section id="come-funziona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <LandingSectionHeader
        eyebrow="Come funziona"
        titolo="Un unico flusso. Dal brief alla prossima decisione."
      />

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PASSI.map((passo) => (
          <li
            key={passo.n}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <p className="text-xs font-medium text-[var(--accent)]">{passo.n}</p>
            <h3 className="mt-2 text-lg font-medium uppercase tracking-wide text-[var(--ink)]">
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
