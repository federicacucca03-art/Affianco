/**
 * Parse / validate / confidence-cap for M6C AI diagnosis JSON.
 * Pure — no network. Never trusts browser metrics.
 * M6C.3: area normalization from evidence basis (no unsupported inference).
 */

import type {
  CampaignAiDiagnosis,
  DiagnosisAiConfidence,
  DiagnosisLikelyArea,
} from "@/lib/campaign-diagnosis/types";
import {
  applySmallSampleConfidenceCap,
  filterUnsupportedAbsoluteJudgments,
  normalizeLikelyArea,
  type DiagnosisEvidenceBasis,
} from "@/lib/campaign-diagnosis/evidence-guards";

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

/** Internal jargon that must never reach the user-facing panel. */
const INTERNAL_JARGON_RE =
  /\b(attentionReason|attentionState|urgencyLevel|healthAvailability|healthStatus|resultMappingConfidence|primaryKpi|actualValue|targetValue|campaignStatus|monitoringMode|REVISION_REQUESTED|TARGET_REQUIRED|RESULT_MAPPING|INSUFFICIENT_DATA|CONFIGURATION_REQUIRED|NEEDS_ATTENTION|HISTORICAL_REVIEW|WORSENING|IMPROVING|INSUFFICIENT|UNKNOWN|AMBIGUOUS|CONFIDENT|AI_DIAGNOSIS)\b|\bhealth\s*=\s*(RED|YELLOW|GREEN|INSUFFICIENT)\b|\btrend\s*=\s*\w+|\bmetrics?\s+(sono|is|are)\s+null\b/i;

export function textContainsInternalJargon(text: string): boolean {
  return INTERNAL_JARGON_RE.test(text);
}

/**
 * Drop evidence lines that leak developer/system language.
 * Returns filtered list (may be empty — caller must handle).
 */
export function filterHumanEvidence(evidence: string[]): string[] {
  return evidence
    .map((e) => clipSentence(e, 120))
    .filter((e) => e.length > 0 && !textContainsInternalJargon(e))
    .slice(0, 3);
}

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
  /** Comparative only — absolute CTR/CPC/frequency never count. */
  ctrComparison?: string | null;
  cpcComparison?: string | null;
  frequencyComparison?: string | null;
  /** @deprecated absolute values ignored for independence (M6C.3) */
  ctr?: number | null;
  cpc?: number | null;
  frequency?: number | null;
}): ConfidenceCapSignals {
  const trendKnown =
    input.trend === "IMPROVING" ||
    input.trend === "WORSENING" ||
    input.trend === "STABLE";
  let independent = 0;
  if (input.health === "RED" || input.health === "YELLOW") independent += 1;
  if (trendKnown && input.trend === "WORSENING") independent += 1;
  if (
    input.ctrComparison === "WORSENING" ||
    input.ctrComparison === "IMPROVING"
  ) {
    independent += 1;
  }
  if (
    input.cpcComparison === "WORSENING" ||
    input.cpcComparison === "IMPROVING"
  ) {
    independent += 1;
  }
  if (
    input.frequencyComparison === "WORSENING" &&
    input.ctrComparison === "WORSENING"
  ) {
    independent += 1;
  }
  return {
    evidenceCount: input.evidence.length,
    trendKnown,
    independentSignalCount: independent,
  };
}

export const EMPTY_EVIDENCE_BASIS: DiagnosisEvidenceBasis = {
  primaryAboveTarget: false,
  primaryCostWorsening: false,
  primaryCostTrendKnown: false,
  ctrComparison: null,
  cpcComparison: null,
  cpmComparison: null,
  frequencyComparison: null,
  hasDownstreamQualityEvidence: false,
  hasCreativeAnalysisEvidence: false,
  results: null,
};

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
 * Softens unsupported causal certainty by capping confidence + normalizing area.
 */
export function parseAndNormalizeDiagnosis(
  rawText: string,
  capSignals: ConfidenceCapSignals,
  evidenceBasis: DiagnosisEvidenceBasis = EMPTY_EVIDENCE_BASIS,
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
  const evidenceHuman = filterHumanEvidence(
    evidenceRaw.filter((e): e is string => typeof e === "string" && e.trim().length > 0),
  );
  const evidence = filterUnsupportedAbsoluteJudgments(
    evidenceHuman,
    evidenceBasis,
  );
  if (evidence.length === 0) {
    throw new Error("evidence vuoto o non utilizzabile.");
  }

  const uncertaintyRaw =
    typeof o.uncertainty === "string" && o.uncertainty.trim()
      ? clipSentence(o.uncertainty, 160)
      : "Non ci sono abbastanza dati per una conclusione definitiva.";
  const uncertainty = textContainsInternalJargon(uncertaintyRaw)
    ? "Non ci sono abbastanza dati per una conclusione definitiva."
    : uncertaintyRaw;

  const whatNotRaw =
    typeof o.what_not_to_conclude === "string" && o.what_not_to_conclude.trim()
      ? clipSentence(o.what_not_to_conclude, 160)
      : null;
  const whatNot =
    whatNotRaw && textContainsInternalJargon(whatNotRaw) ? null : whatNotRaw;

  let area = normalizeLikelyArea(
    areaRaw as DiagnosisLikelyArea,
    evidenceBasis,
  );
  let confidence = confRaw as DiagnosisAiConfidence;
  let summaryDraft = summaryRaw;
  if (textContainsInternalJargon(summaryDraft)) {
    throw new Error("summary contiene linguaggio tecnico interno.");
  }
  const blob = `${summaryDraft} ${evidence.join(" ")} ${uncertainty}`;
  if (CERTAINTY_RE.test(blob)) {
    confidence = "LOW";
  }

  let capped = applyConfidenceCap(confidence, {
    ...capSignals,
    evidenceCount: evidence.length,
  });
  capped = applySmallSampleConfidenceCap(capped, evidenceBasis);

  // Max 2 short sentences for summary.
  const sentences = summaryDraft
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
