/**
 * M9.1 — Ally oggi public barrel (client-safe exports).
 */

export {
  buildAllyOggiBriefContext,
  estimateAllyOggiPromptChars,
  isStaleMetaInsights,
} from "@/lib/ally-oggi/build-context";
export { buildAllyOggiFallback } from "@/lib/ally-oggi/fallback";
export {
  sanitizeAllyOggiBriefContext,
  shouldGenerateAllyOggiBrief,
} from "@/lib/ally-oggi/sanitize-context";
export type {
  AllyOggiBrief,
  AllyOggiBriefContext,
  AllyOggiBriefItem,
  AllyOggiCampaignFact,
} from "@/lib/ally-oggi/types";
export {
  ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT,
  ALLY_OGGI_MAX_CONFIGURATION,
  ALLY_OGGI_MAX_PRIORITY,
  ALLY_OGGI_MAX_WATCH,
} from "@/lib/ally-oggi/types";
