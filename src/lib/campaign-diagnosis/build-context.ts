/**
 * Build sanitized AI payload + facts from Control Room / monitoring signals.
 * Pure — no DB, no secrets.
 */

import type {
  AttentionState,
  AttentionTrend,
  UrgencyLevel,
} from "@/lib/monday-control-room";
import type { HealthStatus } from "@/lib/control-room";
import type {
  CampaignDiagnosisAiPayload,
  CampaignDiagnosisFacts,
  DiagnosisSource,
} from "@/lib/campaign-diagnosis/types";

export type BuildDiagnosisContextInput = {
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
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  results: number | null;
  trend: AttentionTrend;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null;
  maxSustainableCpa: number | null;
  dailyBudget: number | null;
  targetMargin: number | null;
  offer: string | null;
  settore: string | null;
  audienceHint: string | null;
  hasCreativeAsset: boolean;
  formatHint: string | null;
};

export function buildDiagnosisFacts(
  input: BuildDiagnosisContextInput,
): CampaignDiagnosisFacts {
  return {
    primaryKpi: input.primaryKpi,
    actualValue: input.actualValue,
    targetValue: input.targetValue,
    health: input.health,
    attentionState: input.attentionState,
    urgencyLevel: input.urgencyLevel,
    trend: input.trend,
    spend: input.spend,
    impressions: input.impressions,
    linkClicks: input.linkClicks,
    ctr: input.ctr,
    cpc: input.cpc,
    cpm: input.cpm,
    frequency: input.frequency,
    results: input.results,
  };
}

/** Whitelist only — never pass raw DB rows. */
export function buildDiagnosisAiPayload(
  input: BuildDiagnosisContextInput,
): CampaignDiagnosisAiPayload {
  return {
    source: input.source,
    objective: input.objective,
    status: input.status,
    monitoringMode: input.monitoringMode,
    health: input.health,
    attentionState: input.attentionState,
    urgencyLevel: input.urgencyLevel,
    attentionReason: input.attentionReason,
    primaryKpi: input.primaryKpi,
    actualValue: input.actualValue,
    targetValue: input.targetValue,
    metrics: {
      spend: input.spend,
      impressions: input.impressions,
      linkClicks: input.linkClicks,
      ctr: input.ctr,
      cpc: input.cpc,
      cpm: input.cpm,
      frequency: input.frequency,
      results: input.results,
    },
    trend: input.trend,
    resultMappingConfidence: input.resultMappingConfidence,
    economics: {
      maxSustainableCpa: input.maxSustainableCpa,
      dailyBudget: input.dailyBudget,
      targetMargin: input.targetMargin,
    },
    campaignPlan: {
      objective: input.objective,
      offer: input.offer,
      settore: input.settore,
      audienceHint: input.audienceHint,
    },
    creativeContext: {
      hasCreativeAsset: input.hasCreativeAsset,
      formatHint: input.formatHint,
    },
  };
}

/** Assert payload keys never include forbidden secrets. */
export function assertPayloadMinimized(payload: CampaignDiagnosisAiPayload): void {
  const blob = JSON.stringify(payload).toLowerCase();
  const forbidden = [
    "access_token",
    "authorization",
    "api_key",
    "apikey",
    "service_role",
    "approval_token",
    "password",
    "bearer ",
    "encrypted",
  ];
  for (const f of forbidden) {
    if (blob.includes(f)) {
      throw new Error(`Payload non sicuro: ${f}`);
    }
  }
}
