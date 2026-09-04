"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { WIZARD_STEPS, type WizardStep } from "@/lib/pre-lancio-check";

type Props = {
  step: WizardStep;
  onVaiAStep?: (step: WizardStep) => void;
  /** Override opzionale (es. stato Step 6) — non cambia le label corte visibili. */
  titoliOverride?: Partial<Record<WizardStep, string>>;
};

/** Label corte, una sola riga — solo UI, non cambia WIZARD_STEPS. */
const TITOLI_STEPPER: Record<WizardStep, string> = {
  1: "Cliente",
  2: "Economia",
  3: "Messaggio",
  4: "Creatività",
  5: "Pre-lancio",
  6: "Pronta",
};

function titoloChip(id: WizardStep): string {
  return TITOLI_STEPPER[id];
}

export function WizardStepper({
  step,
  onVaiAStep,
  titoliOverride,
}: Props) {
  const correnteRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const el = correnteRef.current;
    const scroller = el?.parentElement;
    if (!el || !scroller) return;
    const left = el.offsetLeft - scroller.clientWidth / 2 + el.offsetWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [step]);

  return (
    <nav aria-label="Passaggi creazione campagna" className="w-full">
      <ol
        className="flex w-full snap-x snap-mandatory items-center gap-0.5 overflow-x-auto pb-0.5 lg:justify-between lg:gap-1 lg:overflow-visible lg:pb-0"
      >
        {WIZARD_STEPS.map((s) => {
          const attivo = s.id === step;
          const fatto = s.id < step;
          const cliccabile = Boolean(onVaiAStep) && (fatto || attivo);
          const label = titoloChip(s.id);
          const ariaExtra =
            s.id === 6 && titoliOverride?.[6]
              ? `, ${titoliOverride[6]}`
              : "";
          return (
            <li
              key={s.id}
              ref={attivo ? correnteRef : undefined}
              className="w-max shrink-0 snap-center"
            >
              <button
                type="button"
                disabled={!cliccabile}
                onClick={() => onVaiAStep?.(s.id)}
                aria-current={attivo ? "step" : undefined}
                aria-label={`Passo ${s.id}, ${label}${ariaExtra}`}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
                  attivo
                    ? "bg-white shadow-[var(--shadow-card)]"
                    : fatto
                      ? "bg-transparent hover:bg-white/70"
                      : "bg-transparent"
                } ${cliccabile ? "cursor-pointer" : "cursor-default"}`}
              >
                {fatto ? (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-[var(--ally-success)]"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                ) : attivo ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-medium text-white">
                    {s.id}
                  </span>
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-medium text-[var(--ink-muted)]">
                    {s.id}
                  </span>
                )}
                <span
                  className={`whitespace-nowrap text-[13px] font-medium leading-none ${
                    attivo
                      ? "text-[var(--ink)]"
                      : fatto
                        ? "text-[var(--ink)]"
                        : "text-[var(--ink-muted)]"
                  }`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
