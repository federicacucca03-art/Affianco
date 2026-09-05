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

function scrubInternalLabels(text: string): string {
  return text
    .replace(/\blaunchReadiness\b/gi, "preparazione al lancio")
    .replace(/\bconfigurationKind\b/gi, "tipo di configurazione")
    .replace(/\battentionReason\b/gi, "motivo")
    .replace(/\bnextAction\b/gi, "prossimo passo")
    .replace(/\bmaxSustainableCpa\b/gi, "soglia sostenibile")
    .replace(/\bCONFIGURATION_REQUIRED\b/g, "configurazione da completare")
    .replace(/\bREVISION_REQUESTED\b/g, "revisione richiesta")
    .replace(/\bINSUFFICIENT_DATA\b/g, "dati insufficienti")
    .replace(/\bNEEDS_ATTENTION\b/g, "richiede attenzione")
    .replace(/\bAttention reason\b/gi, "Motivo")
    .replace(/\bDRAFT\b/g, "bozza")
    .replace(/\bConfidence:\s*HIGH\b/gi, "")
    .replace(/\bConfidence:\s*MEDIUM\b/gi, "")
    .replace(/\bConfidence:\s*LOW\b/gi, "")
    .replace(/\bConfidence:\s*UNKNOWN\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseAllyCopilotAnswer(
  raw: string,
  context: AllyCampaignCopilotContext,
): AllyCopilotAnswer {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  let answer =
    typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) {
    throw new Error("Risposta vuota");
  }
  if (PROHIBITED.test(answer)) {
    throw new Error("Risposta non consentita");
  }
  answer = scrubInternalLabels(answer);

  let confidence = parseConfidence(parsed.confidence);
  if (context.performance.smallSample && confidence === "HIGH") {
    confidence = "MEDIUM";
  }
  const unavailableCount = context.configuration.fields.filter(
    (f) => f.status === "unavailable",
  ).length;
  const relevantMissing = context.configuration.fields.filter(
    (f) => f.status === "missing",
  ).length;
  // Pre-launch style: do not allow HIGH if inventory is empty/thin.
  if (
    confidence === "HIGH" &&
    context.configuration.fields.length === 0
  ) {
    confidence = "MEDIUM";
  }
  if (
    confidence === "HIGH" &&
    unavailableCount >= 2 &&
    relevantMissing === 0 &&
    context.performance.noPerformanceDataYet
  ) {
    confidence = "MEDIUM";
  }

  return {
    answer: answer.slice(0, 1200),
    confidence,
    evidence: asStringArray(parsed.evidence, 4).map(scrubInternalLabels),
    hypotheses: asStringArray(parsed.hypotheses, 2).map(scrubInternalLabels),
    missingInformation: asStringArray(
      parsed.missing_information ?? parsed.missingInformation,
      4,
    ).map(scrubInternalLabels),
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
