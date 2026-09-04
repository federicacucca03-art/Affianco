/**
 * M6D — Next action recommendation (decision support only).
 * No Meta writes, no persistence, no automation.
 */

import type { DiagnosisLikelyArea } from "@/lib/campaign-diagnosis/types";

export type NextActionEligibility =
  | "ACTION_AVAILABLE"
  | "ACTION_NOT_NEEDED"
  | "ACTION_BLOCKED_CONFIGURATION"
  | "ACTION_BLOCKED_INSUFFICIENT_DATA"
  | "ACTION_HISTORICAL_ONLY";

export type NextActionType =
  | "SET_TARGET"
  | "VERIFY_TRACKING"
  | "WAIT_FOR_MORE_DATA"
  | "REVIEW_CREATIVE"
  | "CREATE_CREATIVE_VARIANT"
  | "REVIEW_COPY"
  | "REVIEW_LANDING_OR_FORM"
  | "REVIEW_AUDIENCE"
  | "REVIEW_BUDGET"
  | "REVIEW_OFFER"
  | "REVIEW_RESULT_QUALITY"
  | "REVIEW_CAMPAIGN_SETUP"
  | "CONTACT_CLIENT"
  | "NO_ACTION"
  | "HISTORICAL_LEARNING";

export type NextActionConfidence = "LOW" | "MEDIUM" | "HIGH";

export type NextActionSource = "DETERMINISTIC" | "AI_SUPPORTED";

export type CampaignNextAction = {
  actionType: NextActionType;
  title: string;
  rationale: string;
  confidence: NextActionConfidence;
  eligibility: NextActionEligibility;
  actionSource: NextActionSource;
  blockingReason: string | null;
  relatedDiagnosisArea: DiagnosisLikelyArea | null;
  /** Safe internal navigation only — never Meta write. */
  ctaHref: string | null;
  ctaLabel: string | null;
};
