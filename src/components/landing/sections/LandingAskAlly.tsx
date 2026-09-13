import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockAskAlly } from "@/components/landing/mock/MockAskAlly";

export function LandingAskAlly() {
  return (
    <section id="ask-ally" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Nel contesto"
            titolo="Quando vuoi andare più a fondo, chiedi ad Ally."
            descrizione="Il contesto del cliente, della campagna e dei dati è già disponibile. Non devi ricostruirlo ogni volta in una nuova chat."
          />
          <p className="mt-6 text-sm font-medium text-[var(--ink)]">
            Fatti, ipotesi e informazioni mancanti rimangono separati.
          </p>
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockAskAlly />
        </div>
      </div>
    </section>
  );
}
