"use client";

import { Check } from "lucide-react";
import type { AllyChecklistStep } from "@/lib/ally-setup";
import { AllyPanel } from "@/components/shell/AllyPanel";

type Props = {
  title?: string;
  steps: AllyChecklistStep[];
  completedCount: number;
  totalCount: number;
  className?: string;
};

/**
 * Compact orientation checklist — secondary to the main setup panel.
 * No CTA (avoids competing with the primary action).
 */
export function AllySetupChecklist({
  title = "Configura Ally",
  steps,
  completedCount,
  totalCount,
  className = "",
}: Props) {
  return (
    <AllyPanel
      variant="compact"
      className={`text-left ${className}`.trim()}
      as="section"
      aria-label={title}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] font-medium text-[var(--ink-muted)]">
          {title}
        </p>
        <p
          className="text-[11.5px] tabular-nums text-[var(--ink-muted)]"
          aria-live="polite"
        >
          {completedCount}/{totalCount}
        </p>
      </div>

      <ol className="mt-2.5 space-y-1.5">
        {steps.map((step) => {
          const isCurrent = step.current;
          return (
            <li
              key={step.id}
              className={[
                "flex items-start gap-2 text-[12.5px] leading-snug",
                step.done
                  ? "text-[var(--ink-muted)]"
                  : isCurrent
                    ? "font-medium text-[var(--ink)]"
                    : "text-[var(--ink-muted)]/75",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                  step.done
                    ? "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--ink-muted)]"
                    : isCurrent
                      ? "border-[var(--ink)] bg-white"
                      : "border-[var(--border-soft)] bg-transparent",
                ].join(" ")}
                aria-hidden
              >
                {step.done ? (
                  <Check className="h-2 w-2" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <span className="h-1 w-1 rounded-full bg-[var(--ink)]" />
                ) : null}
              </span>
              <span>
                {step.label}
                {step.done ? (
                  <span className="sr-only">, completato</span>
                ) : isCurrent ? (
                  <span className="sr-only">, passo corrente</span>
                ) : (
                  <span className="sr-only">, da fare</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </AllyPanel>
  );
}
