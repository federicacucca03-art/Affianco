/**
 * ADV.1.5 — Serialize / deserialize CanonicalCampaignState V2 (in-memory / future JSONB).
 * LIVE META WRITES: 0
 */

import type { CanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/types";

export function serializeCanonicalCampaignStateV2(
  state: CanonicalCampaignStateV2,
): string {
  return JSON.stringify(state);
}

export function parseCanonicalCampaignStateV2(
  raw: string | null | undefined,
): CanonicalCampaignStateV2 | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateCanonicalCampaignStateV2(parsed);
  } catch {
    return null;
  }
}

export function validateCanonicalCampaignStateV2(
  raw: unknown,
): CanonicalCampaignStateV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 2) return null;
  if (typeof o.campaignId !== "string" || !o.campaignId.trim()) return null;
  if (!Array.isArray(o.adSets) || !Array.isArray(o.creatives)) return null;
  if (!o.budget || typeof o.budget !== "object") return null;
  if (!o.conversion || typeof o.conversion !== "object") return null;
  // Trust shape after schemaVersion gate — callers treat as Ally-owned document.
  return raw as CanonicalCampaignStateV2;
}

/** Deep clone via JSON — used for roundtrip tests. */
export function cloneCanonicalCampaignStateV2(
  state: CanonicalCampaignStateV2,
): CanonicalCampaignStateV2 {
  const again = parseCanonicalCampaignStateV2(
    serializeCanonicalCampaignStateV2(state),
  );
  if (!again) {
    throw new Error("ADV.1.5: V2 roundtrip clone failed");
  }
  return again;
}
