/**
 * M10A — pure hierarchy evaluation (client-safe; no server import).
 * Small-sample + vs-target states for ad sets / ads. No Meta writes.
 */

import {
  evaluateObjectiveEvidenceSufficiency,
  resolveObjectivePerformanceProfile,
} from "@/lib/meta/objective-performance";

export type HierarchyDataSufficiency = "SUFFICIENT" | "INSUFFICIENT_DATA";

export type AllyHierarchyOperationalState =
  | "STABLE"
  | "MONITOR"
  | "NEEDS_ATTENTION"
  | "INSUFFICIENT_DATA"
  | "NEUTRAL";

export type HierarchyEntityMetrics = {
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  dayCount: number;
};

export type HierarchyFocusCandidate = {
  name: string;
  metaAdSetId?: string;
  metaAdId?: string;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  state: AllyHierarchyOperationalState;
  sufficiency: HierarchyDataSufficiency;
};

export type HierarchyFocusHint = {
  adSetName: string | null;
  adName: string | null;
};

const REFINEABLE_ACTION_TYPES = new Set([
  "REVIEW_CREATIVE",
  "REVIEW_COPY",
  "REVIEW_AUDIENCE",
  "REVIEW_BUDGET",
  "CREATE_CREATIVE_VARIANT",
]);

/** Canonical conversion sample rule (Leads/Sales). Prefer evaluateSampleSufficiencyForObjective. */
export function evaluateSampleSufficiency(input: {
  daysActive: number | null;
  resultsCount: number | null;
}): HierarchyDataSufficiency {
  if (input.daysActive != null && input.daysActive < 3) {
    return "INSUFFICIENT_DATA";
  }
  if (input.resultsCount != null && input.resultsCount < 2) {
    return "INSUFFICIENT_DATA";
  }
  if (input.daysActive == null || input.resultsCount == null) {
    return "INSUFFICIENT_DATA";
  }
  return "SUFFICIENT";
}

/**
 * M10C — objective-aware evidence sufficiency.
 * Awareness uses impressions, not conversion results.
 */
export function evaluateSampleSufficiencyForObjective(input: {
  rawObjective?: string | null;
  daysActive: number | null;
  resultsCount: number | null;
  impressions?: number | null;
  linkClicks?: number | null;
}): HierarchyDataSufficiency {
  const profile = resolveObjectivePerformanceProfile(input.rawObjective);
  return evaluateObjectiveEvidenceSufficiency({
    mode: profile.sufficiencyMode,
    daysActive: input.daysActive,
    resultsCount: input.resultsCount,
    impressions: input.impressions ?? null,
    linkClicks: input.linkClicks ?? null,
  });
}

/**
 * Compare entity cost/result to campaign target.
 * Meta PAUSED/ACTIVE is never mapped here — status is orthogonal.
 */
export function evaluateEntityVsTarget(input: {
  sufficiency: HierarchyDataSufficiency;
  costPerResult: number | null;
  targetValue: number | null;
  primaryKpi?: string | null;
  /** M10C.1 — ambiguous mapping must not become "need more data". */
  resultMappingConfidence?: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null;
}): AllyHierarchyOperationalState {
  if (input.sufficiency === "INSUFFICIENT_DATA") {
    return "INSUFFICIENT_DATA";
  }
  if (input.resultMappingConfidence === "AMBIGUOUS") {
    return "NEUTRAL";
  }
  const kpi = (input.primaryKpi ?? "").toUpperCase();
  if (
    !kpi ||
    kpi === "NONE" ||
    input.targetValue == null ||
    !(input.targetValue > 0)
  ) {
    return "NEUTRAL";
  }
  if (kpi === "ROAS") {
    return "NEUTRAL";
  }
  if (input.costPerResult == null || !Number.isFinite(input.costPerResult)) {
    return "INSUFFICIENT_DATA";
  }
  const target = input.targetValue;
  if (input.costPerResult > target * 1.2) {
    return "NEEDS_ATTENTION";
  }
  if (input.costPerResult > target) {
    return "MONITOR";
  }
  return "STABLE";
}

export function etichettaHierarchyState(
  state: AllyHierarchyOperationalState,
): string {
  switch (state) {
    case "STABLE":
      return "Stabile";
    case "MONITOR":
      return "Da monitorare";
    case "NEEDS_ATTENTION":
      return "Richiede attenzione";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    case "NEUTRAL":
      return "Neutro";
    default:
      return "Da valutare";
  }
}

export function etichettaDataSufficiency(
  sufficiency: HierarchyDataSufficiency,
): string {
  return sufficiency === "SUFFICIENT" ? "Sufficienti" : "Insufficienti";
}

