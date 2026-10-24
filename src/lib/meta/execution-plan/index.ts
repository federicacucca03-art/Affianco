/**
 * ADV.2.1 — Meta Execution Plan public surface.
 * Canonical V2 → MetaExecutionPlan → pure payloads (no Graph mutations).
 */

export type {
  MetaExecutionPlan,
  ExecutionCapabilityStatus,
  ExecutionIssue,
  ExecutionRequirementCode,
  ExecutionPlanCampaignNode,
  ExecutionPlanAdSetNode,
  ExecutionPlanCreativeNode,
  ExecutionPlanAdNode,
  ExecutionPreviewSummary,
  ComponentCapability,
  MetaObjectiveCode,
  MetaDestinationCode,
  ProposedCampaignPayload,
  ProposedAdSetPayload,
  ProposedCreativePayload,
  ProposedAdPayload,
} from "@/lib/meta/execution-plan/types";

export type { ExecutionPlanContext } from "@/lib/meta/execution-plan/from-canonical-v2";

export {
  buildMetaExecutionPlanFromV2,
  assertV2ImmutableAfterPlan,
} from "@/lib/meta/execution-plan/from-canonical-v2";

export {
  buildCampaignPayload,
  buildAdSetPayload,
  buildCreativePayload,
  buildAdPayload,
  materializePlanPayloads,
} from "@/lib/meta/execution-plan/payloads";

export {
  mapV2ObjectiveToMeta,
  metaObjectiveLabelIt,
} from "@/lib/meta/execution-plan/objective-map";

export {
  mapV2LocationToMetaDestination,
  destinationLabelIt,
} from "@/lib/meta/execution-plan/destination-map";

export {
  executionIssuesToGuardianChecks,
  mergeExecutionPlanIntoGuardianChecks,
  executionPlanFacileHeadline,
  EXECUTION_GUARDIAN_ISSUE,
} from "@/lib/meta/execution-plan/guardian-v2";

export {
  OBJECTIVE_EXECUTION_MATRIX,
  DESTINATION_EXECUTION_MATRIX,
  PLACEMENT_EXECUTION_MATRIX,
  CTA_EXECUTION_MATRIX,
  AUDIENCE_EXECUTION_MATRIX,
  TRACKING_EXECUTION_MATRIX,
  IDENTITY_REQUIREMENT_MATRIX,
  EXECUTION_DEPENDENCY_GRAPH,
  IDEMPOTENCY_READINESS,
  LEGACY_EXECUTION_PATHS,
} from "@/lib/meta/execution-plan/matrices";
