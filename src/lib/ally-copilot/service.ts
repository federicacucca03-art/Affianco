/**
 * M9.2 — run Ask Ally (one Anthropic call). Server-only.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  assertAllyCopilotRequestCompatibleWithSonnet5,
  buildAllyCopilotAnthropicParams,
} from "@/lib/ally-copilot/anthropic-request";
import {
  buildAllyCopilotFallbackAnswer,
  parseAllyCopilotAnswer,
} from "@/lib/ally-copilot/parse";
import type {
  AllyCampaignCopilotContext,
  AllyCopilotAnswer,
  AllyCopilotHistoryTurn,
} from "@/lib/ally-copilot/types";
import { ALLY_COPILOT_TIMEOUT_MS } from "@/lib/ally-copilot/types";

export async function runAllyCampaignCopilot(input: {
  context: AllyCampaignCopilotContext;
  question: string;
  history: AllyCopilotHistoryTurn[];
}): Promise<AllyCopilotAnswer> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return buildAllyCopilotFallbackAnswer(input.context);
  }

  const createParams = buildAllyCopilotAnthropicParams(input);
  assertAllyCopilotRequestCompatibleWithSonnet5(
    createParams as unknown as Record<string, unknown>,
  );

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALLY_COPILOT_TIMEOUT_MS);

  try {
    const message = await client.messages.create(createParams, {
      signal: controller.signal,
    });
    const testo = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    if (!testo) {
      return buildAllyCopilotFallbackAnswer(input.context);
    }
    return parseAllyCopilotAnswer(testo, input.context);
  } catch {
    return buildAllyCopilotFallbackAnswer(input.context);
  } finally {
    clearTimeout(timer);
  }
}
