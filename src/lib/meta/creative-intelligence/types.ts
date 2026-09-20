/**
 * M10G — Evidence-based creative intelligence (read-only).
 * PERFORMANCE OF A CREATIVE ≠ QUALITY OF A CREATIVE.
 * No Meta writes. No creative quality scores. No vision.
 */

import type { PerformanceObjectiveFamily } from "@/lib/meta/objective-performance";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";

export type CreativeEvaluability =
  | "FULL"
  | "LIMITED"
  | "NOT_COMPARABLE"
  | "INSUFFICIENT_DATA";

export type CreativeComparisonMode =
  | "CROSS_AD"
  | "SELF_TREND"
  | "SINGLE_AD_ONLY"
  | "NONE";

export type CreativeConfidence = "ALTA" | "MEDIA" | "BASSA";

export type CreativePrimaryObservation =
  | "NO_COMPARISON_AVAILABLE"
  | "ONE_AD_CONCENTRATES_TRAFFIC_DECLINE"
  | "ONE_AD_HAS_HIGHER_CLICK_EFFICIENCY"
  | "RESULT_STAGE_DIFFERENCE"
  | "POSSIBLE_FATIGUE_SIGNAL"
  | "DELIVERY_IMBALANCE"
  | "NEUTRAL_DIFFERENCE"
  | "CREATIVE_DATA_INSUFFICIENT";

export type CreativeFindingCode =
  | "SINGLE_VARIANT_ONLY"
  | "DELIVERY_IMBALANCE"
  | "CLICK_RESPONSE_DIFFERENCE"
  | "CLICK_COST_DIFFERENCE"
  | "RESULT_RESPONSE_DIFFERENCE"
  | "SELF_TREND_DECLINE"
  | "POSSIBLE_FATIGUE_PATTERN"
  | "CREATIVE_DATA_INSUFFICIENT"
  | "MESSAGE_VARIANTS_DIFFER"
  | "MESSAGE_VARIANTS_SAME"
  | "MULTI_AD_SET_CONFOUND";

export type CreativeFinding = {
  code: CreativeFindingCode;
  confidence: CreativeConfidence;
  title: string;
  explanation: string;
  evidence: string[];
  limitations: string[];
};

export type CreativeAdSnapshot = {
  metaAdId: string;
  metaAdSetId: string;
  adSetName: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  creativeId: string | null;
  creativeTitle: string | null;
  creativeBody: string | null;
  creativeCta: string | null;
  creativeLinkUrl: string | null;
  creativeThumbnailUrl: string | null;
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  /** Percentage points (2.87 = 2.87%). */
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  spendShare: number | null;
  sampleSufficient: boolean;
  comparable: boolean;
};

export type CreativeIntelligence = {
  evaluability: CreativeEvaluability;
  comparisonMode: CreativeComparisonMode;
  /** Italian label for UI / Ask Ally — never expose raw comparisonMode enums. */
  comparisonModeLabelIt: string;
  confidence: CreativeConfidence;
  beginnerLabel: string;
  beginnerSummary: string;
  primaryObservation: CreativePrimaryObservation;
  ads: CreativeAdSnapshot[];
  findings: CreativeFinding[];
  facts: string[];
  hypotheses: string[];
  unknowns: string[];
  nextTest: string | null;
  comparisonWindowLabel: string | null;
  professionalLines: Array<{ key: string; label: string; value: string }>;
};

export type CreativeAdInput = {
  metaAdId: string;
  metaAdSetId: string;
  adSetName: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  creativeId: string | null;
  creativeTitle: string | null;
  creativeBody: string | null;
  creativeCta: string | null;
  creativeLinkUrl: string | null;
  creativeThumbnailUrl: string | null;
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  dayCount: number;
  insightRows: NormalizedDailyInsight[];
};

export type CreativeIntelligenceInput = {
  objective: string | null;
  performanceFamily: PerformanceObjectiveFamily;
  isHistorical: boolean;
  /** Campaign-level tracking performance confidence from M10E. */
  trackingPerformanceConfidence: "FULL" | "LIMITED" | "BLOCKED" | null;
  campaignResultMapping: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  ads: CreativeAdInput[];
};
