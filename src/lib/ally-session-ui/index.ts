/**
 * M10F.2 — Session UI continuity helpers.
 */

export type {
  ResultsUiSessionState,
  AskAllySessionState,
} from "@/lib/ally-session-ui/types";

export {
  ALLY_SESSION_UI_VERSION,
  DEFAULT_RESULTS_UI_SESSION,
  DEFAULT_ASK_ALLY_SESSION,
} from "@/lib/ally-session-ui/types";

export {
  resultsUiSessionKey,
  askAllySessionKey,
  parseResultsUiSession,
  parseAskAllySession,
  readResultsUiSession,
  writeResultsUiSession,
  readAskAllySession,
  writeAskAllySession,
  clearAllySessionUiForUser,
  idsToRecord,
  recordToIds,
} from "@/lib/ally-session-ui/storage";
