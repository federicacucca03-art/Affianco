/**
 * M9.1 — run Ally oggi AI narrative from sanitized context.
 * Server-only. One Anthropic call. No Meta / health writes.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  assertAllyOggiRequestCompatibleWithSonnet5,
  ALLY_OGGI_TIMEOUT_MS,
  buildAllyOggiAnthropicParams,
} from "@/lib/ally-oggi/anthropic-request";
import { buildAllyOggiFallback } from "@/lib/ally-oggi/fallback";
import { parseAllyOggiBrief } from "@/lib/ally-oggi/parse";
import type { AllyOggiBrief, AllyOggiBriefContext } from "@/lib/ally-oggi/types";

export async function runAllyOggiBrief(
  context: AllyOggiBriefContext,
): Promise<AllyOggiBrief> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return buildAllyOggiFallback(context);
  }

  const createParams = buildAllyOggiAnthropicParams(context);
  assertAllyOggiRequestCompatibleWithSonnet5(
    createParams as unknown as Record<string, unknown>,
  );

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALLY_OGGI_TIMEOUT_MS);
  const started = Date.now();

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
      return buildAllyOggiFallback(context);
    }
    return parseAllyOggiBrief(testo, context);
  } catch (err) {
    const elapsed = Date.now() - started;
    const name = err instanceof Error ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    let category = "ANTHROPIC_REQUEST";
    if (name === "AbortError" || /aborted/i.test(msg)) category = "TIMEOUT";
    else if (/not_found|model/i.test(msg)) category = "MODEL";
    else if (/INVALID_|PROHIBITED|MISSING_/.test(msg)) category = "SCHEMA";
    console.error("[ally-oggi]", category, `elapsed_ms=${elapsed}`);
    return buildAllyOggiFallback(context);
  } finally {
    clearTimeout(timer);
  }
}
