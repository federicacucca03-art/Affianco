import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockEconomiaCard } from "@/components/landing/mock/MockEconomiaCard";

export function LandingSostenibilita() {
  return (
    <section id="economia" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Contesto economico"
            titolo="Un CPL da solo non ti dice se la campagna sta funzionando."
            descrizione="I risultati vengono collegati all'economia del cliente. Ticket, margine e conversione diventano soglie di riferimento per capire quando una campagna è sostenibile e quando invece va monitorata."
          />
          <p className="mt-6 max-w-lg rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm leading-relaxed text-[var(--ink-muted)]">
            Le soglie sono calcolate sui dati inseriti. Non sono benchmark
            inventati né previsioni certe.
          </p>
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockEconomiaCard />
        </div>
      </div>
    </section>
  );
}
