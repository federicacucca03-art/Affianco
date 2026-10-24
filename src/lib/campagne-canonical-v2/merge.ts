/**
 * ADV.1.5.1 — Lossless patch/merge for CanonicalCampaignState V2.
 * Easy edits must not reconstruct V2 from draft and drop advanced Ad Sets.
 * LIVE META WRITES: 0
 */

import type { InstantFormBuilderDraft } from "@/lib/meta/write/instant-form-builder";
import type {
  BudgetModelV2,
  CanonicalAdSetV2,
  CanonicalCampaignStateV2,
  ConversionContextV2,
  GeographyV2,
} from "@/lib/campagne-canonical-v2/types";

/** Fields the current Easy Builder is allowed to own on a patch. */
export type EasyOwnedField =
  | "budget"
  | "geography"
  | "age"
  | "placements"
  | "copy"
  | "identity"
  | "specialAdCategory"
  | "objective"
  | "conversionLocation";

export type CanonicalV2Patch = {
  name?: string | null;
  budget?: Partial<BudgetModelV2>;
  conversion?: Partial<ConversionContextV2>;
  /** Patch applied only to the primary (first prospecting, else first) Ad Set. */
  primaryAdSet?: Partial<
    Pick<
      CanonicalAdSetV2,
      "geography" | "age" | "placements" | "conversion" | "audience"
    >
  > & {
    geography?: Partial<GeographyV2>;
  };
  updatedAtIso?: string;
};

function primaryAdSetIndex(state: CanonicalCampaignStateV2): number {
  const i = state.adSets.findIndex((a) => a.role === "PROSPECTING");
  return i >= 0 ? i : 0;
}

/**
 * Deep-ish merge that never drops sibling Ad Sets / creatives / architect.
 */
export function mergeCanonicalCampaignStateV2(
  current: CanonicalCampaignStateV2,
  patch: CanonicalV2Patch,
): CanonicalCampaignStateV2 {
  const next: CanonicalCampaignStateV2 = {
    ...current,
    name: patch.name !== undefined ? patch.name : current.name,
    budget: patch.budget
      ? {
          ...current.budget,
          ...patch.budget,
          adSetAmountsMajor: {
            ...current.budget.adSetAmountsMajor,
            ...(patch.budget.adSetAmountsMajor ?? {}),
          },
        }
      : current.budget,
    conversion: patch.conversion
      ? { ...current.conversion, ...patch.conversion }
      : current.conversion,
    adSets: current.adSets.map((a) => ({ ...a })),
    creatives: current.creatives.map((c) => ({ ...c })),
    updatedAtIso: patch.updatedAtIso ?? new Date().toISOString(),
  };

  if (patch.primaryAdSet && next.adSets.length > 0) {
    const idx = primaryAdSetIndex(next);
    const target = next.adSets[idx];
    if (target) {
      next.adSets[idx] = {
        ...target,
        ...patch.primaryAdSet,
        geography: patch.primaryAdSet.geography
          ? { ...target.geography, ...patch.primaryAdSet.geography }
          : target.geography,
        age: patch.primaryAdSet.age
          ? { ...target.age, ...patch.primaryAdSet.age }
          : target.age,
        placements: patch.primaryAdSet.placements
          ? { ...target.placements, ...patch.primaryAdSet.placements }
          : target.placements,
        conversion: patch.primaryAdSet.conversion
          ? { ...target.conversion, ...patch.primaryAdSet.conversion }
          : target.conversion,
        audience: patch.primaryAdSet.audience
          ? { ...target.audience, ...patch.primaryAdSet.audience }
          : target.audience,
      };
    }
  }

  return next;
}

/**
 * Build a V2 patch from Easy draft changes for only the fields Easy owns.
 * Omits unowned dimensions so retargeting / lookalike / schedule stay intact.
 */
export function patchFromEasyDraft(input: {
  current: CanonicalCampaignStateV2;
  draft: InstantFormBuilderDraft;
  owned: EasyOwnedField[];
}): CanonicalV2Patch {
  const { draft, owned } = input;
  const patch: CanonicalV2Patch = {};

  if (owned.includes("budget")) {
    patch.budget = {
      period: draft.budgetDailyMajor != null ? "DAILY" : input.current.budget.period,
      campaignAmountMajor: draft.budgetDailyMajor,
      allocationStatus:
        input.current.budget.allocationStatus === "UNRESOLVED_SPLIT"
          ? "UNRESOLVED_SPLIT"
          : draft.budgetDailyMajor != null
            ? "CAMPAIGN_ONLY"
            : input.current.budget.allocationStatus,
    };
  }

  if (owned.includes("conversionLocation") || owned.includes("identity")) {
    patch.conversion = {
      ...(owned.includes("conversionLocation")
        ? {
            location:
              draft.conversionChoice === "INSTANT_FORM"
                ? ("INSTANT_FORM" as const)
                : draft.conversionChoice === "WEBSITE"
                  ? ("WEBSITE" as const)
                  : input.current.conversion.location,
          }
        : {}),
      ...(owned.includes("identity")
        ? {
            pageId: draft.pageId.trim() || null,
            pageName: draft.pageName,
            formId: draft.formId.trim() || null,
            formName: draft.formName,
          }
        : {}),
    };
  }

  const primary: CanonicalV2Patch["primaryAdSet"] = {};
  let touchPrimary = false;

  if (owned.includes("geography")) {
    touchPrimary = true;
    primary.geography = {
      labelIt: draft.geoLabel?.trim() || draft.geoQuery.trim() || null,
      query: draft.geoQuery.trim() || null,
      countryCode: draft.countryCode || null,
      metaGeoKey: draft.metaGeoKey,
    };
  }

  if (owned.includes("age")) {
    touchPrimary = true;
    primary.age = { min: draft.etaMin, max: draft.etaMax };
  }

  if (owned.includes("placements")) {
    touchPrimary = true;
    primary.placements = {
      mode: draft.placementsMode === "MANUAL" ? "MANUAL" : "ADVANTAGE_PLUS",
      manualSurfaces: [...draft.placementsManual],
    };
  }

  if (touchPrimary) patch.primaryAdSet = primary;

  if (owned.includes("copy")) {
    // Copy lives on creatives — merge handled by caller when needed.
  }

  return patch;
}

/** Convenience: apply Easy-owned patch onto current V2. */
export function applyEasyDraftPatchToV2(input: {
  current: CanonicalCampaignStateV2;
  draft: InstantFormBuilderDraft;
  owned: EasyOwnedField[];
}): CanonicalCampaignStateV2 {
  return mergeCanonicalCampaignStateV2(
    input.current,
    patchFromEasyDraft(input),
  );
}
