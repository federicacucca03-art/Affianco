/**
 * M9.1B — workspace aggregate awareness (not performance evaluation).
 * Pure. Reuses Control Room link suppression semantics.
 */

import type { Campagna } from "@/types/campagne";
import {
  buildMondayControlRoom,
  type ControlRoomAttentionItem,
} from "@/lib/monday-control-room";
import {
  emptyAllyOggiWorkspaceSummary,
  type AllyOggiWorkspaceSummary,
} from "@/lib/ally-oggi/types";

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/**
 * Count operational campaigns after link dedupe:
 * linked native is suppressed in Control Room → count Meta once, not native+Meta.
 */
export function countWorkspaceCampaigns(input: {
  nativeCampaigns: readonly Pick<Campagna, "id">[];
  metaCampaignCount: number;
  linkedNativeIds: ReadonlySet<string>;
}): number {
  const unlinkedNative = input.nativeCampaigns.filter(
    (c) => c.id && !input.linkedNativeIds.has(c.id),
  ).length;
  return unlinkedNative + Math.max(0, input.metaCampaignCount);
}

export function buildAllyOggiWorkspaceSummary(input: {
  nativeCampaigns: readonly Pick<Campagna, "id" | "status">[];
  /**
   * Full Meta inventory for the user (every imported meta_campaigns row mapped
   * to an attention item on Home via loadMetaMondayBundle — including historical /
   * not-urgent / not-evaluable). NOT a filtered Control Room performance subset.
   */
  metaItems: readonly ControlRoomAttentionItem[];
  linkedNativeIds: ReadonlySet<string>;
  /** Full merged attention list (native+meta); suppression applied inside. */
  attentionItems: readonly ControlRoomAttentionItem[];
}): AllyOggiWorkspaceSummary {
  const natives = input.nativeCampaigns.filter((c) => Boolean(c.id));
  const metaCampaigns = input.metaItems.filter((i) => i.source === "META").length;
  const monday = buildMondayControlRoom([...input.attentionItems]);

  let draftCampaigns = 0;
  let revisionRequestedCampaigns = 0;
  let approvedCampaigns = 0;
  for (const c of natives) {
    const s = statusUpper(c.status);
    if (s === "DRAFT" || !s) draftCampaigns += 1;
    else if (s === "REVISION_REQUESTED") revisionRequestedCampaigns += 1;
    else if (s === "APPROVED") approvedCampaigns += 1;
  }

  const configurationRequiredCampaigns =
    monday.counts.CONFIGURATION_REQUIRED;
  const insufficientDataCampaigns = monday.counts.INSUFFICIENT_DATA;
  const historicalCampaigns = monday.counts.HISTORICAL;

  // Performance-monitorable path only (not draft, revision, config-gap, historical).
  const monitorableCampaigns = monday.items.filter((item) => {
    if (!isPerformanceEligibleAttentionItem(item)) return false;
    if (item.attentionState === "HISTORICAL") return false;
    if (item.attentionState === "CONFIGURATION_REQUIRED") return false;
    return true;
  }).length;

  return {
    totalWorkspaceCampaigns: countWorkspaceCampaigns({
      nativeCampaigns: natives,
      metaCampaignCount: metaCampaigns,
      linkedNativeIds: input.linkedNativeIds,
    }),
    nativeCampaigns: natives.length,
    metaCampaigns,
    draftCampaigns,
    revisionRequestedCampaigns,
    approvedCampaigns,
    monitorableCampaigns,
    configurationRequiredCampaigns,
    insufficientDataCampaigns,
    historicalCampaigns,
  };
}

export function isPerformanceEligibleAttentionItem(
  item: ControlRoomAttentionItem,
): boolean {
  if (item.suppressedByLink) return false;
  const status = statusUpper(item.campaignStatus);
  // Native workflow-only rows stay in workspace aggregates, not performance facts.
  if (item.source === "NATIVE") {
    if (status === "DRAFT" || !status) return false;
    if (status === "REVISION_REQUESTED") return false;
  }
  if (item.configurationKind === "DRAFT") return false;
  return true;
}

export { emptyAllyOggiWorkspaceSummary };
