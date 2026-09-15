export type {
  EconomicMetricKind,
  EvidenceSufficiencyMode,
  ObjectiveOutcomeExtraction,
  ObjectivePerformanceProfile,
  PerformanceMetricId,
  PerformanceObjectiveFamily,
} from "@/lib/meta/objective-performance/types";

export {
  PROFILE_AWARENESS,
  PROFILE_ENGAGEMENT,
  PROFILE_LEADS,
  PROFILE_SALES,
  PROFILE_TRAFFIC,
  PROFILE_UNKNOWN,
  resolveObjectivePerformanceProfile,
  resolvePerformanceFamily,
} from "@/lib/meta/objective-performance/profiles";

export { extractOutcomeForProfile } from "@/lib/meta/objective-performance/extract-outcome";

export {
  evaluateObjectiveEvidenceSufficiency,
  M10C_SUFFICIENCY_RULES,
  type EvidenceSufficiency,
} from "@/lib/meta/objective-performance/sufficiency";

export {
  etichettaPerformanceFamily,
  etichettaPerformanceMetric,
  etichetteHierarchyOutcome,
} from "@/lib/meta/objective-performance/labels";

export {
  buildPrimaryMetricDisplays,
  resolveMetricValue,
  type PerformanceMetricDisplay,
} from "@/lib/meta/objective-performance/present";
