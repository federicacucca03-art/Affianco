/**
 * M9.2 — Ask Ally campaign copilot types.
 * Compact, whitelisted context only — never raw DB / Graph / tokens.
 */

export type AllyCopilotSource = "NATIVE" | "META" | "LINKED";

export type AllyCopilotConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type AllyCopilotHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AllyCopilotFieldStatus = "complete" | "missing" | "unavailable";

export type AllyCopilotFieldCategory =
  | "launch"
  | "monitoring"
  | "planning"
  | "unavailable";

export type AllyCopilotConfigField = {
  id: string;
  label: string;
  status: AllyCopilotFieldStatus;
  category: AllyCopilotFieldCategory;
  value: string | null;
};

export type AllyCopilotReadinessInterpretation = {
  preparazioneAlLancio: {
    percentuale: number;
    pronta: boolean;
    blocchi: string[];
    presenti: string[];
  } | null;
  monitoraggioAlly: {
    lacune: string[];
    note: string[];
  };
  regoleDomanda: {
    sogliaSostenibileNonBloccaLancio: true;
    preLancioPrioritaSoloBlocchi: true;
    unavailableSoloSeNecessario: true;
  };
};

export type AllyCopilotConfiguration = {
  fields: AllyCopilotConfigField[];
  /** Question-specific launch vs monitoring split (Italian keys). */
  interpretazione: AllyCopilotReadinessInterpretation | null;
};

/** Safe identity — names only, no emails / ids of other users. */
export type AllyCopilotIdentity = {
  campaignId: string;
  source: AllyCopilotSource;
  clientName: string;
  campaignName: string;
  objective: string | null;
  href: string;
};

export type AllyCopilotWorkflow = {
  /** Raw status for logic; prefer statusLabelIt in user-facing answers. */
  status: string | null;
  statusLabelIt: string;
  attentionState: string;
  attentionLabelIt: string;
  urgencyLevel: string;
  configurationKind: string | null;
  /** Italian human reason — never dump English enum names to the user. */
  attentionReasonIt: string;
};

export type AllyCopilotPlanning = {
  settore: string | null;
  citta: string | null;
  audienceHint: string | null;
  offer: string | null;
  dailyBudget: number | null;
  etaMin: number | null;
  etaMax: number | null;
  raggioKm: number | null;
  targetType: string | null;
  targetAge: string | null;
  copyVariants: string[];
  headline: string | null;
  creativeFormatHint: string | null;
  hasCreativeAsset: boolean;
  hasPageId: boolean;
  hasFormId: boolean;
  hasWebsite: boolean;
  /** Present when a current semantic creative analysis exists. */
  creativeSemanticNote: string | null;
};

export type AllyCopilotEconomics = {
  maxSustainableCpa: number | null;
  targetMargin: number | null;
  targetValue: number | null;
  primaryKpi: string | null;
};

export type AllyCopilotPerformance = {
  spend: number | null;
  results: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  actualValue: number | null;
  health: string | null;
  trend: string;
  smallSample: boolean;
  hasDownstreamQualityEvidence: boolean;
  hasCreativeAnalysisEvidence: boolean;
  comparisons: {
    ctr: string | null;
    cpc: string | null;
    cpm: string | null;
    frequency: string | null;
  };
  /** True when there is no meaningful performance snapshot yet. */
  noPerformanceDataYet: boolean;
  /** M10C — objective-aware performance facts (deterministic). */
  performanceFamily: string | null;
  primaryOutcomeLabel: string | null;
  primaryMetricIds: string[];
  supportingMetricIds: string[];
  resultMappingConfidence: string | null;
  economicMetric: string | null;
  economicTargetRequired: boolean;
  outcomeLimitation: string | null;
  dataSufficiencyMode: string | null;
  /** M10C.1 — sample volume met (independent of result ambiguity). */
  sampleSufficient: boolean | null;
  /** M10C.1 — economic target missing (independent of result ambiguity). */
  targetMissing: boolean | null;
};

