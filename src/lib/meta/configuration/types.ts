/**
 * M10D — Read-only Meta configuration intelligence types.
 * Meta is canonical for published/imported objects. No planning provenance labels.
 */

export type MetaConfigSource = "META";

export type MetaConfigAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "PARTIAL";

export type ConfigObservationSeverity = "INFO" | "CHECK" | "ISSUE";

export type ConfigObservationScope = "CAMPAIGN" | "AD_SET" | "AD";

export type PlannedVsActualState =
  | "MATCH"
  | "DIFFERENT"
  | "UNAVAILABLE"
  | "NOT_COMPARABLE";

export type MetaConfigField<T> = {
  raw: unknown;
  value: T | null;
  availability: MetaConfigAvailability;
  source: MetaConfigSource;
};

export type MetaBudgetKind = "DAILY" | "LIFETIME" | "NONE" | "UNKNOWN";

export type MetaBudgetLevel = "CAMPAIGN" | "AD_SET" | "UNKNOWN";

export type MetaPlacementMode =
  | "AUTOMATIC"
  | "MANUAL"
  | "UNKNOWN"
  | "UNAVAILABLE";

export type MetaAudienceSummary = {
  geographyLabel: string | null;
  ageMin: number | null;
  ageMax: number | null;
  gendersLabel: string | null;
  customAudienceCount: number | null;
  excludedCustomAudienceCount: number | null;
  hasDetailedTargeting: boolean | null;
  detailAvailable: boolean;
};

export type MetaPlacementSummary = {
  mode: MetaPlacementMode;
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
  messengerPositions: string[];
  audienceNetworkPositions: string[];
  devicePlatforms: string[];
};

/** Sanitized targeting stored in targeting_summary jsonb. */
export type MetaTargetingSummaryStored = {
  audience: MetaAudienceSummary;
  placements: MetaPlacementSummary;
  /** True when Graph returned a targeting object (even if empty). */
  targetingReturned: boolean;
};

export type MetaCampaignConfiguration = {
  objective: MetaConfigField<string>;
  status: MetaConfigField<string>;
  effectiveStatus: MetaConfigField<string>;
  buyingType: MetaConfigField<string>;
  specialAdCategories: MetaConfigField<string[]>;
  dailyBudgetMinor: MetaConfigField<number>;
  lifetimeBudgetMinor: MetaConfigField<number>;
  /**
   * Meta `is_adset_budget_sharing_enabled` (Ad Set Budget Sharing).
   * Not the same as Advantage Campaign Budget / CBO — that is budgetLevel +
   * campaign daily/lifetime budget.
   */
  adsetBudgetSharingEnabled: MetaConfigField<boolean>;
  budgetLevel: MetaBudgetLevel;
};

export type MetaAdSetConfiguration = {
  name: string;
  status: MetaConfigField<string>;
  effectiveStatus: MetaConfigField<string>;
  dailyBudgetMinor: MetaConfigField<number>;
  lifetimeBudgetMinor: MetaConfigField<number>;
  budgetKind: MetaBudgetKind;
  startAt: MetaConfigField<string>;
  endAt: MetaConfigField<string>;
  optimizationGoal: MetaConfigField<string>;
  billingEvent: MetaConfigField<string>;
  bidStrategy: MetaConfigField<string>;
  bidAmountMinor: MetaConfigField<number>;
  destinationType: MetaConfigField<string>;
  attributionSpec: MetaConfigField<unknown>;
  promotedObject: MetaConfigField<Record<string, unknown>>;
  audience: MetaConfigField<MetaAudienceSummary>;
  placements: MetaConfigField<MetaPlacementSummary>;
};

export type MetaAdConfiguration = {
  name: string;
  status: MetaConfigField<string>;
  effectiveStatus: MetaConfigField<string>;
  creativeId: MetaConfigField<string>;
  creativeName: MetaConfigField<string>;
  creativeTitle: MetaConfigField<string>;
  creativeCta: MetaConfigField<string>;
  creativeLinkUrl: MetaConfigField<string>;
};

export type ConfigurationObservation = {
  severity: ConfigObservationSeverity;
  scope: ConfigObservationScope;
  code: string;
  title: string;
  explanation: string;
  evidence: string[];
};

export type PlannedVsActualField = {
  field: string;
  label: string;
  state: PlannedVsActualState;
  plannedLabel: string | null;
  actualLabel: string | null;
  note: string | null;
};

export type MetaConfigurationBundle = {
  campaign: MetaCampaignConfiguration;
  adSets: Array<{
    metaAdSetId: string;
    config: MetaAdSetConfiguration;
  }>;
  ads: Array<{
    metaAdId: string;
    metaAdSetId: string;
    config: MetaAdConfiguration;
  }>;
  observations: ConfigurationObservation[];
  plannedVsActual: PlannedVsActualField[] | null;
};

/** Compact beginner-facing lines (no Ads Manager dump). */
export type ConfigSummaryLine = {
  key: string;
  label: string;
  value: string;
};

export type ConfigPresentation = {
  beginner: ConfigSummaryLine[];
  professional: ConfigSummaryLine[];
  observations: ConfigurationObservation[];
  plannedVsActual: PlannedVsActualField[] | null;
};
