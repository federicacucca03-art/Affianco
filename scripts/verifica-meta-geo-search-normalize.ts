/**
 * Geo search query normalization + exact-match ranking (no live Meta).
 * LIVE META WRITES: 0 · DB WRITES: 0
 * Esegui: npx tsx scripts/verifica-meta-geo-search-normalize.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  formatGeoSearchHitLabelIt,
  normalizeGeoSearchQuery,
  prioritizeExactGeoNameMatches,
} from "../src/lib/meta/write/geo-search-normalize";
import { translateWriteTargeting } from "../src/lib/meta/write/targeting";

const root = resolve(__dirname, "..");
let falliti = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
  } else {
    console.log(`PASS  ${msg}`);
  }
}

function exists(rel: string) {
  return existsSync(join(root, rel));
}

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

assert(
  exists("src/lib/meta/write/geo-search-normalize.ts"),
  "normalize module",
);
assert(exists("src/lib/meta/write/geo-search.ts"), "geo-search module");

assert(normalizeGeoSearchQuery("Roma") === "Roma", "Roma unchanged");
assert(
  normalizeGeoSearchQuery("Roma, Lazio, Italia") === "Roma",
  "comma → primary locality",
);
assert(normalizeGeoSearchQuery("  roma  ") === "roma", "trim whitespace");
assert(
  normalizeGeoSearchQuery("roma, lazio, italia") === "roma",
  "lowercase comma form",
);
assert(
  normalizeGeoSearchQuery("Milano, Lombardia, Italia") === "Milano",
  "generic city comma form",
);
assert(normalizeGeoSearchQuery("R") === "R", "short token kept");
assert(normalizeGeoSearchQuery("  ") === "", "blank → empty");

const romanoSoup = [
  {
    key: "2875827",
    name: "Pigneto",
    type: "neighborhood",
    region: "Lazio",
    countryCode: "IT",
  },
  {
    key: "1184117",
    name: "Mazzano Romano",
    type: "city",
    region: "Lazio",
    countryCode: "IT",
  },
  {
    key: "1188733",
    name: "Roma",
    type: "city",
    region: "Lazio",
    countryCode: "IT",
  },
  {
    key: "1176795",
    name: "Carpineto Romano",
    type: "city",
    region: "Lazio",
    countryCode: "IT",
  },
];

for (const query of ["Roma", "Roma, Lazio, Italia", "roma", "  Roma  "]) {
  const q = normalizeGeoSearchQuery(query);
  const ranked = prioritizeExactGeoNameMatches(romanoSoup, q).slice(0, 12);
  assert(
    ranked[0]?.key === "1188733" && ranked[0]?.name === "Roma",
    `pipeline first for "${query}" → 1188733`,
  );
  assert(
    ranked.findIndex((h) => /romano/i.test(h.name)) >
      ranked.findIndex((h) => h.name === "Roma"),
    `Romano after exact for "${query}"`,
  );
}

{
  const ranked = prioritizeExactGeoNameMatches(romanoSoup, "Roma");
  assert(
    ranked.slice(1).map((h) => h.key).join(",") ===
      ["2875827", "1184117", "1176795"].join(","),
    "non-exact keep provider order",
  );
}

assert(
  formatGeoSearchHitLabelIt({
    key: "1188733",
    name: "Roma",
    type: "city",
    region: "Lazio",
    countryCode: "IT",
  }) === "Roma · Città · Lazio · IT",
  "canonical Rome label",
);
assert(
  formatGeoSearchHitLabelIt({
    key: "1",
    name: "Pigneto",
    type: "neighborhood",
    region: "Lazio",
    countryCode: "IT",
  }).includes("Quartiere"),
  "neighborhood labeled Quartiere",
);

{
  const t = translateWriteTargeting({
    countryCode: "IT",
    citta: "Roma",
    raggioKm: null,
    metaGeoKey: "1188733",
    etaMin: null,
    etaMax: null,
    targetType: null,
  });
  assert(t.ok === true, "targeting translate ok");
  if (t.ok) {
    const cities = (t.targeting.geo_locations as { cities?: { key: string }[] })
      ?.cities;
    assert(
      Array.isArray(cities) && cities[0]?.key === "1188733",
      "geo_locations.cities uses city key",
    );
  }
}

{
  const geo = read("src/lib/meta/write/geo-search.ts");
  assert(geo.includes("normalizeGeoSearchQuery"), "search uses normalize");
  assert(
    geo.includes("prioritizeExactGeoNameMatches"),
    "search uses exact priority",
  );
  assert(
    /prioritizeExactGeoNameMatches\([\s\S]*?\)\.slice\(0,\s*12\)/.test(geo),
    "limit after prioritization",
  );
  assert(geo.includes('location_types", JSON.stringify(["city"])'), "city types");
  assert(!/\.post\(/i.test(geo), "no POST helper in geo-search");

  const ui = read("src/components/campagne/InstantFormEasyBuilder.tsx");
  assert(ui.includes("formatGeoSearchHitLabelIt"), "Easy Builder uses labels");
  const pub = read("src/components/campagne/MetaPublishPanel.tsx");
  assert(pub.includes("formatGeoSearchHitLabelIt"), "Publish panel uses labels");
}

if (falliti > 0) {
  console.error(`\n=== GEO NORMALIZE: ${falliti} FAIL ===`);
  process.exit(1);
}
console.log("\n=== GEO NORMALIZE: TUTTI I CHECK PASS ===");
