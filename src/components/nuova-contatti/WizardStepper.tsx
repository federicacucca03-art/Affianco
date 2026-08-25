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
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-1">
        {WIZARD_STEPS.map((s) => {
          const attivo = s.id === step;
          const fatto = s.id < step;
          const cliccabile = Boolean(onVaiAStep) && (fatto || attivo);
          const titoloChip = titoliOverride?.[s.id] ?? s.titolo;
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!cliccabile}
                onClick={() => onVaiAStep?.(s.id)}
                className={`flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
                  attivo
                    ? "bg-[var(--accent-soft)]"
                    : fatto
                      ? "hover:bg-[var(--surface-hover)]"
                      : "opacity-55"
                } ${cliccabile ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    attivo
                      ? "bg-[var(--accent)] text-white"
                      : fatto
                        ? "bg-[#3D8B57] text-white"
                        : "bg-[#EEF0F3] text-[var(--ink-muted)]"
                  }`}
                >
                  {fatto ? "✓" : s.id}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[11px] font-medium uppercase tracking-wide ${
                      attivo
                        ? "text-[var(--accent)]"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    Passo {s.id}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-sm font-medium ${
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
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${(step / 6) * 100}%` }}
        />
      </div>
    </nav>
  );
}
