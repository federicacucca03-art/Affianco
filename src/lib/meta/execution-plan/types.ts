/**
 * ADV.2.1 — Ally MetaExecutionPlan (dry-run / architecture).
 * Canonical V2 → executable interpretation. NO Graph mutations.
 * LIVE META WRITES: 0
 */

export type ExecutionCapabilityStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "NOT_SUPPORTED"
  | "UNRESOLVED";

export type ExecutionIssueSeverity = "BLOCKER" | "WARNING";

export type ExecutionRequirementCode =
  | "PIXEL_REQUIRED"
  | "APP_ID_REQUIRED"
  | "FORM_REQUIRED"
  | "PAGE_REQUIRED"
  | "CUSTOM_AUDIENCE_UNRESOLVED"
  | "LOOKALIKE_UNRESOLVED"
  | "BUDGET_SPLIT_UNRESOLVED"
  | "DESTINATION_URL_REQUIRED"
  | "CREATIVE_REQUIRED"
  | "CTA_UNSUPPORTED"
  | "PLACEMENT_UNSUPPORTED"
  | "PLACEMENT_MANUAL_NOT_WRITABLE"
  | "OBJECTIVE_NOT_EXECUTABLE"
  | "DESTINATION_NOT_EXECUTABLE"
  | "OPTIMIZATION_UNSUPPORTED"
  | "IDENTITY_REQUIRED"
  | "TRACKING_UNRESOLVED"
  | "SCHEDULE_UNRESOLVED"
  | "MULTI_ADSET_PARTIAL"
  | "INVALID_CONFIGURATION";

export type ExecutionIssue = {
  code: ExecutionRequirementCode;
  severity: ExecutionIssueSeverity;
  entityKind: "campaign" | "adset" | "creative" | "ad" | "plan";
  entityId: string | null;
  messageIt: string;
  messagePro?: string;
};

export type MetaObjectiveCode =
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_APP_PROMOTION"
  | "OUTCOME_SALES"
  | "UNRESOLVED";

export type MetaDestinationCode =
  | "META_LEAD_FORM"
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE"
  | "APP"
  | "UNRESOLVED";

export type ComponentCapability = {
  id: string;
  labelIt: string;
  status: ExecutionCapabilityStatus;
  detailIt?: string;
};

/** Pure proposed Graph-shaped fields — never sent in ADV.2.1. */
export type ProposedCampaignPayload = {
  name: string | null;
  objective: MetaObjectiveCode | null;
  status: "PAUSED";
  special_ad_categories: string[];
  daily_budget_major: number | null;
  lifetime_budget_major: number | null;
};

export type ProposedAdSetPayload = {
  name: string | null;
  campaign_ref: string;
  optimization_goal: string | null;
  billing_event: string | null;
  destination_type: string | null;
  daily_budget_major: number | null;
  /** ADV.2.2 — only when Canonical schedule provides real values (never invented). */
  start_time_iso: string | null;
  end_time_iso: string | null;
  targeting_summary: {
    geoLabel: string | null;
    ageMin: number | null;
    ageMax: number | null;
    audienceMode: "ADVANTAGE_PLUS" | "BROAD" | "MANUAL" | "CUSTOM_AUDIENCE" | "LOOKALIKE" | "UNRESOLVED";
    customAudienceId: string | null;
    placementsMode: "ADVANTAGE_PLUS" | "MANUAL" | "UNRESOLVED";
    manualSurfaces: string[];
  };
  promoted_object_keys: string[];
};

export type ProposedCreativePayload = {
  name: string | null;
  object_story_fields: {
    page_id: string | null;
    message: string | null;
    link: string | null;
    call_to_action_type: string | null;
  };
  assetRef: string | null;
};

export type ProposedAdPayload = {
  name: string | null;
  adset_ref: string;
  creative_ref: string;
  status: "PAUSED";
  cta_type: string | null;
  cta_label_it: string | null;
};

export type ExecutionPlanCampaignNode = {
  allyCampaignId: string;
  metaCampaignId: string | null;
  payload: ProposedCampaignPayload;
  capability: ExecutionCapabilityStatus;
};

export type ExecutionPlanAdSetNode = {
  allyAdSetId: string;
  metaAdSetId: string | null;
  role: string;
  payload: ProposedAdSetPayload;
  capability: ExecutionCapabilityStatus;
  issues: ExecutionIssue[];
};

export type ExecutionPlanCreativeNode = {
  allyCreativeId: string;
  assignedAdSetIds: string[];
  payload: ProposedCreativePayload;
  capability: ExecutionCapabilityStatus;
  issues: ExecutionIssue[];
};

export type ExecutionPlanAdNode = {
  allyAdId: string;
  allyAdSetId: string;
  allyCreativeId: string;
  payload: ProposedAdPayload;
  capability: ExecutionCapabilityStatus;
  issues: ExecutionIssue[];
};

export type ExecutionDependencyEdge = {
  from: string;
  to: string;
  kind: "REQUIRES";
};

export type ExecutionPreviewSummary = {
  campaignCount: number;
  adSetCount: number;
  creativeCount: number;
  adCount: number;
  linesIt: string[];
};

/**
 * Ally-owned executable interpretation of CanonicalCampaignStateV2.
 * Pure. No network. No mutation of V2.
 */
export type MetaExecutionPlan = {
  schemaVersion: 1;
  sourceCampaignId: string;
  metaObjective: MetaObjectiveCode;
  destination: MetaDestinationCode;
  optimizationGoal: string | null;
  conversionEvent: string | null;
  campaign: ExecutionPlanCampaignNode;
  adSets: ExecutionPlanAdSetNode[];
  creatives: ExecutionPlanCreativeNode[];
  ads: ExecutionPlanAdNode[];
  dependencies: ExecutionDependencyEdge[];
  issues: ExecutionIssue[];
  components: ComponentCapability[];
  executionCapability: ExecutionCapabilityStatus;
  executionReady: boolean;
  preview: ExecutionPreviewSummary;
  /** Stable operation keys for future idempotent launch (not executed). */
  operationKeys: {
    campaign: string;
    adSets: Record<string, string>;
    creatives: Record<string, string>;
    ads: Record<string, string>;
  };
  generatedAtIso: string;
};
