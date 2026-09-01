"use client";

import { WIZARD_STEPS, type WizardStep } from "@/lib/pre-lancio-check";

type Props = {
  step: WizardStep;
  onVaiAStep?: (step: WizardStep) => void;
  /** Override opzionale del titolo chip per singolo passo (es. INSTORE Step 3). */
  titoliOverride?: Partial<Record<WizardStep, string>>;
};

/** Titoli completi dello stepper — solo UI, non cambia WIZARD_STEPS. */
const TITOLI_STEPPER: Record<WizardStep, string> = {
  1: "Partiamo dal cliente",
  2: "Economia della campagna",
  3: "Messaggio e copy",
  4: "Studio creativo",
  5: "Diagnosi pre-lancio",
  6: "Campagna pronta",
};

function titoloStep(
  id: WizardStep,
  override?: Partial<Record<WizardStep, string>>,
): string {
  return override?.[id] ?? TITOLI_STEPPER[id];
}

function classiBottone(attivo: boolean, fatto: boolean, cliccabile: boolean) {
  return `flex w-full min-h-[4.25rem] items-start gap-2.5 rounded-[20px] px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
    attivo
      ? "bg-white shadow-[var(--shadow-card)]"
      : fatto
        ? "bg-white/80 hover:bg-white"
        : "bg-transparent"
  } ${cliccabile ? "cursor-pointer" : "cursor-default"}`;
}

function classiCerchio(attivo: boolean, fatto: boolean) {
  return `mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
    attivo
      ? "bg-[var(--primary)] text-white"
      : fatto
        ? "bg-[var(--green-soft)] text-[#2d6a4a]"
        : "bg-white text-[var(--ink-muted)]"
  }`;
}

export function WizardStepper({
  step,
  onVaiAStep,
  titoliOverride,
}: Props) {
  const titoloCorrente = titoloStep(step, titoliOverride);

  return (
    <nav aria-label="Passaggi creazione campagna" className="w-full">
      <div className="mb-3 px-1 md:hidden">
        <p className="text-[12px] font-medium text-[var(--primary)]">
          Passo {step} di {WIZARD_STEPS.length}
        </p>
        <p className="mt-1 text-[15px] font-medium leading-snug text-[var(--ink)]">
          {titoloCorrente}
        </p>
      </div>

      <ol className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 lg:grid-cols-6">
        {WIZARD_STEPS.map((s) => {
          const attivo = s.id === step;
          const fatto = s.id < step;
          const cliccabile = Boolean(onVaiAStep) && (fatto || attivo);
          const titoloChip = titoloStep(s.id, titoliOverride);
          return (
            <li
              key={s.id}
              className="w-[min(16.5rem,85vw)] shrink-0 snap-start md:w-auto md:min-w-0"
            >
              <button
                type="button"
                disabled={!cliccabile}
                onClick={() => onVaiAStep?.(s.id)}
                aria-current={attivo ? "step" : undefined}
                className={classiBottone(attivo, fatto, cliccabile)}
              >
                <span className={classiCerchio(attivo, fatto)}>
                  {fatto ? "✓" : s.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[12px] font-medium leading-tight ${
                      attivo
                        ? "text-[var(--primary)]"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    Passo {s.id}
                  </span>
                  <span
                    className={`mt-0.5 block text-[13px] font-medium leading-snug lg:text-[14px] ${
                      attivo ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {titoloChip}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
