/**
 * P0.17 — Canonical Creative Package public surface.
 * LIVE META WRITES: 0
 */

export type {
  AllyCreativeCopySuggestion,
  CanonicalCreativePackage,
  CreativeFormatReadiness,
  CreativeFormatSupport,
  CreativeFormatV1,
  CreativeLaunchPackage,
  CreativePackageStatus,
  CreativeProvenance,
  CreativeSurfaceReadiness,
} from "@/lib/meta/creative/types";

export { analyzeCreativeFormatReadiness } from "@/lib/meta/creative/format-readiness";
export {
  ALLY_META_CTA_LABEL_IT,
  INSTANT_FORM_META_CTA_TYPE,
  allyMetaCtaLabelIt,
  isAllySupportedMetaCtaType,
  metaCtaTypeForDestination,
  resolveAllyMetaCta,
} from "@/lib/meta/creative/cta";
export type { AllySupportedMetaCtaType } from "@/lib/meta/creative/cta";
export {
  buildCanonicalCreativePackage,
  buildCreativePackageFromEasyDraft,
} from "@/lib/meta/creative/build-package";
export type { BuildCanonicalCreativePackageInput } from "@/lib/meta/creative/build-package";
export { buildCreativeLaunchPackage } from "@/lib/meta/creative/launch-package";
export {
  buildCreativeCopyAssistSystemPrompt,
  buildCreativeCopyAssistUserPrompt,
  fallbackAllyCreativeCopySuggestion,
  parseAllyCreativeCopySuggestion,
  stripForbiddenPerformanceClaims,
} from "@/lib/meta/creative/copy-assist";
export type { CreativeCopyAssistInput } from "@/lib/meta/creative/copy-assist";
