/**
 * M9.2 — parse Ask Ally JSON; never trust model blindly.
 */

import type {
  AllyCampaignCopilotContext,
  AllyCopilotAnswer,
  AllyCopilotConfidence,
} from "@/lib/ally-copilot/types";

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("JSON non valido");
  }
}

function asStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function parseConfidence(raw: unknown): AllyCopilotConfidence {
  if (raw === "HIGH" || raw === "MEDIUM" || raw === "LOW" || raw === "UNKNOWN") {
    return raw;
  }
  return "UNKNOWN";
}

function safeHref(
  raw: unknown,
  context: AllyCampaignCopilotContext,
): string | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (!href.startsWith("/")) return null;
  const allowed = new Set<string>();
  if (context.identity.href) allowed.add(context.identity.href);
  if (context.decision.nextActionHref) {
    allowed.add(context.decision.nextActionHref);
  }
  allowed.add("/campagne");
  allowed.add("/risultati");
  allowed.add("/home");
  if (allowed.has(href)) return href;
  if (
    context.identity.source === "NATIVE" &&
    href.startsWith(`/campagne/${context.identity.campaignId}`)
  ) {
    return href;
  }
  return null;
}

const PROHIBITED =
  /pausa(re)?\s+la\s+campagna|aumenta(re)?\s+il\s+budget|riduci\s+il\s+budget|pubblica\s+su\s+meta|scrivi\s+su\s+meta|access_token/i;

export function parseAllyCopilotAnswer(
  raw: string,
  context: AllyCampaignCopilotContext,
): AllyCopilotAnswer {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const answer =
    typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) {
    throw new Error("Risposta vuota");
  }
  if (PROHIBITED.test(answer)) {
    throw new Error("Risposta non consentita");
  }

  let confidence = parseConfidence(parsed.confidence);
  if (context.performance.smallSample && confidence === "HIGH") {
    confidence = "MEDIUM";
  }

  return {
    answer: answer.slice(0, 1200),
    confidence,
    evidence: asStringArray(parsed.evidence, 4),
    hypotheses: asStringArray(parsed.hypotheses, 2),
    missingInformation: asStringArray(
      parsed.missing_information ?? parsed.missingInformation,
      4,
    ),
    suggestedNextQuestions: asStringArray(
      parsed.suggested_next_questions ?? parsed.suggestedNextQuestions,
      3,
    ),
    recommendedActionHref: safeHref(
      parsed.recommended_action_href ?? parsed.recommendedActionHref,
      context,
    ),
    fromAi: true,
  };
}

export function buildAllyCopilotFallbackAnswer(
  context: AllyCampaignCopilotContext,
): AllyCopilotAnswer {
  const href =
    context.decision.nextActionHref ?? context.identity.href ?? null;
  return {
    answer:
      "Non riesco a rispondere in questo momento. Puoi riprovare tra poco: i dati della campagna restano disponibili qui sotto.",
    confidence: "UNKNOWN",
    evidence: [],
    hypotheses: [],
    missingInformation: [],
    suggestedNextQuestions: [],
    recommendedActionHref: href,
    fromAi: false,
  };
}
