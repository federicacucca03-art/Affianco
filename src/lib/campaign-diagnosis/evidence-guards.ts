/**
 * M6C.3 — Deterministic epistemic guards for diagnosis areas.
 * Absolute metrics alone never justify causal localization.
 */

import type {
  CampaignDiagnosisAiPayload,
  DiagnosisAiConfidence,
  DiagnosisLikelyArea,
} from "@/lib/campaign-diagnosis/types";

/** Trustworthy period-over-period comparison (not absolute snapshot). */
export type MetricComparisonDirection = "IMPROVING" | "WORSENING" | "STABLE";

export type DiagnosisEvidenceBasis = {
  primaryAboveTarget: boolean;
  primaryCostWorsening: boolean;
  primaryCostTrendKnown: boolean;
  ctrComparison: MetricComparisonDirection | null;
  cpcComparison: MetricComparisonDirection | null;
  cpmComparison: MetricComparisonDirection | null;
  frequencyComparison: MetricComparisonDirection | null;
  hasDownstreamQualityEvidence: boolean;
  hasCreativeAnalysisEvidence: boolean;
  results: number | null;
};

export function comparisonFromDirection(
  direction: string | null | undefined,
): MetricComparisonDirection | null {
  if (
    direction === "IMPROVING" ||
    direction === "WORSENING" ||
    direction === "STABLE"
  ) {
    return direction;
  }
  return null;
}

export function buildEvidenceBasisFromPayload(
  payload: CampaignDiagnosisAiPayload,
): DiagnosisEvidenceBasis {
  const actual = payload.actualValue;
  const target = payload.targetValue;
  const primaryAboveTarget =
    actual != null &&
    target != null &&
    Number.isFinite(actual) &&
    Number.isFinite(target) &&
    actual > target;

  const primaryCostTrendKnown =
    payload.trend === "IMPROVING" ||
    payload.trend === "WORSENING" ||
    payload.trend === "STABLE";

  return {
    primaryAboveTarget,
    primaryCostWorsening: payload.trend === "WORSENING",
    primaryCostTrendKnown,
    ctrComparison: payload.comparisons.ctr,
    cpcComparison: payload.comparisons.cpc,
    cpmComparison: payload.comparisons.cpm,
    frequencyComparison: payload.comparisons.frequency,
    hasDownstreamQualityEvidence: payload.hasDownstreamQualityEvidence,
    hasCreativeAnalysisEvidence: payload.hasCreativeAnalysisEvidence,
    results: payload.metrics.results,
  };
}

/** Very small result volume → reduce diagnostic specificity. */
export function isSmallSample(basis: DiagnosisEvidenceBasis): boolean {
  return basis.results != null && basis.results > 0 && basis.results <= 2;
}

function trafficUpstreamStableOrImproving(
  basis: DiagnosisEvidenceBasis,
): boolean {
  const ctrOk =
    basis.ctrComparison === "STABLE" || basis.ctrComparison === "IMPROVING";
  const cpcOk =
    basis.cpcComparison === "STABLE" || basis.cpcComparison === "IMPROVING";
  return ctrOk && cpcOk;
}

export function canSupportPostClick(basis: DiagnosisEvidenceBasis): boolean {
  const costPressure =
    basis.primaryAboveTarget || basis.primaryCostWorsening;
  return costPressure && trafficUpstreamStableOrImproving(basis);
}

export function canSupportTrafficCost(basis: DiagnosisEvidenceBasis): boolean {
  return (
    basis.cpcComparison === "WORSENING" || basis.cpmComparison === "WORSENING"
  );
}

export function canSupportCreative(basis: DiagnosisEvidenceBasis): boolean {
  if (basis.hasCreativeAnalysisEvidence) return true;
  if (basis.ctrComparison === "WORSENING") return true;
  // Frequency rising alone is insufficient; needs CTR decline (covered above).
  return false;
}

export function canSupportResultQuality(basis: DiagnosisEvidenceBasis): boolean {
  return basis.hasDownstreamQualityEvidence;
}

/** Multiple strong comparative signals — rare exception to small-sample UNKNOWN. */
export function hasMultipleStrongComparativeSignals(
  basis: DiagnosisEvidenceBasis,
): boolean {
  let n = 0;
  if (basis.primaryAboveTarget || basis.primaryCostWorsening) n += 1;
  if (basis.ctrComparison === "WORSENING" || basis.ctrComparison === "IMPROVING")
    n += 1;
  if (basis.cpcComparison === "WORSENING" || basis.cpcComparison === "IMPROVING")
    n += 1;
  if (basis.cpmComparison === "WORSENING") n += 1;
  if (
    basis.frequencyComparison === "WORSENING" &&
    basis.ctrComparison === "WORSENING"
  ) {
    n += 1;
  }
  if (basis.hasDownstreamQualityEvidence) n += 1;
  if (basis.hasCreativeAnalysisEvidence) n += 1;
  return n >= 2;
}

/**
 * Force UNKNOWN when the model localizes without a valid comparison basis.
 */
export function normalizeLikelyArea(
  area: DiagnosisLikelyArea,
  basis: DiagnosisEvidenceBasis,
): DiagnosisLikelyArea {
  if (isSmallSample(basis) && !hasMultipleStrongComparativeSignals(basis)) {
    return "UNKNOWN";
  }

  switch (area) {
    case "RESULT_QUALITY":
      return canSupportResultQuality(basis) ? area : "UNKNOWN";
    case "POST_CLICK":
      return canSupportPostClick(basis) ? area : "UNKNOWN";
    case "TRAFFIC_COST":
      return canSupportTrafficCost(basis) ? area : "UNKNOWN";
    case "CREATIVE":
      return canSupportCreative(basis) ? area : "UNKNOWN";
    case "TRACKING":
    case "DELIVERY":
    case "UNKNOWN":
      return area;
  }
}

export function applySmallSampleConfidenceCap(
  confidence: DiagnosisAiConfidence,
  basis: DiagnosisEvidenceBasis,
): DiagnosisAiConfidence {
  if (isSmallSample(basis)) return "LOW";
  return confidence;
}

/**
 * Drop evidence lines that judge absolute traffic metrics without comparison.
 * Keeps factual statements like "Il CTR è 1,11%.".
 */
export function filterUnsupportedAbsoluteJudgments(
  evidence: string[],
  basis: DiagnosisEvidenceBasis,
): string[] {
  const hasCtrCmp = basis.ctrComparison != null;
  const hasCpcCmp = basis.cpcComparison != null;
  const hasCpmCmp = basis.cpmComparison != null;
  const hasFreqCmp = basis.frequencyComparison != null;

  const JUDGMENT =
    /\b(non\s+(indica|mostra|suggerisce)|nella\s+norma|normal[ei]|sano|salutare|problematico|problemi?|debole|forte|bass[oa]|alt[oa]|buon[oa]|cattiv[oa]|evident[ei]|affaticament[oi]|saturazion[ei])\b/i;

  return evidence.filter((line) => {
    const l = line.toLowerCase();
    const aboutCtr = /\bctr\b/i.test(l);
    const aboutCpc = /\bcpc\b/i.test(l);
    const aboutCpm = /\bcpm\b/i.test(l);
    const aboutFreq = /\bfrequenz/i.test(l);
    if (!JUDGMENT.test(line)) return true;
    if (aboutCtr && !hasCtrCmp) return false;
    if (aboutCpc && !hasCpcCmp) return false;
    if (aboutCpm && !hasCpmCmp) return false;
    if (aboutFreq && !hasFreqCmp) return false;
    return true;
  });
}