/** Meta delivery status for UI — never Ally health. */
export function etichettaMetaDeliveryStatus(
  status: string | null | undefined,
): string | null {
  const s = (status ?? "").trim().toUpperCase();
  if (!s) return null;
  switch (s) {
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "In pausa su Meta";
    case "ACTIVE":
      return "Attiva su Meta";
    case "ARCHIVED":
      return "Archiviata su Meta";
    case "DELETED":
      return "Eliminata su Meta";
    case "PENDING_REVIEW":
      return "In revisione su Meta";
    case "DISAPPROVED":
      return "Non approvata su Meta";
    case "WITH_ISSUES":
      return "Con problemi su Meta";
    case "IN_PROCESS":
      return "In elaborazione su Meta";
    default:
      return null;
  }
}

export function pluralizzaGruppi(n: number): string {
  return n === 1 ? "1 gruppo di inserzioni" : `${n} gruppi di inserzioni`;
}

export function pluralizzaInserzioni(n: number): string {
  return n === 1 ? "1 inserzione" : `${n} inserzioni`;
}

function isAboveTargetFocus(
  c: HierarchyFocusCandidate,
): boolean {
  return (
    c.sufficiency === "SUFFICIENT" &&
    (c.state === "NEEDS_ATTENTION" || c.state === "MONITOR")
  );
}

/** Highest spend among sufficient entities above target. Never claims causation. */
export function pickFirstAdSetFocus(
  adSets: Array<{
    name: string;
    metaAdSetId: string;
    spend: number | null;
    results: number | null;
    costPerResult: number | null;
    state: AllyHierarchyOperationalState;
    sufficiency: HierarchyDataSufficiency;
  }>,
): HierarchyFocusCandidate | null {
  const candidates = adSets
    .map((a) => ({
      name: a.name,
      metaAdSetId: a.metaAdSetId,
      spend: a.spend,
      results: a.results,
      costPerResult: a.costPerResult,
      state: a.state,
      sufficiency: a.sufficiency,
    }))
    .filter(isAboveTargetFocus);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  return candidates[0] ?? null;
}

export function pickFirstAdFocus(
  ads: Array<{
    name: string;
    metaAdId: string;
    spend: number | null;
    results: number | null;
    costPerResult: number | null;
    state: AllyHierarchyOperationalState;
    sufficiency: HierarchyDataSufficiency;
  }>,
): HierarchyFocusCandidate | null {
  const candidates = ads
    .map((a) => ({
      name: a.name,
      metaAdId: a.metaAdId,
      spend: a.spend,
      results: a.results,
      costPerResult: a.costPerResult,
      state: a.state,
      sufficiency: a.sufficiency,
    }))
    .filter(isAboveTargetFocus);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  return candidates[0] ?? null;
}

export function buildHierarchyDiagnosisLines(input: {
  campaignNeedsAttention: boolean;
  focusAdSet: { name: string } | null;
  focusAd: { name: string } | null;
}): string[] {
  const lines: string[] = [];
  if (!input.campaignNeedsAttention && !input.focusAdSet && !input.focusAd) {
    return lines;
  }
  if (input.focusAdSet) {
    lines.push(
      `Il gruppo ${input.focusAdSet.name} merita il primo controllo.`,
    );
  }
  if (input.focusAd) {
    lines.push(
      `Tra le inserzioni con dati sufficienti, ${input.focusAd.name} è la prima da ispezionare.`,
    );
  }
  return lines;
}

export function specificNextActionTitle(input: {
  adSetName: string | null;
  adName: string | null;
}): string | null {
  const adSet = input.adSetName?.trim() || null;
  const ad = input.adName?.trim() || null;
  if (ad && adSet) {
    return `Controlla l'inserzione '${ad}' nel gruppo ${adSet}.`;
  }
  if (adSet) {
    return `Controlla il gruppo di inserzioni '${adSet}'.`;
  }
  if (ad) {
    return `Controlla l'inserzione '${ad}'.`;
  }
  return null;
}

export function applyHierarchyToNextAction<
  T extends {
    actionType: string;
    title: string;
    rationale: string;
  },
>(
  action: T,
  hint: HierarchyFocusHint | null | undefined,
): T {
  if (!hint) return action;
  if (action.actionType === "WAIT_FOR_MORE_DATA") return action;
  if (!REFINEABLE_ACTION_TYPES.has(action.actionType)) return action;
  const title = specificNextActionTitle({
    adSetName: hint.adSetName,
    adName: hint.adName,
  });
  if (!title) return action;
  const parts: string[] = [];
  if (hint.adSetName) {
    parts.push(`gruppo ${hint.adSetName}`);
  }
  if (hint.adName) {
    parts.push(`inserzione ${hint.adName}`);
  }
  const rationaleExtra =
    parts.length > 0
      ? ` Evidenza gerarchia: avvia dal ${parts.join(" / ")}.`
      : "";
  return {
    ...action,
    title,
    rationale: `${action.rationale}${rationaleExtra}`.trim(),
  };
}
