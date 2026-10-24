/**
 * Pure geo-search helpers (no I/O). Safe for client UI + unit verifica.
 * Never invent Meta keys — only reshape queries / rank provider hits.
 */

export type GeoSearchHitLike = {
  key: string;
  name: string;
  type: string | null;
  countryCode: string | null;
  region: string | null;
};

/**
 * Primary locality for Meta adgeolocation.
 * "Roma, Lazio, Italia" → "Roma"; "  roma  " → "roma"; leaves short tokens alone.
 */
export function normalizeGeoSearchQuery(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const primary = trimmed.split(",")[0]?.trim() ?? "";
  return primary || trimmed;
}

function foldName(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Exact name match against the normalized query (case/diacritic insensitive). */
export function isExactGeoNameMatch(
  hitName: string,
  normalizedQuery: string,
): boolean {
  const q = foldName(normalizedQuery);
  const n = foldName(hitName);
  if (!q || !n) return false;
  return n === q;
}

/**
 * Move exact name matches to the front; preserve relative order within each group.
 * Does not alphabetically sort. Does not invent hits.
 */
export function prioritizeExactGeoNameMatches<T extends GeoSearchHitLike>(
  hits: readonly T[],
  normalizedQuery: string,
): T[] {
  const q = foldName(normalizedQuery);
  if (!q || hits.length === 0) return [...hits];
  const exact: T[] = [];
  const rest: T[] = [];
  for (const h of hits) {
    if (isExactGeoNameMatch(h.name, normalizedQuery)) exact.push(h);
    else rest.push(h);
  }
  return exact.length === 0 ? [...hits] : [...exact, ...rest];
}

export function labelGeoTypeIt(type: string | null | undefined): string | null {
  const t = (type ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "city") return "Città";
  if (t === "neighborhood" || t === "subcity" || t === "subneighborhood") {
    return "Quartiere";
  }
  if (t === "region") return "Regione";
  if (t === "country") return "Paese";
  if (t === "zip" || t === "zip_code") return "CAP";
  if (t === "geo_market") return "Mercato";
  if (t === "electoral_district") return "Distretto";
  // Keep provider token readable rather than inventing Italian for rare types.
  return type!.trim();
}

/** UI label: Roma · Città · Lazio · IT */
export function formatGeoSearchHitLabelIt(hit: GeoSearchHitLike): string {
  const typeIt = labelGeoTypeIt(hit.type);
  return [hit.name, typeIt, hit.region, hit.countryCode]
    .filter((p) => typeof p === "string" && p.trim())
    .join(" · ");
}
