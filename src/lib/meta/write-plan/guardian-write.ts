/**
 * ADV.2.3 — Map MetaWritePlan readiness into Guardian checks.
 */

import type { MetaWritePlan } from "@/lib/meta/write-plan/types";
import type { PreWriteGuardianCheck } from "@/lib/meta/launch-guardian/prewrite-types";

export function writePlanToGuardianChecks(
  writePlan: MetaWritePlan,
): PreWriteGuardianCheck[] {
  const checks: PreWriteGuardianCheck[] = [];
  const seenCodes = new Set<string>();

  // Structural write blockers (ignore gate — gate is a separate PASS safety check)
  for (const b of writePlan.writeBlockers.slice(0, 12)) {
    if (seenCodes.has(b.code)) continue;
    seenCodes.add(b.code);
    checks.push({
      id: `WRITE.${b.code}`,
      scope: "EXECUTION",
      status: "FAIL",
      bucket: "BLOCKERS",
      title: "Blocco scrittura Meta",
      userMessage: b.messageIt,
      technicalReason: b.messagePro ?? b.code,
      editTarget: "review",
    });
  }

  checks.push({
    id: "WRITE.gate",
    scope: "SAFETY",
    status: "PASS",
    bucket: "PASSED",
    title: "Gate ADV.2.3",
    userMessage: writePlan.gate.reasonIt,
    technicalReason: `executionAllowed=${writePlan.gate.executionAllowed}; structurallyReady=${writePlan.structurallyReady}`,
    editTarget: null,
    provenance: "DEFAULT_SAFE",
  });

  checks.push({
    id: "WRITE.activation_separated",
    scope: "SAFETY",
    status: "PASS",
    bucket: "PASSED",
    title: "Attivazione separata",
    userMessage:
      "CREATE e ACTIVATE sono operazioni distinte. Nessuna attivazione in dry-run.",
    technicalReason: "ACTIVATE op modeled, executableWhenGated=false",
    editTarget: null,
    provenance: "DEFAULT_SAFE",
  });

  if (writePlan.adSetOperations.length > 1) {
    checks.push({
      id: "WRITE.multi_adset",
      scope: "AD_SET",
      status: "PASS",
      bucket: "PASSED",
      title: "Multi Ad Set",
      userMessage: `${writePlan.adSetOperations.length} operazioni Ad Set indipendenti.`,
      technicalReason: `adSetOps=${writePlan.adSetOperations.length}`,
      editTarget: null,
      provenance: "ALLY_DERIVED",
    });
  }

  return checks;
}

export function mergeWritePlanIntoGuardianChecks(
  existing: PreWriteGuardianCheck[],
  writePlan: MetaWritePlan,
): PreWriteGuardianCheck[] {
  const seen = new Set(existing.map((c) => c.id));
  const merged = [...existing];
  for (const c of writePlanToGuardianChecks(writePlan)) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }
  return merged;
}

export function isWritePlanGuardianReady(writePlan: MetaWritePlan): boolean {
  return writePlan.readyForExecution === true;
}
