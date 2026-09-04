/**
 * M7B.1 — Deterministic notification transition evaluator.
 * No delivery, no persistence, no AI, no Meta writes.
 */

import type { AttentionState, UrgencyLevel } from "@/lib/monday-control-room";
import type { HealthStatus } from "@/lib/control-room";
import {
  notificationCtaLabel,
  notificationMessage,
  notificationTitle,
} from "@/lib/campaign-notifications/copy";
import type {
  NotificationCampaignSnapshot,
  NotificationDecision,
  NotificationReasonCode,
  NotificationSeverity,
  NotificationType,
} from "@/lib/campaign-notifications/types";

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

function availabilityUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

function isProblemAttention(state: AttentionState): boolean {
  return state === "CRITICAL" || state === "NEEDS_ATTENTION";
}

function isSoftAttention(state: AttentionState): boolean {
  return state === "STABLE" || state === "MONITOR";
}

function isConfigBlockAvailability(raw: string | null | undefined): boolean {
  const a = availabilityUpper(raw);
  return (
    a === "TARGET_REQUIRED" ||
    a === "RESULT_MAPPING_REQUIRED" ||
    a === "LINKED_BUT_KPI_INCOMPATIBLE"
  );
}

function buildDedupeKey(
  current: NotificationCampaignSnapshot,
  type: NotificationType,
  transitionToken: string,
): string {
  return [
    current.userId,
    current.clientId ?? "",
    current.source,
    current.campaignId,
    type,
    transitionToken,
  ].join("|");
}

function decide(
  type: NotificationType,
  severity: NotificationSeverity,
  reasonCode: NotificationReasonCode,
  current: NotificationCampaignSnapshot,
  transitionToken: string,
): NotificationDecision {
  return {
    shouldNotify: true,
    notificationType: type,
    severity,
    reasonCode,
    title: notificationTitle(type),
    message: notificationMessage(type),
    dedupeKey: buildDedupeKey(current, type, transitionToken),
    recommendedHref: current.href || null,
    ctaLabel: notificationCtaLabel(type),
  };
}

function skip(
  reasonCode: NotificationReasonCode,
): NotificationDecision {
  return {
    shouldNotify: false,
    notificationType: null,
    severity: null,
    reasonCode,
    title: null,
    message: null,
    dedupeKey: null,
    recommendedHref: null,
    ctaLabel: null,
  };
}

function severityForUrgency(urgency: UrgencyLevel): NotificationSeverity {
  if (urgency === "NOW") return "HIGH";
  if (urgency === "SOON") return "MEDIUM";
  return "MEDIUM";
}

/**
 * Evaluate whether the transition previous → current deserves a notification.
 * Pure. Callers supply previous snapshot (null = first observation / unknown).
 */
