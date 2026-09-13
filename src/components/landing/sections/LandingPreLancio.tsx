import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockPreLancio } from "@/components/landing/mock/MockPreLancio";

export function LandingPreLancio() {
  return (
    <section
      id="pre-lancio"
      className="border-y border-[var(--border)] bg-white"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Prima di spendere"
            titolo="Controlla la campagna prima che inizi a spendere."
            descrizione="Prima del lancio vengono controllati brief, targeting, copy, formati creativi e configurazione."
          />
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--ink-muted)]">
            Può anche segnalarti quando una creatività sembra poco coerente con
            la campagna, senza trasformare un suggerimento strategico in un
            falso blocco tecnico.
          </p>
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockPreLancio />
        </div>
      </div>
    </section>
  );
}
