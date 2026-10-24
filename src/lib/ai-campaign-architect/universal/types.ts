/**
 * P0.15 — Universal AI Campaign Architect models.
 * UNDERSTANDING ≠ EXECUTION. LIVE META WRITES: 0
 */

export type IntentConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type IntentSource =
  | "CURRENT_BRIEF"
  | "BRAND_BRAIN_CONFIRMED"
  | "BRAND_BRAIN_UNCONFIRMED"
  | "CLIENT_DATA"
  | "ALLY_RULE"
  | "AI_INFERENCE"
  | "DETERMINISTIC_FALLBACK";

export type IntentSlot<T> = {
  value: T;
  reason: string;
  confidence: IntentConfidence;
  source: IntentSource;
  requiresUserConfirmation: boolean;
};

export type BusinessGoalIntent =
  | "LEADS"
  | "SALES"
  | "TRAFFIC"
  | "AWARENESS"
  | "ENGAGEMENT"
  | "APP_PROMOTION"
  | "VIDEO_VIEWS"
  | "UNKNOWN";

export type ConversionLocationIntent =
  | "INSTANT_FORM"
  | "WEBSITE"
  | "MESSAGING"
  | "APP"
  | "STORE"
  | "UNKNOWN";

export type UnderstandingStatus =
  | "CLEAR"
  | "NEEDS_CLARIFICATION"
  | "DEGRADED_FALLBACK"
  | "FAILED";

export type ReasoningSource = "ANTHROPIC" | "DETERMINISTIC_FALLBACK" | "MIXED";

export type CampaignIntent = {
  understandingStatus: UnderstandingStatus;
  userAskSummaryIt: string;
  businessGoal: IntentSlot<BusinessGoalIntent>;
  funnelStage: IntentSlot<string | null>;
  desiredAction: IntentSlot<string | null>;
  conversionLocation: IntentSlot<ConversionLocationIntent>;
  /** Ally suggestion only — never treat as confirmed user/config selection. */
  recommendedConversionLocation: IntentSlot<ConversionLocationIntent | null>;
  productOrService: IntentSlot<string | null>;
  offer: IntentSlot<string | null>;
  budgetDaily: IntentSlot<number | null>;
  budgetMonthly: IntentSlot<number | null>;
  budgetPeriod: IntentSlot<"DAILY" | "MONTHLY" | "TOTAL" | "RANGE" | "UNKNOWN">;
  budgetRange: IntentSlot<{ min: number | null; max: number | null } | null>;
  geography: IntentSlot<string | null>;
  audienceIntent: IntentSlot<string | null>;
  prospectingIntent: IntentSlot<boolean | null>;
  retargetingIntent: IntentSlot<boolean | null>;
  existingCustomerIntent: IntentSlot<boolean | null>;
  customAudienceIntent: IntentSlot<boolean | null>;
  lookalikeIntent: IntentSlot<boolean | null>;
  catalogIntent: IntentSlot<boolean | null>;
  leadCaptureIntent: IntentSlot<boolean | null>;
  messagingIntent: IntentSlot<boolean | null>;
  websiteIntent: IntentSlot<boolean | null>;
  appIntent: IntentSlot<boolean | null>;
  creativeNeeds: IntentSlot<string | null>;
  trackingNeeds: IntentSlot<string[]>;
  specialCategoryRisk: IntentSlot<
    | "NONE"
    | "EMPLOYMENT"
    | "HOUSING"
    | "FINANCIAL_PRODUCTS_SERVICES"
    | "ISSUES_ELECTIONS_POLITICS"
    | "UNKNOWN"
  >;
  constraints: IntentSlot<string[]>;
  ambiguities: string[];
  missingInformation: string[];
  suggestedFollowUpQuestions: string[];
};

