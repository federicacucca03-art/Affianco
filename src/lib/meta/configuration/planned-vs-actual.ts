/**
 * M10D — Deterministic Ally planned vs Meta actual comparison.
 * Only comparable fields. Differences are not automatically errors.
 */

import {
  etichettaBudgetLevel,
  etichettaOptimizationGoal,
  etichettaPlacementMode,
  formatMetaBudgetIt,
} from "@/lib/meta/configuration/labels";
import { audienceBeginnerLabel } from "@/lib/meta/configuration/normalize-targeting";
import type {
  MetaAdSetConfiguration,
  MetaCampaignConfiguration,
  PlannedVsActualField,
  PlannedVsActualState,
} from "@/lib/meta/configuration/types";
import type { GuidedMetaPlan } from "@/lib/meta/guided-plan/types";
import { resolvePerformanceFamily } from "@/lib/meta/objective-performance";

export type AllyPlannedConfigSnapshot = {
  objectiveCode: string | null;
  destinationLabel: string | null;
  budgetDailyMajor: number | null;
  budgetLevel: "CAMPAIGN" | "AD_SET" | "UNKNOWN" | null;
  geographyLabel: string | null;
  ageLabel: string | null;
  placementsStrategy: "ADVANTAGE_PLUS" | "MANUAL" | "META_DEFAULT" | null;
  optimizationGoal: string | null;
};

function stateEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): PlannedVsActualState {
  if (a == null || a === "" || b == null || b === "") return "UNAVAILABLE";
  return a === b ? "MATCH" : "DIFFERENT";
}

function familyFromObjective(code: string | null): string | null {
  if (!code) return null;
  return resolvePerformanceFamily(code);
}

export function plannedSnapshotFromGuided(
  plan: GuidedMetaPlan,
): AllyPlannedConfigSnapshot {
  return {
    objectiveCode: plan.metaObjective.value,
    destinationLabel: plan.destination.value,
    budgetDailyMajor: plan.budgetDaily.value,
    budgetLevel: plan.budgetLevel.value,
    geographyLabel: plan.geographyFacts.value,
    ageLabel: plan.ageFacts.value,
    placementsStrategy: plan.placementsStrategy.value,
    optimizationGoal: plan.optimizationGoal.value,
  };
}

