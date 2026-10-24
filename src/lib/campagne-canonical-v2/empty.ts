/**
 * ADV.1.5 — Empty / factory helpers for CanonicalCampaignState V2.
 * LIVE META WRITES: 0
 */

import type {
  AudienceIntentV2,
  BudgetModelV2,
  CanonicalAdSetV2,
  CanonicalCampaignStateV2,
  ConversionContextV2,
  GeographyV2,
  PlacementsIntentV2,
  ScheduleModelV2,
} from "@/lib/campagne-canonical-v2/types";

export function newCanonicalEntityId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

export function emptyGeographyV2(): GeographyV2 {
  return {
    labelIt: null,
    countryCode: null,
    metaGeoKey: null,
    query: null,
  };
}

export function emptyAudienceIntentV2(): AudienceIntentV2 {
  return {
    role: "UNKNOWN",
    strategyKind: "UNRESOLVED",
    summaryIt: null,
    interestsUserSelected: [],
    retargetingSource: null,
    retargetingWindowDays: null,
    lookalikeSourceSummaryIt: null,
    lookalikePercentage: null,
    resolvedMetaAudienceId: null,
    resolvedMetaAudienceName: null,
  };
}

export function emptyConversionContextV2(): ConversionContextV2 {
  return {
    location: "UNKNOWN",
    optimizationEvent: "UNKNOWN",
    websiteUrl: null,
    pageId: null,
    pageName: null,
    formId: null,
    formName: null,
    messagingChannel: null,
    appStoreId: null,
    appDisplayName: null,
    trackingAssetId: null,
    trackingAssetName: null,
    trackingAssetKind: null,
  };
}

export function emptyPlacementsV2(): PlacementsIntentV2 {
  return { mode: "UNRESOLVED", manualSurfaces: [] };
}

export function emptyBudgetV2(): BudgetModelV2 {
  return {
    currencyCode: null,
    period: "UNRESOLVED",
    campaignAmountMajor: null,
    allocationStatus: "MISSING",
    adSetAmountsMajor: {},
  };
}

export function emptyScheduleV2(): ScheduleModelV2 {
  return {
    kind: "UNRESOLVED",
    startDateIso: null,
    endDateIso: null,
    durationDays: null,
  };
}

export function emptyAdSetV2(
  partial?: Partial<CanonicalAdSetV2>,
): CanonicalAdSetV2 {
  return {
    id: partial?.id ?? newCanonicalEntityId("adset"),
    metaAdSetId: null,
    name: null,
    role: "UNKNOWN",
    geography: emptyGeographyV2(),
    age: { min: null, max: null },
    gender: "UNRESOLVED",
    audience: emptyAudienceIntentV2(),
    placements: emptyPlacementsV2(),
    conversion: emptyConversionContextV2(),
    budgetAmountMajor: null,
    budgetPeriod: "UNRESOLVED",
    scheduleOverride: null,
    creativeIds: [],
    notesIt: null,
    provenance: {
      structure: "UNKNOWN",
      audience: "UNKNOWN",
      geography: "UNKNOWN",
    },
    ...partial,
  };
}

export function emptyCanonicalCampaignStateV2(input: {
  campaignId: string;
  clientId?: string | null;
  name?: string | null;
}): CanonicalCampaignStateV2 {
  return {
    schemaVersion: 2,
    campaignId: input.campaignId,
    clientId: input.clientId ?? null,
    metaCampaignId: null,
    name: input.name ?? null,
    objective: "UNKNOWN",
    specialAdCategories: ["UNRESOLVED"],
    budget: emptyBudgetV2(),
    schedule: emptyScheduleV2(),
    conversion: emptyConversionContextV2(),
    adSets: [],
    creatives: [],
    lifecycle: "DRAFT",
    architect: null,
    legacyV1Compat: null,
    updatedAtIso: new Date().toISOString(),
  };
}
