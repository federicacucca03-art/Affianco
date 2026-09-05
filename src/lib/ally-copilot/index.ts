/**
 * M9.2 — client-safe Ally copilot exports.
 */

export type {
  AllyCampaignCopilotContext,
  AllyCopilotAnswer,
  AllyCopilotConfidence,
  AllyCopilotHistoryTurn,
  AllyCopilotSource,
} from "@/lib/ally-copilot/types";

export {
  ALLY_COPILOT_MAX_HISTORY_TURNS,
  ALLY_COPILOT_MAX_INPUT_CHARS,
  ALLY_COPILOT_MAX_QUESTION_CHARS,
} from "@/lib/ally-copilot/types";

export { buildAllyCopilotSuggestions } from "@/lib/ally-copilot/suggestions";
export {
  buildAllyCampaignCopilotContext,
  estimateAllyCopilotInputChars,
  fitAllyCopilotInput,
  assertAllyCopilotPayloadSafe,
} from "@/lib/ally-copilot/build-context";
export {
  buildAllyCopilotConfigurationInventory,
  summarizeLaunchReadinessForCopilot,
} from "@/lib/ally-copilot/configuration-inventory";
export {
  sanitizeAllyCopilotQuestion,
  sanitizeAllyCopilotHistory,
} from "@/lib/ally-copilot/sanitize";
export {
  parseAllyCopilotAnswer,
  buildAllyCopilotFallbackAnswer,
} from "@/lib/ally-copilot/parse";
