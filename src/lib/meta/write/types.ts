/**
 * M11A.1 — Meta write foundation types (dry-run / preview only).
 * No Marketing API creates. CREATE ≠ ACTIVATE. Safe status = PAUSED.
 */

export const META_WRITE_SAFE_STATUS = "PAUSED" as const;

export type MetaWriteOperationType = "CAMPAIGN_ADSET_PAUSED";

export type MetaWriteOperationState =
  | "PREVIEWED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "PARTIALLY_CREATED"
  | "COMPLETED"
  | "FAILED";

/** Deterministic readiness — never READY_TO_WRITE in M11A.1. */
export type MetaWriteReadinessCode =
  | "READY_TO_PREVIEW"
  | "MISSING_META_CONNECTION"
  | "MISSING_AD_ACCOUNT"
  | "MISSING_META_PERMISSION"
  | "MISSING_SPECIAL_AD_CATEGORY_DECISION"
  | "MISSING_OBJECTIVE"
  | "MISSING_BUDGET"
  | "MISSING_GEO"
  | "MISSING_GEO_RESOLUTION"
  | "MISSING_DESTINATION"
  | "MISSING_PAGE"
  | "MISSING_FORM"
  | "MISSING_TRACKING_CONFIG"
  | "MISSING_CREATIVE_ASSET"
  | "MISSING_SCHEDULE"
  | "UNSUPPORTED_OBJECTIVE"
  | "UNSUPPORTED_BILLING_EVENT"
  | "IMPORTED_META_NOT_ELIGIBLE"
  | "STALE_PREVIEW";

export type MetaWriteErrorCategory =
  | "PERMISSION"
  | "TOKEN"
  | "INVALID_PARAM"
  | "MISSING_ASSET"
  | "ACCOUNT_RESTRICTED"
  | "RATE_LIMIT"
  | "POLICY"
  | "NETWORK"
  | "STALE_PREVIEW"
  | "DUPLICATE_OPERATION"
  | "PARTIAL_HIERARCHY";

export type MetaWriteFieldStatus = "AVAILABLE" | "DERIVABLE" | "MISSING" | "UNRESOLVED";

export type MetaWriteSpecialAdCategoriesDecision =
  | { kind: "NONE" }
  | { kind: "CATEGORIES"; categories: string[] }
  | { kind: "UNRESOLVED" };

export type MetaWriteDestinationKind =
  | "META_LEAD_FORM"
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE"
  | "UNKNOWN"
  | "UNRESOLVED";

export type MetaWriteBudgetLevel = "CAMPAIGN" | "AD_SET";

export type MetaWritePlanInput = {
  /** Ally-native campaign UUID. */
  allyCampaignId: string;
  clientId: string;
  campaignName: string;
  /** Ally business objective code (LEADS, …) or Meta OUTCOME_*. */
  objectiveRaw: string | null;
  destination: MetaWriteDestinationKind;
  destinationUrl: string | null;
  pageId: string | null;
  formId: string | null;
  whatsappNumber: string | null;
  budgetDailyMajor: number | null;
  budgetLevel: MetaWriteBudgetLevel;
  /** Explicit special ad category decision — never silent []. */
  specialAdCategories: MetaWriteSpecialAdCategoriesDecision;
  citta: string | null;
  raggioKm: number | null;
  /** ISO country when known (e.g. IT). Not invented from city text. */
  countryCode: string | null;
  /** Meta geo key when already resolved; never invent from city string. */
  metaGeoKey: string | null;
  etaMin: number | null;
  etaMax: number | null;
  /** Explicit Advantage+/automatic placement choice. */
  placementsAdvantage: boolean | null;
  startAtIso: string | null;
  endAtIso: string | null;
  creativitaCount: number;
  /** B2B/B2C business label — never becomes Meta interest targeting. */
  targetType: string | null;
  /** True when campaign is pure imported Meta (no Ally-native create). */
  isImportedMetaOnly: boolean;
  /** Granted scopes from stored Meta connection. */
  grantedScopes: string[];
  hasMetaConnection: boolean;
  hasAdAccount: boolean;
  adAccountCurrency: string | null;
  adAccountTimezone: string | null;
  buyingType: "AUCTION";
};

export type MetaWriteCampaignPayloadPreview = {
  name: string;
  objective: string | null;
  status: typeof META_WRITE_SAFE_STATUS;
  special_ad_categories: string[] | null;
  buying_type: "AUCTION";
  daily_budget: number | null;
  lifetime_budget: null;
  is_adset_budget_sharing_enabled: boolean | null;
  fieldStatus: Record<string, MetaWriteFieldStatus>;
};

export type MetaWriteAdSetPayloadPreview = {
  name: string;
  campaign_id: "{pending_campaign_id}";
  optimization_goal: string | null;
  billing_event: string | null;
  daily_budget: number | null;
  lifetime_budget: null;
  start_time: string | null;
  end_time: string | null;
  targeting: Record<string, unknown> | null;
  destination_type: string | null;
  promoted_object: Record<string, unknown> | null;
  status: typeof META_WRITE_SAFE_STATUS;
  placementsNote: string | null;
  fieldStatus: Record<string, MetaWriteFieldStatus>;
};

export type MetaWritePreviewResult = {
  operationType: MetaWriteOperationType;
  readinessCodes: MetaWriteReadinessCode[];
  canPreview: boolean;
  /** M11A.1: always false — no write enabled. */
  canWrite: false;
  adsManagementPresent: boolean;
  fingerprint: string;
  idempotencyKey: string;
  campaign: MetaWriteCampaignPayloadPreview | null;
  adSet: MetaWriteAdSetPayloadPreview | null;
  creative: { enabled: false; reason: "MISSING_CREATIVE_ASSET" | "DEFERRED_SLICE" };
  ad: { enabled: false; reason: "DEFERRED_SLICE" };
  blockersIt: string[];
  summaryIt: {
    campaignLines: string[];
    adSetLines: string[];
    missingLines: string[];
    footnote: string;
  };
  safePayloadSummary: Record<string, unknown>;
};
