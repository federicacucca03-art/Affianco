/**
 * M11A.1 — Map Ally objective → Meta OUTCOME_* for dry-run.
 */

import { mapBusinessIntentToMetaArchitecture } from "@/lib/meta/guided-plan/map-intent";

export function resolveMetaObjectiveCode(
  objectiveRaw: string | null | undefined,
): string | null {
  const raw = (objectiveRaw ?? "").trim().toUpperCase();
  if (raw.startsWith("OUTCOME_")) return raw;
  const mapped = mapBusinessIntentToMetaArchitecture({
    objective: raw || null,
  });
  return mapped.metaObjective;
}

export function resolveOptimizationAndDestination(input: {
  metaObjective: string | null;
  destination: string;
}): {
  optimizationGoal: string | null;
  destinationType: string | null;
  promotedObject: Record<string, unknown> | null;
  needsPage: boolean;
  needsForm: boolean;
  needsUrl: boolean;
  needsTracking: boolean;
} {
  const dest = input.destination;
  const obj = input.metaObjective;

  if (dest === "UNRESOLVED" || dest === "UNKNOWN") {
    return {
      optimizationGoal: null,
      destinationType: null,
      promotedObject: null,
      needsPage: false,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  if (dest === "META_LEAD_FORM") {
    return {
      optimizationGoal: "LEAD_GENERATION",
      destinationType: "ON_AD",
      promotedObject: null, // filled when page present
      needsPage: true,
      needsForm: true,
      needsUrl: false,
      needsTracking: false,
    };
  }

  if (dest === "WEBSITE") {
    const needsTracking =
      obj === "OUTCOME_LEADS" || obj === "OUTCOME_SALES";
    return {
      optimizationGoal:
        obj === "OUTCOME_TRAFFIC"
          ? "LINK_CLICKS"
          : needsTracking
            ? "OFFSITE_CONVERSIONS"
            : "LINK_CLICKS",
      destinationType: "WEBSITE",
      promotedObject: null,
      needsPage: false,
      needsForm: false,
      needsUrl: true,
      needsTracking,
    };
  }

  if (dest === "WHATSAPP") {
    return {
      optimizationGoal: "CONVERSATIONS",
      destinationType: "WHATSAPP",
      promotedObject: null,
      needsPage: true,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  if (dest === "PHONE") {
    return {
      optimizationGoal: "QUALITY_CALL",
      destinationType: "PHONE",
      promotedObject: null,
      needsPage: false,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  if (obj === "OUTCOME_AWARENESS") {
    return {
      optimizationGoal: "REACH",
      destinationType: null,
      promotedObject: null,
      needsPage: false,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  return {
    optimizationGoal: null,
    destinationType: null,
    promotedObject: null,
    needsPage: false,
    needsForm: false,
    needsUrl: false,
    needsTracking: false,
  };
}
