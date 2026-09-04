/**
 * M7B.1 — Notification decision types (deterministic, no delivery).
 */

import type {
  AttentionSource,
  AttentionState,
  AttentionTrend,
  UrgencyLevel,
} from "@/lib/monday-control-room";
import type { HealthStatus } from "@/lib/control-room";
import type { MetaDataFreshness } from "@/lib/meta/freshness";
import type { NextActionType } from "@/lib/campaign-next-action/types";

export type NotificationType =
  | "PERFORMANCE_DROPPED"
  | "CRITICAL_STATE"
  | "RECOVERED"
  | "CONFIGURATION_REQUIRED"
  | "DATA_STALE"
  | "CLIENT_REVISION";

export type NotificationSeverity = "HIGH" | "MEDIUM" | "LOW";

export type NotificationReasonCode =
  | "ATTENTION_ESCALATED_CRITICAL"
  | "ATTENTION_ENTERED_NEEDS_ATTENTION"
  | "HEALTH_ENTERED_RED"
  | "ATTENTION_RECOVERED_STABLE"
  | "CONFIGURATION_BLOCK_NEW"
  | "FRESHNESS_ENTERED_STALE"
  | "REVISION_REQUESTED_NEW"
  | "NO_TRANSITION"
  | "HISTORICAL_SKIP"
  | "SUPPRESSED_LINK_SKIP"
  | "DRAFT_SKIP"
  | "INSUFFICIENT_ONLY_SKIP"
  | "SMALL_SAMPLE_ONLY_SKIP"
  | "UNCHANGED_SKIP";

/** Canonical snapshot used as previous/current for transition evaluation. */
export type NotificationCampaignSnapshot = {
  userId: string;
  clientId: string | null;
  campaignId: string;
  source: AttentionSource;
  campaignStatus: string | null;
  attentionState: AttentionState;
  urgencyLevel: UrgencyLevel;
  health: HealthStatus | null;
  trend: AttentionTrend;
  healthAvailability: string | null;
  configurationKind:
    | "DRAFT"
    | "ACTIVE_MISSING_TARGET"
    | "ACTIVE_MISSING_RESULTS"
    | "RESULT_MAPPING"
    | "OTHER"
    | null;
  freshness: MetaDataFreshness | null;
  resultsCount: number | null;
  /** Linked native row suppressed in Monday — do not notify. */
  suppressedByLink: boolean;
  href: string;
  nextActionType?: NextActionType | null;
};

export type NotificationDecision = {
  shouldNotify: boolean;
  notificationType: NotificationType | null;
  severity: NotificationSeverity | null;
  reasonCode: NotificationReasonCode;
  title: string | null;
  message: string | null;
  dedupeKey: string | null;
  recommendedHref: string | null;
  ctaLabel: string | null;
};
