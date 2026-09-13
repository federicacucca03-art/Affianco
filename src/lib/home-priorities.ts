/**
 * Home priority partitioning for returning users.
 * Presentation only — reuses Control Room attention states (no new scoring).
 */

import type {
  AttentionState,
  ControlRoomAttentionItem,
  MondayControlRoomSummary,
} from "@/lib/monday-control-room";

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export function isHomeDraftItem(item: ControlRoomAttentionItem): boolean {
  if (item.suppressedByLink) return false;
  if (item.configurationKind === "DRAFT") return true;
  const status = statusUpper(item.campaignStatus);
  return status === "DRAFT" || !status;
}

export function isHomeRevisionItem(item: ControlRoomAttentionItem): boolean {
  if (item.suppressedByLink) return false;
  return statusUpper(item.campaignStatus) === "REVISION_REQUESTED";
}

/** Highest-priority operational actions for "Da fare oggi". */
export function isHomeDoNowItem(item: ControlRoomAttentionItem): boolean {
  if (item.suppressedByLink) return false;
  if (isHomeDraftItem(item)) return false;
  const state = item.attentionState;
  if (state === "CRITICAL" || state === "NEEDS_ATTENTION") return true;
  if (state === "CONFIGURATION_REQUIRED") return true;
  return false;
}

export function isHomeMonitorItem(item: ControlRoomAttentionItem): boolean {
  if (item.suppressedByLink) return false;
  if (isHomeDraftItem(item)) return false;
  return (
    item.attentionState === "MONITOR" ||
    item.attentionState === "INSUFFICIENT_DATA"
  );
}

export type HomePriorityBuckets = {
  doNow: ControlRoomAttentionItem[];
  monitor: ControlRoomAttentionItem[];
  drafts: ControlRoomAttentionItem[];
  stable: ControlRoomAttentionItem[];
  historical: ControlRoomAttentionItem[];
  draftCount: number;
  revisionCount: number;
  /** Count of items that require a real user response today (not drafts). */
  actionableCount: number;
};

export function partitionHomePriorities(
  summary: MondayControlRoomSummary,
): HomePriorityBuckets {
  const visible = summary.items.filter((i) => !i.suppressedByLink);
  const drafts = visible.filter(isHomeDraftItem);
  const doNow = visible.filter(isHomeDoNowItem);
  const monitor = visible.filter(isHomeMonitorItem);
  const revisionCount = visible.filter(isHomeRevisionItem).length;
  const actionableCount = doNow.length;

  return {
    doNow,
    monitor,
    drafts,
    stable: summary.stable,
    historical: summary.historical,
    draftCount: drafts.length,
    revisionCount,
    actionableCount,
  };
}

export type HomeDailySummaryCopy = {
  doNowCount: number;
  monitorCount: number;
  prepCount: number;
  totalWorkspaceCampaigns: number;
  historicalCount: number;
  /** Secondary inventory line — never the operational headline. */
  secondaryLine: string | null;
};

/**
 * Compact state summary for Home orientation.
 * Counts map 1:1 to Da fare / Da monitorare / In preparazione sections.
 * No combined "azioni" language.
 */
export function buildHomeDailySummaryCopy(input: {
  totalWorkspaceCampaigns: number;
  buckets: HomePriorityBuckets;
}): HomeDailySummaryCopy {
  const { buckets, totalWorkspaceCampaigns } = input;
  const doNowCount = buckets.doNow.length;
  const monitorCount = buckets.monitor.length;
  const prepCount = buckets.draftCount;
  const historicalCount = buckets.historical.filter((i) => !i.suppressedByLink)
    .length;

  const secondaryBits: string[] = [];
  if (totalWorkspaceCampaigns > 0) {
    secondaryBits.push(
      totalWorkspaceCampaigns === 1
        ? "1 campagna totale"
        : `${totalWorkspaceCampaigns} campagne totali`,
    );
  }
  if (historicalCount > 0) {
    secondaryBits.push(
      historicalCount === 1
        ? "1 nello storico"
        : `${historicalCount} nello storico`,
    );
  }

  return {
    doNowCount,
    monitorCount,
    prepCount,
    totalWorkspaceCampaigns,
    historicalCount,
    secondaryLine: secondaryBits.length > 0 ? secondaryBits.join(" · ") : null,
  };
}

export function greetingNameFromUser(input: {
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
}): string | null {
  const meta = input.userMetadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.nome === "string" && meta.nome.trim()) ||
    "";
  if (full) {
    return full.split(/\s+/)[0] ?? full;
  }
  const email = input.email?.trim();
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function homeSectionLabel(state: AttentionState): string {
  switch (state) {
    case "CRITICAL":
      return "Critica";
    case "NEEDS_ATTENTION":
      return "Da controllare";
    case "MONITOR":
      return "Da monitorare";
    case "CONFIGURATION_REQUIRED":
      return "Da configurare";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    case "STABLE":
      return "Stabile";
    case "HISTORICAL":
      return "Storico";
  }
}
