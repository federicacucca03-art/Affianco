/**
 * ADV.1.5 — Canonical Campaign State V2 (Ally domain model).
 * UNDERSTANDING / STATE ≠ META EXECUTION. LIVE META WRITES: 0
 *
 * Durable DB persistence requires a dedicated column/table (see proposed migration).
 * This module is the in-memory / serializable contract only.
 */

/** Decision provenance — user-facing labels stay outside this enum. */
export type DecisionProvenance =
  | "USER"
  | "ALLY"
  | "MISSING"
  | "IMPORTED"
  | "UNKNOWN";

export type Provenanced<T> = {
  value: T;
  provenance: DecisionProvenance;
};

export type MetaObjectiveFamilyV2 =
  | "AWARENESS"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "LEADS"
  | "APP_PROMOTION"
  | "SALES"
  | "UNKNOWN";

export type ConversionLocationV2 =
  | "WEBSITE"
  | "INSTANT_FORM"
  | "MESSAGING"
  | "WHATSAPP"
  | "PHONE"
  | "APP"
  | "STORE"
  | "UNKNOWN";

export type OptimizationEventIntentV2 =
  | "PURCHASE"
  | "LEAD"
  | "LANDING_PAGE_VIEW"
  | "LINK_CLICK"
  | "MESSAGE"
  | "APP_INSTALL"
  | "APP_EVENT"
  | "OTHER"
  | "UNKNOWN";

export type AudienceRoleV2 = "PROSPECTING" | "RETARGETING" | "LOOKALIKE" | "MIXED" | "UNKNOWN";

export type AudienceStrategyKindV2 =
  | "BROAD"
  | "ADVANTAGE_PLUS"
  | "MANUAL"
  | "CUSTOM_AUDIENCE_INTENT"
  | "LOOKALIKE_INTENT"
  | "UNRESOLVED";

export type RetargetingSourceIntentV2 =
  | "WEBSITE_VISITORS"
  | "SOCIAL_ENGAGERS"
  | "VIDEO_VIEWERS"
  | "CART_ABANDONERS"
  | "LEADS"
  | "OTHER"
  | "UNKNOWN";

/** Intent ≠ resolved Meta entity. Never invent Meta IDs. */
export type AudienceIntentV2 = {
  role: AudienceRoleV2;
  strategyKind: AudienceStrategyKindV2;
  summaryIt: string | null;
  interestsUserSelected: string[];
  retargetingSource: RetargetingSourceIntentV2 | null;
  retargetingWindowDays: number | null;
  lookalikeSourceSummaryIt: string | null;
  lookalikePercentage: number | null;
  /** Optional resolved Meta Custom Audience / LAL — only when discovered. */
  resolvedMetaAudienceId: string | null;
  resolvedMetaAudienceName: string | null;
};

export type GeographyV2 = {
  labelIt: string | null;
  countryCode: string | null;
  metaGeoKey: string | null;
  query: string | null;
};

export type AgeRangeV2 = {
  min: number | null;
  max: number | null;
};

export type GenderIntentV2 = "ALL" | "MALE" | "FEMALE" | "UNRESOLVED";

export type PlacementsIntentV2 = {
  mode: "ADVANTAGE_PLUS" | "MANUAL" | "UNRESOLVED";
  manualSurfaces: string[];
};

export type BudgetPeriodV2 = "DAILY" | "LIFETIME" | "TOTAL" | "UNRESOLVED";

export type BudgetAllocationStatusV2 =
  | "CAMPAIGN_ONLY"
  | "ADSET_EXPLICIT"
  | "UNRESOLVED_SPLIT"
  | "MISSING";

export type BudgetModelV2 = {
  currencyCode: string | null;
  period: BudgetPeriodV2;
  /** Campaign-level amount in major units when known. */
  campaignAmountMajor: number | null;
  allocationStatus: BudgetAllocationStatusV2;
  /** Explicit per-Ad-Set amounts only when user supplied — never invented. */
  adSetAmountsMajor: Record<string, number | null>;
};

export type ScheduleModelV2 = {
  kind: "ALWAYS_ON" | "FIXED_WINDOW" | "DURATION_ONLY" | "UNRESOLVED";
  startDateIso: string | null;
  endDateIso: string | null;
  durationDays: number | null;
};

