/**
 * M10E — Read-only tracking health types.
 * Measurement reliability ≠ delivery ≠ performance.
 */

export type TrackingHealthStatus =
  | "HEALTHY"
  | "PARTIAL"
  | "AMBIGUOUS"
  | "CONFIGURATION_REQUIRED"
  | "UNKNOWN";

/** Italian categorical reliability — no fake 0–100 scores. */
export type TrackingReliability =
  | "AFFIDABILE"
  | "PARZIALE"
  | "NON_VERIFICABILE";

export type TrackingIssueSeverity = "INFO" | "CHECK" | "ISSUE";

export type TrackingSignalCode =
  | "DESTINATION_NATIVE_META"
  | "DESTINATION_WEBSITE"
  | "DESTINATION_MESSAGING"
  | "DESTINATION_UNKNOWN"
  | "OPTIMIZATION_LEAD_GENERATION"
  | "OPTIMIZATION_CONVERSIONS"
  | "OPTIMIZATION_TRAFFIC"
  | "OPTIMIZATION_AWARENESS"
  | "OPTIMIZATION_ENGAGEMENT"
  | "PROMOTED_OBJECT_PAGE"
  | "PROMOTED_OBJECT_PIXEL"
  | "PROMOTED_OBJECT_PRESENT"
  | "ATTRIBUTION_CONFIGURED"
  | "LEAD_EVENT_PRESENT"
  | "PURCHASE_EVENT_PRESENT"
  | "PURCHASE_VALUE_PRESENT"
  | "LPV_SIGNAL_PRESENT"
  | "LINK_CLICK_ONLY"
  | "RESULT_MAPPING_CONFIDENT"
  | "RESULT_MAPPING_AMBIGUOUS"
  | "RESULT_MAPPING_UNKNOWN"
  | "PIXEL_UNKNOWN"
  | "EVENT_SOURCE_UNKNOWN"
  | "DELIVERY_PRESENT";

export type TrackingSignal = {
  code: TrackingSignalCode;
  evidence: string[];
};

export type TrackingIssue = {
  severity: TrackingIssueSeverity;
  code: string;
  title: string;
  explanation: string;
  evidence: string[];
};

/** How far Ally may go on economic performance claims. */
export type TrackingPerformanceConfidence =
  | "FULL"
  | "LIMITED"
  | "BLOCKED";

export type TrackingHealth = {
  status: TrackingHealthStatus;
  reliability: TrackingReliability;
  performanceConfidence: TrackingPerformanceConfidence;
  beginnerSummary: string;
  beginnerLabel: string;
  signals: TrackingSignal[];
  issues: TrackingIssue[];
  unknowns: string[];
  /** Pixel/dataset Graph visibility with current ads_read data. */
  pixelVisibility: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  /** Outcome-relevant action types that justify result-signal claims. */
  relevantResultActions: string[];
  /** Other observed actions (engagement/delivery noise) — secondary. */
  otherObservedActions: string[];
  professionalLines: Array<{ key: string; label: string; value: string }>;
};

export type TrackingHealthInput = {
  objective: string | null;
  optimizationGoal: string | null;
  destinationType: string | null;
  promotedObject: Record<string, unknown> | null;
  attributionSpec: unknown;
  /** Aggregated / period-level observed action types with positive values. */
  observedActionTypes: string[];
  hasPurchaseValue: boolean;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  primaryResultType: string | null;
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  landingPageViews: number | null;
};
