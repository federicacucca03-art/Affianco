/**
 * M5B / M10C — Meta Control Room adapter (deterministic, no AI, no invented targets).
 *
 * Rules enforced:
 * - No GREEN/YELLOW/RED without explicit target (when economic target is required).
 * - No CPL/CPA health without CONFIDENT result mapping.
 * - Awareness/Traffic/Engagement do NOT require CPL/CPA → no fake CONFIGURATION_REQUIRED.
 * - ROAS health only when spend + reliable purchase value exist (separate path).
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
import {
  evaluateObjectiveEvidenceSufficiency,
  resolveObjectivePerformanceProfile,
  type ObjectivePerformanceProfile,
} from "@/lib/meta/objective-performance";

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
  | "ROAS_DEFERRED"
  | "LINKED_BUT_KPI_INCOMPATIBLE"
  /** Unknown Meta objective — factual metrics only, no performance verdict. */
  | "OBJECTIVE_UNSUPPORTED"
  /**
   * Objective does not require an economic target (e.g. Awareness).
   * Delivery may be readable; no GREEN/YELLOW/RED without an optional compatible target.
   */
  | "NO_ECONOMIC_EVALUATION";

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
 * Inclusive calendar-day span for YYYY-MM-DD windows (UTC date parts).
 * Used to feed canonical small-sample health opts.
 */
export function daysInclusiveYmd(since: string, until: string): number | null {
  const s = Date.parse(`${since}T00:00:00.000Z`);
  const u = Date.parse(`${until}T00:00:00.000Z`);
  if (!Number.isFinite(s) || !Number.isFinite(u) || u < s) return null;
  return Math.floor((u - s) / 86_400_000) + 1;
}

function kpiCompatibleWithProfile(
  kpi: MetaMonitoringKpi,
  profile: ObjectivePerformanceProfile,
): boolean {
  switch (profile.family) {
    case "LEADS":
      return kpi === "CPL" || kpi === "CPA" || kpi === "CPC" || kpi === "CPM";
    case "SALES":
      return kpi === "CPA" || kpi === "ROAS" || kpi === "CPC" || kpi === "CPM";
    case "TRAFFIC":
      return kpi === "CPC" || kpi === "CPM";
    case "AWARENESS":
      return kpi === "CPM" || kpi === "CPC";
    case "ENGAGEMENT":
      return kpi === "CPC" || kpi === "CPM";
    default:
      return false;
  }
}

/**
 * Determine health availability before attempting to compute health.
 * Objective-aware: Awareness without CPL is not TARGET_REQUIRED.
 * M10C.1: RESULT ambiguity ≠ sample insufficiency ≠ missing target.
 */