export type CampaignDesign = {
  metaObjective: IntentSlot<BusinessGoalIntent>;
  conversionLocation: IntentSlot<ConversionLocationIntent>;
  performanceGoal: IntentSlot<string | null>;
  optimizationGoal: IntentSlot<string | null>;
  campaignStructure: IntentSlot<string | null>;
  budgetStrategy: IntentSlot<string | null>;
  dailyBudget: IntentSlot<number | null>;
  lifetimeBudget: IntentSlot<number | null>;
  schedule: IntentSlot<string | null>;
  audienceStrategy: IntentSlot<string | null>;
  prospectingVsRetargeting: IntentSlot<string | null>;
  geoStrategy: IntentSlot<string | null>;
  ageStrategy: IntentSlot<string | null>;
  advantageAudienceRecommendation: IntentSlot<boolean | null>;
  placementsStrategy: IntentSlot<string | null>;
  identityRequirements: IntentSlot<string[]>;
  trackingRequirements: IntentSlot<string[]>;
  eventRequirement: IntentSlot<string | null>;
  catalogRequirement: IntentSlot<boolean | null>;
  formRequirement: IntentSlot<boolean | null>;
  creativeStrategy: IntentSlot<string | null>;
  creativeFormats: IntentSlot<string[]>;
  primaryMessage: IntentSlot<string | null>;
  headlineDirection: IntentSlot<string | null>;
  ctaRecommendation: IntentSlot<string | null>;
  destinationRequirement: IntentSlot<string | null>;
  specialAdCategoryAssessment: IntentSlot<{
    risk:
      | "NONE"
      | "EMPLOYMENT"
      | "HOUSING"
      | "FINANCIAL_PRODUCTS_SERVICES"
      | "ISSUES_ELECTIONS_POLITICS"
      | "UNKNOWN";
    note: string;
  } | null>;
  technicalDefaults: IntentSlot<{
    initialStatus: "PAUSED";
    placements: string;
    bidStrategy: string;
  } | null>;
};

export type AllyCapabilityLevel =
  | "EASY_READY"
  | "FULL_READY"
  | "PARTIAL_SUPPORT"
  | "NOT_YET_SUPPORTED";

/**
 * ADV.1 — per-component execution honesty.
 * UNDERSTOOD = design preserved; execution status is separate.
 */
export type CapabilityComponentStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "NOT_SUPPORTED"
  | "UNDERSTOOD";

export type CapabilityComponent = {
  id: string;
  labelIt: string;
  /** Understanding always preserved when UNDERSTOOD / NOT_SUPPORTED. */
  status: CapabilityComponentStatus;
  detailIt?: string;
};

export type AllyCapabilityAssessment = {
  level: AllyCapabilityLevel;
  supportedFields: string[];
  unsupportedFields: string[];
  requiresManualConfiguration: string[];
  blockingCapabilities: string[];
  recommendedRoute: "EASY" | "FULL" | "MANUAL_MIX" | "NONE";
  summaryIt: string;
  /** ADV.1 — granular component assessment (never flattens intent). */
  components: CapabilityComponent[];
};

export type UniversalArchitectResult = {
  ok: boolean;
  reasoningSource: ReasoningSource;
  aiCalls: number;
  errorCode?:
    | "CONFIG"
    | "ANTHROPIC"
    | "TIMEOUT"
    | "PARSE"
    | "SCHEMA"
    | "EMPTY"
    | "UNAUTHORIZED";
  errorMessageIt?: string;
  intent: CampaignIntent;
  design: CampaignDesign;
  capability: AllyCapabilityAssessment;
  /** Validated fields safe to apply into Easy Builder (never invents Meta IDs). */
  easyApplySafe: boolean;
};

export function emptySlot<T>(
  value: T,
  opts?: Partial<Omit<IntentSlot<T>, "value">>,
): IntentSlot<T> {
  return {
    value,
    reason: opts?.reason ?? "",
    confidence: opts?.confidence ?? "UNKNOWN",
    source: opts?.source ?? "AI_INFERENCE",
    requiresUserConfirmation: opts?.requiresUserConfirmation ?? true,
  };
}
