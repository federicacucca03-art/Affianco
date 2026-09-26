/**
 * M11A.2E — Deterministic Meta objective × optimization matrix (ODAX / v26).
 * No AI. No Technon historical fallbacks.
 */

export const META_AWARENESS_OPTIMIZATION_GOALS = [
  "REACH",
  "IMPRESSIONS",
  "AD_RECALL_LIFT",
  "THRUPLAY",
] as const;

export const META_TRAFFIC_OPTIMIZATION_GOALS = [
  "LINK_CLICKS",
  "LANDING_PAGE_VIEWS",
  "IMPRESSIONS",
  "REACH",
] as const;

/** Supported optimization goals per Meta campaign objective. */
export const META_OBJECTIVE_OPTIMIZATION_MATRIX: Record<
  string,
  readonly string[]
> = {
  OUTCOME_AWARENESS: META_AWARENESS_OPTIMIZATION_GOALS,
  OUTCOME_TRAFFIC: META_TRAFFIC_OPTIMIZATION_GOALS,
  OUTCOME_LEADS: [
    "LEAD_GENERATION",
    "OFFSITE_CONVERSIONS",
    "CONVERSATIONS",
    "QUALITY_CALL",
    "LINK_CLICKS",
    "QUALITY_LEAD",
  ],
  OUTCOME_SALES: [
    "OFFSITE_CONVERSIONS",
    "LINK_CLICKS",
    "IMPRESSIONS",
    "REACH",
    "VALUE",
    "CONVERSATIONS",
  ],
  OUTCOME_ENGAGEMENT: [
    "POST_ENGAGEMENT",
    "PAGE_LIKES",
    "THRUPLAY",
    "CONVERSATIONS",
  ],
  OUTCOME_APP_PROMOTION: [
    "APP_INSTALLS",
    "APP_INSTALLS_AND_OFFSITE_CONVERSIONS",
    "VALUE",
  ],
};

export function isObjectiveOptimizationSupported(
  metaObjective: string | null | undefined,
  optimizationGoal: string | null | undefined,
): boolean {
  const obj = (metaObjective ?? "").trim().toUpperCase();
  const goal = (optimizationGoal ?? "").trim().toUpperCase();
  if (!obj || !goal) return false;
  const allowed = META_OBJECTIVE_OPTIMIZATION_MATRIX[obj];
  if (!allowed) return false;
  return allowed.includes(goal);
}

/**
 * Cross-level write configuration check (Campaign objective × Ad Set opt/dest).
 */
export function validateWriteObjectiveConfiguration(input: {
  metaObjective: string | null;
  destination: string;
  optimizationGoal: string | null;
}): { ok: true } | { ok: false; reason: "UNSUPPORTED_CONFIGURATION" } {
  const obj = (input.metaObjective ?? "").trim().toUpperCase();
  const dest = (input.destination ?? "").trim().toUpperCase();
  const goal = (input.optimizationGoal ?? "").trim().toUpperCase();

  if (!obj || !goal) {
    return { ok: false, reason: "UNSUPPORTED_CONFIGURATION" };
  }
  if (!isObjectiveOptimizationSupported(obj, goal)) {
    return { ok: false, reason: "UNSUPPORTED_CONFIGURATION" };
  }

  // Hard rejects called out by M11A.2D/E
  if (obj === "OUTCOME_AWARENESS" && goal === "LINK_CLICKS") {
    return { ok: false, reason: "UNSUPPORTED_CONFIGURATION" };
  }

  if (
    obj === "OUTCOME_TRAFFIC" &&
    dest === "WEBSITE" &&
    (goal === "LINK_CLICKS" ||
      goal === "LANDING_PAGE_VIEWS" ||
      goal === "IMPRESSIONS" ||
      goal === "REACH")
  ) {
    return { ok: true };
  }

  if (
    obj === "OUTCOME_AWARENESS" &&
    (goal === "REACH" ||
      goal === "IMPRESSIONS" ||
      goal === "AD_RECALL_LIFT" ||
      goal === "THRUPLAY")
  ) {
    return { ok: true };
  }

  // Other objectives: matrix membership is enough (destination gates elsewhere).
  if (obj !== "OUTCOME_TRAFFIC" && obj !== "OUTCOME_AWARENESS") {
    return { ok: true };
  }

  return { ok: true };
}
