/**
 * M6C — Contextual AI diagnosis types (no persistence, no recommendations).
 */

import type { AttentionState, AttentionTrend, UrgencyLevel } from "@/lib/monday-control-room";
import type { HealthStatus } from "@/lib/control-room";

export type DiagnosisSource = "NATIVE" | "META";

export type DiagnosisEligibility =
  | "AI_DIAGNOSIS_AVAILABLE"
  | "AI_DIAGNOSIS_NOT_NEEDED"
  | "AI_DIAGNOSIS_BLOCKED_INSUFFICIENT_DATA"
  | "AI_DIAGNOSIS_BLOCKED_CONFIGURATION"
  | "AI_DIAGNOSIS_HISTORICAL";

export type DiagnosisLikelyArea =
  | "CREATIVE"
  | "TRAFFIC_COST"
  | "POST_CLICK"
  | "TRACKING"
  | "DELIVERY"
  | "RESULT_QUALITY"
  | "UNKNOWN";

export type DiagnosisAiConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Strict model output after validation + confidence cap. */
export type CampaignAiDiagnosis = {
  summary: string;
  likely_area: DiagnosisLikelyArea;
  confidence: DiagnosisAiConfidence;
  evidence: string[];
  uncertainty: string;
  what_not_to_conclude: string | null;
};

/** Deterministic facts shown beside AI interpretation — never from the model. */
export type CampaignDiagnosisFacts = {
  primaryKpi: string | null;
  actualValue: number | null;
  targetValue: number | null;
  health: HealthStatus | null;
  attentionState: AttentionState;
  urgencyLevel: UrgencyLevel;
  trend: AttentionTrend;
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  results: number | null;
};

/** Whitelisted payload sent to the model (no secrets, no client name required). */
export type CampaignDiagnosisAiPayload = {
  source: DiagnosisSource;
  objective: string | null;
  status: string | null;
  monitoringMode: "ACTIVE" | "HISTORICAL" | null;
  health: HealthStatus | null;
  attentionState: AttentionState;
  urgencyLevel: UrgencyLevel;
  attentionReason: string;
  primaryKpi: string | null;
  actualValue: number | null;
  targetValue: number | null;
  metrics: {
    spend: number | null;
    impressions: number | null;
    linkClicks: number | null;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    frequency: number | null;
    results: number | null;
  };
  trend: AttentionTrend;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null;
  economics: {
    maxSustainableCpa: number | null;
    dailyBudget: number | null;
    targetMargin: number | null;
  };
  campaignPlan: {
    objective: string | null;
    offer: string | null;
    settore: string | null;
    audienceHint: string | null;
  };
  creativeContext: {
    hasCreativeAsset: boolean;
    formatHint: string | null;
  };
};

export type CampaignDiagnosisResponse = {
  eligibility: DiagnosisEligibility;
  facts: CampaignDiagnosisFacts | null;
  diagnosis: CampaignAiDiagnosis | null;
  message: string | null;
};
