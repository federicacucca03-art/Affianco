/**
 * M11A.2L — Age fields for Advantage+ Audience vs Manual Audience.
 *
 * Meta (Advantage+ Audience enabled):
 * - Hard control: age_min only (18–25)
 * - age_max must NOT be set (fixed at 65 by Meta)
 * - Optional suggestion: age_range + targeting_automation.individual_setting.age = 1
 *
 * Manual Audience: age_min / age_max remain hard constraints.
 */

import type { AllyAudienceMode } from "@/lib/meta/write/audience-mode";

export type AgeSuggestion = {
  min: number;
  max: number;
} | null;

export type WriteAgeResolve =
  | {
      ok: true;
      age_min: number | null;
      age_max: number | null;
      age_range: [number, number] | null;
      individualSettingAge: 0 | 1 | null;
      hardMinimumHuman: string | null;
      suggestionHuman: string;
      notes: string[];
    }
  | {
      ok: false;
      reason:
        | "INVALID_AGE"
        | "INVALID_HARD_AGE_MAX_ADVANTAGE"
        | "INVALID_HARD_AGE_MIN_ADVANTAGE"
        | "INVALID_AGE_SUGGESTION";
      age_min: number | null;
      age_max: number | null;
      age_range: [number, number] | null;
      individualSettingAge: null;
      hardMinimumHuman: string | null;
      suggestionHuman: string;
      notes: string[];
    };

function validAge(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= 13 && n <= 65;
}

/**
 * Resolve Meta age fields from Ally ages + audience mode.
 * Never silently invent a hard age_max under Advantage Audience.
 */
