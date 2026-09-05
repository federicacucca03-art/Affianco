/**
 * Session-scoped Ally oggi cache (client). No DB.
 */

import type { AllyOggiBrief, AllyOggiBriefContext } from "@/lib/ally-oggi/types";

const PREFIX = "affianco-ally-oggi-v2:";

export function allyOggiCacheFingerprint(context: AllyOggiBriefContext): string {
  const tip = context.campaigns
    .slice(0, 8)
    .map(
      (c) =>
        [
          c.source,
          c.campaignId,
          c.attentionState,
          c.urgencyLevel,
          c.healthStatus ?? "",
          c.trend,
          c.configurationKind ?? "",
          c.resultsCount ?? "",
          c.staleMeta ? "1" : "0",
        ].join(":"),
    )
    .join("|");
  const ws = context.workspace;
  return [
    ws.totalWorkspaceCampaigns,
    ws.draftCampaigns,
    ws.revisionRequestedCampaigns,
    ws.approvedCampaigns,
    ws.monitorableCampaigns,
    ws.configurationRequiredCampaigns,
    context.totalMonitored,
    context.counts.critical,
    context.counts.needsAttention,
    context.counts.monitor,
    context.counts.stable,
    context.counts.configurationRequired,
    context.counts.insufficientData,
    context.staleMetaCount,
    tip,
  ].join(";");
}

export function readAllyOggiSessionCache(
  userId: string,
  fingerprint: string,
): AllyOggiBrief | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      fingerprint?: string;
      brief?: AllyOggiBrief;
    };
    if (parsed.fingerprint !== fingerprint || !parsed.brief) return null;
    return parsed.brief;
  } catch {
    return null;
  }
}

export function writeAllyOggiSessionCache(
  userId: string,
  fingerprint: string,
  brief: AllyOggiBrief,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PREFIX + userId,
      JSON.stringify({ fingerprint, brief, at: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}
