import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockStoricoCliente } from "@/components/landing/mock/MockStoricoCliente";

export function LandingStoricoCliente() {
  return (
    <section
      id="memoria"
      className="border-y border-[var(--border)] bg-white"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Contesto nel tempo"
            titolo="Non riparti da zero ogni volta."
            descrizione="Cliente, campagne, approvazioni, risultati e decisioni restano collegati nel tempo. Quando torni su un cliente, ritrovi il contesto necessario per capire cosa è stato fatto e cosa sta succedendo adesso."
          />
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockStoricoCliente />
        </div>
      </div>
    </section>
  );
}
