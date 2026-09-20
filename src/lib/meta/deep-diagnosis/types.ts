/**
 * M10F — Deterministic deep diagnosis (measurement → delivery → … → hypothesis).
 * Read-only. No Meta writes. No creative scoring (see M10G).
 */

import type { PerformanceObjectiveFamily } from "@/lib/meta/objective-performance";
import type { MetaTrendResult } from "@/lib/meta/meta-trend";
import type { TrackingHealth } from "@/lib/meta/tracking-health";
import type {
  ConfigPresentation,
  PlannedVsActualField,
} from "@/lib/meta/configuration";

export type DeepDiagnosisEvaluability = "FULL" | "LIMITED" | "BLOCKED";

export type DeepDiagnosticLayer =
  | "MEASUREMENT"
  | "DELIVERY"
  | "TRAFFIC"
  | "CONVERSION"
  | "ECONOMICS"
  | "CONFIGURATION";

export type DeepDiagnosisConfidence = "ALTA" | "MEDIA" | "BASSA";

export type DeepFindingSeverity = "INFO" | "CHECK" | "ISSUE";

export type DeepFinding = {
  code: string;
  layer: DeepDiagnosticLayer;
  severity: DeepFindingSeverity;
  confidence: DeepDiagnosisConfidence;
  title: string;
  explanation: string;
  evidence: string[];
  limitations: string[];
  nextCheck: string | null;
};

export type DeepDiagnosis = {
  evaluability: DeepDiagnosisEvaluability;
  /** Where evidence currently points first — not a proven root cause. */
  primaryFocus: DeepDiagnosticLayer | null;
  beginnerSummary: string;
  beginnerLabel: string;
  confidence: DeepDiagnosisConfidence;
  findings: DeepFinding[];
  facts: string[];
  hypotheses: string[];
  unknowns: string[];
  blockers: string[];
  nextCheck: string | null;
  selfComparison: "AVAILABLE" | "PARTIAL" | "NOT_AVAILABLE";
  comparisonWindowLabel: string | null;
  /**
   * Structured self-comparison metrics (CTR as percentage points, CPC as currency).
   * Null when no TWO_WINDOW comparison is available.
   */
  comparisonMetrics: {
    ctrPrevious: number | null;
    ctrCurrent: number | null;
    ctrDeltaPercent: number | null;
    cpcPrevious: number | null;
    cpcCurrent: number | null;
    cpcDeltaPercent: number | null;
  } | null;
  professionalLines: Array<{ key: string; label: string; value: string }>;
};

export type DeepDiagnosisInput = {
  objective: string | null;
  performanceFamily: PerformanceObjectiveFamily;
  destinationType: string | null;
  /** Effective / delivery status (Meta). */
  effectiveStatus: string | null;
  isHistorical: boolean;
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  landingPageViews: number | null;
  ctr: number | null;
  cpc: number | null;
  frequency: number | null;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  primaryResults: number | null;
  costPerResult: number | null;
  /** User sustainable target when present. */
  hasTarget: boolean;
  targetValue: number | null;
  /** From M10C sufficiency when known. */
  sampleSufficient: boolean | null;
  trackingHealth: TrackingHealth | null;
  configuration: ConfigPresentation | null;
  plannedVsActual: PlannedVsActualField[] | null;
  trend: MetaTrendResult | null;
  hierarchyFocus: {
    focusAdSetName: string | null;
    focusAdName: string | null;
    lines: string[];
  } | null;
};
