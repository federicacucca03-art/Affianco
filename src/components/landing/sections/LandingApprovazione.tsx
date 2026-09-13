import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockApprovazioneCliente } from "@/components/landing/mock/MockApprovazioneCliente";

export function LandingApprovazione() {
  return (
    <section id="approvazione" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <LandingSectionHeader
            eyebrow="Approvazione cliente"
            titolo="Una campagna. Una versione approvata."
            descrizione="Condividi un link con strategia, copy e creatività. Il cliente può approvare o chiedere modifiche senza creare un account."
          />
          <p className="mt-6 text-sm font-medium leading-relaxed text-[var(--ink)]">
            Niente versioni sparse.
            <br />
            Niente dubbi su cosa è stato approvato.
          </p>
        </div>
        <div className="mx-auto w-full max-w-lg lg:max-w-none">
          <MockApprovazioneCliente />
        </div>
      </div>
    </section>
  );
}
