/**
 * ADV.1.5 — InstantFormBuilderDraft / CanonicalCampaignState V1 → V2.
 * Deterministic, lossless for currently supported Easy fields.
 * LIVE META WRITES: 0
 */

import type { InstantFormBuilderDraft } from "@/lib/meta/write/instant-form-builder";
import type { CanonicalCampaignState } from "@/lib/campagne-unified-builder/types";
import {
  emptyAdSetV2,
  emptyCanonicalCampaignStateV2,
  newCanonicalEntityId,
} from "@/lib/campagne-canonical-v2/empty";
import type {
  CanonicalCampaignStateV2,
  ConversionLocationV2,
  MetaObjectiveFamilyV2,
  OptimizationEventIntentV2,
  SpecialAdCategoryV2,
} from "@/lib/campagne-canonical-v2/types";

function mapObjective(
  goal: InstantFormBuilderDraft["objectiveChoice"],
): MetaObjectiveFamilyV2 {
  if (goal === "GENERATE_LEADS") return "LEADS";
  if (goal === "SELL_ONLINE") return "SALES";
  if (goal === "TRAFFIC") return "TRAFFIC";
  if (goal === "AWARENESS") return "AWARENESS";
  if (goal === "ENGAGEMENT") return "ENGAGEMENT";
  return "UNKNOWN";
}

function mapLocation(
  loc: InstantFormBuilderDraft["conversionChoice"],
): ConversionLocationV2 {
  if (loc === "INSTANT_FORM") return "INSTANT_FORM";
  if (loc === "WEBSITE") return "WEBSITE";
  return "UNKNOWN";
}

function mapOptimization(
  objective: MetaObjectiveFamilyV2,
  location: ConversionLocationV2,
): OptimizationEventIntentV2 {
  if (objective === "SALES") return "PURCHASE";
  if (objective === "LEADS") return "LEAD";
  if (objective === "TRAFFIC") return "LANDING_PAGE_VIEW";
  if (objective === "APP_PROMOTION") return "APP_INSTALL";
  if (objective === "ENGAGEMENT" && location === "MESSAGING") return "MESSAGE";
  return "UNKNOWN";
}

function mapSpecial(kind: string): SpecialAdCategoryV2[] {
  const k = (kind || "").toUpperCase();
  if (!k || k === "UNRESOLVED" || k === "NONE") {
    return k === "NONE" ? ["NONE"] : ["UNRESOLVED"];
  }
  if (k.includes("EMPLOY")) return ["EMPLOYMENT"];
  if (k.includes("HOUS")) return ["HOUSING"];
  if (k.includes("FINANC")) return ["FINANCIAL_PRODUCTS_SERVICES"];
  if (k.includes("POLIT") || k.includes("ISSUE")) {
    return ["ISSUES_ELECTIONS_POLITICS"];
  }
  return ["UNRESOLVED"];
}

/**
 * Map current Easy / Instant Form draft into CanonicalCampaignState V2.
 * Always produces exactly one Ad Set for V1 sources.
 */
