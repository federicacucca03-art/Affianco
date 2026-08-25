import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { MockApprovazioneCliente } from "@/components/landing/mock/MockApprovazioneCliente";

export function LandingApprovazione() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <LandingSectionHeader
        eyebrow="Approvazione cliente"
        titolo="Basta “Hai visto il messaggio che ti ho mandato?”"
        descrizione="Prepara la campagna, condividi un link e fai vedere al cliente esattamente cosa verrà pubblicato."
      />

      <div className="mt-10">
        <MockApprovazioneCliente />
        <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
          Una sola versione. Una sola approvazione. Tutto tracciato.
        </p>
      </div>
    </section>
  );
}