export function resolveWriteAgeFields(input: {
  allyAudienceMode: AllyAudienceMode;
  etaMin: number | null;
  etaMax: number | null;
  /** Optional preference only — never a hard ceiling under Advantage Audience. */
  ageSuggestion?: AgeSuggestion;
}): WriteAgeResolve {
  const mode = input.allyAudienceMode;
  const suggestionHuman = input.ageSuggestion
    ? `${input.ageSuggestion.min}–${input.ageSuggestion.max}`
    : "Nessuna";

  if (mode === "UNRESOLVED") {
    return {
      ok: false,
      reason: "INVALID_AGE",
      age_min: null,
      age_max: null,
      age_range: null,
      individualSettingAge: null,
      hardMinimumHuman: null,
      suggestionHuman,
      notes: [],
    };
  }

  if (mode === "MANUAL_AUDIENCE") {
    if (
      (input.etaMin != null && !validAge(input.etaMin)) ||
      (input.etaMax != null && !validAge(input.etaMax))
    ) {
      return {
        ok: false,
        reason: "INVALID_AGE",
        age_min: input.etaMin,
        age_max: input.etaMax,
        age_range: null,
        individualSettingAge: null,
        hardMinimumHuman:
          input.etaMin != null ? `${input.etaMin} — vincolo` : null,
        suggestionHuman,
        notes: [],
      };
    }
    if (
      input.etaMin != null &&
      input.etaMax != null &&
      input.etaMin > input.etaMax
    ) {
      return {
        ok: false,
        reason: "INVALID_AGE",
        age_min: input.etaMin,
        age_max: input.etaMax,
        age_range: null,
        individualSettingAge: null,
        hardMinimumHuman: `${input.etaMin} — vincolo`,
        suggestionHuman,
        notes: [],
      };
    }
    return {
      ok: true,
      age_min: input.etaMin != null ? Math.round(input.etaMin) : null,
      age_max: input.etaMax != null ? Math.round(input.etaMax) : null,
      age_range: null,
      individualSettingAge: null,
      hardMinimumHuman:
        input.etaMin != null ? `${Math.round(input.etaMin)} — vincolo` : null,
      suggestionHuman: "Nessuna",
      notes: [],
    };
  }

  // ADVANTAGE_AUDIENCE
  // Hard age_max is invalid under Meta Advantage+ Audience.
  if (input.etaMax != null) {
    return {
      ok: false,
      reason: "INVALID_HARD_AGE_MAX_ADVANTAGE",
      age_min: input.etaMin,
      age_max: input.etaMax,
      age_range: null,
      individualSettingAge: null,
      hardMinimumHuman:
        input.etaMin != null ? `${input.etaMin} — vincolo` : null,
      suggestionHuman,
      notes: [
        "Advantage+ Audience: età massima hard non consentita (Meta fissa 65).",
      ],
    };
  }

  // Hard minimum: 18–25 only; default 18 when omitted (QA / Ally write).
  let ageMin = input.etaMin;
  if (ageMin == null) ageMin = 18;
  if (!validAge(ageMin) || ageMin < 18 || ageMin > 25) {
    return {
      ok: false,
      reason: "INVALID_HARD_AGE_MIN_ADVANTAGE",
      age_min: ageMin,
      age_max: null,
      age_range: null,
      individualSettingAge: null,
      hardMinimumHuman: `${ageMin} — vincolo`,
      suggestionHuman,
      notes: [
        "Advantage+ Audience: età minima hard consentita solo tra 18 e 25.",
      ],
    };
  }

  let age_range: [number, number] | null = null;
  let individualSettingAge: 0 | 1 | null = null;
  if (input.ageSuggestion) {
    const sMin = input.ageSuggestion.min;
    const sMax = input.ageSuggestion.max;
    if (
      !validAge(sMin) ||
      !validAge(sMax) ||
      sMin > sMax ||
      sMin < ageMin
    ) {
      return {
        ok: false,
        reason: "INVALID_AGE_SUGGESTION",
        age_min: Math.round(ageMin),
        age_max: null,
        age_range: null,
        individualSettingAge: null,
        hardMinimumHuman: `${Math.round(ageMin)} — vincolo`,
        suggestionHuman,
        notes: [],
      };
    }
    age_range = [Math.round(sMin), Math.round(sMax)];
    individualSettingAge = 1;
  }

  return {
    ok: true,
    age_min: Math.round(ageMin),
    age_max: null,
    age_range,
    individualSettingAge,
    hardMinimumHuman: `${Math.round(ageMin)} — vincolo`,
    suggestionHuman: age_range
      ? `${age_range[0]}–${age_range[1]}`
      : "Nessuna",
    notes: [
      "Advantage+ Audience: età massima hard non inviata.",
      age_range
        ? "Fascia d'età inviata solo come suggerimento (age_range)."
        : "Nessun suggerimento di fascia d'età.",
    ],
  };
}

/** Apply resolved age fields onto a targeting object (mutates copy). */
export function applyAgeFieldsToTargeting(
  targeting: Record<string, unknown>,
  age: Extract<WriteAgeResolve, { ok: true }>,
): Record<string, unknown> {
  const next = { ...targeting };
  delete next.age_min;
  delete next.age_max;
  delete next.age_range;
  if (age.age_min != null) next.age_min = age.age_min;
  if (age.age_max != null) next.age_max = age.age_max;
  if (age.age_range) next.age_range = age.age_range;

  const existingAuto =
    next.targeting_automation &&
    typeof next.targeting_automation === "object"
      ? { ...(next.targeting_automation as Record<string, unknown>) }
      : {};
  if (age.individualSettingAge === 1) {
    const prevInd =
      existingAuto.individual_setting &&
      typeof existingAuto.individual_setting === "object"
        ? {
            ...(existingAuto.individual_setting as Record<string, unknown>),
          }
        : {};
    existingAuto.individual_setting = { ...prevInd, age: 1 };
    next.targeting_automation = existingAuto;
  } else if (
    existingAuto.individual_setting &&
    typeof existingAuto.individual_setting === "object"
  ) {
    const ind = {
      ...(existingAuto.individual_setting as Record<string, unknown>),
    };
    delete ind.age;
    if (Object.keys(ind).length === 0) delete existingAuto.individual_setting;
    else existingAuto.individual_setting = ind;
    next.targeting_automation = existingAuto;
  }
  return next;
}
