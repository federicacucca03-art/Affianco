/**
 * M10G — Ally product evidence gates for creative comparison.
 * Not Meta official thresholds. Not industry standards.
 */

/** Minimum impressions before an ad enters cross-ad comparison. */
export const MIN_IMPRESSIONS_FOR_COMPARE = 1000;

/** Minimum delivery days with spend before comparison/self-trend claims. */
export const MIN_DELIVERY_DAYS_FOR_COMPARE = 3;

/**
 * If one ad holds this share (or more) of spend among delivered ads,
 * treat as delivery imbalance — do not call others underperformers.
 */
export const DELIVERY_IMBALANCE_SPEND_SHARE = 0.85;

/** Ad below this spend share among peers is too thin to compare. */
export const MIN_PEER_SPEND_SHARE = 0.1;

/** Absolute daily-frequency rise used only with CTR decline (hypothesis). */
export const FATIGUE_FREQ_RISE_ABS = 0.4;
