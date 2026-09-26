/**
 * M11A.1/M11A.2 — Meta write domain exports.
 */

export { majorCurrencyToMetaMinorUnits } from "@/lib/meta/write/budget";
export { fingerprintPayload, canonicalJson, buildIdempotencyKey } from "@/lib/meta/write/fingerprint";
export { resolveBillingEvent } from "@/lib/meta/write/billing-event";
export { resolveWriteSchedule } from "@/lib/meta/write/schedule";
export { translateWriteTargeting } from "@/lib/meta/write/targeting";
export { resolveWritePlacements } from "@/lib/meta/write/placements";
export {
  resolveMetaBidStrategy,
  LOWEST_COST_WITHOUT_CAP_SUPPORTED,
  BID_AMOUNT_REQUIRED_WITH_LOWEST_COST_WITHOUT_CAP,
  META_BID_STRATEGY_LOWEST_COST_WITHOUT_CAP,
} from "@/lib/meta/write/bid-strategy";
export type { AllyBidMode, MetaBidResolve } from "@/lib/meta/write/bid-strategy";
export {
  resolveMetaAudienceMode,
  META_ADVANTAGE_AUDIENCE_ON,
  META_ADVANTAGE_AUDIENCE_OFF,
} from "@/lib/meta/write/audience-mode";
export type {
  AllyAudienceMode,
  AudienceModeResolve,
} from "@/lib/meta/write/audience-mode";
export {
  resolveWriteAgeFields,
  applyAgeFieldsToTargeting,
} from "@/lib/meta/write/age-model";
export type { WriteAgeResolve, AgeSuggestion } from "@/lib/meta/write/age-model";
export {
  isObjectiveOptimizationSupported,
  validateWriteObjectiveConfiguration,
  META_OBJECTIVE_OPTIMIZATION_MATRIX,
} from "@/lib/meta/write/objective-matrix";
export {
  buildMetaWritePreview,
  assertPreviewFingerprintMatch,
  connectionHasAdsManagement,
} from "@/lib/meta/write/preview";
export {
  isAllyNativeWriteEligible,
  isMetaCreateWriteEligible,
} from "@/lib/meta/write/eligibility";
export { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
export type * from "@/lib/meta/write/types";
