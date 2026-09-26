/**
 * M11A.2 — Meta geo targeting search (adgeolocation).
 * Never invent keys. User must pick a returned result.
 */

import "server-only";
import { getMetaServerConfig } from "@/lib/meta/config";
import { graphApiBase } from "@/lib/meta/graph";
import { MetaError } from "@/lib/meta/errors";

export type MetaGeoSearchHit = {
  key: string;
  name: string;
  type: string | null;
  countryCode: string | null;
  region: string | null;
};

export type MetaGeoSearchTransport = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: unknown;
}>;

async function defaultTransport(url: string): Promise<{
  ok: boolean;
  status: number;
  json: unknown;
}> {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * Search Meta targeting locations. Requires a valid user access token
 * (ads_read is sufficient for Targeting Search).
 */
export async function searchMetaGeoLocations(input: {
  accessToken: string;
  query: string;
  countryCode?: string | null;
  transport?: MetaGeoSearchTransport;
}): Promise<MetaGeoSearchHit[]> {
  const q = input.query.trim();
  if (q.length < 2) return [];

  const config = getMetaServerConfig();
  const url = new URL(graphApiBase(config.graphApiVersion, "search"));
  url.searchParams.set("type", "adgeolocation");
  url.searchParams.set("location_types", JSON.stringify(["city"]));
  url.searchParams.set("q", q);
  const country = (input.countryCode ?? "").trim().toUpperCase();
  if (country) url.searchParams.set("country_code", country);
  url.searchParams.set("access_token", input.accessToken);

  const transport = input.transport ?? defaultTransport;
  const res = await transport(url.toString());
  if (!res.ok) {
    throw new MetaError(
      "META_ACCOUNT_DISCOVERY_FAILED",
      "Ricerca zona Meta non riuscita.",
    );
  }
  const data = (res.json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  const hits: MetaGeoSearchHit[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!key || !name) continue;
    hits.push({
      key,
      name,
      type: typeof r.type === "string" ? r.type : null,
      countryCode:
        typeof r.country_code === "string" ? r.country_code : null,
      region: typeof r.region === "string" ? r.region : null,
    });
  }
  return hits.slice(0, 12);
}
