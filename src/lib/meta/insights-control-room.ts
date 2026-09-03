/**
 * M5B — Meta Control Room adapter (deterministic, no AI, no invented targets).
 *
 * Rules enforced:
 * - No GREEN/YELLOW/RED without explicit target.
 * - No CPL/CPA health without CONFIDENT result mapping.
 * - ROAS health deferred (higher-is-better needs separate engine).
 * - PAUSED/ARCHIVED/DELETED → HISTORICAL_REVIEW mode.
 * - Never writes to campaign_checks.
 * - Never auto-infers target from Meta data.
 */

import {
  calcolaHealthStatus,
  type HealthResult,
  type HealthStatus,
} from "@/lib/control-room";
import type { AggregatedMetaInsights } from "@/lib/meta/insight-aggregate";
import type { MetaCampaignTarget, MetaMonitoringKpi } from "@/lib/meta/campaign-target";

export const META_INSIGHTS_CONTROL_ROOM_SOURCE = "META_API" as const;

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type MetaMonitoringMode = "ACTIVE_MONITORING" | "HISTORICAL_REVIEW";

export type MetaHealthAvailability =
  | "AVAILABLE"
  | "TARGET_REQUIRED"
  | "RESULT_MAPPING_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "ROAS_DEFERRED";

export type MetaControlRoomMetrics = {
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  genericClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  results: number | null;
  resultType: string | null;
};

export type MetaControlRoomTarget = {
  primaryKpi: MetaMonitoringKpi | null;
  targetValue: number | null;
};

export type MetaControlRoomOutput = {
  source: typeof META_INSIGHTS_CONTROL_ROOM_SOURCE;
  mode: MetaMonitoringMode;
  healthAvailability: MetaHealthAvailability;
  metrics: MetaControlRoomMetrics;
  target: MetaControlRoomTarget;
  health: HealthResult | null;
  dateRange: { since: string; until: string };
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const HISTORICAL_STATUSES = new Set([
  "PAUSED",
  "CAMPAIGN_PAUSED",
  "ARCHIVED",
  "DELETED",
  "ADSET_PAUSED",
]);

export function resolveMonitoringMode(
  effectiveStatus: string | null | undefined,
): MetaMonitoringMode {
  if (!effectiveStatus) return "ACTIVE_MONITORING";
  const upper = effectiveStatus.toUpperCase();
  if (HISTORICAL_STATUSES.has(upper)) return "HISTORICAL_REVIEW";
  return "ACTIVE_MONITORING";
}

/**
 * Resolve the actual metric value for the chosen KPI.
 * Returns null if the metric is not available or semantics are wrong.
 */
function resolveActualForKpi(
  kpi: MetaMonitoringKpi,
  metrics: MetaControlRoomMetrics,
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN",
): number | null {
  switch (kpi) {
    case "CPL":
    case "CPA":
      if (resultMappingConfidence !== "CONFIDENT") return null;
      if (
        metrics.results == null ||
        metrics.results <= 0 ||
        metrics.spend == null
      )
        return null;
      return Math.round((metrics.spend / metrics.results) * 100) / 100;
    case "CPC":
      return metrics.cpc;
    case "CPM":
      return metrics.cpm;
    case "ROAS":
      return null; // deferred
    case "NONE":
      return null;
  }
}

/**
 * Determine health availability before attempting to compute health.
 */
function resolveHealthAvailability(
  target: MetaControlRoomTarget,
  metrics: MetaControlRoomMetrics,
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN",
): MetaHealthAvailability {
  if (target.primaryKpi == null || target.primaryKpi === "NONE") {
    return "TARGET_REQUIRED";
  }
  if (target.targetValue == null || target.targetValue <= 0) {
    return "TARGET_REQUIRED";
  }
  if (target.primaryKpi === "ROAS") {
    return "ROAS_DEFERRED";
  }
  if (
    (target.primaryKpi === "CPL" || target.primaryKpi === "CPA") &&
    resultMappingConfidence !== "CONFIDENT"
  ) {
    return "RESULT_MAPPING_REQUIRED";
  }
  const actual = resolveActualForKpi(
    target.primaryKpi,
    metrics,
    resultMappingConfidence,
  );
  if (actual == null) {
    return "INSUFFICIENT_DATA";
  }
  return "AVAILABLE";
}

// ------------------------------------------------------------------
// Main adapter
// ------------------------------------------------------------------

export function metaInsightsToControlRoomInput(input: {
  aggregate: AggregatedMetaInsights;
  since: string;
  until: string;
  target?: MetaCampaignTarget | null;
  effectiveStatus?: string | null;
}): MetaControlRoomOutput {
  const { aggregate, since, until, target, effectiveStatus } = input;

  const mode = resolveMonitoringMode(effectiveStatus);

  const metrics: MetaControlRoomMetrics = {
    spend: aggregate.spend,
    impressions: aggregate.impressions,
    linkClicks: aggregate.linkClicks,
    genericClicks: aggregate.clicks,
    ctr: aggregate.ctr,
    cpc: aggregate.cpc,
    cpm: aggregate.cpm,
    frequency: aggregate.periodFrequency,
    results:
      aggregate.resultMappingConfidence === "CONFIDENT"
        ? aggregate.primaryResults
        : null,
    resultType:
      aggregate.resultMappingConfidence === "CONFIDENT"
        ? aggregate.primaryResultType
        : null,
  };

  const controlRoomTarget: MetaControlRoomTarget = {
    primaryKpi: target?.primaryKpi ?? null,
    targetValue: target?.targetValue ?? null,
  };

  const availability = resolveHealthAvailability(
    controlRoomTarget,
    metrics,
    aggregate.resultMappingConfidence,
  );

  let health: HealthResult | null = null;

  if (availability === "AVAILABLE" && controlRoomTarget.primaryKpi && controlRoomTarget.primaryKpi !== "NONE" && controlRoomTarget.primaryKpi !== "ROAS") {
    const actual = resolveActualForKpi(
      controlRoomTarget.primaryKpi,
      metrics,
      aggregate.resultMappingConfidence,
    );
    const threshold = controlRoomTarget.targetValue!;
    const healthMode =
      controlRoomTarget.primaryKpi === "CPM" ? "efficiency" : "economic";
    health = calcolaHealthStatus(actual, threshold, healthMode);
  }

  return {
    source: META_INSIGHTS_CONTROL_ROOM_SOURCE,
    mode,
    healthAvailability: availability,
    metrics,
    target: controlRoomTarget,
    health,
    dateRange: { since, until },
  };
}

// ------------------------------------------------------------------
// Historical CTA filter
// ------------------------------------------------------------------

/** Returns true if an action CTA should be suppressed in HISTORICAL_REVIEW mode. */
export function isLiveInterventionCta(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("aumenta il budget") ||
    t.includes("riduci il budget") ||
    t.includes("controlla domani") ||
    t.includes("fix immediately") ||
    t.includes("aumentare il budget") ||
    t.includes("ridurre il budget") ||
    t.includes("ricontrolla al prossimo") ||
    t.includes("ricontrolla tra 1") ||
    t.includes("ricontrolla tra 3")
  );
}

