/**
 * M10C — Objective-aware evidence sufficiency (conservative, documented).
 *
 * Rules:
 * - All modes: daysActive < 3 → INSUFFICIENT_DATA
 * - CONVERSION (Leads/Sales): results < 2 → INSUFFICIENT_DATA
 * - TRAFFIC: (LPV or link clicks as primary evidence) < 5 → INSUFFICIENT_DATA
 * - DELIVERY (Awareness): impressions < 1000 → INSUFFICIENT_DATA
 * - ENGAGEMENT: engagement results < 5 → INSUFFICIENT_DATA
 * - GENERIC: impressions < 500 AND linkClicks < 5 → INSUFFICIENT_DATA
 *
 * Null counts with known days still insufficient (cannot prove volume).
 */

import type { EvidenceSufficiencyMode } from "@/lib/meta/objective-performance/types";

export type EvidenceSufficiency = "SUFFICIENT" | "INSUFFICIENT_DATA";

export const M10C_SUFFICIENCY_RULES = {
  minDays: 3,
  conversionMinResults: 2,
  trafficMinEvents: 5,
  deliveryMinImpressions: 1000,
  engagementMinResults: 5,
  genericMinImpressions: 500,
  genericMinLinkClicks: 5,
} as const;

export function evaluateObjectiveEvidenceSufficiency(input: {
  mode: EvidenceSufficiencyMode;
  daysActive: number | null;
  /** Primary conversion / traffic / engagement event count when applicable. */
  resultsCount: number | null;
  impressions: number | null;
  linkClicks: number | null;
}): EvidenceSufficiency {
  const { minDays } = M10C_SUFFICIENCY_RULES;
  if (input.daysActive == null || input.daysActive < minDays) {
    return "INSUFFICIENT_DATA";
  }

  switch (input.mode) {
    case "CONVERSION": {
      if (
        input.resultsCount == null ||
        input.resultsCount < M10C_SUFFICIENCY_RULES.conversionMinResults
      ) {
        return "INSUFFICIENT_DATA";
      }
      return "SUFFICIENT";
    }
    case "TRAFFIC": {
      if (
        input.resultsCount == null ||
        input.resultsCount < M10C_SUFFICIENCY_RULES.trafficMinEvents
      ) {
        return "INSUFFICIENT_DATA";
      }
      return "SUFFICIENT";
    }
    case "DELIVERY": {
      if (
        input.impressions == null ||
        input.impressions < M10C_SUFFICIENCY_RULES.deliveryMinImpressions
      ) {
        return "INSUFFICIENT_DATA";
      }
      return "SUFFICIENT";
    }
    case "ENGAGEMENT": {
      if (
        input.resultsCount == null ||
        input.resultsCount < M10C_SUFFICIENCY_RULES.engagementMinResults
      ) {
        return "INSUFFICIENT_DATA";
      }
      return "SUFFICIENT";
    }
    case "GENERIC":
    default: {
      const impressionsOk =
        input.impressions != null &&
        input.impressions >= M10C_SUFFICIENCY_RULES.genericMinImpressions;
      const clicksOk =
        input.linkClicks != null &&
        input.linkClicks >= M10C_SUFFICIENCY_RULES.genericMinLinkClicks;
      if (!impressionsOk && !clicksOk) return "INSUFFICIENT_DATA";
      return "SUFFICIENT";
    }
  }
}
