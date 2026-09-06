/**
 * M9.3A — run one Anthropic call for brief analysis.
 */

import Anthropic from "@anthropic-ai/sdk";
import { anthropicModelId } from "@/lib/anthropic-config";
import {
  ALLY_BRIEF_SYSTEM_PROMPT,
  buildAllyBriefUserPrompt,
} from "@/lib/ally-brief/prompt";
import {
  buildAllyBriefFallbackProposal,
  parseAllyBriefProposal,
} from "@/lib/ally-brief/parse";
import type {
  AllyBriefExistingClientContext,
  AllyBriefProposal,
} from "@/lib/ally-brief/types";
import { ALLY_BRIEF_MAX_TOKENS, ALLY_BRIEF_TIMEOUT_MS } from "@/lib/ally-brief/types";

export function buildAllyBriefAnthropicParams(input: {
  brief: string;
  existingClient: AllyBriefExistingClientContext | null;
}) {
  return {
    model: anthropicModelId(),
    max_tokens: ALLY_BRIEF_MAX_TOKENS,
    thinking: { type: "disabled" as const },
    system: ALLY_BRIEF_SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: buildAllyBriefUserPrompt({
          brief: input.brief,
          existingClient: input.existingClient,
        }),
      },
    ],
  };
}

export async function runAllyBriefAnalysis(input: {
  brief: string;
  existingClient: AllyBriefExistingClientContext | null;
}): Promise<AllyBriefProposal> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return buildAllyBriefFallbackProposal(input.brief, input.existingClient);
  }

  const client = new Anthropic({ apiKey: key });
  const params = buildAllyBriefAnthropicParams(input);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ALLY_BRIEF_TIMEOUT_MS);
    const res = await client.messages.create(params, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    if (!text) {
      return buildAllyBriefFallbackProposal(input.brief, input.existingClient);
    }
    return parseAllyBriefProposal(text, input.existingClient);
  } catch {
    return buildAllyBriefFallbackProposal(input.brief, input.existingClient);
  }
}
