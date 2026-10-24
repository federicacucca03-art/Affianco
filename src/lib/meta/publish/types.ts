/**
 * M14 — Full Ally → Meta publish plan types.
 * Planning + validation only. Live Graph mutations stay gated.
 */

import type { MetaWritePreviewResult } from "@/lib/meta/write/types";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";

export { META_WRITE_SAFE_STATUS };

export type MetaPublishProductStatus =
  | "non_pronta"
  | "pronta"
  | "in_preparazione"
  | "incompleta"
  | "pubblicata"
  | "problema";

export type MetaPublishIssueSeverity = "BLOCKING" | "WARNING";

export type MetaPublishIssueCode =
  | "NOT_APPROVED"
  | "MISSING_CLIENT"
  | "MISSING_META_CONNECTION"
  | "MISSING_AD_ACCOUNT"
  | "MISSING_META_PERMISSION"
  | "UNSUPPORTED_OBJECTIVE"
  | "MISSING_BUDGET"
  | "MISSING_GEO"
  | "MISSING_GEO_RESOLUTION"
  | "MISSING_DESTINATION"
  | "MISSING_PAGE"
  | "MISSING_FORM"
  | "MISSING_FORM_TECHNICAL_URL"
  | "MISSING_DESTINATION_URL"
  | "MISSING_CREATIVE_ASSET"
  | "MISSING_PRIMARY_TEXT"
  | "MISSING_HEADLINE"
  | "MISSING_SCHEDULE"
  | "MISSING_SPECIAL_AD_CATEGORY"
  | "INVALID_DATES"
  | "MISSING_AUDIENCE_MODE"
  | "IMPORTED_META_NOT_ELIGIBLE"
  | "ALREADY_LINKED_META"
  | "LIVE_WRITES_GATED"
  | "ASSET_UPLOAD_NOT_READY"
  | "MISSING_CTA"
  | "OTHER";

export type MetaPublishIssue = {
  code: MetaPublishIssueCode;
  severity: MetaPublishIssueSeverity;
  messageIt: string;
};

export type MetaPublishStepId =
  | "VALIDATE"
  | "CREATE_CAMPAIGN"
  | "CREATE_ADSET"
  | "MEDIA_UPLOAD"
  | "CREATE_CREATIVE"
  | "CREATE_AD"
  | "ESTABLISH_LINK"
  | "MARK_SYNC_BASELINE";

export type MetaPublishStepStatus =
  | "PENDING"
  | "VALID"
  | "SKIPPED"
  | "GATED"
  | "FAILED"
  | "MOCK_OK"
  | "CREATED";

export type MetaPublishStepResult = {
  step: MetaPublishStepId;
  status: MetaPublishStepStatus;
  /** Real Meta IDs only after live/mock execute succeeds. */
  metaObjectId: string | null;
  /** True when metaObjectId is mock-only namespace. */
  mockOnly: boolean;
  messageIt: string | null;
};

export type MetaPublishCreativePayload = {
  name: string;
  object_story_spec: {
    page_id: string | null;
    link_data?: {
      message: string | null;
      name: string | null;
      description: string | null;
      link: string | null;
      call_to_action?: {
        type: string;
        value?: { link?: string; lead_gen_form_id?: string };
      };
      image_hash?: string | null;
      video_id?: string | null;
      /** Ally storage path — not a Meta field; audit only. */
      ally_storage_path?: string | null;
    };
  };
  status: typeof META_WRITE_SAFE_STATUS;
  fieldStatus: Record<string, "AVAILABLE" | "DERIVABLE" | "MISSING" | "UNRESOLVED">;
  assetHandling: "READY" | "PARTIAL" | "BLOCKED";
  assetNoteIt: string | null;
};

export type MetaPublishAdPayload = {
  name: string;
  adset_id: "{pending_adset_id}";
  creative: { creative_id: "{pending_creative_id}" };
  status: typeof META_WRITE_SAFE_STATUS;
  fieldStatus: Record<string, "AVAILABLE" | "DERIVABLE" | "MISSING" | "UNRESOLVED">;
};

export type MetaPublishReviewCard = {
  productStatus: MetaPublishProductStatus;
  productStatusLabelIt: string;
  headlineIt: string;
  campaignLine: string;
  adSetLine: string;
  creativeLine: string;
  adLine: string;
  initialStatusLine: string;
  /** Ally product rules (e.g. client approval) — not Meta Graph prerequisites. */
  productRequirementLines: string[];
  /** Meta technical prerequisites (page, destination, creative, account…). */
  metaRequirementLines: string[];
  adAccountLine: string;
  objectiveLine: string;
  budgetLine: string;
  audienceLine: string;
  destinationLine: string;
  pageLine: string;
  creativeAssetLine: string;
  blockingIssues: string[];
  warnings: string[];
  canReview: boolean;
  /** True when plan is complete enough for future live write. */
  readyForLiveWrite: boolean;
  liveWritesEnabled: boolean;
  ctaState: "HIDDEN" | "DISABLED_NOT_READY" | "GATED_LIVE_OFF" | "ENABLED";
  ctaLabelIt: string;
  gatedNoteIt: string | null;
  destinationKind: string | null;
};

export type MetaPublishPlan = {
  allyCampaignId: string;
  clientId: string;
  fingerprint: string;
  idempotencyKey: string;
  ready: boolean;
  blockingIssues: MetaPublishIssue[];
  warnings: MetaPublishIssue[];
  writePreview: MetaWritePreviewResult;
  creative: MetaPublishCreativePayload | null;
  ad: MetaPublishAdPayload | null;
  review: MetaPublishReviewCard;
  publishOrder: ReadonlyArray<MetaPublishStepId>;
  objectiveMapping: {
    allyObjective: string | null;
    metaObjective: string | null;
    supported: boolean;
  };
};

export type MetaPublishDryRunResult = {
  plan: MetaPublishPlan;
  executed: false;
  liveWritesGated: boolean;
  steps: MetaPublishStepResult[];
  failedAt: MetaPublishStepId | null;
  /** Always false on dry-run / gated path. */
  markedSynced: boolean;
  /** Always false until real Meta objects verified. */
  markedPublished: boolean;
};

/** Sanitized Meta Graph diagnostics for QA — never tokens. */
export type MetaPublishGraphError = {
  code: number | null;
  subcode: number | null;
  type: string | null;
  message: string | null;
  userTitle: string | null;
  userMsg: string | null;
  blameFields: string[] | null;
  source: "validate_only" | "create";
};

export type MetaPublishExecuteResult = {
  plan: MetaPublishPlan;
  executed: boolean;
  liveWritesGated: boolean;
  steps: MetaPublishStepResult[];
  failedAt: MetaPublishStepId | null;
  markedSynced: boolean;
  markedPublished: boolean;
  operationId: string | null;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaCreativeId: string | null;
  metaAdId: string | null;
  errorCategory: string | null;
  /** User-facing normalized message (Italian). */
  errorSafeMessage: string | null;
  /** Internal/QA Graph diagnostics when a Meta step failed. */
  graphError?: MetaPublishGraphError | null;
};

export const META_PUBLISH_ORDER = [
  "VALIDATE",
  "CREATE_CAMPAIGN",
  "CREATE_ADSET",
  "MEDIA_UPLOAD",
  "CREATE_CREATIVE",
  "CREATE_AD",
  "ESTABLISH_LINK",
  "MARK_SYNC_BASELINE",
] as const satisfies ReadonlyArray<MetaPublishStepId>;
