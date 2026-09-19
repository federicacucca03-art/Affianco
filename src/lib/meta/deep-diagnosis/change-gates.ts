/**
 * M10F — Conservative material-change gates for self-comparison.
 * Tiny fluctuations must not become diagnosis.
 */

import type { MetaMetricTrend, MetaTrendDirection } from "@/lib/meta/meta-trend";

/** Absolute |Δ%| required before a directional change is "material". */
export const MATERIAL_CHANGE_PCT = 20;

export function isMaterialChange(
  trend: MetaMetricTrend | null | undefined,
): boolean {
  if (!trend || trend.direction == null || trend.deltaPercent == null) {
    return false;
  }
  if (trend.direction === "STABLE") return false;
  return Math.abs(trend.deltaPercent) >= MATERIAL_CHANGE_PCT;
}

export function isMaterialWorsening(
  trend: MetaMetricTrend | null | undefined,
): boolean {
  return isMaterialChange(trend) && trend?.direction === "WORSENING";
}

export function isMaterialImproving(
  trend: MetaMetricTrend | null | undefined,
): boolean {
  return isMaterialChange(trend) && trend?.direction === "IMPROVING";
}

export function isApproximatelyStable(
  trend: MetaMetricTrend | null | undefined,
): boolean {
  if (!trend || trend.direction == null) return false;
  if (trend.direction === "STABLE") return true;
  if (trend.deltaPercent == null) return false;
  return Math.abs(trend.deltaPercent) < MATERIAL_CHANGE_PCT;
}

export function findDiagnostic(
  diagnostics: MetaMetricTrend[],
  metric: string,
): MetaMetricTrend | null {
  return diagnostics.find((d) => d.metric === metric) ?? null;
}

export function directionLabelIt(
  direction: MetaTrendDirection | null,
): string {
  switch (direction) {
    case "IMPROVING":
      return "in miglioramento";
    case "WORSENING":
      return "in peggioramento";
    case "STABLE":
      return "stabile";
    default:
      return "non determinabile";
  }
}
