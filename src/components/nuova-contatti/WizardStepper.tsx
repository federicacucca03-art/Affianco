"use client";

import { WIZARD_STEPS, type WizardStep } from "@/lib/pre-lancio-check";

type Props = {
  step: WizardStep;
  onVaiAStep?: (step: WizardStep) => void;
  /** Override opzionale del titolo chip per singolo passo (es. INSTORE Step 3). */
  titoliOverride?: Partial<Record<WizardStep, string>>;
};

export function WizardStepper({
  step,
  onVaiAStep,
  titoliOverride,
}: Props) {
  return (
    <nav aria-label="Passaggi creazione campagna" className="w-full">
      <ol className="flex gap-1 overflow-x-auto">
        {WIZARD_STEPS.map((s) => {
          const attivo = s.id === step;
          const fatto = s.id < step;
          const cliccabile = Boolean(onVaiAStep) && (fatto || attivo);
          const titoloChip = titoliOverride?.[s.id] ?? s.titolo;
          return (
            <li key={s.id} className="min-w-[8rem] flex-1">
              <button
                type="button"
                disabled={!cliccabile}
                onClick={() => onVaiAStep?.(s.id)}
                className={`flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-left transition-all ${
                  attivo
                    ? "bg-white shadow-[var(--shadow-card)]"
                    : fatto
                      ? "bg-white/35 hover:bg-white/55"
                      : "bg-transparent"
                } ${cliccabile ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    attivo
                      ? "bg-[var(--primary)] text-white"
                      : fatto
                        ? "bg-[var(--green-soft)] text-[#2d6a4a]"
                        : "bg-white/50 text-[var(--ink-muted)]"
                  }`}
                >
                  {fatto ? "✓" : s.id}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[11px] font-medium ${
                      attivo
                        ? "text-[var(--primary)]"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    Passo {s.id}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[13px] font-medium ${
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
