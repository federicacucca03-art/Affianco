import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockEconomiaCard } from "@/components/landing/mock/MockEconomiaCard";

export function LandingSostenibilita() {
  return (
    <section
      id="funzionalita"
      className="border-y border-[var(--border)] bg-[var(--background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <LandingSectionHeader
            eyebrow="Sostenibilità economica"
            titolo="Non guardare solo il CPL. Guarda se la campagna ha senso."
            descrizione={
              <>
                Un CPL non è buono o cattivo in assoluto. Dipende dal valore
                economico del cliente. Ally calcola una{" "}
                <strong className="font-medium text-[var(--ink)]">
                  soglia economica di riferimento
                </strong>{" "}
                basata sui dati inseriti — non una previsione certa.
              </>
            }
          />
          <MockEconomiaCard />
        </div>
      </div>
    </section>
  );
}
