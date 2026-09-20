/**
 * M10F.2 — Session-scoped UI continuity (client only).
 * Never stores canonical campaign facts — only disclosure + Ask Ally presentation.
 */

export const ALLY_SESSION_UI_VERSION = 1 as const;

export type ResultsUiSessionState = {
  version: typeof ALLY_SESSION_UI_VERSION;
  hierarchyOpen: boolean;
  adSetExpandedIds: string[];
  campaignConfigOpen: boolean;
  measurementDetailsOpen: boolean;
  diagnosisEvidenceOpen: boolean;
  creativeEvidenceOpen: boolean;
  /** Ad-set configuration technical disclosure by metaAdSetId. */
  adSetConfigOpenIds: string[];
  /** Ad configuration technical disclosure by metaAdId. */
  adConfigOpenIds: string[];
};

export type AskAllySessionState = {
  version: typeof ALLY_SESSION_UI_VERSION;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  latest: {
    answer: string;
    confidence: string;
    evidence: string[];
    hypotheses: string[];
    missingInformation: string[];
    suggestedNextQuestions: string[];
    recommendedActionHref: string | null;
    fromAi: boolean;
  } | null;
  draft: string;
  error: string | null;
};

export const DEFAULT_RESULTS_UI_SESSION: ResultsUiSessionState = {
  version: ALLY_SESSION_UI_VERSION,
  hierarchyOpen: false,
  adSetExpandedIds: [],
  campaignConfigOpen: false,
  measurementDetailsOpen: false,
  diagnosisEvidenceOpen: false,
  creativeEvidenceOpen: false,
  adSetConfigOpenIds: [],
  adConfigOpenIds: [],
};

export const DEFAULT_ASK_ALLY_SESSION: AskAllySessionState = {
  version: ALLY_SESSION_UI_VERSION,
  history: [],
  latest: null,
  draft: "",
  error: null,
};
