/**
 * M9.3A/B — run at most one Anthropic call for brief (+ optional website) analysis.
 * Website HTTP fetch is deterministic and does not count as an AI call.
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
import {
  fetchWebsiteContext,
  formatWebsiteContextForPrompt,
} from "@/lib/ally-brief/website-context";
import {
  ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE,
  ALLY_BRIEF_WEBSITE_UNAVAILABLE_MESSAGE,
  validatePublicWebsiteUrl,
} from "@/lib/ally-brief/website-safety";

export async function runAllyBriefAnalysis(input: {
  brief: string;
  existingClient: AllyBriefExistingClientContext | null;
  /** Optional user-supplied public website URL. */
  websiteUrl?: string | null;
}): Promise<AllyBriefRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "CONFIG", aiCalls: 0 };
  }

  const websiteRaw = input.websiteUrl?.trim() || "";
  let websiteBlock: string | null = null;
  let websiteStatus: "ok" | "unavailable" | "blocked" | "skipped" | null =
    null;
  let websiteWarning: string | null = null;
  let userWebsiteUrl: string | null = null;

  if (websiteRaw) {
    const validated = validatePublicWebsiteUrl(websiteRaw);
    if (!validated.ok) {
      websiteStatus = "blocked";
      websiteWarning = ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE;
      // No fetch. Continue with brief-only when brief is present.
    } else {
      userWebsiteUrl = validated.href;
      const ctx = await fetchWebsiteContext(validated.href);
      if (ctx.status === "ok") {
        websiteStatus = "ok";
        websiteBlock = formatWebsiteContextForPrompt(ctx);
        userWebsiteUrl = ctx.url;
      } else if (ctx.status === "blocked") {
        websiteStatus = "blocked";
        websiteWarning = ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE;
      } else {
        websiteStatus = "unavailable";
        websiteWarning = ALLY_BRIEF_WEBSITE_UNAVAILABLE_MESSAGE;
      }
    }
  } else {
    websiteStatus = "skipped";
  }

  const createParams = buildAllyBriefAnthropicParams({
    brief: input.brief,
    existingClient: input.existingClient,
    websiteBlock,
  });
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
      return {
        ok: false,
        code: "EMPTY",
        aiCalls: 1,
        websiteStatus,
        websiteWarning,
      };
    }

    let proposal;
    try {
      proposal = parseAllyBriefProposal(text, input.existingClient, {
        userWebsiteUrl,
        siteOnly: !input.brief.trim() && Boolean(websiteBlock || userWebsiteUrl),
      });
    } catch {
      return {
        ok: false,
        code: "PARSE",
        aiCalls: 1,
        websiteStatus,
        websiteWarning,
      };
    }

    if (!isMeaningfulAllyBriefProposal(proposal)) {
      return {
        ok: false,
        code: "NOT_MEANINGFUL",
        aiCalls: 1,
        websiteStatus,
        websiteWarning,
      };
    }

    return {
      ok: true,
      proposal,
      aiCalls: 1,
      websiteStatus,
      websiteWarning,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (/aborted|timeout|timed out/i.test(msg)) {
      return {
        ok: false,
        code: "TIMEOUT",
        aiCalls: 0,
        websiteStatus,
        websiteWarning,
      };
    }
    return {
      ok: false,
      code: "ANTHROPIC",
      aiCalls: 0,
      websiteStatus,
      websiteWarning,
    };
  } finally {
    clearTimeout(timer);
  }
}
