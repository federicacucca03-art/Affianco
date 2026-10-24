/**
 * ADV.2.1 — Map MetaExecutionPlan issues into Pre-Write Guardian checks.
 * Never deletes unsupported V2 state. LIVE META WRITES: 0
 */

import type { MetaExecutionPlan, ExecutionIssue } from "@/lib/meta/execution-plan/types";
import type {
  PreWriteEditTarget,
  PreWriteGuardianCheck,
} from "@/lib/meta/launch-guardian/prewrite-types";

export const EXECUTION_GUARDIAN_ISSUE = {
  PIXEL_REQUIRED: "EXEC.PIXEL_REQUIRED",
  APP_ID_REQUIRED: "EXEC.APP_ID_REQUIRED",
  FORM_REQUIRED: "EXEC.FORM_REQUIRED",
  PAGE_REQUIRED: "EXEC.PAGE_REQUIRED",
  CUSTOM_AUDIENCE_UNRESOLVED: "EXEC.CUSTOM_AUDIENCE_UNRESOLVED",
  LOOKALIKE_UNRESOLVED: "EXEC.LOOKALIKE_UNRESOLVED",
  BUDGET_SPLIT_UNRESOLVED: "EXEC.BUDGET_SPLIT_UNRESOLVED",
  DESTINATION_URL_REQUIRED: "EXEC.DESTINATION_URL_REQUIRED",
  CREATIVE_REQUIRED: "EXEC.CREATIVE_REQUIRED",
  CTA_UNSUPPORTED: "EXEC.CTA_UNSUPPORTED",
  PLACEMENT_MANUAL_NOT_WRITABLE: "EXEC.PLACEMENT_MANUAL_NOT_WRITABLE",
  PLACEMENT_UNSUPPORTED: "EXEC.PLACEMENT_UNSUPPORTED",
  OBJECTIVE_NOT_EXECUTABLE: "EXEC.OBJECTIVE_NOT_EXECUTABLE",
  DESTINATION_NOT_EXECUTABLE: "EXEC.DESTINATION_NOT_EXECUTABLE",
  OPTIMIZATION_UNSUPPORTED: "EXEC.OPTIMIZATION_UNSUPPORTED",
  INVALID_CONFIGURATION: "EXEC.INVALID_CONFIGURATION",
} as const;

function editTargetFor(code: ExecutionIssue["code"]): PreWriteEditTarget {
  switch (code) {
    case "PIXEL_REQUIRED":
    case "TRACKING_UNRESOLVED":
      return "tracking";
    case "FORM_REQUIRED":
      return "modulo";
    case "PAGE_REQUIRED":
    case "IDENTITY_REQUIRED":
      return "identita";
    case "CUSTOM_AUDIENCE_UNRESOLVED":
    case "LOOKALIKE_UNRESOLVED":
      return "pubblico";
    case "BUDGET_SPLIT_UNRESOLVED":
      return "budget";
    case "DESTINATION_URL_REQUIRED":
      return "review";
    case "CREATIVE_REQUIRED":
      return "annuncio";
    case "OBJECTIVE_NOT_EXECUTABLE":
    case "DESTINATION_NOT_EXECUTABLE":
      return "obiettivo";
    default:
      return "review";
  }
}

function titleFor(code: ExecutionIssue["code"]): string {
  switch (code) {
    case "PIXEL_REQUIRED":
      return "Pixel obbligatorio";
    case "APP_ID_REQUIRED":
      return "App non collegata";
    case "FORM_REQUIRED":
      return "Modulo Instant Form mancante";
    case "PAGE_REQUIRED":
      return "Pagina Facebook mancante";
    case "CUSTOM_AUDIENCE_UNRESOLVED":
      return "Pubblico di retargeting non risolto";
    case "LOOKALIKE_UNRESOLVED":
      return "Lookalike non risolto";
    case "BUDGET_SPLIT_UNRESOLVED":
      return "Ripartizione budget non definita";
    case "DESTINATION_URL_REQUIRED":
      return "URL destinazione mancante";
    case "CREATIVE_REQUIRED":
      return "Creatività incompleta";
    case "CTA_UNSUPPORTED":
      return "CTA non supportata";
    case "PLACEMENT_MANUAL_NOT_WRITABLE":
      return "Posizionamenti manuali non pubblicabili";
    case "PLACEMENT_UNSUPPORTED":
      return "Posizionamenti non supportati";
    case "OBJECTIVE_NOT_EXECUTABLE":
      return "Obiettivo non eseguibile";
    case "DESTINATION_NOT_EXECUTABLE":
      return "Destinazione non eseguibile";
    case "OPTIMIZATION_UNSUPPORTED":
      return "Ottimizzazione non supportata";
    default:
      return "Requisito esecuzione";
  }
}

export function executionIssuesToGuardianChecks(
  plan: MetaExecutionPlan,
): PreWriteGuardianCheck[] {
  return plan.issues.map((iss) => {
    const id =
      EXECUTION_GUARDIAN_ISSUE[
        iss.code as keyof typeof EXECUTION_GUARDIAN_ISSUE
      ] ?? `EXEC.${iss.code}`;
    const isBlocker = iss.severity === "BLOCKER";
    return {
      id: iss.entityId ? `${id}.${iss.entityId}` : id,
      scope: iss.entityKind === "adset" ? "AD_SET" : "EXECUTION",
      status: isBlocker ? "FAIL" : "WARN",
      bucket: isBlocker ? "BLOCKERS" : "WARNINGS",
      title: titleFor(iss.code),
      userMessage: iss.messageIt,
      technicalReason: iss.messagePro ?? iss.code,
      editTarget: editTargetFor(iss.code),
    };
  });
}

/**
 * Merge execution-plan checks into an existing Guardian result without
 * dropping prior checks or unsupported design state.
 */
export function mergeExecutionPlanIntoGuardianChecks(
  existing: PreWriteGuardianCheck[],
  plan: MetaExecutionPlan,
): PreWriteGuardianCheck[] {
  const seen = new Set(existing.map((c) => c.id));
  const merged = [...existing];
  for (const c of executionIssuesToGuardianChecks(plan)) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }
  return merged;
}

/** Facile one-liner for execution preview. */
export function executionPlanFacileHeadline(plan: MetaExecutionPlan): string {
  if (plan.executionReady) {
    return "Questo è ciò che Ally pubblicherebbe su Meta (ancora in dry-run).";
  }
  const n = plan.issues.filter((i) => i.severity === "BLOCKER").length;
  return n > 0
    ? `Piano di esecuzione con ${n} blocco/i da risolvere — il design resta intatto.`
    : "Piano di esecuzione parziale — design preservato.";
}
