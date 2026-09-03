/**
 * Parse / validate / confidence-cap for M6C AI diagnosis JSON.
 * Pure — no network. Never trusts browser metrics.
 */

import type {
  CampaignAiDiagnosis,
  DiagnosisAiConfidence,
  DiagnosisLikelyArea,
} from "@/lib/campaign-diagnosis/types";

const AREAS: ReadonlySet<string> = new Set([
  "CREATIVE",
  "TRAFFIC_COST",
  "POST_CLICK",
  "TRACKING",
  "DELIVERY",
  "RESULT_QUALITY",
  "UNKNOWN",
]);

const CONF: ReadonlySet<string> = new Set(["LOW", "MEDIUM", "HIGH"]);

const CERTAINTY_RE =
  /\b(sicuramente|certamente|è certo|devi\b|meta sta penalizzando|il pubblico è sbagliato)\b/i;

export type ConfidenceCapSignals = {
  evidenceCount: number;
  trendKnown: boolean;
  /** Independent metric anomalies (e.g. health red + trend + ctr/cpc pattern). */
  independentSignalCount: number;
};

function clipSentence(raw: string, maxChars: number): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

function confidenceRank(c: DiagnosisAiConfidence): number {
  if (c === "HIGH") return 2;
  if (c === "MEDIUM") return 1;
  return 0;
}

function minConfidence(
  a: DiagnosisAiConfidence,
  b: DiagnosisAiConfidence,
): DiagnosisAiConfidence {
  return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

/** Deterministic ceiling — AI may not freely claim HIGH. */
export function applyConfidenceCap(
  aiConfidence: DiagnosisAiConfidence,
  signals: ConfidenceCapSignals,
): DiagnosisAiConfidence {
  let ceiling: DiagnosisAiConfidence = "HIGH";
  if (signals.evidenceCount < 2) {
    ceiling = "LOW";
  } else if (!signals.trendKnown) {
    ceiling = "MEDIUM";
  } else if (signals.independentSignalCount < 2) {
    ceiling = minConfidence(ceiling, "MEDIUM");
  }
  return minConfidence(aiConfidence, ceiling);
}

export function buildConfidenceCapSignals(input: {
  evidence: string[];
  trend: string;
  health: string | null;
  ctr: number | null;
  cpc: number | null;
  frequency: number | null;
}): ConfidenceCapSignals {
  const trendKnown =
    input.trend === "IMPROVING" ||
    input.trend === "WORSENING" ||
    input.trend === "STABLE";
  let independent = 0;
  if (input.health === "RED" || input.health === "YELLOW") independent += 1;
  if (trendKnown && input.trend === "WORSENING") independent += 1;
  if (input.ctr != null && input.ctr < 0.8) independent += 1;
  if (input.cpc != null && input.health === "RED") independent += 1;
  if (input.frequency != null && input.frequency >= 3) independent += 1;
  return {
    evidenceCount: input.evidence.length,
    trendKnown,
    independentSignalCount: independent,
  };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("JSON diagnosi non trovato.");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

/**
 * Parse model text → validated diagnosis.
 * Softens unsupported causal certainty by capping confidence + area UNKNOWN when needed.
 */
export function parseAndNormalizeDiagnosis(
  rawText: string,
  capSignals: ConfidenceCapSignals,
): CampaignAiDiagnosis {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(rawText);
  } catch {
    throw new Error("Risposta AI non valida.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Risposta AI non valida.");
  }
  const o = parsed as Record<string, unknown>;

  const summaryRaw = typeof o.summary === "string" ? o.summary.trim() : "";
  if (!summaryRaw) throw new Error("Campo summary mancante.");

  const areaRaw = typeof o.likely_area === "string" ? o.likely_area.trim() : "";
  if (!AREAS.has(areaRaw)) throw new Error("likely_area non valido.");

  const confRaw =
    typeof o.confidence === "string" ? o.confidence.trim().toUpperCase() : "";
  if (!CONF.has(confRaw)) throw new Error("confidence non valido.");

  const evidenceRaw = Array.isArray(o.evidence) ? o.evidence : [];
  const evidence = evidenceRaw
    .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    .map((e) => clipSentence(e, 120))
    .slice(0, 3);
  if (evidence.length === 0) {
    throw new Error("evidence vuoto.");
  }

  const uncertainty =
    typeof o.uncertainty === "string" && o.uncertainty.trim()
      ? clipSentence(o.uncertainty, 160)
      : "Non ci sono abbastanza dati per una conclusione definitiva.";

  const whatNot =
    typeof o.what_not_to_conclude === "string" && o.what_not_to_conclude.trim()
      ? clipSentence(o.what_not_to_conclude, 160)
      : null;

  let area = areaRaw as DiagnosisLikelyArea;
  let confidence = confRaw as DiagnosisAiConfidence;
  const blob = `${summaryRaw} ${evidence.join(" ")} ${uncertainty}`;
  if (CERTAINTY_RE.test(blob)) {
    confidence = "LOW";
    if (area !== "UNKNOWN") {
      // Keep area but force humble confidence; certainty language is unsupported.
      confidence = "LOW";
    }
  }

  const capped = applyConfidenceCap(confidence, {
    ...capSignals,
    evidenceCount: evidence.length,
  });

  // Max 2 short sentences for summary.
  const sentences = summaryRaw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  const summary = clipSentence(sentences.join(" "), 280);

  return {
    summary,
    likely_area: area,
    confidence: capped,
    evidence,
    uncertainty,
    what_not_to_conclude: whatNot,
  };
}

/** Reject payloads that try to inject invented target/results fields into model output. */
export function assertDiagnosisHasNoInventedMetrics(
  diagnosis: CampaignAiDiagnosis,
  facts: { targetValue: number | null; results: number | null },
): void {
  const blob = [
    diagnosis.summary,
    ...diagnosis.evidence,
    diagnosis.uncertainty,
    diagnosis.what_not_to_conclude ?? "",
  ].join(" ");

  // If facts have no target, reject explicit "target di €NN" claims with numbers
  // that invent a precise threshold (heuristic).
  if (facts.targetValue == null) {
    if (/target\s+(di\s+)?€?\s*\d/i.test(blob) || /soglia\s+€?\s*\d/i.test(blob)) {
      throw new Error("Diagnosi scartata: target inventato.");
    }
  }
  if (facts.results == null) {
    if (/\b\d+\s+lead\b/i.test(blob) || /\b\d+\s+conversioni\b/i.test(blob)) {
      throw new Error("Diagnosi scartata: risultati inventati.");
    }
  }
}
