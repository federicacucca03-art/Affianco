/**
 * ADV.2.3 — Ally MetaWritePlan (gated Graph operation descriptors).
 * Pure planning. NO Graph mutations. CREATE ≠ ACTIVATE.
 */

import type {
  ExecutionIssue,
  MetaDestinationCode,
  MetaExecutionPlan,
  MetaObjectiveCode,
} from "@/lib/meta/execution-plan/types";

export type MetaWriteOpType =
  | "CREATE_CAMPAIGN"
  | "CREATE_ADSET"
  | "UPLOAD_IMAGE"
  | "CREATE_CREATIVE"
  | "CREATE_AD"
  | "CREATE_CUSTOM_AUDIENCE"
  | "CREATE_LOOKALIKE"
  | "CREATE_INSTANT_FORM"
  | "UPDATE_STATUS"
  | "ACTIVATE";

export type MetaWriteMutationClass =
  | "CREATE"
  | "UPDATE"
  | "ACTIVATE"
  | "UPLOAD"
  | "PLAN_ONLY_DEPENDENCY";

export type MetaWriteOpLifecycle =
  | "NOT_STARTED"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN_RESULT";

export type MetaWriteOpBlocker = {
  code: string;
  messageIt: string;
  messagePro?: string;
};

/** One planned Graph (or dependency) operation — never executed in ADV.2.3. */
export type MetaWriteOperation = {
  allyOperationId: string;
  idempotencyKey: string;
  type: MetaWriteOpType;
  mutationClass: MetaWriteMutationClass;
  canonicalEntityId: string | null;
  /** e.g. POST /act_{ad_account_id}/campaigns */
  targetEndpoint: string;
  method: "POST" | "GET" | "NONE";
  /** Validated Graph-shaped body — never sent. */
  payload: Record<string, unknown>;
  /** Ally operation ids that must succeed first. */
  dependsOn: string[];
  /** Placeholder for future Meta object id after create. */
  expectedOutputRef: string;
  blockers: MetaWriteOpBlocker[];
  warnings: MetaWriteOpBlocker[];
  /** PLAN_ONLY deps are never ready for live execution in ADV.2.3. */
  executableWhenGated: boolean;
  initialStatus: "PAUSED" | "ACTIVE" | "N/A";
  payloadFingerprint: string;
  replayState: MetaWriteOpLifecycle;
};

export type RollbackPolicyEntry = {
  operationType: MetaWriteOpType;
  rollbackPossible: boolean;
  rollbackMutationRequired: boolean;
  safeStateIt: string;
};

export type MetaWriteAuditDescriptor = {
  operationKey: string;
  entityType: string;
  action: MetaWriteOpType;
  payloadFingerprint: string;
  status: MetaWriteOpLifecycle;
  metaResultId: string | null;
  plannedAtIso: string;
  errorClass: string | null;
};

export type MetaWriteGateSnapshot = {
  adv23LiveFlag: boolean;
  metaWritesLive: boolean;
  /**
   * True only when both live flags are "1" AND the MetaWritePlan executor is
   * present. Flags alone never authorize Graph POST without an explicit
   * MutationManifest at call time (ADV.2.4.0.1).
   */
  executionAllowed: boolean;
  reasonIt: string;
};

export type MetaWritePlanPreview = {
  linesIt: string[];
  dependencyLinesIt: string[];
  campaignCount: number;
  adSetCount: number;
  creativeCount: number;
  adCount: number;
  dependencyCreateCount: number;
};

/**
 * Ally-owned write plan derived from MetaExecutionPlan.
 * Does not call Graph. Does not mutate DB.
 */
export type MetaWritePlan = {
  schemaVersion: 1;
  sourceCampaignId: string;
  executionPlanId: string;
  metaObjective: MetaObjectiveCode;
  destination: MetaDestinationCode;
  campaignOperation: MetaWriteOperation | null;
  dependencyOperations: MetaWriteOperation[];
  adSetOperations: MetaWriteOperation[];
  creativeOperations: MetaWriteOperation[];
  adOperations: MetaWriteOperation[];
  activationOperations: MetaWriteOperation[];
  operationOrder: string[];
  blockers: ExecutionIssue[];
  warnings: ExecutionIssue[];
  writeBlockers: MetaWriteOpBlocker[];
  rollbackPolicy: RollbackPolicyEntry[];
  auditDescriptors: MetaWriteAuditDescriptor[];
  gate: MetaWriteGateSnapshot;
  /**
   * True only when gate allows AND structure is complete.
   * Always false in ADV.2.3 (gate off).
   */
  readyForExecution: boolean;
  /** Ops/payloads valid ignoring live gate — dry-run readiness. */
  structurallyReady: boolean;
  preview: MetaWritePlanPreview;
  initialStatusPolicy: string;
  generatedAtIso: string;
};