export function comparePlannedVsActual(input: {
  planned: AllyPlannedConfigSnapshot | null;
  campaign: MetaCampaignConfiguration;
  primaryAdSet: MetaAdSetConfiguration | null;
}): PlannedVsActualField[] | null {
  if (!input.planned) return null;
  const planned = input.planned;
  const actualObj = input.campaign.objective.value;
  const fields: PlannedVsActualField[] = [];

  // Objective (by performance family)
  const plannedFam = familyFromObjective(planned.objectiveCode);
  const actualFam = familyFromObjective(actualObj);
  let objState: PlannedVsActualState = "UNAVAILABLE";
  if (plannedFam == null && actualFam == null) objState = "UNAVAILABLE";
  else if (plannedFam == null || actualFam == null) objState = "UNAVAILABLE";
  else if (plannedFam === "UNKNOWN" || actualFam === "UNKNOWN")
    objState = "NOT_COMPARABLE";
  else objState = plannedFam === actualFam ? "MATCH" : "DIFFERENT";
  fields.push({
    field: "objective",
    label: "Obiettivo",
    state: objState,
    plannedLabel: planned.objectiveCode,
    actualLabel: actualObj,
    note:
      objState === "NOT_COMPARABLE"
        ? "Obiettivo non mappabile in modo affidabile"
        : null,
  });

  // Destination — only if Meta destination_type present
  const actualDest = input.primaryAdSet?.destinationType.value ?? null;
  let destState: PlannedVsActualState = "NOT_COMPARABLE";
  if (!planned.destinationLabel) destState = "UNAVAILABLE";
  else if (!actualDest) destState = "UNAVAILABLE";
  else {
    const p = planned.destinationLabel.toUpperCase();
    const a = actualDest.toUpperCase();
    const map: Record<string, string[]> = {
      META_LEAD_FORM: ["ON_AD", "ON_PAGE", "UNDEFINED"],
      WEBSITE: ["WEBSITE"],
      WHATSAPP: ["WHATSAPP"],
      PHONE: ["PHONE_CALL"],
      INSTAGRAM_DM: ["INSTAGRAM_DIRECT"],
    };
    const allowed = map[p];
    if (!allowed) destState = "NOT_COMPARABLE";
    else destState = allowed.includes(a) ? "MATCH" : "DIFFERENT";
  }
  fields.push({
    field: "destination",
    label: "Destinazione",
    state: destState,
    plannedLabel: planned.destinationLabel,
    actualLabel: actualDest,
    note:
      destState === "NOT_COMPARABLE"
        ? "Mappatura destinazione non affidabile"
        : null,
  });

  // Budget level
  const plannedLevel = planned.budgetLevel;
  const actualLevel = input.campaign.budgetLevel;
  let budgetLevelState: PlannedVsActualState = "UNAVAILABLE";
  if (!plannedLevel || plannedLevel === "UNKNOWN")
    budgetLevelState = "UNAVAILABLE";
  else if (actualLevel === "UNKNOWN") budgetLevelState = "UNAVAILABLE";
  else
    budgetLevelState =
      plannedLevel === actualLevel ? "MATCH" : "DIFFERENT";
  fields.push({
    field: "budgetLevel",
    label: "Livello budget",
    state: budgetLevelState,
    plannedLabel: plannedLevel
      ? etichettaBudgetLevel(plannedLevel)
      : null,
    actualLabel: etichettaBudgetLevel(actualLevel),
    note: null,
  });

  // Daily budget magnitude — only when both daily and Meta daily known
  const plannedDaily = planned.budgetDailyMajor;
  const actualDailyMinor =
    input.campaign.dailyBudgetMinor.value ??
    input.primaryAdSet?.dailyBudgetMinor.value ??
    null;
  let budgetState: PlannedVsActualState = "UNAVAILABLE";
  let actualBudgetLabel: string | null = null;
  if (plannedDaily == null) budgetState = "UNAVAILABLE";
  else if (actualDailyMinor == null) budgetState = "UNAVAILABLE";
  else {
    const actualMajor = Math.round(actualDailyMinor) / 100;
    actualBudgetLabel = formatMetaBudgetIt(actualDailyMinor, "DAILY");
    const ratio =
      plannedDaily > 0 ? Math.abs(actualMajor - plannedDaily) / plannedDaily : 1;
    budgetState = ratio <= 0.15 ? "MATCH" : "DIFFERENT";
  }
  fields.push({
    field: "budgetDaily",
    label: "Budget giornaliero",
    state: budgetState,
    plannedLabel:
      plannedDaily != null
        ? new Intl.NumberFormat("it-IT", {
            style: "currency",
            currency: "EUR",
          }).format(plannedDaily)
        : null,
    actualLabel: actualBudgetLabel,
    note:
      budgetState === "UNAVAILABLE"
        ? "Confronto solo se entrambi i budget giornalieri sono noti"
        : null,
  });

  // Geography
  const actualGeo =
    input.primaryAdSet?.audience.value?.geographyLabel ?? null;
  fields.push({
    field: "geography",
    label: "Area geografica",
    state: stateEqual(
      planned.geographyLabel?.toLowerCase() ?? null,
      actualGeo?.toLowerCase() ?? null,
    ),
    plannedLabel: planned.geographyLabel,
    actualLabel: actualGeo,
    note: null,
  });

  // Age
  const actualAge = input.primaryAdSet?.audience.value
    ? audienceBeginnerLabel(input.primaryAdSet.audience.value)
    : null;
  const ageComparable =
    actualAge &&
    actualAge !== "Dettaglio pubblico non disponibile" &&
    planned.ageLabel;
  fields.push({
    field: "age",
    label: "Età",
    state: !ageComparable
      ? "UNAVAILABLE"
      : stateEqual(
          planned.ageLabel?.replace(/\s/g, "") ?? null,
          actualAge?.replace(/\s/g, "") ?? null,
        ),
    plannedLabel: planned.ageLabel,
    actualLabel: actualAge,
    note: null,
  });

  // Placements
  const actualPlace = input.primaryAdSet?.placements.value?.mode ?? null;
  let placeState: PlannedVsActualState = "UNAVAILABLE";
  if (!planned.placementsStrategy) placeState = "UNAVAILABLE";
  else if (!actualPlace || actualPlace === "UNAVAILABLE")
    placeState = "UNAVAILABLE";
  else if (actualPlace === "UNKNOWN") placeState = "NOT_COMPARABLE";
  else {
    const wantAuto =
      planned.placementsStrategy === "ADVANTAGE_PLUS" ||
      planned.placementsStrategy === "META_DEFAULT";
    if (wantAuto) placeState = actualPlace === "AUTOMATIC" ? "MATCH" : "DIFFERENT";
    else
      placeState =
        planned.placementsStrategy === "MANUAL" && actualPlace === "MANUAL"
          ? "MATCH"
          : "DIFFERENT";
  }
  fields.push({
    field: "placements",
    label: "Distribuzione",
    state: placeState,
    plannedLabel: planned.placementsStrategy,
    actualLabel: actualPlace
      ? etichettaPlacementMode(actualPlace)
      : null,
    note: null,
  });

  // Optimization
  const actualOpt = input.primaryAdSet?.optimizationGoal.value ?? null;
  let optState: PlannedVsActualState = "UNAVAILABLE";
  if (!planned.optimizationGoal) optState = "UNAVAILABLE";
  else if (!actualOpt) optState = "UNAVAILABLE";
  else
    optState =
      planned.optimizationGoal.toUpperCase() === actualOpt.toUpperCase()
        ? "MATCH"
        : "DIFFERENT";
  fields.push({
    field: "optimization",
    label: "Ottimizzazione",
    state: optState,
    plannedLabel: planned.optimizationGoal
      ? etichettaOptimizationGoal(planned.optimizationGoal)
      : null,
    actualLabel: actualOpt ? etichettaOptimizationGoal(actualOpt) : null,
    note: null,
  });

  return fields;
}
