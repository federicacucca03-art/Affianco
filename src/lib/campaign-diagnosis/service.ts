/**
 * M6C — run AI diagnosis from sanitized payload.
 * Server-only Anthropic call. No persistence.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { anthropicModelId } from "@/lib/anthropic-config";
import {
  buildDiagnosisUserPrompt,
  DIAGNOSIS_SYSTEM_PROMPT,
} from "@/lib/campaign-diagnosis/prompt";
import {
  assertDiagnosisHasNoInventedMetrics,
  buildConfidenceCapSignals,
  parseAndNormalizeDiagnosis,
} from "@/lib/campaign-diagnosis/schema";
import { assertPayloadMinimized } from "@/lib/campaign-diagnosis/build-context";
import type {
  CampaignAiDiagnosis,
  CampaignDiagnosisAiPayload,
  CampaignDiagnosisFacts,
} from "@/lib/campaign-diagnosis/types";

const MAX_TOKENS = 700;
const TEMPERATURE = 0;
const TIMEOUT_MS = 25_000;

export async function runCampaignAiDiagnosis(input: {
  payload: CampaignDiagnosisAiPayload;
  facts: CampaignDiagnosisFacts;
}): Promise<CampaignAiDiagnosis> {
  assertPayloadMinimized(input.payload);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CONFIG_MISSING");
  }

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const message = await client.messages.create(
      {
        model: anthropicModelId(),
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: DIAGNOSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildDiagnosisUserPrompt(input.payload),
          },
        ],
      },
      { signal: controller.signal },
    );

    const testo = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    if (!testo) {
      throw new Error("EMPTY_RESPONSE");
    }

    const capSignals = buildConfidenceCapSignals({
      evidence: [],
      trend: input.facts.trend,
      health: input.facts.health,
      ctr: input.facts.ctr,
      cpc: input.facts.cpc,
      frequency: input.facts.frequency,
    });

    const diagnosis = parseAndNormalizeDiagnosis(testo, capSignals);

    assertDiagnosisHasNoInventedMetrics(diagnosis, {
      targetValue: input.facts.targetValue,
      results: input.facts.results,
    });

    return diagnosis;
  } finally {
    clearTimeout(timer);
  }
}
