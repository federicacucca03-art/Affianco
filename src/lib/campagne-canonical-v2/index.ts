/**
 * ADV.1.5 — Canonical Campaign State V2 public surface.
 * Domain model + adapters only. Durable DB write requires authorized QA migration.
 * LIVE META WRITES: 0
 */

export type {
  AudienceIntentV2,
  AudienceRoleV2,
  AudienceStrategyKindV2,
  BudgetAllocationStatusV2,
  BudgetModelV2,
  BudgetPeriodV2,
  CanonicalAdSetV2,
  CanonicalCampaignStateV2,
  CanonicalCreativeRefV2,
  ConversionContextV2,
  ConversionLocationV2,
  DecisionProvenance,
  FacileComplexitySummaryV2,
  GeographyV2,
  MetaObjectiveFamilyV2,
  OptimizationEventIntentV2,
  PlacementsIntentV2,
  RetargetingSourceIntentV2,
  ScheduleModelV2,
  SpecialAdCategoryV2,
  V2ToV1ProjectionResult,
} from "@/lib/campagne-canonical-v2/types";

export {
  emptyAdSetV2,
  emptyAudienceIntentV2,
  emptyBudgetV2,
  emptyCanonicalCampaignStateV2,
  emptyConversionContextV2,
  emptyGeographyV2,
  emptyPlacementsV2,
  emptyScheduleV2,
  newCanonicalEntityId,
} from "@/lib/campagne-canonical-v2/empty";

export {
  canonicalV2FromCanonicalV1,
  canonicalV2FromInstantFormDraft,
} from "@/lib/campagne-canonical-v2/from-v1";

export { canonicalV2FromArchitect } from "@/lib/campagne-canonical-v2/from-architect";

export { projectCanonicalV2ToV1Draft } from "@/lib/campagne-canonical-v2/to-v1-projection";

export { buildFacileComplexitySummary } from "@/lib/campagne-canonical-v2/facile-summary";

export {
  cloneCanonicalCampaignStateV2,
  parseCanonicalCampaignStateV2,
  serializeCanonicalCampaignStateV2,
  validateCanonicalCampaignStateV2,
} from "@/lib/campagne-canonical-v2/serialize";

export {
  applyEasyDraftPatchToV2,
  mergeCanonicalCampaignStateV2,
  patchFromEasyDraft,
  type CanonicalV2Patch,
  type EasyOwnedField,
} from "@/lib/campagne-canonical-v2/merge";

export {
  addAdSetV2,
  assignCreativeToAdSetsV2,
  describeObjectiveChangeImpact,
  duplicateAdSetV2,
  patchAdSetAudienceV2,
  patchAdSetGenderV2,
  patchAdSetPlacementsV2,
  patchAppRefV2,
  patchConversionLocationV2,
  patchObjectiveV2,
  patchOptimizationEventV2,
  patchScheduleV2,
  patchTrackingAssetV2,
  patchWebsiteUrlV2,
  removeAdSetV2,
  resolveBudgetSplitExplicit,
  setCampaignBudgetOnly,
  type ObjectiveChangeImpact,
} from "@/lib/campagne-canonical-v2/builder-ops";

export {
  DESTINATION_OPTIONS_V2,
  OBJECTIVE_OPTIONS_V2,
  OPTIMIZATION_OPTIONS_V2,
  destinationLabelIt,
  destinationsForObjective,
  objectiveLabelIt,
  objectiveMetaCode,
  optimizationsFor,
  roleLabelIt,
  strategyLabelIt,
} from "@/lib/campagne-canonical-v2/builder-labels";

export {
  builderV2SessionKey,
  readBuilderV2Session,
  writeBuilderV2Session,
} from "@/lib/campagne-canonical-v2/builder-session";

export {
  isCanonicalV2LiveWriteEnabled,
  persistCanonicalCampaignStateV2,
  readCanonicalCampaignStateV2,
  type CanonicalV2DbClient,
  type CanonicalV2PersistResult,
  type CanonicalV2ReadResult,
} from "@/lib/campagne-canonical-v2/persist";

export {
  resolveRuntimeCanonicalV2FromCampagna,
  runtimeV2FromBuilderState,
  seedV1DraftPreferringV2,
  type RuntimeV2ResolveResult,
  type RuntimeV2ResolveSource,
} from "@/lib/campagne-canonical-v2/resolve";

export {
  legacyColumnProjectionFromV2,
  legacyProjectionUpdatePayload,
  type LegacyCampaignColumnProjection,
} from "@/lib/campagne-canonical-v2/legacy-projection";

/**
 * Durable persistence: campaigns.canonical_state (QA schema applied ADV.1.5.1).
 * Live row writes remain gated (ADV_CANONICAL_V2_LIVE_WRITES=1) until data roundtrip auth.
 * Never store V2 graphs in front_end_offer / meta_write_operations.
 */
export const CANONICAL_V2_DURABLE_PERSISTENCE = {
  schemaChangeRequired: false as const,
  schemaAppliedQa: true as const,
  recommendedColumn: "canonical_state",
  liveWritesDefault: false as const,
  forbiddenContainers: ["front_end_offer", "meta_write_operations", "creativita"],
} as const;
