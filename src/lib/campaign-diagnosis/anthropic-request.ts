/**
 * Anthropic request params for M6C diagnosis.
 * Pure — testable without network.
 *
 * Claude Sonnet 5 rejects non-default sampling params (temperature/top_p/top_k → 400).
 * Adaptive thinking is on by default and consumes max_tokens; disable for short JSON.
 */

import { anthropicModelId } from "@/lib/anthropic-config";
import {
  buildDiagnosisUserPrompt,
  DIAGNOSIS_SYSTEM_PROMPT,
} from "@/lib/campaign-diagnosis/prompt";
import type { CampaignDiagnosisAiPayload } from "@/lib/campaign-diagnosis/types";

export const DIAGNOSIS_MAX_TOKENS = 700;
export const DIAGNOSIS_TIMEOUT_MS = 25_000;

export type DiagnosisAnthropicCreateParams = {
  model: string;
  max_tokens: number;
  system: string;
  thinking: { type: "disabled" };
  messages: Array<{ role: "user"; content: string }>;
};

/**
 * Build Messages API body for diagnosis.
 * Must NOT include temperature / top_p / top_k (Sonnet 5).
 */
export function buildDiagnosisAnthropicParams(
  payload: CampaignDiagnosisAiPayload,
): DiagnosisAnthropicCreateParams {
  return {
    model: anthropicModelId(),
    max_tokens: DIAGNOSIS_MAX_TOKENS,
    thinking: { type: "disabled" },
    system: DIAGNOSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildDiagnosisUserPrompt(payload),
      },
    ],
  };
}

/** Structural guard used by tests / preflight. */
export function assertDiagnosisRequestCompatibleWithSonnet5(
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
    throw new Error("thinking deve essere disabled per diagnosi JSON breve");
  }
}