function resolveHealthAvailability(
  target: MetaControlRoomTarget,
  metrics: MetaControlRoomMetrics,
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN",
  sample: {
    daysActive: number | null;
    resultsCount: number | null;
    impressions: number | null;
    linkClicks: number | null;
  },
  profile: ObjectivePerformanceProfile,
): MetaHealthAvailability {
  if (profile.family === "UNKNOWN") {
    return "OBJECTIVE_UNSUPPORTED";
  }

  const conversionFamily =
    profile.family === "LEADS" ||
    profile.family === "SALES" ||
    profile.family === "ENGAGEMENT" ||
    profile.family === "TRAFFIC";

  /**
   * Ambiguity is a semantic limitation — never "need more sample" and never
   * overwritten by "set a target" when an outcome mapping is required.
   */
  if (conversionFamily && resultMappingConfidence === "AMBIGUOUS") {
    return "RESULT_MAPPING_REQUIRED";
  }

  const hasUsableTarget =
    target.primaryKpi != null &&
    target.primaryKpi !== "NONE" &&
    target.targetValue != null &&
    target.targetValue > 0;

  if (!hasUsableTarget) {
    if (!profile.economicTargetRequired) {
      const sufficiency = evaluateObjectiveEvidenceSufficiency({
        mode: profile.sufficiencyMode,
        daysActive: sample.daysActive,
        resultsCount: sample.resultsCount,
        impressions: sample.impressions,
        linkClicks: sample.linkClicks,
      });
      if (sufficiency === "INSUFFICIENT_DATA") return "INSUFFICIENT_DATA";
      return "NO_ECONOMIC_EVALUATION";
    }
    // Leads/Sales without target: check delivery/days before asking for target.
    const deliverySufficiency = evaluateObjectiveEvidenceSufficiency({
      mode:
        profile.sufficiencyMode === "CONVERSION"
          ? "GENERIC"
          : profile.sufficiencyMode,
      daysActive: sample.daysActive,
      resultsCount: null,
      impressions: sample.impressions,
      linkClicks: sample.linkClicks,
    });
    if (deliverySufficiency === "INSUFFICIENT_DATA") {
      return "INSUFFICIENT_DATA";
    }
    return "TARGET_REQUIRED";
  }

  const kpi = target.primaryKpi!;
  if (!kpiCompatibleWithProfile(kpi, profile)) {
    return "LINKED_BUT_KPI_INCOMPATIBLE";
  }
  if (kpi === "ROAS") {
    // Observed ROAS needs spend + purchase value; engine still defers G/Y/R ROAS.
    return "ROAS_DEFERRED";
  }
  if (
    (kpi === "CPL" || kpi === "CPA") &&
    resultMappingConfidence !== "CONFIDENT"
  ) {
    return "RESULT_MAPPING_REQUIRED";
  }

  // CPC/CPM evaluate delivery economics — do not require conversion results.
  const sufficiencyMode =
    kpi === "CPC" || kpi === "CPM" ? "GENERIC" : profile.sufficiencyMode;
  const sufficiency = evaluateObjectiveEvidenceSufficiency({
    mode: sufficiencyMode,
    daysActive: sample.daysActive,
    resultsCount:
      sufficiencyMode === "DELIVERY" || sufficiencyMode === "GENERIC"
        ? null
        : sample.resultsCount,
    impressions: sample.impressions,
    linkClicks: sample.linkClicks,
  });
  if (sufficiency === "INSUFFICIENT_DATA") {
    return "INSUFFICIENT_DATA";
  }

  const actual = resolveActualForKpi(kpi, metrics, resultMappingConfidence);
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
  /** Meta Graph objective — drives M10C profile (optional; defaults UNKNOWN). */
  rawObjective?: string | null;
}): MetaControlRoomOutput {
  const { aggregate, since, until, target, effectiveStatus, rawObjective } =
    input;

  const mode = resolveMonitoringMode(effectiveStatus);
  const profile = resolveObjectivePerformanceProfile(rawObjective);

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

  const daysActive = daysInclusiveYmd(since, until);
  const resultsCount =
    metrics.results != null && Number.isFinite(metrics.results)
      ? metrics.results
      : null;

  const availability = resolveHealthAvailability(
    controlRoomTarget,
    metrics,
    aggregate.resultMappingConfidence,
    {
      daysActive,
      resultsCount,
      impressions: metrics.impressions,
      linkClicks: metrics.linkClicks,
    },
    profile,
  );

  let health: HealthResult | null = null;

  if (
    availability === "AVAILABLE" &&
    controlRoomTarget.primaryKpi &&
    controlRoomTarget.primaryKpi !== "NONE" &&
    controlRoomTarget.primaryKpi !== "ROAS"
  ) {
    const actual = resolveActualForKpi(
      controlRoomTarget.primaryKpi,
      metrics,
      aggregate.resultMappingConfidence,
    );
    const threshold = controlRoomTarget.targetValue!;
    const healthMode =
      controlRoomTarget.primaryKpi === "CPM" ? "efficiency" : "economic";
    health = calcolaHealthStatus(actual, threshold, healthMode, {
      daysActive,
      resultsCount:
        controlRoomTarget.primaryKpi === "CPL" ||
        controlRoomTarget.primaryKpi === "CPA"
          ? resultsCount
          : null,
    });
  } else if (availability === "INSUFFICIENT_DATA") {
    /* Same canonical engine — force INSUFFICIENT rather than G/Y/R. */
    health = calcolaHealthStatus(null, null, "economic", {
      daysActive: daysActive ?? 0,
      resultsCount: resultsCount ?? 0,
    });
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
      return "Risultati Meta non determinabili";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    case "ROAS_DEFERRED":
      return "ROAS non ancora supportato";
    case "LINKED_BUT_KPI_INCOMPATIBLE":
      return "KPI pianificato non compatibile";
    case "OBJECTIVE_UNSUPPORTED":
      return "Obiettivo non supportato per la valutazione";
    case "NO_ECONOMIC_EVALUATION":
      return "Valutazione economica non richiesta";
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
