/**
 * P0.16 — Pre-write Launch Guardian types.
 * Separate from P0.6 post-write EXPECTED vs ACTUAL.
 * META MUTATIONS: 0
 */

export type CanonicalReviewStatus =
  | "READY"
  | "READY_WITH_CONFIRMATIONS"
  | "BLOCKED"
  | "UNSUPPORTED";

export type PreWriteCheckBucket =
  | "BLOCKERS"
  | "CONFIRMATIONS"
  | "WARNINGS"
  | "PASSED";

export type PreWriteCheckStatus =
  | "PASS"
  | "FAIL"
  | "CONFIRM"
  | "WARN"
  | "SKIP";

export type PreWriteCheckScope =
  | "CAMPAIGN"
  | "AD_SET"
  | "CREATIVE"
  | "AD"
  | "IDENTITY"
  | "EXECUTION"
  | "SAFETY";

export type DecisionProvenance =
  | "USER_SELECTED"
  | "ALLY_RECOMMENDED"
  | "ALLY_DERIVED"
  | "BRAND_BRAIN"
  | "META_DISCOVERED"
  | "DEFAULT_SAFE"
  | "UNKNOWN";

export type PreWriteEditTarget =
  | "obiettivo"
  | "identita"
  | "modulo"
  | "pubblico"
  | "budget"
  | "annuncio"
  | "categoria"
  | "tracking"
  | "review"
  | "preparazione"
  | null;

export type PreWriteGuardianCheck = {
  id: string;
  scope: PreWriteCheckScope;
  status: PreWriteCheckStatus;
  bucket: PreWriteCheckBucket;
  title: string;
  userMessage: string;
  technicalReason: string;
  editTarget: PreWriteEditTarget;
  provenance?: DecisionProvenance;
};

export type PreWriteGuardianResult = {
  /** Pre-write phase — never confuses with P0.6 IMMEDIATE_EXPECTED_VS_ACTUAL. */
  phase: "PRE_WRITE";
  reviewStatus: CanonicalReviewStatus;
  headlineIt: string;
  summaryIt: string;
  checks: PreWriteGuardianCheck[];
  blockers: PreWriteGuardianCheck[];
  confirmations: PreWriteGuardianCheck[];
  warnings: PreWriteGuardianCheck[];
  passed: PreWriteGuardianCheck[];
  /** True only when reviewStatus === READY (future launch may proceed). */
  futureLaunchEligible: boolean;
  /** Always 0 in P0.16. */
  mutationsPerformed: 0;
  /** Mirrors CanonicalPublishPreview.publishAllowed when available. */
  publishAllowed: boolean;
};
