/**
 * M10G — Evidence-based creative intelligence (read-only).
 */

export type {
  CreativeIntelligence,
  CreativeIntelligenceInput,
  CreativeAdInput,
  CreativeAdSnapshot,
  CreativeEvaluability,
  CreativeComparisonMode,
  CreativeConfidence,
  CreativePrimaryObservation,
  CreativeFinding,
  CreativeFindingCode,
} from "@/lib/meta/creative-intelligence/types";

export {
  buildCreativeIntelligence,
  etichettaCreativeEvaluability,
  etichettaComparisonMode,
} from "@/lib/meta/creative-intelligence/build";

export {
  MIN_IMPRESSIONS_FOR_COMPARE,
  MIN_DELIVERY_DAYS_FOR_COMPARE,
  DELIVERY_IMBALANCE_SPEND_SHARE,
  MIN_PEER_SPEND_SHARE,
  FATIGUE_FREQ_RISE_ABS,
} from "@/lib/meta/creative-intelligence/evidence-gates";