export function resolveNotificationDecision(input: {
  previous: NotificationCampaignSnapshot | null;
  current: NotificationCampaignSnapshot;
}): NotificationDecision {
  const { previous, current } = input;

  if (current.attentionState === "HISTORICAL") {
    return skip("HISTORICAL_SKIP");
  }

  if (current.suppressedByLink) {
    return skip("SUPPRESSED_LINK_SKIP");
  }

  const currStatus = statusUpper(current.campaignStatus);
  const prevStatus = statusUpper(previous?.campaignStatus);

  // Draft / initial setup never notifies.
  if (
    currStatus === "DRAFT" ||
    current.configurationKind === "DRAFT"
  ) {
    return skip("DRAFT_SKIP");
  }

  // --- Revision (status transition) ---
  if (currStatus === "REVISION_REQUESTED") {
    if (prevStatus !== "REVISION_REQUESTED") {
      return decide(
        "CLIENT_REVISION",
        "MEDIUM",
        "REVISION_REQUESTED_NEW",
        current,
        "status:->REVISION_REQUESTED",
      );
    }
    // Repeated revision: only notify if nothing else applies below — skip revision noise.
  }

  // First observation: no previous → only actionable brand-new revision (above).
  if (!previous) {
    return skip("NO_TRANSITION");
  }

  // Insufficient-only: staying in / entering insufficient without performance signal.
  if (
    current.attentionState === "INSUFFICIENT_DATA" &&
    previous.attentionState === "INSUFFICIENT_DATA"
  ) {
    return skip("INSUFFICIENT_ONLY_SKIP");
  }
  if (
    current.attentionState === "INSUFFICIENT_DATA" &&
    previous.attentionState !== "CRITICAL" &&
    previous.attentionState !== "NEEDS_ATTENTION"
  ) {
    return skip("INSUFFICIENT_ONLY_SKIP");
  }

  // Small sample alone (no attention/health escalation).
  const smallSample =
    current.resultsCount != null &&
    current.resultsCount > 0 &&
    current.resultsCount <= 2;
  if (
    smallSample &&
    current.attentionState === previous.attentionState &&
    current.health === previous.health &&
    currStatus === prevStatus &&
    current.freshness === previous.freshness
  ) {
    return skip("SMALL_SAMPLE_ONLY_SKIP");
  }

  // Unchanged core state → no notify (before weaker rules).
  const sameCore =
    current.attentionState === previous.attentionState &&
    current.urgencyLevel === previous.urgencyLevel &&
    current.health === previous.health &&
    currStatus === prevStatus &&
    availabilityUpper(current.healthAvailability) ===
      availabilityUpper(previous.healthAvailability) &&
    current.freshness === previous.freshness;

  if (sameCore) {
    return skip("UNCHANGED_SKIP");
  }

  // --- Attention escalation to CRITICAL ---
  if (
    current.attentionState === "CRITICAL" &&
    previous.attentionState !== "CRITICAL"
  ) {
    return decide(
      "CRITICAL_STATE",
      "HIGH",
      "ATTENTION_ESCALATED_CRITICAL",
      current,
      `att:${previous.attentionState}->CRITICAL`,
    );
  }

  // --- Entered NEEDS_ATTENTION from soft states ---
  if (
    current.attentionState === "NEEDS_ATTENTION" &&
    isSoftAttention(previous.attentionState)
  ) {
    return decide(
      "PERFORMANCE_DROPPED",
      severityForUrgency(current.urgencyLevel),
      "ATTENTION_ENTERED_NEEDS_ATTENTION",
      current,
      `att:${previous.attentionState}->NEEDS_ATTENTION`,
    );
  }

  // --- Health entered RED (fresh-enough / not insufficient) ---
  if (
    current.health === "RED" &&
    previous.health !== "RED" &&
    previous.health != null &&
    current.attentionState !== "INSUFFICIENT_DATA" &&
    current.attentionState !== "CONFIGURATION_REQUIRED"
  ) {
    const sev: NotificationSeverity =
      current.urgencyLevel === "NOW" ? "HIGH" : "MEDIUM";
    return decide(
      "PERFORMANCE_DROPPED",
      sev,
      "HEALTH_ENTERED_RED",
      current,
      `health:${previous.health}->RED`,
    );
  }

  // --- Recovery to STABLE from problem ---
  if (
    current.attentionState === "STABLE" &&
    isProblemAttention(previous.attentionState)
  ) {
    return decide(
      "RECOVERED",
      "LOW",
      "ATTENTION_RECOVERED_STABLE",
      current,
      `att:${previous.attentionState}->STABLE`,
    );
  }

  // --- Configuration block newly introduced (ACTIVE only) ---
  if (
    current.attentionState === "CONFIGURATION_REQUIRED" &&
    isConfigBlockAvailability(current.healthAvailability) &&
    !isConfigBlockAvailability(previous.healthAvailability) &&
    currStatus !== "DRAFT" &&
    (statusUpper(current.campaignStatus) === "ACTIVE" ||
      statusUpper(current.campaignStatus) === "RUNNING" ||
      current.source === "META")
  ) {
    // Require ACTIVE-ish Meta/native monitoring, not draft setup.
    const metaActive =
      current.source === "META" &&
      statusUpper(current.campaignStatus) !== "PAUSED" &&
      statusUpper(current.campaignStatus) !== "ARCHIVED" &&
      statusUpper(current.campaignStatus) !== "DELETED";
    const nativeActive =
      current.source === "NATIVE" &&
      (statusUpper(current.campaignStatus) === "ACTIVE" ||
        statusUpper(current.campaignStatus) === "RUNNING" ||
        statusUpper(current.campaignStatus) === "APPROVED");
    if (metaActive || nativeActive) {
      const avail = availabilityUpper(current.healthAvailability);
      return decide(
        "CONFIGURATION_REQUIRED",
        "MEDIUM",
        "CONFIGURATION_BLOCK_NEW",
        current,
        `avail:->${avail}`,
      );
    }
  }

  // --- Freshness entered STALE (ACTIVE Meta only) ---
  if (
    current.source === "META" &&
    current.freshness === "STALE" &&
    previous.freshness !== "STALE" &&
    (previous.freshness === "FRESH" ||
      previous.freshness === "AGING" ||
      previous.freshness === "UNKNOWN") &&
    statusUpper(current.campaignStatus) !== "PAUSED" &&
    statusUpper(current.campaignStatus) !== "ARCHIVED" &&
    statusUpper(current.campaignStatus) !== "DELETED"
  ) {
    return decide(
      "DATA_STALE",
      "LOW",
      "FRESHNESS_ENTERED_STALE",
      current,
      `fresh:${previous.freshness ?? "UNKNOWN"}->STALE`,
    );
  }

  // Repeated REVISION_REQUESTED with no other transition → no notify
  if (
    currStatus === "REVISION_REQUESTED" &&
    prevStatus === "REVISION_REQUESTED"
  ) {
    return skip("UNCHANGED_SKIP");
  }

  return skip("NO_TRANSITION");
}

/** Map Control Room row-ish fields into a notification snapshot. */
export function snapshotFromControlRoomFields(input: {
  userId: string;
  clientId: string | null;
  campaignId: string;
  source: NotificationCampaignSnapshot["source"];
  campaignStatus: string | null;
  attentionState: AttentionState;
  urgencyLevel: UrgencyLevel;
  health: HealthStatus | null;
  trend: NotificationCampaignSnapshot["trend"];
  healthAvailability: string | null;
  configurationKind: NotificationCampaignSnapshot["configurationKind"];
  freshness: NotificationCampaignSnapshot["freshness"];
  resultsCount: number | null;
  suppressedByLink: boolean;
  href: string;
  nextActionType?: NotificationCampaignSnapshot["nextActionType"];
}): NotificationCampaignSnapshot {
  return { ...input };
}