export const HISTORICAL_CTA_SUBSTITUTE =
  "Usa questi dati come riferimento per la prossima campagna.";

// ------------------------------------------------------------------
// Health availability labels (for UI)
// ------------------------------------------------------------------

export function etichettaHealthAvailability(
  availability: MetaHealthAvailability,
): string {
  switch (availability) {
    case "AVAILABLE":
      return "Monitoraggio attivo";
    case "TARGET_REQUIRED":
      return "Target da impostare";
    case "RESULT_MAPPING_REQUIRED":
      return "Tipo risultato non determinabile";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    case "ROAS_DEFERRED":
      return "ROAS non ancora supportato";
  }
}

export function etichettaMonitoringMode(mode: MetaMonitoringMode): string {
  return mode === "HISTORICAL_REVIEW"
    ? "Revisione storica"
    : "Monitoraggio attivo";
}

export function kpiLabel(kpi: MetaMonitoringKpi | null): string {
  switch (kpi) {
    case "CPL":
      return "CPL";
    case "CPA":
      return "CPA";
    case "CPM":
      return "CPM";
    case "CPC":
      return "CPC";
    case "ROAS":
      return "ROAS";
    case "NONE":
      return "Nessuno";
    default:
      return "—";
  }
}

// Health status labels reused from control-room — re-exported for convenience
export function metaHealthStatusLabel(status: HealthStatus | null): string {
  switch (status) {
    case "GREEN":
      return "Sostenibile";
    case "YELLOW":
      return "Da monitorare";
    case "RED":
      return "Fuori soglia";
    case "INSUFFICIENT":
      return "Dati insufficienti";
    default:
      return "—";
  }
}
