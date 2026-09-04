export type {
  CampaignNextAction,
  NextActionConfidence,
  NextActionEligibility,
  NextActionSource,
  NextActionType,
} from "@/lib/campaign-next-action/types";

export {
  etichettaNextAction,
  shouldShowNextAction,
} from "@/lib/campaign-next-action/labels";

export {
  actionConsistentWithDiagnosis,
  actionTypeFromDiagnosisArea,
  isSmallSample,
  PROHIBITED_ACTION_PHRASES,
  resolveAiSupportedNextAction,
  resolveDeterministicNextAction,
  resolveNextAction,
  type NextActionConfigurationKind,
  type ResolveNextActionInput,
} from "@/lib/campaign-next-action/resolve";

export { resolveNextActionCta } from "@/lib/campaign-next-action/cta";
