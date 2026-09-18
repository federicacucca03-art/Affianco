/**
 * M10D — Conservative targeting / placement normalization.
 * Never invent "Broad" or "Automatic" without evidence.
 */

import type {
  MetaAudienceSummary,
  MetaPlacementMode,
  MetaPlacementSummary,
  MetaTargetingSummaryStored,
} from "@/lib/meta/configuration/types";

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => asText(x))
    .filter((x): x is string => x != null);
}

function countNamedOrIdList(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  return value.length;
}

function geographyLabel(geo: unknown): string | null {
  if (!geo || typeof geo !== "object") return null;
  const g = geo as Record<string, unknown>;
  const countries = asStringArray(g.countries);
  const cities = Array.isArray(g.cities)
    ? g.cities
        .map((c) =>
          c && typeof c === "object"
            ? asText((c as { name?: unknown }).name)
            : null,
        )
        .filter((x): x is string => x != null)
    : [];
  const regions = Array.isArray(g.regions)
    ? g.regions
        .map((c) =>
          c && typeof c === "object"
            ? asText((c as { name?: unknown }).name)
            : null,
        )
        .filter((x): x is string => x != null)
    : [];
  const parts = [...cities, ...regions, ...countries];
  if (parts.length === 0) return null;
  return parts.slice(0, 4).join(", ");
}

function gendersLabel(genders: unknown): string | null {
  if (!Array.isArray(genders) || genders.length === 0) return null;
  const set = new Set(
    genders
      .map((g) => asNum(g))
      .filter((n): n is number => n != null),
  );
  if (set.size === 0) return null;
  if (set.has(1) && set.has(2)) return "Tutti i generi";
  if (set.has(1) && set.size === 1) return "Uomini";
  if (set.has(2) && set.size === 1) return "Donne";
  return "Generi configurati";
}

function hasFlexibleDetail(flexible: unknown): boolean | null {
  if (flexible == null) return null;
  if (!Array.isArray(flexible)) return null;
  if (flexible.length === 0) return false;
  return true;
}

/**
 * Placement mode rule (documented + tested):
 * - If any explicit position array is non-empty → MANUAL
 * - If targeting was returned AND publisher_platforms is absent/empty
 *   AND all position arrays empty → AUTOMATIC (Meta default distribution)
 * - If targeting object missing → UNAVAILABLE
 * - Otherwise UNKNOWN
 */
export function resolvePlacementMode(input: {
  targetingReturned: boolean;
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
  messengerPositions: string[];
  audienceNetworkPositions: string[];
}): MetaPlacementMode {
  if (!input.targetingReturned) return "UNAVAILABLE";
  const manual =
    input.facebookPositions.length > 0 ||
    input.instagramPositions.length > 0 ||
    input.messengerPositions.length > 0 ||
    input.audienceNetworkPositions.length > 0;
  if (manual) return "MANUAL";
  if (
    input.publisherPlatforms.length === 0 &&
    !manual
  ) {
    return "AUTOMATIC";
  }
  if (input.publisherPlatforms.length > 0 && !manual) {
    // Platforms constrained without position lists — still a restriction.
    return "MANUAL";
  }
  return "UNKNOWN";
}

export function normalizeTargetingSummary(
  targeting: unknown,
): MetaTargetingSummaryStored {
  if (targeting == null || typeof targeting !== "object") {
    return {
      targetingReturned: false,
      audience: {
        geographyLabel: null,
        ageMin: null,
        ageMax: null,
        gendersLabel: null,
        customAudienceCount: null,
        excludedCustomAudienceCount: null,
        hasDetailedTargeting: null,
        detailAvailable: false,
      },
      placements: {
        mode: "UNAVAILABLE",
        publisherPlatforms: [],
        facebookPositions: [],
        instagramPositions: [],
        messengerPositions: [],
        audienceNetworkPositions: [],
        devicePlatforms: [],
      },
    };
  }

  const t = targeting as Record<string, unknown>;
  const publisherPlatforms = asStringArray(t.publisher_platforms);
  const facebookPositions = asStringArray(t.facebook_positions);
  const instagramPositions = asStringArray(t.instagram_positions);
  const messengerPositions = asStringArray(t.messenger_positions);
  const audienceNetworkPositions = asStringArray(
    t.audience_network_positions,
  );
  const devicePlatforms = asStringArray(t.device_platforms);

  const audience: MetaAudienceSummary = {
    geographyLabel: geographyLabel(t.geo_locations),
    ageMin: asNum(t.age_min),
    ageMax: asNum(t.age_max),
    gendersLabel: gendersLabel(t.genders),
    customAudienceCount: countNamedOrIdList(t.custom_audiences),
    excludedCustomAudienceCount: countNamedOrIdList(
      t.excluded_custom_audiences,
    ),
    hasDetailedTargeting: hasFlexibleDetail(t.flexible_spec),
    detailAvailable: true,
  };

  const placements: MetaPlacementSummary = {
    mode: resolvePlacementMode({
      targetingReturned: true,
      publisherPlatforms,
      facebookPositions,
      instagramPositions,
      messengerPositions,
      audienceNetworkPositions,
    }),
    publisherPlatforms,
    facebookPositions,
    instagramPositions,
    messengerPositions,
    audienceNetworkPositions,
    devicePlatforms,
  };

  return { targetingReturned: true, audience, placements };
}

/** Presentation-only country codes → Italian labels (stored summary unchanged). */
const GEO_DISPLAY: Record<string, string> = {
  IT: "Italia",
  US: "Stati Uniti",
  GB: "Regno Unito",
  DE: "Germania",
  FR: "Francia",
  ES: "Spagna",
  CH: "Svizzera",
  AT: "Austria",
};

function displayGeographyLabel(raw: string): string {
  return raw
    .split(/\s*,\s*/)
    .map((part) => GEO_DISPLAY[part.trim().toUpperCase()] ?? part.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Meta Marketing API: age_max maxes at 65 and Ads Manager shows that top
 * bucket as 65+. age_max=65 therefore displays as 65+ (not "up to 65 only").
 */
export function formatAudienceAgeRange(
  ageMin: number | null,
  ageMax: number | null,
): string | null {
  if (ageMin == null && ageMax == null) return null;
  const min = ageMin != null ? String(ageMin) : "?";
  const max =
    ageMax != null ? (ageMax >= 65 ? "65+" : String(ageMax)) : "?";
  return `${min}–${max}`;
}

export function audienceBeginnerLabel(a: MetaAudienceSummary): string {
  if (!a.detailAvailable) return "Dettaglio pubblico non disponibile";
  const parts: string[] = [];
  if (a.geographyLabel) parts.push(displayGeographyLabel(a.geographyLabel));
  const age = formatAudienceAgeRange(a.ageMin, a.ageMax);
  if (age) parts.push(age);
  if (a.gendersLabel) parts.push(a.gendersLabel);
  if (parts.length === 0) return "Dettaglio pubblico non disponibile";
  return parts.join(" · ");
}
