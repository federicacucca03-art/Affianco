/**
 * M9.1 — Ally oggi types.
 * AI narrates deterministic Control Room facts. Never mutates health/urgency.
 */

export type AllyOggiItemKind = "priority" | "watch" | "configuration";

export type AllyOggiCampaignFact = {
  campaignId: string;
  source: "NATIVE" | "META";
  clientName: string;
  campaignName: string;
  attentionState: string;
  urgencyLevel: string;
  healthStatus: string | null;
  trend: string;
  configurationKind: string | null;
  resultsCount: number | null;
  primaryMetric: string | null;
  primaryMetricValue: number | null;
  targetValue: number | null;
  nextActionType: string | null;
  nextActionTitle: string | null;
  smallSample: boolean;
  staleMeta: boolean;
  href: string;
};

export type AllyOggiBriefContext = {
  totalMonitored: number;
  counts: {
    critical: number;
    needsAttention: number;
    monitor: number;
    stable: number;
    configurationRequired: number;
    insufficientData: number;
    historical: number;
  };
  staleMetaCount: number;
  campaigns: AllyOggiCampaignFact[];
};

export type AllyOggiBriefItem = {
  campaignId: string;
  source: "NATIVE" | "META";
  title: string;
  sentence: string;
  recommendedHref: string;
};

export type AllyOggiBrief = {
  headline: string;
  summary: string;
  priorityItems: AllyOggiBriefItem[];
  watchItems: AllyOggiBriefItem[];
  configurationItems: AllyOggiBriefItem[];
  closingNote: string | null;
  /** true when AI produced the narrative; false for deterministic fallback. */
  fromAi: boolean;
};

export const ALLY_OGGI_MAX_PRIORITY = 3;
export const ALLY_OGGI_MAX_WATCH = 2;
export const ALLY_OGGI_MAX_CONFIGURATION = 2;
/** Max campaign facts sent to the model (one call). */
export const ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT = 8;
