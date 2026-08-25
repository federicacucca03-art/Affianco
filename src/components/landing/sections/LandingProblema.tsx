import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const FLUSSO = [
  "Meta Ads Manager",
  "Excel",
  "ChatGPT",
  "WhatsApp",
  "Drive",
  "Report",
];

export function LandingProblema() {
  return (
    <section id="problema" className="border-y border-[var(--border)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <LandingSectionHeader
          eyebrow="Il problema"
          titolo="Gestire le Meta Ads non è solo premere “Pubblica”."
          descrizione="Per ogni cliente devi capire quanto puoi realmente spendere, definire l'offerta, preparare copy e creatività, ottenere approvazioni, configurare la campagna, controllare i risultati e spiegare tutto al cliente."
        />

        <div className="mt-10 flex flex-col items-center">
          <div className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-6 shadow-[var(--shadow-soft)]">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Il flusso frammentato di oggi
            </p>
            <ol className="mt-5 space-y-0">
              {FLUSSO.map((step, i) => (
                <li key={step} className="flex flex-col items-center">
                  <span className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-medium text-[var(--ink)]">
                    {step}
                  </span>
                  {i < FLUSSO.length - 1 ? (
                    <span
                      className="my-1 text-lg leading-none text-[var(--ink-muted)]"
                      aria-hidden
                    >
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-10 max-w-xl text-center text-2xl font-medium tracking-tight text-[var(--ink)] sm:text-3xl">
            Affianco mette ordine in tutto questo.
          </p>
        </div>
      </div>
    </section>
  );
}
