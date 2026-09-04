/**
 * M6C — run AI diagnosis from sanitized payload.
 * Server-only Anthropic call. No persistence.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  assertDiagnosisRequestCompatibleWithSonnet5,
  buildDiagnosisAnthropicParams,
  DIAGNOSIS_TIMEOUT_MS,
} from "@/lib/campaign-diagnosis/anthropic-request";
import {
  assertDiagnosisHasNoInventedMetrics,
  buildConfidenceCapSignals,
  parseAndNormalizeDiagnosis,
} from "@/lib/campaign-diagnosis/schema";
import { buildEvidenceBasisFromPayload } from "@/lib/campaign-diagnosis/evidence-guards";
import { assertPayloadMinimized } from "@/lib/campaign-diagnosis/build-context";
import type {
  CampaignAiDiagnosis,
  CampaignDiagnosisAiPayload,
  CampaignDiagnosisFacts,
} from "@/lib/campaign-diagnosis/types";

export async function runCampaignAiDiagnosis(input: {
  payload: CampaignDiagnosisAiPayload;
  facts: CampaignDiagnosisFacts;
}): Promise<CampaignAiDiagnosis> {
  assertPayloadMinimized(input.payload);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CONFIG_MISSING");
  }

  const createParams = buildDiagnosisAnthropicParams(input.payload);
  assertDiagnosisRequestCompatibleWithSonnet5(
    createParams as unknown as Record<string, unknown>,
  );

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIAGNOSIS_TIMEOUT_MS);
  const started = Date.now();

  try {
    const message = await client.messages.create(createParams, {
      signal: controller.signal,
    });

    // Select text blocks by type (thinking blocks may still appear if misconfigured).
    const testo = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    if (!testo) {
      throw new Error("EMPTY_RESPONSE");
    }

    const evidenceBasis = buildEvidenceBasisFromPayload(input.payload);
    const capSignals = buildConfidenceCapSignals({
      evidence: [],
      trend: input.facts.trend,
      health: input.facts.health,
      ctrComparison: evidenceBasis.ctrComparison,
      cpcComparison: evidenceBasis.cpcComparison,
      frequencyComparison: evidenceBasis.frequencyComparison,
    });

    const diagnosis = parseAndNormalizeDiagnosis(
      testo,
      capSignals,
      evidenceBasis,
    );

    assertDiagnosisHasNoInventedMetrics(diagnosis, {
      targetValue: input.facts.targetValue,
      results: input.facts.results,
    });

    return diagnosis;
  } catch (err) {
    const elapsed = Date.now() - started;
    const name = err instanceof Error ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    // Safe category log only — no prompt, no PII, no API key.
    let category = "ANTHROPIC_REQUEST";
    if (msg === "CONFIG_MISSING") category = "ANTHROPIC_CONFIG";
    else if (msg === "EMPTY_RESPONSE") category = "EMPTY_RESPONSE";
    else if (msg.startsWith("Diagnosi scartata") || msg.includes("JSON") || msg.includes("non valid"))
      category = "SCHEMA_VALIDATION";
    else if (name === "AbortError" || /aborted/i.test(msg)) category = "TIMEOUT";
    else if (/not_found|model/i.test(msg)) category = "MODEL";
    console.error("[diagnosi]", category, `elapsed_ms=${elapsed}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
