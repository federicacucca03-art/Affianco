import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const META = [
  "Campagne",
  "Ad set",
  "Annunci",
  "Budget",
  "Pubblicazione",
] as const;

const ALLY = [
  "Strategia",
  "Economia",
  "Approvazioni",
  "Controllo",
  "Diagnosi",
  "Prossima decisione",
] as const;

export function LandingDifferenziazione() {
  return (
    <section id="ally-vs-meta" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <LandingSectionHeader
        allineamento="centro"
        titolo="Ally non sostituisce Meta Ads Manager."
        descrizione="Meta gestisce le inserzioni. Qui organizzi il lavoro e le decisioni intorno alle inserzioni."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Meta Ads Manager
          </p>
          <ul className="mt-4 space-y-2.5">
            {META.map((item) => (
              <li key={item} className="text-sm text-[var(--ink)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-hover)] p-6 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            Ally
          </p>
          <ul className="mt-4 space-y-2.5">
            {ALLY.map((item) => (
              <li key={item} className="text-sm font-medium text-[var(--ink)]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
