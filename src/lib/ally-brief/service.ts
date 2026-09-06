/**
 * M9.3A — run one Anthropic call for brief analysis.
 * Aligned with M9.2 Sonnet request shape (thinking disabled, no temperature).
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  assertAllyBriefRequestCompatibleWithSonnet5,
  buildAllyBriefAnthropicParams,
} from "@/lib/ally-brief/anthropic-request";
import {
  isMeaningfulAllyBriefProposal,
  parseAllyBriefProposal,
} from "@/lib/ally-brief/parse";
import type {
  AllyBriefExistingClientContext,
  AllyBriefRunResult,
} from "@/lib/ally-brief/types";
import { ALLY_BRIEF_TIMEOUT_MS } from "@/lib/ally-brief/types";

export async function runAllyBriefAnalysis(input: {
  brief: string;
  existingClient: AllyBriefExistingClientContext | null;
}): Promise<AllyBriefRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "CONFIG", aiCalls: 0 };
  }

  const createParams = buildAllyBriefAnthropicParams(input);
  assertAllyBriefRequestCompatibleWithSonnet5(
    createParams as unknown as Record<string, unknown>,
  );

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALLY_BRIEF_TIMEOUT_MS);

  try {
    const message = await client.messages.create(createParams, {
      signal: controller.signal,
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    if (!text) {
      return { ok: false, code: "EMPTY", aiCalls: 1 };
    }

    let proposal;
    try {
      proposal = parseAllyBriefProposal(text, input.existingClient);
    } catch {
      return { ok: false, code: "PARSE", aiCalls: 1 };
    }

    if (!isMeaningfulAllyBriefProposal(proposal)) {
      return { ok: false, code: "NOT_MEANINGFUL", aiCalls: 1 };
    }

    return { ok: true, proposal, aiCalls: 1 };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (/aborted|timeout|timed out/i.test(msg)) {
      return { ok: false, code: "TIMEOUT", aiCalls: 0 };
    }
    return { ok: false, code: "ANTHROPIC", aiCalls: 0 };
  } finally {
    clearTimeout(timer);
  }
}
