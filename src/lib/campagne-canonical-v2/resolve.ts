/**
 * ADV.1.5.1 — Deterministic V2 read precedence (no DB mutation).
 *
 * 1. valid campaigns.canonical_state V2
 * 2. legacy columns / ALY_CANON_V1 → runtime V2 adapter
 * 3. localStorage only for Builder in-flight (handled outside Detail/Review)
 *
 * LIVE META WRITES: 0
 */

import type { Campagna } from "@/types/campagne";
import type { CanonicalCampaignState } from "@/lib/campagne-unified-builder/types";
import { seedDraftFromPersistedCampagna } from "@/lib/campagne-unified-builder/canon-persist";
import {
  canonicalV2FromCanonicalV1,
  canonicalV2FromInstantFormDraft,
} from "@/lib/campagne-canonical-v2/from-v1";
import { validateCanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/serialize";
import { projectCanonicalV2ToV1Draft } from "@/lib/campagne-canonical-v2/to-v1-projection";
import type { CanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/types";

export type RuntimeV2ResolveSource =
  | "canonical_state"
  | "legacy_v1_adapter"
  | "builder_v1";

export type RuntimeV2ResolveResult = {
  state: CanonicalCampaignStateV2;
  source: RuntimeV2ResolveSource;
};

/**
 * Resolve runtime V2 from a loaded Campagna row (Detail / Review / Guardian).
 * Does not write back to DB.
 */
export function resolveRuntimeCanonicalV2FromCampagna(
  campagna: Campagna,
): RuntimeV2ResolveResult {
  const raw = campagna.canonicalState ?? null;
  if (raw != null) {
    const parsed =
      typeof raw === "string"
        ? validateCanonicalCampaignStateV2(
            (() => {
              try {
                return JSON.parse(raw);
              } catch {
                return null;
              }
            })(),
          )
        : validateCanonicalCampaignStateV2(raw);
    if (parsed && parsed.campaignId === campagna.id) {
      return { state: parsed, source: "canonical_state" };
    }
  }

  const draft = seedDraftFromPersistedCampagna(campagna);
  const v1: CanonicalCampaignState = {
    campaignId: campagna.id,
    draft,
    creativeAssetId: null,
    creativeNomeFile: null,
    creativeStoragePath: null,
  };
  return {
    state: canonicalV2FromCanonicalV1(v1, {
      clientId: campagna.clienteId ?? null,
      name: campagna.nomeCampagna ?? null,
    }),
    source: "legacy_v1_adapter",
  };
}

/**
 * Prefer durable/runtime V2 when projecting into V1 Builder draft.
 * Used by loadCanonicalCampaignState so Facile sees V2-backed values when present.
 */
export function seedV1DraftPreferringV2(campagna: Campagna) {
  const resolved = resolveRuntimeCanonicalV2FromCampagna(campagna);
  if (resolved.source === "canonical_state") {
    const proj = projectCanonicalV2ToV1Draft(resolved.state);
    return {
      draft: proj.draft,
      advancedStatePreserved: proj.advancedStatePreserved,
      facileSummary: proj.facileSummary,
      v2: resolved.state,
      source: resolved.source,
    };
  }
  const draft = seedDraftFromPersistedCampagna(campagna);
  return {
    draft,
    advancedStatePreserved: false,
    facileSummary: null,
    v2: resolved.state,
    source: resolved.source,
  };
}

/** Builder in-flight: start from LS V1 overlay but keep V2 base for merge. */
export function runtimeV2FromBuilderState(
  v1: CanonicalCampaignState,
  opts?: { clientId?: string | null; name?: string | null },
): CanonicalCampaignStateV2 {
  return canonicalV2FromInstantFormDraft({
    campaignId: v1.campaignId,
    clientId: opts?.clientId,
    name: opts?.name,
    draft: v1.draft,
    creativeAssetId: v1.creativeAssetId,
    creativeNomeFile: v1.creativeNomeFile,
    creativeStoragePath: v1.creativeStoragePath,
  });
}
