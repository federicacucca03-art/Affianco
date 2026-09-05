import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockStoricoCliente } from "@/components/landing/mock/MockStoricoCliente";

export function LandingStoricoCliente() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <LandingSectionHeader
          eyebrow="Storico cliente"
          titolo="Ogni cliente costruisce una memoria."
          descrizione="Ally conserva campagne, risultati, approvazioni e decisioni nel tempo, così non riparti da zero ogni volta. Dal campaign-centric al client-centric."
        />
        <MockStoricoCliente />
      </div>
    </section>
  );
}
