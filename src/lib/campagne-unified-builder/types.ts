/**
 * UX.4 — Unified Builder: one canonical campaign configuration state.
 * View mode (Facile | Pro) is NOT part of campaign configuration.
 * LIVE META WRITES: 0
 */

import type { InstantFormBuilderDraft } from "@/lib/meta/write/instant-form-builder";

/** UI-only projection. Never persisted as campaign configuration. */
export type BuilderViewMode = "FACILE" | "PRO";

/**
 * Application-level campaign configuration edited by Facile and Pro (V1).
 * Reuses InstantFormBuilderDraft as the single mutable config object
 * (same localStorage key as legacy Easy Builder — one source of truth).
 *
 * ADV.1.5: Professional multi-AdSet design lives in
 * `@/lib/campagne-canonical-v2` (CanonicalCampaignStateV2).
 * Durable V2 persistence requires authorized QA schema migration —
 * do NOT stuff multi-AdSet graphs into front_end_offer / ALY_CANON_V1.
 */
export type CanonicalCampaignState = {
  campaignId: string;
  /** Shared configuration — Facile and Pro edit this object. */
  draft: InstantFormBuilderDraft;
  creativeAssetId: string | null;
  creativeNomeFile: string | null;
  creativeStoragePath: string | null;
};

export const BUILDER_VIEW_MODE_STORAGE_PREFIX = "ally_builder_view_v1:";

export function builderViewModeStorageKey(campaignId: string): string {
  return `${BUILDER_VIEW_MODE_STORAGE_PREFIX}${campaignId}`;
}
