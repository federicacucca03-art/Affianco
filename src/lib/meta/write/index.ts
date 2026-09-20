/**
 * M11A.1 — Meta write foundation (dry-run / preview only).
 * MARKETING API CREATE FUNCTIONS: 0
 */

export { majorCurrencyToMetaMinorUnits } from "@/lib/meta/write/budget";
export { fingerprintPayload, canonicalJson, buildIdempotencyKey } from "@/lib/meta/write/fingerprint";
export { resolveBillingEvent } from "@/lib/meta/write/billing-event";
export { resolveWriteSchedule } from "@/lib/meta/write/schedule";
export { translateWriteTargeting } from "@/lib/meta/write/targeting";
export { resolveWritePlacements } from "@/lib/meta/write/placements";
export {
  buildMetaWritePreview,
  assertPreviewFingerprintMatch,
  connectionHasAdsManagement,
} from "@/lib/meta/write/preview";
export { isAllyNativeWriteEligible } from "@/lib/meta/write/eligibility";
export { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
export type * from "@/lib/meta/write/types";
