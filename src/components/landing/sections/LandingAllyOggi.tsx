import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockAllyOggi } from "@/components/landing/mock/MockAllyOggi";

export function LandingAllyOggi() {
  return (
    <section
      id="priorita"
      className="border-y border-[var(--border)] bg-[var(--surface-hover)]/40"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Priorità"
            titolo="Apri la dashboard e sai da dove iniziare."
            descrizione="Non devi controllare ogni campagna una per una. Le campagne vengono ordinate per priorità, così distingui ciò che richiede attenzione da ciò che può aspettare."
          />
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockAllyOggi />
        </div>
      </div>
    </section>
  );
}
