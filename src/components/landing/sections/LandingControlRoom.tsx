import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockControlRoom } from "@/components/landing/mock/MockControlRoom";

export function LandingControlRoom() {
  return (
    <section className="border-y border-[var(--border)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <MockControlRoom />
          <LandingSectionHeader
            eyebrow="Control room"
            titolo="Ogni lunedì sai dove guardare."
            descrizione="Ally organizza i clienti in base allo stato delle campagne, così capisci subito dove intervenire. Cosa sta succedendo, perché, e cosa fare — senza aprire cinque strumenti diversi."
          />
        </div>
      </div>
    </section>
  );
}
