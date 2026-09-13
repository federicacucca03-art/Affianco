import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockControlRoom } from "@/components/landing/mock/MockControlRoom";

export function LandingControlRoom() {
  return (
    <section
      id="control-room"
      className="border-y border-[var(--border)] bg-[var(--surface-hover)]/40"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Monitoraggio"
            titolo="Non tutte le campagne meritano la tua attenzione oggi."
            descrizione="I risultati collegati a Meta distinguono ciò che è stabile da ciò che deve essere monitorato o richiede una decisione."
          />
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--ink-muted)]">
            E quando i dati non sono ancora sufficienti, te lo dice invece di
            forzare una conclusione.
          </p>
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockControlRoom />
        </div>
      </div>
    </section>
  );
}
