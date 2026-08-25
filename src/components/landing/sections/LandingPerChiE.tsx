import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const TARGET = [
  {
    titolo: "Freelance",
    testo:
      "Gestisci diversi clienti senza saltare continuamente tra strumenti.",
  },
  {
    titolo: "Media buyer",
    testo:
      "Standardizza il tuo processo e mantieni il controllo sulle performance.",
  },
  {
    titolo: "Micro-agenzie",
    testo:
      "Fai lavorare il team con un processo chiaro e riduci gli errori operativi.",
  },
];

export function LandingPerChiE() {
  return (
    <section
      id="per-chi-e"
      className="border-y border-[var(--border)] bg-[var(--background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <LandingSectionHeader
          eyebrow="Per chi è"
          titolo="Costruito per chi gestisce campagne per clienti."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {TARGET.map((item) => (
            <article
              key={item.titolo}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--accent)]">
                {item.titolo}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                {item.testo}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
