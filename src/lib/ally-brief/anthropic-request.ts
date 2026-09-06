/**
 * M9.3A — Anthropic params for brief analysis (Sonnet 5 compatible).
 * Pure — safe to import from verification scripts.
 */

import { anthropicModelId } from "@/lib/anthropic-config";
import {
  ALLY_BRIEF_SYSTEM_PROMPT,
  buildAllyBriefUserPrompt,
} from "@/lib/ally-brief/prompt";
import type { AllyBriefExistingClientContext } from "@/lib/ally-brief/types";
import { ALLY_BRIEF_MAX_TOKENS } from "@/lib/ally-brief/types";

export type AllyBriefAnthropicCreateParams = {
  model: string;
  max_tokens: number;
  system: string;
  thinking: { type: "disabled" };
  messages: Array<{ role: "user"; content: string }>;
};

export function buildAllyBriefAnthropicParams(input: {
  brief: string;
  existingClient: AllyBriefExistingClientContext | null;
}): AllyBriefAnthropicCreateParams {
  return {
    model: anthropicModelId(),
    max_tokens: ALLY_BRIEF_MAX_TOKENS,
    thinking: { type: "disabled" },
    system: ALLY_BRIEF_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildAllyBriefUserPrompt({
          brief: input.brief,
          existingClient: input.existingClient,
        }),
      },
    ],
  };
}

export function assertAllyBriefRequestCompatibleWithSonnet5(
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
    throw new Error("thinking deve essere disabled per Ally brief JSON");
  }
}
