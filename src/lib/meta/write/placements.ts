/**
 * M11A.1 — Placement contract. No hidden empty-array "automatic" fakes.
 */

export type PlacementResolve =
  | {
      ok: true;
      mode: "ADVANTAGE_PLUS";
      note: string;
      /** No publisher_platforms array invented. */
      targetingPlacementFields: null;
    }
  | {
      ok: false;
      reason: "PLACEMENTS_UNRESOLVED" | "MANUAL_UNSUPPORTED";
    };

export function resolveWritePlacements(input: {
  placementsAdvantage: boolean | null;
}): PlacementResolve {
  if (input.placementsAdvantage === true) {
    return {
      ok: true,
      mode: "ADVANTAGE_PLUS",
      note: "Distribuzione Advantage+/automatica — senza array di placement inventati.",
      targetingPlacementFields: null,
    };
  }
  if (input.placementsAdvantage === false) {
    return { ok: false, reason: "MANUAL_UNSUPPORTED" };
  }
  return { ok: false, reason: "PLACEMENTS_UNRESOLVED" };
}
