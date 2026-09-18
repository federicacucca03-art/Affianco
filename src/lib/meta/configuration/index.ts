/**
 * M10D — Meta configuration intelligence (read-only).
 */

export type {
  MetaCampaignConfiguration,
  MetaAdSetConfiguration,
  MetaAdConfiguration,
  MetaConfigurationBundle,
  ConfigurationObservation,
  PlannedVsActualField,
  PlannedVsActualState,
  ConfigPresentation,
  ConfigSummaryLine,
  MetaTargetingSummaryStored,
} from "@/lib/meta/configuration/types";

export {
  buildCampaignConfiguration,
  buildAdSetConfiguration,
  buildAdConfiguration,
  parseStoredTargetingSummary,
  resolveBudgetKind,
  resolveCampaignBudgetLevel,
} from "@/lib/meta/configuration/build";

export {
  presentCampaignConfig,
  presentAdSetConfig,
  presentAdConfig,
  buildConfigPresentation,
  buildAdSetConfigPresentation,
} from "@/lib/meta/configuration/present";

export {
  etichettaOptimizationGoal,
  etichettaBidStrategy,
  etichettaBillingEvent,
  etichettaPlacementMode,
  etichettaBudgetLevel,
  formatMetaBudgetIt,
  formatMetaBudgetAmountIt,
  formatMetaConfigDateTimeIt,
  formatAttributionSpecIt,
  etichettaAdsetBudgetSharing,
  etichettaSpecialAdCategories,
  metaBudgetMinorToMajor,
} from "@/lib/meta/configuration/labels";

export {
  normalizeTargetingSummary,
  resolvePlacementMode,
  audienceBeginnerLabel,
  formatAudienceAgeRange,
} from "@/lib/meta/configuration/normalize-targeting";

export { buildConfigurationObservations } from "@/lib/meta/configuration/observations";

export {
  comparePlannedVsActual,
  plannedSnapshotFromGuided,
  type AllyPlannedConfigSnapshot,
} from "@/lib/meta/configuration/planned-vs-actual";
