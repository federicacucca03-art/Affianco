"use client";

/**
 * ADV.2.1 / ADV.2.3 — Read-only “Cosa pubblicherà Ally?”
 * From MetaExecutionPlan (+ optional MetaWritePlan operation summary).
 * No raw Graph JSON. No mutations.
 */

import type { MetaExecutionPlan } from "@/lib/meta/execution-plan/types";
import { executionPlanFacileHeadline } from "@/lib/meta/execution-plan/guardian-v2";
import type { MetaWritePlan } from "@/lib/meta/write-plan/types";

type Props = {
  plan: MetaExecutionPlan | null | undefined;
  writePlan?: MetaWritePlan | null;
  /** Pro may show technical objective / opt codes. */
  mode?: "facile" | "pro";
};

export function MetaExecutionPreviewView({
  plan,
  writePlan,
  mode = "facile",
}: Props) {
  if (!plan) return null;

  const blockers = plan.issues.filter((i) => i.severity === "BLOCKER");
  const warnings = plan.issues.filter((i) => i.severity === "WARNING");

  return (
    <div className="rounded-[12px] border border-[var(--border)] px-4 py-3 space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--primary)]">
          Cosa pubblicherà Ally?
        </p>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
          {executionPlanFacileHeadline(plan)}
        </p>
      </div>

      <ul className="space-y-1 text-[14px] text-[var(--ink)]">
        {plan.preview.linesIt.map((line) => (
          <li key={line}>· {line}</li>
        ))}
      </ul>

      {writePlan ? (
        <p
          className="text-[13px] text-[var(--ink)]"
          data-testid="write-plan-ops-summary"
        >
          {writePlan.preview.campaignCount} campagna ·{" "}
          {writePlan.preview.adSetCount}{" "}
          {writePlan.preview.adSetCount === 1
            ? "gruppo di inserzioni"
            : "gruppi di inserzioni"}{" "}
          · {writePlan.preview.creativeCount}{" "}
          {writePlan.preview.creativeCount === 1 ? "creatività" : "creatività"} ·{" "}
          {writePlan.preview.adCount}{" "}
          {writePlan.preview.adCount === 1 ? "inserzione" : "inserzioni"}
          {writePlan.preview.dependencyCreateCount
            ? ` · ${writePlan.preview.dependencyCreateCount} dipendenze da risolvere`
            : ""}
        </p>
      ) : null}

      {writePlan?.preview.dependencyLinesIt?.length ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            Dipendenze
          </p>
          <ul className="space-y-1 text-[13px] text-[var(--ink)]">
            {writePlan.preview.dependencyLinesIt.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {mode === "pro" ? (
        <div className="space-y-1 text-[12px] text-[var(--ink-muted)]">
          <p>
            {plan.metaObjective}
            {plan.optimizationGoal ? ` · ${plan.optimizationGoal}` : ""}
            {plan.conversionEvent ? ` · ${plan.conversionEvent}` : ""}
            {" · "}
            capability={plan.executionCapability}
            {" · "}
            ready={plan.executionReady ? "yes" : "no"}
          </p>
          {writePlan ? (
            <p data-testid="write-plan-tech-summary">
              writeReady={writePlan.readyForExecution ? "yes" : "no"}
              {" · "}
              structural={writePlan.structurallyReady ? "yes" : "no"}
              {" · "}
              gate=OFF
              {" · "}
              status={writePlan.campaignOperation?.initialStatus ?? "PAUSED"}
            </p>
          ) : null}
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            Blocchi
          </p>
          <ul className="space-y-1 text-[13px] text-[var(--ink)]">
            {blockers.slice(0, 6).map((b) => (
              <li key={`${b.code}-${b.entityId ?? "plan"}`}>
                {b.messageIt}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 && mode === "pro" ? (
        <p className="text-[12px] text-[var(--ink-muted)]">
          Avvisi: {warnings.length}
        </p>
      ) : null}
    </div>
  );
}
