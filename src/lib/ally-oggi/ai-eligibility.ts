/**
 * M9.1E — whether AI narration adds value beyond the deterministic summary.
 * Not a priority / health / urgency engine.
 */

import type {
  AllyOggiBriefContext,
  AllyOggiWorkspaceSummary,
} from "@/lib/ally-oggi/types";

/**
 * Cross-campaign synthesis: ≥2 campaigns with ≥2 distinct canonical state buckets.
 * Buckets use existing workspace summary fields only (no new priority engine):
 * - drafts
 * - revisions
 * - monitorable (performance path)
 * - approved but not yet monitorable
 * - historical
 */
function hasCrossCampaignSynthesisValue(
  ws: AllyOggiWorkspaceSummary,
): boolean {
  if (ws.totalWorkspaceCampaigns < 2) return false;

  let distinctBuckets = 0;
  if (ws.draftCampaigns > 0) distinctBuckets += 1;
  if (ws.revisionRequestedCampaigns > 0) distinctBuckets += 1;
  if (ws.monitorableCampaigns > 0) distinctBuckets += 1;
  if (ws.approvedCampaigns > 0 && ws.monitorableCampaigns === 0) {
    distinctBuckets += 1;
  }
  if (ws.historicalCampaigns > 0) distinctBuckets += 1;

  return distinctBuckets >= 2;
}

/**
 * True when there is enough meaningful context for an Ally oggi AI briefing.
 *
 * Final rule (exact):
 * - false if onboarding incomplete or workspace has 0 campaigns
 * - true if PERFORMANCE VALUE: `campaigns[]` has ≥1 Control Room–eligible fact
 * - true if CROSS-CAMPAIGN SYNTHESIS VALUE: ≥2 workspace campaigns AND ≥2 distinct
 *   canonical state buckets (draft / revision / monitorable / approved-pending / historical)
 * - otherwise false (e.g. 1 DRAFT, 2 equivalent DRAFTs, lone REVISION)
 */
export function canGenerateAllyOggiAiBrief(
  context: AllyOggiBriefContext,
  options?: { isFirstRunOnboarding?: boolean },
): boolean {
  if (options?.isFirstRunOnboarding) return false;
  const ws = context.workspace;
  if (ws.totalWorkspaceCampaigns <= 0) return false;

  // A — performance / evaluable facts already in context
  if (context.campaigns.length > 0) return true;

  // B — meaningful cross-campaign variation (not mere count ≥ 2)
  if (hasCrossCampaignSynthesisValue(ws)) return true;

  return false;
}
