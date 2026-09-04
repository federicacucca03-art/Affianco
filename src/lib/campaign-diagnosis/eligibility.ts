/**
 * Deterministic eligibility for M6C AI diagnosis.
 * No LLM. Historical AI deferred (eligibility only).
 *
 * M6C.2: AI only when there is something to interpret —
 * not for obvious admin/status rows (revision-only, draft, etc.).
 */

import type { AttentionState, AttentionTrend } from "@/lib/monday-control-room";
import type { HealthStatus } from "@/lib/control-room";
import type {
  DiagnosisAiConfidence,
  DiagnosisEligibility,
  DiagnosisLikelyArea,
} from "@/lib/campaign-diagnosis/types";

export type EligibilityInput = {
  attentionState: AttentionState;
  health: HealthStatus | null;
  campaignStatus: string | null | undefined;
  /** Meta healthAvailability when known. */
  healthAvailability?: string | null;
  trend?: AttentionTrend;
  /** Optional performance signals for interpretation eligibility. */
  actualValue?: number | null;
  targetValue?: number | null;
  spend?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  frequency?: number | null;
};

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/**
 * True when Ally has enough performance signal for AI interpretation
 * (not mere restatement of an admin status).
 */
export function hasMeaningfulPerformanceSignals(
  input: EligibilityInput,
): boolean {
  const healthEvaluable =
    input.health === "RED" ||
    input.health === "YELLOW" ||
    input.health === "GREEN";
  const hasTargetPair =
    input.actualValue != null &&
    Number.isFinite(input.actualValue) &&
    input.targetValue != null &&
    Number.isFinite(input.targetValue);
  const hasTraffic =
    input.ctr != null ||
    input.cpc != null ||
    input.cpm != null ||
    input.frequency != null;
  const hasSpend = input.spend != null && input.spend > 0;
  const trendKnown =
    input.trend === "IMPROVING" ||
    input.trend === "WORSENING" ||
    input.trend === "STABLE";

  if (hasTargetPair && healthEvaluable) return true;
  if (healthEvaluable && (hasTraffic || hasSpend)) return true;
  if (hasTargetPair && (hasTraffic || trendKnown || hasSpend)) return true;
  if (healthEvaluable && trendKnown) return true;
  return false;
}

/**
 * Decide whether AI may be called.
 * Configuration / insufficient data / drafts / revision-only never call the model.
 */
export function resolveDiagnosisEligibility(
  input: EligibilityInput,
): DiagnosisEligibility {
  if (input.attentionState === "HISTORICAL") {
    return "AI_DIAGNOSIS_HISTORICAL";
  }

  if (statusUpper(input.campaignStatus) === "DRAFT") {
    return "AI_DIAGNOSIS_NOT_NEEDED";
  }

  const availability = (input.healthAvailability ?? "").toUpperCase();
  if (
    availability === "TARGET_REQUIRED" ||
    availability === "RESULT_MAPPING_REQUIRED" ||
    availability === "LINKED_BUT_KPI_INCOMPATIBLE" ||
    availability === "ROAS_DEFERRED"
  ) {
    return "AI_DIAGNOSIS_BLOCKED_CONFIGURATION";
  }

  if (input.attentionState === "CONFIGURATION_REQUIRED") {
    return "AI_DIAGNOSIS_BLOCKED_CONFIGURATION";
  }

  if (
    input.attentionState === "INSUFFICIENT_DATA" ||
    input.health === "INSUFFICIENT" ||
    availability === "INSUFFICIENT_DATA"
  ) {
    return "AI_DIAGNOSIS_BLOCKED_INSUFFICIENT_DATA";
  }

  if (input.attentionState === "STABLE") {
    return "AI_DIAGNOSIS_NOT_NEEDED";
  }

  // Client revision without performance signals: deterministic copy is enough.
  if (
    statusUpper(input.campaignStatus) === "REVISION_REQUESTED" &&
    !hasMeaningfulPerformanceSignals(input)
  ) {
    return "AI_DIAGNOSIS_NOT_NEEDED";
  }

  if (
    input.attentionState === "CRITICAL" ||
    input.attentionState === "NEEDS_ATTENTION" ||
    input.attentionState === "MONITOR"
  ) {
    if (!hasMeaningfulPerformanceSignals(input)) {
      return "AI_DIAGNOSIS_NOT_NEEDED";
    }
    return "AI_DIAGNOSIS_AVAILABLE";
  }

  return "AI_DIAGNOSIS_NOT_NEEDED";
}

export function isDiagnosisUiEligible(
  eligibility: DiagnosisEligibility,
): boolean {
  return eligibility === "AI_DIAGNOSIS_AVAILABLE";
}

export function etichettaLikelyArea(area: DiagnosisLikelyArea): string {
  switch (area) {
    case "CREATIVE":
      return "Creatività";
    case "TRAFFIC_COST":
      return "Costo del traffico";
    case "POST_CLICK":
      return "Dopo il clic";
    case "TRACKING":
      return "Tracciamento";
    case "DELIVERY":
      return "Distribuzione";
    case "RESULT_QUALITY":
      return "Qualità dei risultati";
    case "UNKNOWN":
      return "Non chiaro";
  }
}

export function etichettaConfidence(c: DiagnosisAiConfidence): string {
  switch (c) {
    case "HIGH":
      return "Alta";
    case "MEDIUM":
      return "Media";
    case "LOW":
      return "Bassa";
  }
}
