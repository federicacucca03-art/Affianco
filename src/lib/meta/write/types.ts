/**
 * M11A.1 — Meta write foundation types (dry-run / preview only).
 * No Marketing API creates. CREATE ≠ ACTIVATE. Safe status = PAUSED.
 */

import type { AllyWebsiteTrackingConfig } from "@/lib/meta/write/tracking";
import type { AllyConversionPublishPlan } from "@/lib/meta/write/conversion-resolver";
import type { CanonicalPublishPreview } from "@/lib/meta/write/canonical-publish-preview";
import type {
  DestinationTrackingConfig,
  DestinationTrackingMode,
} from "@/lib/meta/write/destination-tracking";
import type { AdIdentityConfig } from "@/lib/meta/write/ad-identity";

export const META_WRITE_SAFE_STATUS = "PAUSED" as const;

export type MetaWriteOperationType =
  | "CAMPAIGN_ADSET_PAUSED"
  | "FULL_PUBLISH_PAUSED";

export type MetaWriteOperationState =
  | "PREVIEWED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "PARTIALLY_CREATED"
  | "COMPLETED"
  | "FAILED";

/** Deterministic readiness. READY_TO_WRITE only when all write gates pass. */
export type MetaWriteReadinessCode =
  | "READY_TO_PREVIEW"
  | "READY_TO_WRITE"
  | "MISSING_META_CONNECTION"
  | "MISSING_AD_ACCOUNT"
  | "MISSING_META_PERMISSION"
  | "MISSING_SPECIAL_AD_CATEGORY_DECISION"
  | "SPECIAL_AD_CATEGORY_REQUIRED"
  | "SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION"
  | "SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED"
  | "MALFORMED_DESTINATION_URL"
  | "MISSING_INSTAGRAM_SELECTION"
  | "IG_PAGE_MISMATCH"
  | "MISSING_OBJECTIVE"
  | "MISSING_BUDGET"
  | "MISSING_GEO"
  | "MISSING_GEO_RESOLUTION"
  | "MISSING_DESTINATION"
  | "MISSING_PAGE"
  | "MISSING_FORM"
  | "MISSING_FORM_TECHNICAL_URL"
  | "FORM_PAGE_MISMATCH"
  | "MISSING_TRACKING_CONFIG"
  | "MISSING_CREATIVE_ASSET"
  | "MISSING_SCHEDULE"
  | "MISSING_BID_STRATEGY"
  | "MISSING_AUDIENCE_MODE"
  | "UNSUPPORTED_OBJECTIVE"
  | "UNSUPPORTED_BILLING_EVENT"
  | "UNSUPPORTED_CONFIGURATION"
  | "IMPORTED_META_NOT_ELIGIBLE"
  | "ALREADY_LINKED_META"
  | "PARTIAL_HIERARCHY"
  | "WRITE_ALREADY_COMPLETED"
  | "STALE_PREVIEW"
  | "LIVE_WRITES_GATED";

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
  /**
   * Instant Form privacy_policy_url for META_LEAD_FORM Creative link_data.link.
   * Never clients.website / Facebook Page URL.
   */
  formPrivacyPolicyUrl?: string | null;
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
  /** Human-readable Meta geo label (e.g. Roma, Lazio, IT). */
  geoLabel: string | null;
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
  /** Meta campaign id already linked to this Ally campaign, if any. */
  existingMetaCampaignId: string | null;
  /**
   * True when meta_write_operations has PARTIALLY_CREATED with campaign id
   * and no ad set — resume is Ad Set only (Campaign POST = 0).
   */
  partialHierarchyPending: boolean;
  /**
   * True when meta_write_operations is COMPLETED with campaign + ad set ids.
   * Preview must not re-offer create.
   */
  writeHierarchyCompleted: boolean;
  /** Granted scopes from stored Meta connection. */
  grantedScopes: string[];
  hasMetaConnection: boolean;
  hasAdAccount: boolean;
  /** Meta act_… id when mapped — never invent. */
  metaAdAccountId?: string | null;
  adAccountCurrency: string | null;
  adAccountTimezone: string | null;
  buyingType: "AUCTION";
  /** Ally bid mode — default AUTOMATIC_NO_CAP when omitted. */
  allyBidMode?: "AUTOMATIC_NO_CAP" | "BID_CAP" | "COST_CAP" | "MIN_ROAS" | null;
  /** Required for BID_CAP / COST_CAP (Meta minor units). */
  bidAmountMinor?: number | null;
  /** Required for MIN_ROAS (deferred). */
  minRoas?: number | null;
  /**
   * Advantage+ Audience mode — independent of placements.
   * UNRESOLVED / omit → readiness blocker (Meta requires 0|1).
   */
  allyAudienceMode?: "ADVANTAGE_AUDIENCE" | "MANUAL_AUDIENCE" | "UNRESOLVED" | null;
  /**
   * P0.1 — Website Pixel/Dataset + conversion event selection.
   * Required for professional Website Leads / Website Sales.
   * Instant Form ignores this.
   */
  websiteTracking?: AllyWebsiteTrackingConfig | null;
  /**
   * P0.3 — Instant Form ↔ Page ownership.
   * VERIFIED = form came from discovery for this Page.
   * MISMATCH = form does not belong to selected Page.
   * UNCHECKED = relation not verified (legacy / offline).
   */
  instantFormRelation?: "VERIFIED" | "MISMATCH" | "UNCHECKED" | null;
  /** Display name from discovery (never invent). */
  instantFormName?: string | null;
  /** Page display name when known. */
  pageName?: string | null;
  /**
   * P0.5 — Website URL tracking mode.
   * Instant Form ignores (forced NONE). Default AUTO_UTM for WEBSITE when omitted.
   */
  destinationTrackingMode?: DestinationTrackingMode | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  /** P0.5 — Selected Instagram user id (object_story_spec.instagram_user_id). */
  instagramUserId?: string | null;
  /** Explicit Page-only (no IG) when multiple IG identities exist. */
  preferPageOnly?: boolean | null;
  /**
   * Discovered IG accounts for the selected Page (tests / hydrate).
   * Null = discovery not run (UNCHECKED).
   */
  instagramDiscovery?: {
    accounts: Array<{
      id: string;
      username: string | null;
      maskedId: string;
      available: boolean;
      pageId: string;
    }>;
    emptyReason: "NONE" | "NO_ACCOUNTS" | "PERMISSION" | "PAGE_INVALID" | "UNCHECKED";
  } | null;
};

