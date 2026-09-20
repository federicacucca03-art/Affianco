/**
 * M11A.1 — Targeting translator.
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
  void input.targetType; // intentional: business label must not become targeting

  const ageMin = input.etaMin;
  const ageMax = input.etaMax;
  if (
    (ageMin != null && (!Number.isFinite(ageMin) || ageMin < 13 || ageMin > 65)) ||
    (ageMax != null && (!Number.isFinite(ageMax) || ageMax < 13 || ageMax > 65))
  ) {
    return { ok: false, reason: "INVALID_AGE" };
  }
  if (ageMin != null && ageMax != null && ageMin > ageMax) {
    return { ok: false, reason: "INVALID_AGE" };
  }

  const country = (input.countryCode ?? "").trim().toUpperCase();
  const city = (input.citta ?? "").trim();
  const geoKey = (input.metaGeoKey ?? "").trim();

  if (city && !geoKey) {
    // Have a city label but no Meta key — do not invent.
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
  if (ageMin != null) targeting.age_min = Math.round(ageMin);
  if (ageMax != null) targeting.age_max = Math.round(ageMax);

  const notes: string[] = [];
  if (input.targetType) {
    notes.push(
      "Tipo cliente (B2B/B2C) resta etichetta Ally — non diventa targeting Meta.",
    );
  }

  return { ok: true, targeting, notes };
}
