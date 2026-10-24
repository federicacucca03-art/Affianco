/**
 * ADV.1.5 — Facile-facing complexity summary for CanonicalCampaignState V2.
 * Does not delete advanced structure. LIVE META WRITES: 0
 */

import type {
  CanonicalCampaignStateV2,
  FacileComplexitySummaryV2,
} from "@/lib/campagne-canonical-v2/types";

export function buildFacileComplexitySummary(
  state: CanonicalCampaignStateV2,
): FacileComplexitySummaryV2 {
  const adSetCount = state.adSets.length;
  const hasRetargeting = state.adSets.some((a) => a.role === "RETARGETING");
  const hasLookalike = state.adSets.some((a) => a.role === "LOOKALIKE");
  const hasManualPlacements = state.adSets.some(
    (a) => a.placements.mode === "MANUAL",
  );
  const hasUnresolvedBudgetSplit =
    state.budget.allocationStatus === "UNRESOLVED_SPLIT";

  const isSimpleLeadsInstantForm =
    state.objective === "LEADS" &&
    state.conversion.location === "INSTANT_FORM" &&
    adSetCount <= 1 &&
    !hasRetargeting &&
    !hasLookalike &&
    !hasUnresolvedBudgetSplit;

  const linesIt: string[] = [];
  if (!isSimpleLeadsInstantForm) {
    linesIt.push("Configurazione avanzata");
  }
  if (adSetCount > 1) {
    linesIt.push(`${adSetCount} gruppi di pubblico`);
  }
  if (hasRetargeting) {
    linesIt.push("Include retargeting");
  }
  if (hasLookalike) {
    linesIt.push("Include lookalike");
  }
  if (hasManualPlacements) {
    linesIt.push("Posizionamenti personalizzati");
  }
  if (hasUnresolvedBudgetSplit) {
    linesIt.push("Ripartizione budget da definire");
  }
  if (state.objective === "SALES") {
    linesIt.push("Obiettivo vendite");
  }
  if (state.objective === "APP_PROMOTION") {
    linesIt.push("Promozione app");
  }

  return {
    isSimpleLeadsInstantForm,
    adSetCount,
    hasRetargeting,
    hasLookalike,
    hasManualPlacements,
    hasUnresolvedBudgetSplit,
    linesIt,
  };
}
