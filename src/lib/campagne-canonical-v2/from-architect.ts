/**
 * ADV.1.5 — CampaignIntent / CampaignDesign → CanonicalCampaignState V2.
 * Preserves multi-AdSet / retarget / Sales / App without execution claims.
 * LIVE META WRITES: 0
 */

import type {
  CampaignDesign,
  CampaignIntent,
} from "@/lib/ai-campaign-architect/universal/types";
import {
  emptyAdSetV2,
  emptyCanonicalCampaignStateV2,
  newCanonicalEntityId,
} from "@/lib/campagne-canonical-v2/empty";
import type {
  AudienceRoleV2,
  AudienceStrategyKindV2,
  CanonicalAdSetV2,
  CanonicalCampaignStateV2,
  ConversionLocationV2,
  MetaObjectiveFamilyV2,
  OptimizationEventIntentV2,
  RetargetingSourceIntentV2,
  SpecialAdCategoryV2,
} from "@/lib/campagne-canonical-v2/types";

function mapObjective(
  g: CampaignIntent["businessGoal"]["value"],
): MetaObjectiveFamilyV2 {
  if (
    g === "LEADS" ||
    g === "SALES" ||
    g === "TRAFFIC" ||
    g === "AWARENESS" ||
    g === "ENGAGEMENT" ||
    g === "APP_PROMOTION"
  ) {
    return g;
  }
  return "UNKNOWN";
}

function mapLocation(
  loc: CampaignIntent["conversionLocation"]["value"],
): ConversionLocationV2 {
  if (loc === "INSTANT_FORM") return "INSTANT_FORM";
  if (loc === "WEBSITE") return "WEBSITE";
  if (loc === "MESSAGING") return "MESSAGING";
  if (loc === "APP") return "APP";
  if (loc === "STORE") return "STORE";
  return "UNKNOWN";
}

function mapOptimizationEvent(
  intent: CampaignIntent,
  design: CampaignDesign,
): OptimizationEventIntentV2 {
  const raw = (
    design.eventRequirement.value ||
    design.performanceGoal.value ||
    intent.desiredAction.value ||
    ""
  ).toLowerCase();
  if (/purchase|acquist/.test(raw)) return "PURCHASE";
  if (/landing page view|lpv/.test(raw)) return "LANDING_PAGE_VIEW";
  if (/link click/.test(raw)) return "LINK_CLICK";
  if (/install/.test(raw)) return "APP_INSTALL";
  if (/app event/.test(raw)) return "APP_EVENT";
  if (/messagg|message|whatsapp/.test(raw)) return "MESSAGE";
  if (/lead|contatt|preventiv/.test(raw)) return "LEAD";
  const goal = intent.businessGoal.value;
  if (goal === "SALES") return "PURCHASE";
  if (goal === "LEADS") return "LEAD";
  if (goal === "TRAFFIC") return "LANDING_PAGE_VIEW";
  if (goal === "APP_PROMOTION") return "APP_INSTALL";
  if (goal === "ENGAGEMENT") return "MESSAGE";
  return "UNKNOWN";
}

function mapSpecial(
  intent: CampaignIntent,
): SpecialAdCategoryV2[] {
  const risk = intent.specialCategoryRisk.value;
  if (risk === "NONE") return ["NONE"];
  if (
    risk === "EMPLOYMENT" ||
    risk === "HOUSING" ||
    risk === "FINANCIAL_PRODUCTS_SERVICES" ||
    risk === "ISSUES_ELECTIONS_POLITICS"
  ) {
    return [risk];
  }
  return ["UNRESOLVED"];
}

