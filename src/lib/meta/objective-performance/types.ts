/**
 * M10C — Objective-aware performance profiles (deterministic, read-only).
 * One authoritative mapping: Meta objective → how Ally interprets performance.
 * Does NOT invent CPL/ROAS. Does NOT write to Meta.
 */

export type PerformanceObjectiveFamily =
  | "LEADS"
  | "SALES"
  | "TRAFFIC"
  | "AWARENESS"
  | "ENGAGEMENT"
  | "UNKNOWN";

/** Metrics Ally may surface for decisions (presentation ids). */
export type PerformanceMetricId =
  | "results"
  | "cost_per_result"
  | "spend"
  | "ctr"
  | "cpc"
  | "purchases"
  | "cost_per_purchase"
  | "roas"
  | "landing_page_views"
  | "cost_per_lpv"
  | "link_clicks"
  | "reach"
  | "impressions"
  | "frequency"
  | "cpm"
  | "engagement"
  | "cost_per_engagement";

export type EconomicMetricKind =
  | "CPL"
  | "CPA"
  | "ROAS"
  | "CPM"
  | "CPC"
  | "COST_PER_LPV"
  | "NONE";

/**
 * Evidence sufficiency modes (conservative thresholds documented in sufficiency.ts).
 * CONVERSION: leads/sales result counts
 * TRAFFIC: LPV / link clicks
 * DELIVERY: impressions / reach (awareness)
 * ENGAGEMENT: engagement actions
 * GENERIC: unknown objective fallback
 */
export type EvidenceSufficiencyMode =
  | "CONVERSION"
  | "TRAFFIC"
  | "DELIVERY"
  | "ENGAGEMENT"
  | "GENERIC";

export type ObjectivePerformanceProfile = {
  family: PerformanceObjectiveFamily;
  /** Italian primary outcome description for UI / Ask Ally. */
  primaryOutcomeLabel: string;
  primaryMetrics: PerformanceMetricId[];
  supportingMetrics: PerformanceMetricId[];
  /** Action types Ally will consider for primary outcome (Graph evidence still required). */
  resultActionCandidates: readonly string[];
  economicMetric: EconomicMetricKind;
  /** False for Awareness — no mandatory CPL/CPA target. */
  economicTargetRequired: boolean;
  unsupportedMetrics: PerformanceMetricId[];
  sufficiencyMode: EvidenceSufficiencyMode;
  /**
   * When true, Ally may show delivery metrics without requiring a business target
   * for a basic "Meta sta erogando?" reading.
   */
  deliveryWithoutEconomicTarget: boolean;
};

export type ObjectiveOutcomeExtraction = {
  primaryResultType: string | null;
  primaryResults: number | null;
  primaryResultValue: number | null;
  mappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  /** Traffic: LPV preferred; link_click is a documented limitation. */
  outcomeLimitation: string | null;
};
