/**
 * M10C — Build display metric values from aggregate + profile (no inventions).
 */

import { deriveRoas } from "@/lib/meta/insight-actions";
import type { AggregatedMetaInsights } from "@/lib/meta/insight-aggregate";
import {
  etichettaPerformanceMetric,
} from "@/lib/meta/objective-performance/labels";
import type {
  ObjectivePerformanceProfile,
  PerformanceMetricId,
} from "@/lib/meta/objective-performance/types";

export type PerformanceMetricDisplay = {
  id: PerformanceMetricId;
  label: string;
  /** Formatted or raw number; null = unavailable (do not invent). */
  value: number | null;
  format: "euro" | "number" | "percent" | "ratio" | "plain";
  available: boolean;
  note: string | null;
};

function costPer(
  spend: number | null,
  count: number | null,
  confidence: string,
): number | null {
  if (confidence !== "CONFIDENT") return null;
  if (spend == null || count == null || count <= 0) return null;
  return Math.round((spend / count) * 100) / 100;
}

export function resolveMetricValue(
  id: PerformanceMetricId,
  aggregate: AggregatedMetaInsights,
  outcomeLimitation: string | null,
): { value: number | null; note: string | null; format: PerformanceMetricDisplay["format"] } {
  const conf = aggregate.resultMappingConfidence;
  switch (id) {
    case "spend":
      return { value: aggregate.spend, note: null, format: "euro" };
    case "impressions":
      return { value: aggregate.impressions, note: null, format: "number" };
    case "reach":
      return { value: aggregate.periodReach, note: null, format: "number" };
    case "frequency":
      return { value: aggregate.periodFrequency, note: null, format: "plain" };
    case "cpm":
      return { value: aggregate.cpm, note: null, format: "euro" };
    case "ctr":
      return { value: aggregate.ctr, note: null, format: "percent" };
    case "cpc":
      return { value: aggregate.cpc, note: null, format: "euro" };
    case "link_clicks":
      return { value: aggregate.linkClicks, note: null, format: "number" };
    case "results":
    case "purchases":
    case "landing_page_views":
    case "engagement":
      return {
        value: conf === "CONFIDENT" ? aggregate.primaryResults : null,
        note:
          conf === "AMBIGUOUS"
            ? "Risultati non determinabili (mapping ambiguo)."
            : conf === "UNKNOWN"
              ? "Risultato primario non disponibile."
              : outcomeLimitation,
        format: "number",
      };
    case "cost_per_result":
    case "cost_per_purchase":
    case "cost_per_lpv":
    case "cost_per_engagement":
      return {
        value: costPer(aggregate.spend, aggregate.primaryResults, conf),
        note:
          conf === "AMBIGUOUS"
            ? "Costo per risultato non calcolato: mapping ambiguo."
            : conf !== "CONFIDENT"
              ? "Costo per risultato non disponibile."
              : outcomeLimitation,
        format: "euro",
      };
    case "roas": {
      const roas =
        conf === "CONFIDENT" && aggregate.primaryResultValue != null
          ? deriveRoas(aggregate.spend, aggregate.primaryResultValue)
          : null;
      return {
        value: roas,
        note:
          roas == null
            ? "ROAS non disponibile: serve spesa e valore acquisti affidabile."
            : null,
        format: "ratio",
      };
    }
    default:
      return { value: null, note: null, format: "plain" };
  }
}

export function buildPrimaryMetricDisplays(
  profile: ObjectivePerformanceProfile,
  aggregate: AggregatedMetaInsights,
  outcomeLimitation: string | null = null,
): PerformanceMetricDisplay[] {
  return profile.primaryMetrics.map((id) => {
    const resolved = resolveMetricValue(id, aggregate, outcomeLimitation);
    return {
      id,
      label: etichettaPerformanceMetric(id),
      value: resolved.value,
      format: resolved.format,
      available: resolved.value != null,
      note: resolved.note,
    };
  });
}
