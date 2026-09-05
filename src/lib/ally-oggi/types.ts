/**
 * M9.1B — Ally oggi types.
 * Workspace awareness ≠ performance evaluation.
 */

export type AllyOggiItemKind = "priority" | "watch" | "configuration";

/** Compact workspace aggregates (workflow + inventory). No per-row dump. */
export type AllyOggiWorkspaceSummary = {
  totalWorkspaceCampaigns: number;
  nativeCampaigns: number;
  metaCampaigns: number;
  draftCampaigns: number;
  revisionRequestedCampaigns: number;
  approvedCampaigns: number;
  /** CR-visible campaigns that are in a monitoring path (not draft-config / not historical-only). */
  monitorableCampaigns: number;
  configurationRequiredCampaigns: number;
  insufficientDataCampaigns: number;
  historicalCampaigns: number;
};

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
  workspace: AllyOggiWorkspaceSummary;
  /** Control Room visible count after link suppression (inventory of CR rows). */
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
  /**
   * Bounded prioritized *performance / config* facts from Control Room.
   * Excludes draft-only and revision-workflow rows (those live in workspace aggregates).
   */
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

export function emptyAllyOggiWorkspaceSummary(): AllyOggiWorkspaceSummary {
  return {
    totalWorkspaceCampaigns: 0,
    nativeCampaigns: 0,
    metaCampaigns: 0,
    draftCampaigns: 0,
    revisionRequestedCampaigns: 0,
    approvedCampaigns: 0,
    monitorableCampaigns: 0,
    configurationRequiredCampaigns: 0,
    insufficientDataCampaigns: 0,
    historicalCampaigns: 0,
  };
}
