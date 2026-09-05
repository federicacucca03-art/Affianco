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
};

export type AllyCopilotDecision = {
  nextActionType: string | null;
  nextActionTitle: string | null;
  nextActionHref: string | null;
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
export const ALLY_COPILOT_MAX_ANSWER_TOKENS = 900;
export const ALLY_COPILOT_TIMEOUT_MS = 25_000;
/** Soft ceiling for JSON context + history (chars). */
export const ALLY_COPILOT_MAX_INPUT_CHARS = 8_000;
