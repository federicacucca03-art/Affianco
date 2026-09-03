/**
 * Deterministic eligibility for M6C AI diagnosis.
 * No LLM. Historical AI deferred (eligibility only).
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
};

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/**
 * Decide whether AI may be called.
 * Configuration / insufficient data / drafts never call the model.
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

  if (
    input.attentionState === "CRITICAL" ||
    input.attentionState === "NEEDS_ATTENTION" ||
    input.attentionState === "MONITOR"
  ) {
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
      return "Tracking";
    case "DELIVERY":
      return "Erogazione";
    case "RESULT_QUALITY":
      return "Qualità risultato";
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
