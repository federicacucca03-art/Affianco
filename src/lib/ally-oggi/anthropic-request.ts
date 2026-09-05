/**
 * M9.1 — Anthropic request params for Ally oggi.
 * Pure — Sonnet 5 compatible (no temperature/top_p; thinking disabled).
 */

import { anthropicModelId } from "@/lib/anthropic-config";
import {
  ALLY_OGGI_SYSTEM_PROMPT,
  buildAllyOggiUserPrompt,
} from "@/lib/ally-oggi/prompt";
import type { AllyOggiBriefContext } from "@/lib/ally-oggi/types";

export const ALLY_OGGI_MAX_TOKENS = 900;
export const ALLY_OGGI_TIMEOUT_MS = 25_000;

export type AllyOggiAnthropicCreateParams = {
  model: string;
  max_tokens: number;
  system: string;
  thinking: { type: "disabled" };
  messages: Array<{ role: "user"; content: string }>;
};

export function buildAllyOggiAnthropicParams(
  context: AllyOggiBriefContext,
): AllyOggiAnthropicCreateParams {
  return {
    model: anthropicModelId(),
    max_tokens: ALLY_OGGI_MAX_TOKENS,
    thinking: { type: "disabled" },
    system: ALLY_OGGI_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildAllyOggiUserPrompt(context),
      },
    ],
  };
}

export function assertAllyOggiRequestCompatibleWithSonnet5(
  params: Record<string, unknown>,
): void {
  if ("temperature" in params && params.temperature !== undefined) {
    throw new Error("temperature non consentito con claude-sonnet-5");
  }
  if ("top_p" in params && params.top_p !== undefined) {
    throw new Error("top_p non consentito con claude-sonnet-5");
  }
  if ("top_k" in params && params.top_k !== undefined) {
    throw new Error("top_k non consentito con claude-sonnet-5");
  }
  const thinking = params.thinking as { type?: string } | undefined;
  if (!thinking || thinking.type !== "disabled") {
    throw new Error("thinking deve essere disabled per Ally oggi JSON breve");
  }
}
