/**
 * M11A.2K — Advantage+ Audience mode (independent of placements).
 * Meta: targeting_automation.advantage_audience must be 0 or 1 when required.
 */

export type AllyAudienceMode =
  | "ADVANTAGE_AUDIENCE"
  | "MANUAL_AUDIENCE"
  | "UNRESOLVED";

export const META_ADVANTAGE_AUDIENCE_ON = 1 as const;
export const META_ADVANTAGE_AUDIENCE_OFF = 0 as const;

export type AudienceModeResolve =
  | {
      ok: true;
      allyAudienceMode: Exclude<AllyAudienceMode, "UNRESOLVED">;
      advantageAudience: 0 | 1;
      humanLabelIt: string;
      targetingAutomation: { advantage_audience: 0 | 1 };
    }
  | {
      ok: false;
      allyAudienceMode: "UNRESOLVED";
      advantageAudience: null;
      humanLabelIt: null;
      targetingAutomation: null;
      reason: "UNRESOLVED_AUDIENCE_MODE";
    };

/**
 * Advantage+ Audience ≠ Advantage+ placements.
 * Geo/age controls may coexist with Advantage Audience (suggestions/controls).
 */
export function resolveMetaAudienceMode(input: {
  allyAudienceMode?: AllyAudienceMode | null;
}): AudienceModeResolve {
  const mode = input.allyAudienceMode ?? "UNRESOLVED";

  if (mode === "ADVANTAGE_AUDIENCE") {
    return {
      ok: true,
      allyAudienceMode: mode,
      advantageAudience: META_ADVANTAGE_AUDIENCE_ON,
      humanLabelIt: "Advantage+ Audience",
      targetingAutomation: {
        advantage_audience: META_ADVANTAGE_AUDIENCE_ON,
      },
    };
  }

  if (mode === "MANUAL_AUDIENCE") {
    return {
      ok: true,
      allyAudienceMode: mode,
      advantageAudience: META_ADVANTAGE_AUDIENCE_OFF,
      humanLabelIt: "Pubblico manuale",
      targetingAutomation: {
        advantage_audience: META_ADVANTAGE_AUDIENCE_OFF,
      },
    };
  }

  return {
    ok: false,
    allyAudienceMode: "UNRESOLVED",
    advantageAudience: null,
    humanLabelIt: null,
    targetingAutomation: null,
    reason: "UNRESOLVED_AUDIENCE_MODE",
  };
}
