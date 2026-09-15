export type {
  BuildGuidedMetaPlanInput,
  GuidedAdPlan,
  GuidedAdSetPlan,
  GuidedAudienceStrategy,
  GuidedDestinationKind,
  GuidedMetaObjectiveCode,
  GuidedMetaPlan,
  GuidedMissingRequirement,
  GuidedProvenance,
} from "@/lib/meta/guided-plan/types";

export {
  etichettaBusinessGoalFromObjective,
  etichettaGuidedAudience,
  etichettaGuidedDestination,
  etichettaGuidedMetaObjective,
  etichettaGuidedPlacements,
  etichettaGuidedProvenance,
} from "@/lib/meta/guided-plan/labels";

export {
  mapBusinessIntentToMetaArchitecture,
  resolveGuidedDestination,
} from "@/lib/meta/guided-plan/map-intent";

export {
  buildGuidedMetaPlan,
  destinationRequiresLeadForm,
  etichettaOptimizationGoal,
  hasMetaTechnicalGaps,
  isGuidedPlanningReady,
} from "@/lib/meta/guided-plan/build-plan";
