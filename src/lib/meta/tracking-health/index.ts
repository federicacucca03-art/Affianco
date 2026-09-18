/**
 * M10E — Read-only tracking health (measurement reliability).
 */

export type {
  TrackingHealth,
  TrackingHealthInput,
  TrackingHealthStatus,
  TrackingReliability,
  TrackingIssue,
  TrackingIssueSeverity,
  TrackingSignal,
  TrackingSignalCode,
  TrackingPerformanceConfidence,
} from "@/lib/meta/tracking-health/types";

export {
  buildTrackingHealth,
  resolveTrackingPerformanceConfidence,
  reliabilityFromStatus,
  etichettaTrackingReliability,
} from "@/lib/meta/tracking-health/build";

export {
  resolveDestinationKind,
  promotedObjectFlags,
  hasAttributionConfigured,
  hasLeadEvent,
  hasPurchaseEvent,
  hasLpvEvent,
  hasLinkClickOnly,
  listLeadActionTypes,
  partitionObservedActions,
  etichettaRelevantResultSummary,
} from "@/lib/meta/tracking-health/evidence";
