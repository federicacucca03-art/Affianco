/**
 * ADV.1.5 — Project V2 → InstantFormBuilderDraft subset for current Builder.
 * Advanced V2 fields are NOT flattened away — flagged as preserved.
 * LIVE META WRITES: 0
 */

import {
  emptyInstantFormBuilderDraft,
  type InstantFormBuilderDraft,
} from "@/lib/meta/write/instant-form-builder";
import { buildFacileComplexitySummary } from "@/lib/campagne-canonical-v2/facile-summary";
import type {
  CanonicalCampaignStateV2,
  MetaObjectiveFamilyV2,
  V2ToV1ProjectionResult,
} from "@/lib/campagne-canonical-v2/types";

function mapObjectiveToEasy(
  o: MetaObjectiveFamilyV2,
): InstantFormBuilderDraft["objectiveChoice"] {
  if (o === "LEADS") return "GENERATE_LEADS";
  if (o === "SALES") return "SELL_ONLINE";
  if (o === "TRAFFIC") return "TRAFFIC";
  if (o === "AWARENESS") return "AWARENESS";
  if (o === "ENGAGEMENT") return "ENGAGEMENT";
  // APP_PROMOTION has no Easy enum — leave null; V2 remains source of truth.
  return null;
}

/**
 * Build the Easy-editable subset from V2 without destroying advanced Ad Sets.
 * When advancedStatePreserved=true, callers must not persist draft as if complete.
 */
export function projectCanonicalV2ToV1Draft(
  state: CanonicalCampaignStateV2,
): V2ToV1ProjectionResult {
  const summary = buildFacileComplexitySummary(state);
  const warningsIt: string[] = [];
  const primary =
    state.adSets.find((a) => a.role === "PROSPECTING") ?? state.adSets[0];
  const creative =
    state.creatives.find((c) =>
      primary ? c.assignedAdSetIds.includes(primary.id) : true,
    ) ?? state.creatives[0];

  const legacy = (state.legacyV1Compat ?? {}) as Record<string, unknown>;

  const conversionChoice: InstantFormBuilderDraft["conversionChoice"] =
    state.conversion.location === "INSTANT_FORM"
      ? "INSTANT_FORM"
      : state.conversion.location === "WEBSITE"
        ? "WEBSITE"
        : null;

  if (state.objective === "APP_PROMOTION") {
    warningsIt.push(
      "Obiettivo App Promotion non è ancora modificabile nel Builder Facile — stato V2 preservato.",
    );
  }
  if (summary.adSetCount > 1) {
    warningsIt.push(
      "Questa campagna ha più gruppi di pubblico. Il Builder attuale mostra solo il sottoinsieme supportato senza cancellare gli altri.",
    );
  }
  if (summary.hasUnresolvedBudgetSplit) {
    warningsIt.push("Ripartizione budget tra gruppi ancora da definire.");
  }

  const draft = emptyInstantFormBuilderDraft({
    objectiveChoice: mapObjectiveToEasy(state.objective),
    conversionChoice,
    pageId: state.conversion.pageId ?? "",
    pageName: state.conversion.pageName,
    formId: state.conversion.formId ?? "",
    formName: state.conversion.formName,
    formRelation:
      legacy.formRelation === "VERIFIED" ||
      legacy.formRelation === "MISMATCH" ||
      legacy.formRelation === "UNCHECKED"
        ? legacy.formRelation
        : "UNCHECKED",
    instagramUserId:
      typeof legacy.instagramUserId === "string" ? legacy.instagramUserId : "",
    preferPageOnly: legacy.preferPageOnly === true,
    metaGeoKey: primary?.geography.metaGeoKey ?? null,
    geoLabel: primary?.geography.labelIt ?? null,
    geoQuery: primary?.geography.query ?? primary?.geography.labelIt ?? "",
    countryCode: primary?.geography.countryCode ?? "IT",
    etaMin: primary?.age.min ?? null,
    etaMax: primary?.age.max ?? null,
    allyAudienceMode:
      primary?.audience.strategyKind === "MANUAL" ||
      primary?.audience.strategyKind === "CUSTOM_AUDIENCE_INTENT"
        ? "CUSTOM"
        : "ADVANTAGE_AUDIENCE",
    budgetDailyMajor:
      state.budget.period === "DAILY" ? state.budget.campaignAmountMajor : null,
    primaryText: creative?.primaryText ?? "",
    headline: creative?.headline ?? "",
    description: creative?.description ?? "",
    primaryTextProvenance:
      creative?.primaryTextProvenance === "USER" ||
      creative?.primaryTextProvenance === "ALLY"
        ? creative.primaryTextProvenance
        : "UNKNOWN",
    headlineProvenance:
      creative?.headlineProvenance === "USER" ||
      creative?.headlineProvenance === "ALLY"
        ? creative.headlineProvenance
        : "UNKNOWN",
    descriptionProvenance:
      creative?.descriptionProvenance === "USER" ||
      creative?.descriptionProvenance === "ALLY"
        ? creative.descriptionProvenance
        : "UNKNOWN",
    creativitaCount:
      typeof legacy.creativitaCount === "number"
        ? legacy.creativitaCount
        : state.creatives.length,
    specialKind:
      state.specialAdCategories[0] === "NONE"
        ? "NONE"
        : state.specialAdCategories[0] === "UNRESOLVED"
          ? "UNRESOLVED"
          : state.specialAdCategories[0] ?? "UNRESOLVED",
    placementsMode:
      primary?.placements.mode === "MANUAL" ? "MANUAL" : "ADVANTAGE",
    placementsManual: (primary?.placements.manualSurfaces ?? []).filter(
      (s): s is InstantFormBuilderDraft["placementsManual"][number] =>
        [
          "facebook_feed",
          "instagram_feed",
          "instagram_stories",
          "instagram_reels",
          "facebook_stories",
        ].includes(s),
    ) as InstantFormBuilderDraft["placementsManual"],
  });

  return {
    draft,
    advancedStatePreserved: !summary.isSimpleLeadsInstantForm,
    facileSummary: summary,
    warningsIt,
  };
}
