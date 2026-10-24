/**
 * ADV.2.2 — Session-only V2 builder state (no DB mutation).
 * Survives Facile↔Pro within the browser tab; never touches campaigns row.
 */

import {
  parseCanonicalCampaignStateV2,
  serializeCanonicalCampaignStateV2,
} from "@/lib/campagne-canonical-v2/serialize";
import type { CanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/types";

const PREFIX = "ally_builder_v2_session_v1:";

export function builderV2SessionKey(campaignId: string): string {
  return `${PREFIX}${campaignId}`;
}

export function readBuilderV2Session(
  campaignId: string,
): CanonicalCampaignStateV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(builderV2SessionKey(campaignId));
    return parseCanonicalCampaignStateV2(raw);
  } catch {
    return null;
  }
}

export function writeBuilderV2Session(
  campaignId: string,
  state: CanonicalCampaignStateV2,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      builderV2SessionKey(campaignId),
      serializeCanonicalCampaignStateV2(state),
    );
  } catch {
    // quota / private mode — in-memory still works
  }
}
