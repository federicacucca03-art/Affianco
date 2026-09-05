/**
 * M9.2 — Anthropic params for Ask Ally (Sonnet 5 compatible).
 */

import { anthropicModelId } from "@/lib/anthropic-config";
import {
  ALLY_COPILOT_SYSTEM_PROMPT,
  buildAllyCopilotUserPrompt,
} from "@/lib/ally-copilot/prompt";
import type {
  AllyCampaignCopilotContext,
  AllyCopilotHistoryTurn,
} from "@/lib/ally-copilot/types";
import { ALLY_COPILOT_MAX_ANSWER_TOKENS } from "@/lib/ally-copilot/types";

export type AllyCopilotAnthropicCreateParams = {
  model: string;
  max_tokens: number;
  system: string;
  thinking: { type: "disabled" };
  messages: Array<{ role: "user"; content: string }>;
};

export function buildAllyCopilotAnthropicParams(input: {
  context: AllyCampaignCopilotContext;
  question: string;
  history: AllyCopilotHistoryTurn[];
}): AllyCopilotAnthropicCreateParams {
  return {
    model: anthropicModelId(),
    max_tokens: ALLY_COPILOT_MAX_ANSWER_TOKENS,
    thinking: { type: "disabled" },
    system: ALLY_COPILOT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildAllyCopilotUserPrompt(input),
      },
    ],
  };
}

export function assertAllyCopilotRequestCompatibleWithSonnet5(
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
    throw new Error("thinking deve essere disabled per Ask Ally");
  }
}
