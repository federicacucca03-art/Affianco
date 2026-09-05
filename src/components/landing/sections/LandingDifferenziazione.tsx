import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const COLONNE = [
  {
    titolo: "Prima",
    punti: [
      "Strategia",
      "Economia",
      "Copy",
      "Creatività",
      "Pre-flight check",
    ],
  },
  {
    titolo: "Durante",
    punti: ["Approvazione", "Preparazione", "Lancio", "Controllo"],
  },
  {
    titolo: "Dopo",
    punti: ["Risultati", "Diagnosi", "Storico", "Decisioni"],
  },
];

export function LandingDifferenziazione() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <LandingSectionHeader
        eyebrow="Posizionamento"
        titolo="Ally non sostituisce Meta Ads Manager."
        descrizione="Organizza tutto il lavoro che succede prima, durante e dopo la campagna."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {COLONNE.map((colonna) => (
          <article
            key={colonna.titolo}
            className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <h3 className="text-sm font-medium uppercase tracking-[0.1em] text-[var(--ink)]">
              {colonna.titolo}
            </h3>
            <ul className="mt-4 space-y-2">
              {colonna.punti.map((punto) => (
                <li
                  key={punto}
                  className="flex items-center gap-2 text-sm text-[var(--ink-muted)]"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                  {punto}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
