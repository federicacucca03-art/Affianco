import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const PROFILI = [
  {
    titolo: "Freelance / Consulenti",
    testo:
      "Gestisci più clienti e vuoi smettere di ricostruire ogni volta contesto, numeri e decisioni.",
  },
  {
    titolo: "Media buyer",
    testo:
      "Vuoi passare meno tempo a cercare cosa guardare e più tempo a decidere cosa fare.",
  },
  {
    titolo: "Micro-agenzie",
    testo:
      "Vuoi un processo condiviso tra strategia, approvazione, monitoraggio e prossime azioni.",
  },
];

export function LandingPerChiE() {
  return (
    <section
      id="per-chi-e"
      className="border-y border-[var(--border)] bg-[var(--surface-hover)]/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <LandingSectionHeader
          allineamento="centro"
          titolo="Costruito per chi gestisce campagne per altri."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PROFILI.map((p) => (
            <article
              key={p.titolo}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
            >
              <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
                {p.titolo}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                {p.testo}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
