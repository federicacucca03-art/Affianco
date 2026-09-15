/**
 * M10C — Canonical objective → performance profile map.
 */

import type {
  ObjectivePerformanceProfile,
  PerformanceObjectiveFamily,
} from "@/lib/meta/objective-performance/types";

const LEADS_ACTIONS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "omni_lead",
] as const;

const SALES_ACTIONS = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
] as const;

const TRAFFIC_ACTIONS = [
  "landing_page_view",
  "omni_landing_page_view",
  "link_click",
] as const;

const ENGAGEMENT_ACTIONS = [
  "post_engagement",
  "page_engagement",
  "video_view",
] as const;

export const PROFILE_LEADS: ObjectivePerformanceProfile = {
  family: "LEADS",
  primaryOutcomeLabel: "Contatti / lead",
  primaryMetrics: ["results", "cost_per_result", "spend", "ctr"],
  supportingMetrics: ["cpc", "link_clicks", "impressions"],
  resultActionCandidates: LEADS_ACTIONS,
  economicMetric: "CPL",
  economicTargetRequired: true,
  unsupportedMetrics: ["roas", "purchases", "landing_page_views"],
  sufficiencyMode: "CONVERSION",
  deliveryWithoutEconomicTarget: false,
};

export const PROFILE_SALES: ObjectivePerformanceProfile = {
  family: "SALES",
  primaryOutcomeLabel: "Acquisti",
  primaryMetrics: ["purchases", "cost_per_purchase", "roas", "spend"],
  supportingMetrics: ["ctr", "cpc", "link_clicks"],
  resultActionCandidates: SALES_ACTIONS,
  economicMetric: "CPA",
  economicTargetRequired: true,
  unsupportedMetrics: ["landing_page_views"],
  sufficiencyMode: "CONVERSION",
  deliveryWithoutEconomicTarget: false,
};

export const PROFILE_TRAFFIC: ObjectivePerformanceProfile = {
  family: "TRAFFIC",
  primaryOutcomeLabel: "Traffico al sito",
  primaryMetrics: ["landing_page_views", "cost_per_lpv", "ctr", "spend"],
  supportingMetrics: ["link_clicks", "cpc", "impressions"],
  resultActionCandidates: TRAFFIC_ACTIONS,
  economicMetric: "COST_PER_LPV",
  economicTargetRequired: false,
  unsupportedMetrics: ["roas", "purchases", "results"],
  sufficiencyMode: "TRAFFIC",
  deliveryWithoutEconomicTarget: true,
};

export const PROFILE_AWARENESS: ObjectivePerformanceProfile = {
  family: "AWARENESS",
  primaryOutcomeLabel: "Copertura / notorietà",
  primaryMetrics: ["reach", "impressions", "frequency", "cpm", "spend"],
  supportingMetrics: ["ctr"],
  resultActionCandidates: [],
  economicMetric: "CPM",
  economicTargetRequired: false,
  unsupportedMetrics: [
    "results",
    "cost_per_result",
    "purchases",
    "roas",
    "landing_page_views",
  ],
  sufficiencyMode: "DELIVERY",
  deliveryWithoutEconomicTarget: true,
};

export const PROFILE_ENGAGEMENT: ObjectivePerformanceProfile = {
  family: "ENGAGEMENT",
  primaryOutcomeLabel: "Interazioni",
  primaryMetrics: ["engagement", "cost_per_engagement", "spend", "ctr"],
  supportingMetrics: ["impressions", "reach", "cpc"],
  resultActionCandidates: ENGAGEMENT_ACTIONS,
  economicMetric: "NONE",
  economicTargetRequired: false,
  unsupportedMetrics: ["roas", "purchases", "landing_page_views"],
  sufficiencyMode: "ENGAGEMENT",
  deliveryWithoutEconomicTarget: true,
};

export const PROFILE_UNKNOWN: ObjectivePerformanceProfile = {
  family: "UNKNOWN",
  primaryOutcomeLabel: "Obiettivo non supportato",
  primaryMetrics: ["spend", "impressions", "reach", "link_clicks"],
  supportingMetrics: ["ctr", "cpc", "cpm"],
  resultActionCandidates: [],
  economicMetric: "NONE",
  economicTargetRequired: false,
  unsupportedMetrics: [
    "results",
    "cost_per_result",
    "purchases",
    "roas",
    "landing_page_views",
  ],
  sufficiencyMode: "GENERIC",
  deliveryWithoutEconomicTarget: true,
};

const LEADS_CODES = new Set(["LEADS", "OUTCOME_LEADS"]);
const SALES_CODES = new Set([
  "OUTCOME_SALES",
  "CONVERSIONS",
  "PRODUCT_CATALOG_SALES",
  "CATALOG_SALES",
]);
const TRAFFIC_CODES = new Set([
  "OUTCOME_TRAFFIC",
  "TRAFFIC",
  "LINK_CLICKS",
]);
const AWARENESS_CODES = new Set([
  "OUTCOME_AWARENESS",
  "BRAND_AWARENESS",
  "REACH",
  "AWARENESS",
]);
const ENGAGEMENT_CODES = new Set([
  "OUTCOME_ENGAGEMENT",
  "ENGAGEMENT",
  "POST_ENGAGEMENT",
  "VIDEO_VIEWS",
]);

export function resolvePerformanceFamily(
  rawObjective: string | null | undefined,
): PerformanceObjectiveFamily {
  const code =
    typeof rawObjective === "string" && rawObjective.trim()
      ? rawObjective.trim().toUpperCase()
      : "";
  if (!code) return "UNKNOWN";
  if (LEADS_CODES.has(code)) return "LEADS";
  if (SALES_CODES.has(code)) return "SALES";
  if (TRAFFIC_CODES.has(code)) return "TRAFFIC";
  if (AWARENESS_CODES.has(code)) return "AWARENESS";
  if (ENGAGEMENT_CODES.has(code)) return "ENGAGEMENT";
  return "UNKNOWN";
}

export function resolveObjectivePerformanceProfile(
  rawObjective: string | null | undefined,
): ObjectivePerformanceProfile {
  switch (resolvePerformanceFamily(rawObjective)) {
    case "LEADS":
      return PROFILE_LEADS;
    case "SALES":
      return PROFILE_SALES;
    case "TRAFFIC":
      return PROFILE_TRAFFIC;
    case "AWARENESS":
      return PROFILE_AWARENESS;
    case "ENGAGEMENT":
      return PROFILE_ENGAGEMENT;
    default:
      return PROFILE_UNKNOWN;
  }
}
