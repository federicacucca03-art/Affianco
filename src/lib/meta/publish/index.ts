/**
 * M14 / M14.1 — Full Meta publish domain exports.
 */

export {
  buildMetaPublishPlan,
  validateMetaPublishPlan,
} from "@/lib/meta/publish/plan";
export { normalizeWritePreviewForFullPublish } from "@/lib/meta/publish/full-publish-preview";
export {
  dryRunMetaPublishPlan,
  executeMetaPublishPlan,
  isFullPublishLiveExecutionAllowed,
} from "@/lib/meta/publish/orchestrate";
export {
  evaluateControlledQaWriteGate,
  isQaScopedMetaWritesEnvironment,
  maskMetaAdAccountId,
  ALLY_QA_SUPABASE_PROJECT_REF,
} from "@/lib/meta/publish/qa-write-gate";
export {
  buildMetaCreativePayload,
  buildMetaAdPayload,
  creativeBlockingIssues,
  buildObjectStorySpecForPublish,
} from "@/lib/meta/publish/payloads";
export {
  etichettaPublishProductStatus,
  resolvePublishProductStatus,
} from "@/lib/meta/publish/labels";
export {
  createMetaAdCreative,
  createMetaAdPaused,
  uploadMetaAdImageHash,
  uploadMetaAdVideoId,
} from "@/lib/meta/publish/graph-publish";
export { META_PUBLISH_ORDER } from "@/lib/meta/publish/types";
export type * from "@/lib/meta/publish/types";
export {
  toSafeGraphErrorDiagnostics,
  type MetaGraphErrorDiagnostics,
} from "@/lib/meta/write/graph-write";