/** Persisted write fields — shared by preview, confirm, and UI hydrate. */
export type MetaWriteCanonicalPlan = {
  specialAdCategories: MetaWriteSpecialAdCategoriesDecision;
  destination: MetaWriteDestinationKind;
  countryCode: string | null;
  metaGeoKey: string | null;
  geoLabel: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  pageId: string | null;
  formId: string | null;
  /** Instant Form privacy_policy_url for Creative technical link. */
  formPrivacyPolicyUrl?: string | null;
  /** Explicit Advantage+ Audience decision — part of fingerprint. */
  allyAudienceMode?: "ADVANTAGE_AUDIENCE" | "MANUAL_AUDIENCE" | "UNRESOLVED" | null;
  /** P0.1 — nullable for legacy plans; Instant Form may omit. */
  websiteTracking?: AllyWebsiteTrackingConfig | null;
  /** P0.5 — URL tracking mode for website destinations. */
  destinationTrackingMode?: DestinationTrackingMode | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  /** P0.5 — Instagram identity selection. */
  instagramUserId?: string | null;
  preferPageOnly?: boolean | null;
};

export type MetaWriteFormState = {
  /**
   * Easy Mode picker value: UNRESOLVED | NONE | Graph category code.
   * Legacy "CATEGORIES" may appear briefly during hydrate of multi-category plans.
   */
  specialKind: "NONE" | "UNRESOLVED" | "CATEGORIES" | string;
  /** Graph category codes when kind is CATEGORIES / a specific category. */
  specialCategories?: string[];
  destination: "" | MetaWriteDestinationKind;
  /**
   * Website destination URL when destination === WEBSITE (from clients.website).
   * Empty for META_LEAD_FORM — Instant Form must not inherit the client website.
   */
  destinationUrl: string;
  countryCode: string;
  metaGeoKey: string | null;
  geoLabel: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  pageId: string;
  formId: string;
  /** Instant Form privacy_policy_url retained from discovery. */
  formPrivacyPolicyUrl?: string;
  timezoneName: string | null;
  accountLabel: string | null;
  adAccountId: string | null;
  /** Ally client UUID — discovery APIs. */
  clientId?: string | null;
  /** P0.1 website tracking selection for hydrate/UI. */
  websiteTracking?: AllyWebsiteTrackingConfig | null;
  /** P0.5 */
  destinationTrackingMode?: DestinationTrackingMode | null;
  instagramUserId?: string | null;
  preferPageOnly?: boolean | null;
};