export type ConversionContextV2 = {
  location: ConversionLocationV2;
  optimizationEvent: OptimizationEventIntentV2;
  websiteUrl: string | null;
  /** Instant Form — only when user/config selected. */
  pageId: string | null;
  pageName: string | null;
  formId: string | null;
  formName: string | null;
  messagingChannel: "WHATSAPP" | "MESSENGER" | "OTHER" | null;
  appStoreId: string | null;
  appDisplayName: string | null;
  /**
   * ADV.2.2 — Real Pixel/Dataset selection (never invented).
   * Optional for backward-compatible V2 documents.
   */
  trackingAssetId?: string | null;
  trackingAssetName?: string | null;
  trackingAssetKind?: "PIXEL" | "DATASET" | null;
};

export type SpecialAdCategoryV2 =
  | "NONE"
  | "EMPLOYMENT"
  | "HOUSING"
  | "FINANCIAL_PRODUCTS_SERVICES"
  | "ISSUES_ELECTIONS_POLITICS"
  | "UNRESOLVED";

export type CampaignLifecycleV2 =
  | "DRAFT"
  | "IN_REVIEW"
  | "READY"
  | "PUBLISHED_EXTERNAL"
  | "ARCHIVED"
  | "UNKNOWN";

/**
 * One canonical Ad Set — Ally internal identity is primary.
 * metaAdSetId is optional future sync reference.
 */
export type CanonicalAdSetV2 = {
  id: string;
  metaAdSetId: string | null;
  name: string | null;
  role: AudienceRoleV2;
  geography: GeographyV2;
  age: AgeRangeV2;
  gender: GenderIntentV2;
  audience: AudienceIntentV2;
  placements: PlacementsIntentV2;
  conversion: ConversionContextV2;
  /** ABO amount when explicitly set on this Ad Set. */
  budgetAmountMajor: number | null;
  budgetPeriod: BudgetPeriodV2;
  scheduleOverride: ScheduleModelV2 | null;
  creativeIds: string[];
  notesIt: string | null;
  provenance: {
    structure: DecisionProvenance;
    audience: DecisionProvenance;
    geography: DecisionProvenance;
  };
};

export type CanonicalCreativeRefV2 = {
  id: string;
  /** Link to campaigns.creativita asset id when known. */
  assetId: string | null;
  storagePath: string | null;
  nomeFile: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  primaryTextProvenance: DecisionProvenance;
  headlineProvenance: DecisionProvenance;
  descriptionProvenance: DecisionProvenance;
  /** Assigned Ad Set ids — empty = campaign-level / all. */
  assignedAdSetIds: string[];
};

export type ArchitectProvenanceV2 = {
  briefSummaryIt: string | null;
  reasoningSource: string | null;
  mappedAtIso: string | null;
};

/**
 * Ally Canonical Campaign State V2 — single durable design document.
 * Capability / execution readiness is NOT stored as mutating this graph.
 */
export type CanonicalCampaignStateV2 = {
  schemaVersion: 2;
  campaignId: string;
  clientId: string | null;
  metaCampaignId: string | null;
  name: string | null;
  objective: MetaObjectiveFamilyV2;
  specialAdCategories: SpecialAdCategoryV2[];
  budget: BudgetModelV2;
  schedule: ScheduleModelV2;
  conversion: ConversionContextV2;
  adSets: CanonicalAdSetV2[];
  creatives: CanonicalCreativeRefV2[];
  lifecycle: CampaignLifecycleV2;
  architect: ArchitectProvenanceV2 | null;
  /**
   * Opaque bag for V1 fields not yet first-class in V2 UI,
   * so roundtrip does not silently drop Instant Form extras.
   */
  legacyV1Compat: Record<string, unknown> | null;
  updatedAtIso: string;
};

export type FacileComplexitySummaryV2 = {
  isSimpleLeadsInstantForm: boolean;
  adSetCount: number;
  hasRetargeting: boolean;
  hasLookalike: boolean;
  hasManualPlacements: boolean;
  hasUnresolvedBudgetSplit: boolean;
  linesIt: string[];
};

export type V2ToV1ProjectionResult = {
  /** Supported Easy/Instant Form subset — never invents advanced fields away. */
  draft: import("@/lib/meta/write/instant-form-builder").InstantFormBuilderDraft;
  /** True when V2 has structure the current Builder must not overwrite. */
  advancedStatePreserved: boolean;
  facileSummary: FacileComplexitySummaryV2;
  warningsIt: string[];
};