function extractRetargetWindow(design: CampaignDesign, intent: CampaignIntent): number | null {
  const blob = [
    design.campaignStructure.value,
    design.audienceStrategy.value,
    intent.audienceIntent.value,
    intent.retargetingIntent.reason,
  ]
    .filter(Boolean)
    .join(" ");
  const m = blob.match(/(\d{1,3})\s*giorn/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 365 ? n : null;
}

function retargetSourceFromText(text: string): RetargetingSourceIntentV2 {
  const t = text.toLowerCase();
  if (/carrell|cart|checkout/.test(t)) return "CART_ABANDONERS";
  if (/engager|instagram|facebook|social/.test(t)) return "SOCIAL_ENGAGERS";
  if (/video/.test(t)) return "VIDEO_VIEWERS";
  if (/lead/.test(t)) return "LEADS";
  if (/visitor|sito|website|visitator/.test(t)) return "WEBSITE_VISITORS";
  return "UNKNOWN";
}

function geoFromIntent(intent: CampaignIntent, design: CampaignDesign) {
  const label =
    intent.geography.value?.trim() ||
    (design.geoStrategy.value?.trim() &&
    design.geoStrategy.requiresUserConfirmation === false
      ? design.geoStrategy.value.trim()
      : null) ||
    null;
  const isItaly = label != null && /^italia$/i.test(label);
  return {
    labelIt: label,
    countryCode: isItaly ? "IT" : null,
    metaGeoKey: null,
    query: label,
  };
}

function placementsFromDesign(design: CampaignDesign) {
  const p = design.placementsStrategy.value ?? "";
  if (/advantage/i.test(p)) {
    return { mode: "ADVANTAGE_PLUS" as const, manualSurfaces: [] as string[] };
  }
  if (/manual/i.test(p)) {
    return { mode: "MANUAL" as const, manualSurfaces: [] as string[] };
  }
  return { mode: "UNRESOLVED" as const, manualSurfaces: [] as string[] };
}

function lookalikePercentage(text: string): number | null {
  const m = text.match(/\b(\d{1,2})\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : null;
}

/**
 * Map ADV.1 Architect intent+design into CanonicalCampaignState V2.
 * Multi-audience → multiple Ad Sets. Budget split never invented.
 */
export function canonicalV2FromArchitect(input: {
  campaignId: string;
  clientId?: string | null;
  name?: string | null;
  intent: CampaignIntent;
  design: CampaignDesign;
  currencyCode?: string | null;
}): CanonicalCampaignStateV2 {
  const { intent, design } = input;
  const objective = mapObjective(intent.businessGoal.value);
  const location = mapLocation(
    design.conversionLocation.value || intent.conversionLocation.value,
  );
  const optimizationEvent = mapOptimizationEvent(intent, design);
  const geo = geoFromIntent(intent, design);
  const placements = placementsFromDesign(design);
  const retarget = intent.retargetingIntent.value === true;
  const prospecting =
    intent.prospectingIntent.value === true ||
    (!retarget && intent.lookalikeIntent.value !== true);
  const lookalike = intent.lookalikeIntent.value === true;
  const multi = prospecting && retarget;
  const windowDays = extractRetargetWindow(design, intent);
  const audienceBlob = [
    design.audienceStrategy.value,
    intent.audienceIntent.value,
  ]
    .filter(Boolean)
    .join(" ");

  const state = emptyCanonicalCampaignStateV2({
    campaignId: input.campaignId,
    clientId: input.clientId,
    name: input.name,
  });

  state.objective = objective;
  state.specialAdCategories = mapSpecial(intent);
  state.conversion = {
    location:
      objective === "APP_PROMOTION" && location === "UNKNOWN" ? "APP" : location,
    optimizationEvent,
    websiteUrl: null,
    pageId: null,
    pageName: null,
    formId: null,
    formName: null,
    messagingChannel:
      location === "MESSAGING" || intent.messagingIntent.value === true
        ? /whatsapp/i.test(intent.userAskSummaryIt)
          ? "WHATSAPP"
          : "MESSENGER"
        : null,
    appStoreId: null,
    appDisplayName: null,
  };

  const budgetDaily = design.dailyBudget.value ?? intent.budgetDaily.value;
  const allocationStatus =
    multi && budgetDaily != null
      ? ("UNRESOLVED_SPLIT" as const)
      : budgetDaily != null
        ? ("CAMPAIGN_ONLY" as const)
        : ("MISSING" as const);

  state.budget = {
    currencyCode: input.currencyCode ?? null,
    period: budgetDaily != null ? "DAILY" : "UNRESOLVED",
    campaignAmountMajor: budgetDaily,
    allocationStatus,
    adSetAmountsMajor: {},
  };

  state.schedule = {
    kind: "UNRESOLVED",
    startDateIso: null,
    endDateIso: null,
    durationDays: null,
  };

  const conversionShared = { ...state.conversion };
  const adSets: CanonicalAdSetV2[] = [];

  if (multi) {
    adSets.push(
      emptyAdSetV2({
        id: newCanonicalEntityId("adset"),
        name: "Prospecting",
        role: "PROSPECTING",
        geography: { ...geo },
        audience: {
          role: "PROSPECTING",
          strategyKind: /broad|advantage|ampio/i.test(audienceBlob)
            ? "BROAD"
            : "ADVANTAGE_PLUS",
          summaryIt: "Pubblico ampio / prospecting",
          interestsUserSelected: [],
          retargetingSource: null,
          retargetingWindowDays: null,
          lookalikeSourceSummaryIt: null,
          lookalikePercentage: null,
          resolvedMetaAudienceId: null,
          resolvedMetaAudienceName: null,
        },
        placements: { ...placements },
        conversion: { ...conversionShared },
        provenance: {
          structure: "USER",
          audience: "USER",
          geography: geo.labelIt ? "USER" : "MISSING",
        },
      }),
    );
    adSets.push(
      emptyAdSetV2({
        id: newCanonicalEntityId("adset"),
        name:
          windowDays != null
            ? `Retargeting ${windowDays} giorni`
            : "Retargeting",
        role: "RETARGETING",
        geography: { ...geo },
        audience: {
          role: "RETARGETING",
          strategyKind: "CUSTOM_AUDIENCE_INTENT",
          summaryIt:
            windowDays != null
              ? `Visitatori sito ${windowDays} giorni`
              : "Retargeting (audience da definire)",
          interestsUserSelected: [],
          retargetingSource: retargetSourceFromText(audienceBlob),
          retargetingWindowDays: windowDays,
          lookalikeSourceSummaryIt: null,
          lookalikePercentage: null,
          resolvedMetaAudienceId: null,
          resolvedMetaAudienceName: null,
        },
        placements: { ...placements },
        conversion: { ...conversionShared },
        provenance: {
          structure: "USER",
          audience: "USER",
          geography: geo.labelIt ? "USER" : "MISSING",
        },
      }),
    );
  } else if (lookalike && !retarget) {
    const pct = lookalikePercentage(audienceBlob);
    adSets.push(
      emptyAdSetV2({
        id: newCanonicalEntityId("adset"),
        name: pct != null ? `Lookalike ${pct}%` : "Lookalike",
        role: "LOOKALIKE",
        geography: { ...geo },
        audience: {
          role: "LOOKALIKE",
          strategyKind: "LOOKALIKE_INTENT",
          summaryIt:
            intent.audienceIntent.value ||
            design.audienceStrategy.value ||
            "Lookalike (seed da definire)",
          interestsUserSelected: [],
          retargetingSource: null,
          retargetingWindowDays: null,
          lookalikeSourceSummaryIt:
            intent.lookalikeIntent.reason ||
            "clienti esistenti / seed non risolto",
          lookalikePercentage: pct,
          resolvedMetaAudienceId: null,
          resolvedMetaAudienceName: null,
        },
        placements: { ...placements },
        conversion: { ...conversionShared },
        provenance: {
          structure: "USER",
          audience: "USER",
          geography: geo.labelIt ? "USER" : "MISSING",
        },
      }),
    );
  } else if (retarget) {
    adSets.push(
      emptyAdSetV2({
        id: newCanonicalEntityId("adset"),
        name:
          windowDays != null
            ? `Retargeting ${windowDays} giorni`
            : "Retargeting",
        role: "RETARGETING",
        geography: { ...geo },
        audience: {
          role: "RETARGETING",
          strategyKind: "CUSTOM_AUDIENCE_INTENT",
          summaryIt:
            windowDays != null
              ? `Visitatori sito ${windowDays} giorni`
              : intent.audienceIntent.value,
          interestsUserSelected: [],
          retargetingSource: retargetSourceFromText(audienceBlob),
          retargetingWindowDays: windowDays,
          lookalikeSourceSummaryIt: null,
          lookalikePercentage: null,
          resolvedMetaAudienceId: null,
          resolvedMetaAudienceName: null,
        },
        placements: { ...placements },
        conversion: { ...conversionShared },
        provenance: {
          structure: "USER",
          audience: "USER",
          geography: geo.labelIt ? "USER" : "MISSING",
        },
      }),
    );
  } else {
    const strategyKind: AudienceStrategyKindV2 = /broad|ampio|advantage/i.test(
      audienceBlob,
    )
      ? /advantage/i.test(audienceBlob)
        ? "ADVANTAGE_PLUS"
        : "BROAD"
      : design.advantageAudienceRecommendation.value
        ? "ADVANTAGE_PLUS"
        : "UNRESOLVED";
    const role: AudienceRoleV2 = "PROSPECTING";
    adSets.push(
      emptyAdSetV2({
        id: newCanonicalEntityId("adset"),
        name: "Prospecting",
        role,
        geography: { ...geo },
        audience: {
          role,
          strategyKind,
          summaryIt:
            design.audienceStrategy.value ||
            intent.audienceIntent.value ||
            (strategyKind === "BROAD" || strategyKind === "ADVANTAGE_PLUS"
              ? "Pubblico ampio"
              : null),
          interestsUserSelected: [],
          retargetingSource: null,
          retargetingWindowDays: null,
          lookalikeSourceSummaryIt: null,
          lookalikePercentage: null,
          resolvedMetaAudienceId: null,
          resolvedMetaAudienceName: null,
        },
        placements: { ...placements },
        conversion: { ...conversionShared },
        provenance: {
          structure: intent.businessGoal.source === "CURRENT_BRIEF" ? "USER" : "ALLY",
          audience:
            intent.audienceIntent.source === "CURRENT_BRIEF" ? "USER" : "ALLY",
          geography: geo.labelIt ? "USER" : "MISSING",
        },
      }),
    );
  }

  state.adSets = adSets;
  state.architect = {
    briefSummaryIt: intent.userAskSummaryIt || null,
    reasoningSource: null,
    mappedAtIso: new Date().toISOString(),
  };
  state.updatedAtIso = new Date().toISOString();
  return state;
}