export type MetaWriteCampaignPayloadPreview = {
  name: string;
  objective: string | null;
  status: typeof META_WRITE_SAFE_STATUS;
  special_ad_categories: string[] | null;
  /** Present when Meta requires country for housing/employment/financial SAC. */
  special_ad_category_country?: string[] | null;
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
  bid_strategy: string | null;
  bid_amount: number | null;
  status: typeof META_WRITE_SAFE_STATUS;
  placementsNote: string | null;
  fieldStatus: Record<string, MetaWriteFieldStatus>;
};

export type MetaWritePreviewResult = {
  operationType: MetaWriteOperationType;
  readinessCodes: MetaWriteReadinessCode[];
  canPreview: boolean;
  /** True only when READY_TO_WRITE (all gates incl. ads_management). */
  canWrite: boolean;
  /**
   * PARTIALLY_CREATED recovery: Ad Set only. Campaign POST must stay 0.
   * Null for first-create flow.
   */
  resumeMode: "RESUME_ADSET" | null;
  /** True when hierarchy already written (COMPLETED) — create CTA must hide. */
  writeAlreadyCompleted: boolean;
  adsManagementPresent: boolean;
  fingerprint: string;
  idempotencyKey: string;
  campaign: MetaWriteCampaignPayloadPreview | null;
  adSet: MetaWriteAdSetPayloadPreview | null;
  /**
   * M11A Campaign+AdSet slice: enabled false (DEFERRED / missing asset).
   * M14 FULL_PUBLISH_PAUSED plan adapter: enabled true (FULL_PUBLISH_INCLUDED).
   */
  creative:
    | { enabled: false; reason: "MISSING_CREATIVE_ASSET" | "DEFERRED_SLICE" }
    | { enabled: true; reason: "FULL_PUBLISH_INCLUDED" };
  ad:
    | { enabled: false; reason: "DEFERRED_SLICE" }
    | { enabled: true; reason: "FULL_PUBLISH_INCLUDED" };
  blockersIt: string[];
  summaryIt: {
    campaignLines: string[];
    adSetLines: string[];
    missingLines: string[];
    footnote: string;
  };
  safePayloadSummary: Record<string, unknown>;
  /**
   * P0.1 — Canonical conversion publish plan (same resolver as Graph payload).
   * Null only for imported-Meta-ineligible paths.
   */
  conversionPublishPlan?: AllyConversionPublishPlan | null;
  /**
   * P0.2 — User-facing + Pro pre-publish preview (same validation as canWrite).
   */
  canonicalPublishPreview?: CanonicalPublishPreview | null;
  /** Alias of canWrite for Launch Guardian / 5-Minute Builder. */
  publishAllowed?: boolean;
  /** P0.3 — Instant Form Easy Mode readiness (null when not Instant Form). */
  instantFormEasyReadiness?: import("@/lib/meta/write/instant-form-readiness").InstantFormEasyReadiness | null;
  /** P0.5 — Resolved destination URL / UTM config. */
  destinationTracking?: DestinationTrackingConfig | null;
  /** P0.5 — Resolved Page + Instagram identity. */
  adIdentity?: AdIdentityConfig | null;
  /** Optional Meta validate_only outcome — never raw Graph. */
  metaValidation?: {
    status: "PASS" | "FAIL" | "SKIPPED";
    safeMessage?: string;
  } | null;
};