export function canonicalV2FromInstantFormDraft(input: {
  campaignId: string;
  clientId?: string | null;
  name?: string | null;
  draft: InstantFormBuilderDraft;
  creativeAssetId?: string | null;
  creativeNomeFile?: string | null;
  creativeStoragePath?: string | null;
}): CanonicalCampaignStateV2 {
  const { draft } = input;
  const objective = mapObjective(draft.objectiveChoice);
  const location = mapLocation(draft.conversionChoice);
  const optimizationEvent = mapOptimization(objective, location);

  const state = emptyCanonicalCampaignStateV2({
    campaignId: input.campaignId,
    clientId: input.clientId,
    name: input.name,
  });

  state.objective = objective;
  state.specialAdCategories = mapSpecial(draft.specialKind);
  state.conversion = {
    location,
    optimizationEvent,
    websiteUrl: null,
    pageId: draft.pageId.trim() || null,
    pageName: draft.pageName,
    formId: draft.formId.trim() || null,
    formName: draft.formName,
    messagingChannel: null,
    appStoreId: null,
    appDisplayName: null,
  };
  state.budget = {
    currencyCode: null,
    period: draft.budgetDailyMajor != null ? "DAILY" : "UNRESOLVED",
    campaignAmountMajor: draft.budgetDailyMajor,
    allocationStatus:
      draft.budgetDailyMajor != null ? "CAMPAIGN_ONLY" : "MISSING",
    adSetAmountsMajor: {},
  };

  const geoLabel = draft.geoLabel?.trim() || draft.geoQuery.trim() || null;
  const adSetId = newCanonicalEntityId("adset");
  const creativeId =
    input.creativeAssetId || draft.primaryText || draft.headline
      ? newCanonicalEntityId("creative")
      : null;

  const adSet = emptyAdSetV2({
    id: adSetId,
    name: "Gruppo principale",
    role: "PROSPECTING",
    geography: {
      labelIt: geoLabel,
      countryCode: draft.countryCode || null,
      metaGeoKey: draft.metaGeoKey,
      query: draft.geoQuery.trim() || null,
    },
    age: { min: draft.etaMin, max: draft.etaMax },
    audience: {
      role: "PROSPECTING",
      strategyKind:
        draft.allyAudienceMode === "ADVANTAGE_AUDIENCE"
          ? "ADVANTAGE_PLUS"
          : "MANUAL",
      summaryIt:
        draft.allyAudienceMode === "ADVANTAGE_AUDIENCE"
          ? "Pubblico ampio"
          : "Pubblico personalizzato",
      interestsUserSelected: [],
      retargetingSource: null,
      retargetingWindowDays: null,
      lookalikeSourceSummaryIt: null,
      lookalikePercentage: null,
      resolvedMetaAudienceId: null,
      resolvedMetaAudienceName: null,
    },
    placements: {
      mode:
        draft.placementsMode === "MANUAL"
          ? "MANUAL"
          : draft.placementsMode === "ADVANTAGE"
            ? "ADVANTAGE_PLUS"
            : "UNRESOLVED",
      manualSurfaces: [...draft.placementsManual],
    },
    conversion: { ...state.conversion },
    creativeIds: creativeId ? [creativeId] : [],
    provenance: {
      structure: "USER",
      audience: "USER",
      geography: geoLabel ? "USER" : "MISSING",
    },
  });

  state.adSets = [adSet];

  if (creativeId) {
    state.creatives = [
      {
        id: creativeId,
        assetId: input.creativeAssetId ?? null,
        storagePath: input.creativeStoragePath ?? null,
        nomeFile: input.creativeNomeFile ?? null,
        primaryText: draft.primaryText || null,
        headline: draft.headline || null,
        description: draft.description || null,
        primaryTextProvenance: draft.primaryTextProvenance,
        headlineProvenance: draft.headlineProvenance,
        descriptionProvenance: draft.descriptionProvenance,
        assignedAdSetIds: [adSetId],
      },
    ];
  }

  state.legacyV1Compat = {
    formRelation: draft.formRelation,
    preferPageOnly: draft.preferPageOnly,
    instagramUserId: draft.instagramUserId,
    creativitaCount: draft.creativitaCount,
    allyAudienceMode: draft.allyAudienceMode,
    placementsMode: draft.placementsMode,
  };
  state.updatedAtIso = new Date().toISOString();
  return state;
}

export function canonicalV2FromCanonicalV1(
  state: CanonicalCampaignState,
  opts?: { clientId?: string | null; name?: string | null },
): CanonicalCampaignStateV2 {
  return canonicalV2FromInstantFormDraft({
    campaignId: state.campaignId,
    clientId: opts?.clientId,
    name: opts?.name,
    draft: state.draft,
    creativeAssetId: state.creativeAssetId,
    creativeNomeFile: state.creativeNomeFile,
    creativeStoragePath: state.creativeStoragePath,
  });
}
