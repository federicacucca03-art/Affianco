/**
 * M11A.1 — Targeting translator (geo).
 * Age fields applied separately via age-model (Advantage vs Manual).
 * Never invent interests. Never map B2B/B2C to Meta targeting.
 * City text without Meta geo key → MISSING_GEO_RESOLUTION.
 */

export type TargetingResolve =
  | {
      ok: true;
      targeting: Record<string, unknown>;
      notes: string[];
    }
  | {
      ok: false;
      reason: "MISSING_GEO" | "MISSING_GEO_RESOLUTION" | "INVALID_AGE";
    };

export function translateWriteTargeting(input: {
  countryCode: string | null;
  citta: string | null;
  raggioKm: number | null;
  metaGeoKey: string | null;
  etaMin: number | null;
  etaMax: number | null;
  targetType: string | null;
}): TargetingResolve {
  void input.targetType;
  // Age is resolved by resolveWriteAgeFields (Advantage vs Manual).
  void input.etaMin;
  void input.etaMax;

  const country = (input.countryCode ?? "").trim().toUpperCase();
  const city = (input.citta ?? "").trim();
  const geoKey = (input.metaGeoKey ?? "").trim();

  if (city && !geoKey) {
    return { ok: false, reason: "MISSING_GEO_RESOLUTION" };
  }

  if (!country && !geoKey) {
    return { ok: false, reason: "MISSING_GEO" };
  }

  const geo_locations: Record<string, unknown> = {};
  if (geoKey) {
    geo_locations.cities = [
      {
        key: geoKey,
        ...(input.raggioKm != null && input.raggioKm > 0
          ? { radius: input.raggioKm, distance_unit: "kilometer" }
          : {}),
      },
    ];
  } else if (country) {
    geo_locations.countries = [country];
  }

  const targeting: Record<string, unknown> = {
    geo_locations,
  };

  const notes: string[] = [];
  if (input.targetType) {
    notes.push(
      "Tipo cliente (B2B/B2C) resta etichetta Ally — non diventa targeting Meta.",
    );
  }

  return { ok: true, targeting, notes };
}
