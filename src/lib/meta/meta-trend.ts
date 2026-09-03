/**
 * M5B — Meta Trend Engine (deterministic, no campaign_checks writes).
 *
 * Computes a simple two-window trend from Meta daily insight rows.
 * Windows:
 *   CURRENT:  last N available delivery days (default 7)
 *   PREVIOUS: previous N available delivery days
 *
 * Rules:
 * - Only days with spend > 0 are counted as "delivery days".
 * - For historical campaigns, windows are relative to available history.
 * - Result types must be consistent across both windows (same type).
 * - Fewer than N days in a window → INSUFFICIENT_TREND_DATA.
 * - Never compare incompatible result types.
 */

import type { AggregatedMetaInsights } from "@/lib/meta/insight-aggregate";
import { aggregateDailyInsights } from "@/lib/meta/insight-aggregate";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";

export type MetaTrendDirection = "IMPROVING" | "WORSENING" | "STABLE";

export type MetaTrendLevel =
  | "TWO_WINDOW_COMPARISON"
  | "INSUFFICIENT_TREND_DATA";

export type MetaMetricTrend = {
  metric: string;
  current: number | null;
  previous: number | null;
  direction: MetaTrendDirection | null;
  deltaPercent: number | null;
};

export type MetaTrendResult = {
  level: MetaTrendLevel;
  windowDays: number;
  currentWindow: { since: string; until: string } | null;
  previousWindow: { since: string; until: string } | null;
  currentAggregate: AggregatedMetaInsights | null;
  previousAggregate: AggregatedMetaInsights | null;
  primary: MetaMetricTrend | null;
  diagnostics: MetaMetricTrend[];
  insufficientReason: string | null;
};

const WINDOW_DAYS = 7;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function deliveryDays(rows: NormalizedDailyInsight[]): NormalizedDailyInsight[] {
  return rows.filter((r) => r.spend != null && r.spend > 0);
}

function sortByDateAsc(rows: NormalizedDailyInsight[]): NormalizedDailyInsight[] {
  return [...rows].sort((a, b) => a.dateStart.localeCompare(b.dateStart));
}

function trendDirection(
  current: number | null,
  previous: number | null,
  lowerIsBetter: boolean,
): MetaTrendDirection | null {
  if (current == null || previous == null) return null;
  const c = Math.round(current * 1000) / 1000;
  const p = Math.round(previous * 1000) / 1000;
  if (c === p) return "STABLE";
  const improved = lowerIsBetter ? c < p : c > p;
  return improved ? "IMPROVING" : "WORSENING";
}

function deltaPercent(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function metricTrend(
  metric: string,
  current: number | null,
  previous: number | null,
  lowerIsBetter: boolean,
): MetaMetricTrend {
  return {
    metric,
    current,
    previous,
    direction: trendDirection(current, previous, lowerIsBetter),
    deltaPercent: deltaPercent(current, previous),
  };
}

function cplFromAggregate(agg: AggregatedMetaInsights): number | null {
  if (
    agg.resultMappingConfidence !== "CONFIDENT" ||
    agg.primaryResults == null ||
    agg.primaryResults <= 0 ||
    agg.spend == null
  )
    return null;
  return Math.round((agg.spend / agg.primaryResults) * 100) / 100;
}

function windowLabel(rows: NormalizedDailyInsight[]): {
  since: string;
  until: string;
} {
  const sorted = sortByDateAsc(rows);
  return {
    since: sorted[0]!.dateStart,
    until: sorted[sorted.length - 1]!.dateStart,
  };
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

export function computeMetaTrend(
  allRows: NormalizedDailyInsight[],
  options?: { windowDays?: number },
): MetaTrendResult {
  const windowDays = options?.windowDays ?? WINDOW_DAYS;
  const delivery = deliveryDays(sortByDateAsc(allRows));

  const insufficient = (reason: string): MetaTrendResult => ({
    level: "INSUFFICIENT_TREND_DATA",
    windowDays,
    currentWindow: null,
    previousWindow: null,
    currentAggregate: null,
    previousAggregate: null,
    primary: null,
    diagnostics: [],
    insufficientReason: reason,
  });

  if (delivery.length < windowDays * 2) {
    return insufficient(
      `Servono almeno ${windowDays * 2} giorni di delivery. Disponibili: ${delivery.length}.`,
    );
  }

  const currentRows = delivery.slice(-windowDays);
  const previousRows = delivery.slice(-windowDays * 2, -windowDays);

  const periodPlaceholder = { reach: null, frequency: null };
  const currentAgg = aggregateDailyInsights(currentRows, periodPlaceholder);
  const previousAgg = aggregateDailyInsights(previousRows, periodPlaceholder);

  // Result type consistency check
  if (
    currentAgg.resultMappingConfidence === "CONFIDENT" &&
    previousAgg.resultMappingConfidence === "CONFIDENT" &&
    currentAgg.primaryResultType !== previousAgg.primaryResultType
  ) {
    return insufficient(
      "Il tipo di risultato è cambiato tra i due periodi: confronto non affidabile.",
    );
  }

  // Primary metric: cost per result (CPL/CPA) or spend as fallback
  const currentCpl = cplFromAggregate(currentAgg);
  const previousCpl = cplFromAggregate(previousAgg);

  const hasCplBoth = currentCpl != null && previousCpl != null;

  const primaryTrend: MetaMetricTrend = hasCplBoth
    ? metricTrend("cpl", currentCpl, previousCpl, true)
    : metricTrend("spend", currentAgg.spend, previousAgg.spend, true);

  const diagnostics: MetaMetricTrend[] = [
    metricTrend("ctr", currentAgg.ctr, previousAgg.ctr, false),
    metricTrend("cpc", currentAgg.cpc, previousAgg.cpc, true),
    metricTrend("cpm", currentAgg.cpm, previousAgg.cpm, true),
    // frequency from period aggregate is not available per-window; skip to avoid confusion
  ].filter((t) => t.current != null || t.previous != null);

  return {
    level: "TWO_WINDOW_COMPARISON",
    windowDays,
    currentWindow: windowLabel(currentRows),
    previousWindow: windowLabel(previousRows),
    currentAggregate: currentAgg,
    previousAggregate: previousAgg,
    primary: primaryTrend,
    diagnostics,
    insufficientReason: null,
  };
}

// ------------------------------------------------------------------
// Trend summary text (UI helper)
// ------------------------------------------------------------------

export function metaTrendSummary(trend: MetaTrendResult): string {
  if (trend.level === "INSUFFICIENT_TREND_DATA") {
    return trend.insufficientReason ?? "Dati insufficienti per il trend.";
  }
  const p = trend.primary;
  if (!p) return "Nessun dato di trend disponibile.";
  const metricLabel = p.metric === "cpl" ? "CPL" : "Spesa";
  if (p.direction === "IMPROVING")
    return `${metricLabel} in miglioramento nell'ultimo periodo.`;
  if (p.direction === "WORSENING")
    return `${metricLabel} in aumento nell'ultimo periodo.`;
  if (p.direction === "STABLE") return `${metricLabel} stabile.`;
  return "Trend non determinabile.";
}