export type AllyCopilotDecision = {
  nextActionType: string | null;
  nextActionTitle: string | null;
  nextActionHref: string | null;
};

/** M10A — compact Meta hierarchy for Ask Ally (optional). */
export type AllyCopilotHierarchyAd = {
  name: string;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  dataSufficiency: string;
  operationalState: string;
};

export type AllyCopilotHierarchyAdSet = {
  name: string;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  dataSufficiency: string;
  operationalState: string;
  ads: AllyCopilotHierarchyAd[];
};

export type AllyCopilotHierarchy = {
  adSets: AllyCopilotHierarchyAdSet[];
  focusHint: { adSetName: string | null; adName: string | null } | null;
  diagnosisLines: string[];
};

/** M10D — compact read-only Meta configuration for Ask Ally. */
export type AllyCopilotMetaConfiguration = {
  beginnerLines: Array<{ label: string; value: string }>;
  observations: Array<{
    severity: string;
    title: string;
    explanation: string;
  }>;
  plannedVsActual: Array<{
    field: string;
    state: string;
    plannedLabel: string | null;
    actualLabel: string | null;
  }> | null;
  unknownFields: string[];
};

/** M10E — measurement reliability for Ask Ally (deterministic). */
export type AllyCopilotTrackingHealth = {
  status: string;
  reliability: string;
  reliabilityLabel: string;
  summary: string;
  performanceConfidence: string;
  signals: string[];
  issues: Array<{
    severity: string;
    title: string;
    explanation: string;
  }>;
  unknowns: string[];
  pixelVisibility: string;
  /** Outcome-relevant action types that justify result-signal claims. */
  relevantResultActions: string[];
  /** Other observed actions (engagement/delivery) — secondary. */
  otherObservedActions: string[];
};

/** M10F — deterministic deep diagnosis for Ask Ally. */
export type AllyCopilotDeepDiagnosis = {
  evaluability: string;
  primaryFocus: string | null;
  confidence: string;
  label: string;
  summary: string;
  facts: string[];
  hypotheses: string[];
  unknowns: string[];
  blockers: string[];
  nextCheck: string | null;
  selfComparison: string;
  comparisonWindowLabel: string | null;
  /** CTR values are percentage points (2.87 = 2.87%). */
  comparisonMetrics: {
    ctrPrevious: number | null;
    ctrCurrent: number | null;
    ctrDeltaPercent: number | null;
    cpcPrevious: number | null;
    cpcCurrent: number | null;
    cpcDeltaPercent: number | null;
  } | null;
};

/** Canonical compact context sent to the model (plus question + short history). */
export type AllyCampaignCopilotContext = {
  identity: AllyCopilotIdentity;
  workflow: AllyCopilotWorkflow;
  planning: AllyCopilotPlanning;
  economics: AllyCopilotEconomics;
  performance: AllyCopilotPerformance;
  decision: AllyCopilotDecision;
  configuration: AllyCopilotConfiguration;
  linkedNativeId: string | null;
  hierarchy: AllyCopilotHierarchy | null;
  metaConfiguration: AllyCopilotMetaConfiguration | null;
  trackingHealth: AllyCopilotTrackingHealth | null;
  deepDiagnosis: AllyCopilotDeepDiagnosis | null;
};

export type AllyCopilotAnswer = {
  answer: string;
  confidence: AllyCopilotConfidence;
  evidence: string[];
  hypotheses: string[];
  missingInformation: string[];
  suggestedNextQuestions: string[];
  recommendedActionHref: string | null;
  fromAi: boolean;
};

export const ALLY_COPILOT_MAX_HISTORY_TURNS = 6;
export const ALLY_COPILOT_MAX_QUESTION_CHARS = 500;
/** Headroom for structured JSON + Italian prose (truncation caused silent fallback). */
export const ALLY_COPILOT_MAX_ANSWER_TOKENS = 1400;
export const ALLY_COPILOT_TIMEOUT_MS = 25_000;
/** Soft ceiling for JSON context + history (chars). */
export const ALLY_COPILOT_MAX_INPUT_CHARS = 8_000;
