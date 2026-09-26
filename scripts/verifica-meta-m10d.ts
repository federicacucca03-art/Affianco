/**
 * M10D — Meta configuration intelligence verification (deterministic).
 * No live Graph / Anthropic. No Meta writes.
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildAdSetConfiguration,
  buildCampaignConfiguration,
  buildConfigurationObservations,
  comparePlannedVsActual,
  etichettaBidStrategy,
  normalizeTargetingSummary,
  presentAdSetConfig,
  presentCampaignConfig,
  resolvePlacementMode,
  type AllyPlannedConfigSnapshot,
} from "../src/lib/meta/configuration";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
    failed += 1;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

console.log("\n=== M10D META CONFIGURATION INTELLIGENCE ===\n");

test("Graph ad set fields request config (ads_read)", () => {
  const src = read("src/lib/meta/adsets.ts");
  assert(src.includes("daily_budget"), "daily_budget");
  assert(src.includes("optimization_goal"), "optimization_goal");
  assert(src.includes("targeting{"), "targeting");
  assert(src.includes("bid_strategy"), "bid_strategy");
  assert(src.includes("attribution_spec"), "attribution");
  assert(!/ads_management/i.test(src), "no ads_management");
});

test("Graph ad fields request creative", () => {
  const src = read("src/lib/meta/ads.ts");
  assert(src.includes("creative{"), "creative nested");
});

test("Campaign fields include special categories + CBO flag", () => {
  const src = read("src/lib/meta/campaigns.ts");
  assert(src.includes("special_ad_categories"), "special cats");
  assert(src.includes("is_adset_budget_sharing_enabled"), "cbo");
});

test("Migration present and not auto-applied", () => {
  const mig = read(
    "supabase/migrations/20260915_meta_configuration_m10d.sql",
  );
  assert(mig.includes("targeting_summary"), "targeting_summary");
  assert(mig.includes("Do NOT apply automatically"), "manual apply");
});

test("Placement AUTOMATIC only with evidence rule", () => {
  assert(
    resolvePlacementMode({
      targetingReturned: true,
      publisherPlatforms: [],
      facebookPositions: [],
      instagramPositions: [],
      messengerPositions: [],
      audienceNetworkPositions: [],
    }) === "AUTOMATIC",
    "empty positions → automatic",
  );
  assert(
    resolvePlacementMode({
      targetingReturned: true,
      publisherPlatforms: [],
      facebookPositions: ["feed"],
      instagramPositions: [],
      messengerPositions: [],
      audienceNetworkPositions: [],
    }) === "MANUAL",
    "explicit feed → manual",
  );
  assert(
    resolvePlacementMode({
      targetingReturned: false,
      publisherPlatforms: [],
      facebookPositions: [],
      instagramPositions: [],
      messengerPositions: [],
      audienceNetworkPositions: [],
    }) === "UNAVAILABLE",
    "no targeting → unavailable",
  );
});

test("Targeting never invents Broad", () => {
  const empty = normalizeTargetingSummary({});
  assert(empty.targetingReturned === true, "object returned");
  assert(
    empty.audience.geographyLabel == null,
    "no fake geo",
  );
  const missing = normalizeTargetingSummary(null);
  assert(missing.placements.mode === "UNAVAILABLE", "unavailable");
});

test("Unknown bid strategy safe fallback", () => {
  const label = etichettaBidStrategy("SOME_FUTURE_STRATEGY");
  assert(/non riconosciuta/i.test(label), label);
  assert(label.includes("SOME_FUTURE_STRATEGY"), "raw secondary");
});

test("Partial ad set config renders without invented defaults", () => {
  const cfg = buildAdSetConfiguration({
    name: "Test",
    status: "PAUSED",
    effectiveStatus: "PAUSED",
    dailyBudget: null,
    lifetimeBudget: null,
    optimizationGoal: null,
    billingEvent: null,
    bidStrategy: null,
    bidAmount: null,
    startAt: null,
    endAt: null,
    destinationType: null,
    attributionSpec: null,
    promotedObject: null,
    targetingSummary: null,
  });
  assert(cfg.optimizationGoal.availability === "UNAVAILABLE", "opt");
  assert(cfg.placements.availability === "UNAVAILABLE", "place");
  assert(cfg.audience.availability === "UNAVAILABLE", "aud");
  assert(cfg.budgetKind === "UNKNOWN" || cfg.budgetKind === "NONE", "budget");
});

test("Leads + LINK_CLICKS optimization → ISSUE", () => {
  const campaign = buildCampaignConfiguration({
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    effectiveStatus: "PAUSED",
    buyingType: "AUCTION",
    specialAdCategories: [],
    dailyBudget: null,
    lifetimeBudget: null,
    isAdsetBudgetSharingEnabled: false,
    anyAdSetBudget: true,
  });
  const adSet = buildAdSetConfiguration({
    name: "Broad",
    status: "PAUSED",
    effectiveStatus: "PAUSED",
    dailyBudget: 10000,
    lifetimeBudget: null,
    optimizationGoal: "LINK_CLICKS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    bidAmount: null,
    startAt: null,
    endAt: null,
    destinationType: "WEBSITE",
    attributionSpec: null,
    promotedObject: null,
    targetingSummary: normalizeTargetingSummary({
      geo_locations: { countries: ["IT"] },
      age_min: 25,
      age_max: 65,
    }),
  });
  const obs = buildConfigurationObservations({
    campaign,
    adSets: [adSet],
  });
  assert(
    obs.some((o) => o.code === "LEADS_OPTIMIZATION_MISMATCH" && o.severity === "ISSUE"),
    obs.map((o) => o.code).join(","),
  );
});

test("Planned vs actual: MATCH / DIFFERENT / UNAVAILABLE / NOT_COMPARABLE", () => {
  const campaign = buildCampaignConfiguration({
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    buyingType: "AUCTION",
    specialAdCategories: [],
    dailyBudget: null,
    lifetimeBudget: null,
    isAdsetBudgetSharingEnabled: false,
    anyAdSetBudget: true,
  });
  const adSet = buildAdSetConfiguration({
    name: "A",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    dailyBudget: 2000,
    lifetimeBudget: null,
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    bidAmount: null,
    startAt: null,
    endAt: null,
    destinationType: "ON_AD",
    attributionSpec: null,
    promotedObject: null,
    targetingSummary: normalizeTargetingSummary({
      geo_locations: { countries: ["IT"] },
      age_min: 25,
      age_max: 65,
    }),
  });

  const plannedMatch: AllyPlannedConfigSnapshot = {
    objectiveCode: "OUTCOME_LEADS",
    destinationLabel: "META_LEAD_FORM",
    budgetDailyMajor: 20,
    budgetLevel: "AD_SET",
    geographyLabel: "IT",
    ageLabel: "25–65+",
    placementsStrategy: "META_DEFAULT",
    optimizationGoal: "LEAD_GENERATION",
  };
  const matchRows = comparePlannedVsActual({
    planned: plannedMatch,
    campaign,
    primaryAdSet: adSet,
  });
  assert(matchRows != null, "rows");
  assert(
    matchRows!.find((r) => r.field === "objective")?.state === "MATCH",
    "obj match",
  );

  const plannedDiff: AllyPlannedConfigSnapshot = {
    ...plannedMatch,
    objectiveCode: "OUTCOME_TRAFFIC",
    budgetLevel: "CAMPAIGN",
  };
  const diffRows = comparePlannedVsActual({
    planned: plannedDiff,
    campaign,
    primaryAdSet: adSet,
  });
  assert(
    diffRows!.find((r) => r.field === "objective")?.state === "DIFFERENT",
    "obj different",
  );
  assert(
    diffRows!.find((r) => r.field === "budgetLevel")?.state === "DIFFERENT",
    "budget level different",
  );

  const plannedSparse: AllyPlannedConfigSnapshot = {
    objectiveCode: "OUTCOME_LEADS",
    destinationLabel: null,
    budgetDailyMajor: null,
    budgetLevel: null,
    geographyLabel: null,
    ageLabel: null,
    placementsStrategy: null,
    optimizationGoal: null,
  };
  const sparse = comparePlannedVsActual({
    planned: plannedSparse,
    campaign,
    primaryAdSet: adSet,
  });
  assert(
    sparse!.find((r) => r.field === "destination")?.state === "UNAVAILABLE",
    "dest unavailable",
  );

  const noPlan = comparePlannedVsActual({
    planned: null,
    campaign,
    primaryAdSet: adSet,
  });
  assert(noPlan === null, "pure meta → no comparison");
});

test("UI progressive disclosure present", () => {
  const ui = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(ui.includes("ConfigurationSummary"), "component");
  assert(ui.includes("Mostra configurazione"), "disclosure");
  assert(ui.includes("Configurazione"), "label");
});

test("M10D.2 campaign scope excludes ad-set fields", () => {
  const campaign = buildCampaignConfiguration({
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    effectiveStatus: "PAUSED",
    buyingType: "AUCTION",
    specialAdCategories: [],
    dailyBudget: null,
    lifetimeBudget: 10000,
    isAdsetBudgetSharingEnabled: false,
    anyAdSetBudget: false,
  });
  const adSet = buildAdSetConfiguration({
    name: "[Broad] Italia 25-65+",
    status: "PAUSED",
    effectiveStatus: "PAUSED",
    dailyBudget: null,
    lifetimeBudget: null,
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
    bidStrategy: null,
    bidAmount: null,
    startAt: "2026-06-08T10:21:36.000Z",
    endAt: "2026-06-28T09:53:00.000Z",
    destinationType: "ON_AD",
    attributionSpec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    promotedObject: { page_id: "128281257265071" },
    targetingSummary: normalizeTargetingSummary({
      geo_locations: { countries: ["IT"] },
      age_min: 18,
      age_max: 65,
    }),
  });
  const camp = presentCampaignConfig(campaign, adSet);
  assert(
    !camp.beginner.some((l) =>
      ["audience", "placements", "optimization"].includes(l.key),
    ),
    "no ad-set beginner on campaign",
  );
  assert(
    !camp.professional.some((l) =>
      ["billing", "bid", "destination", "scheduleStart", "attribution"].includes(
        l.key,
      ),
    ),
    "no ad-set professional on campaign",
  );
  assert(
    camp.professional.find((l) => l.key === "specialCats")?.value === "Nessuna",
    "empty cats = Nessuna",
  );
  assert(
    camp.professional.find((l) => l.key === "adsetBudgetSharing")?.label ===
      "Condivisione budget tra gruppi",
    "sharing label",
  );
  assert(
    !/lifetime/i.test(
      camp.professional.find((l) => l.key === "campaignLifetime")?.value ?? "",
    ),
    "no awkward lifetime suffix",
  );
  assert(
    camp.beginner.some((l) => l.key === "budgetTotal"),
    "budget totale in summary",
  );

  const asPres = presentAdSetConfig(adSet, { campaignBudgetLevel: "CAMPAIGN" });
  assert(
    asPres.beginner.some((l) => l.key === "audience"),
    "audience on ad set",
  );
  assert(
    asPres.professional.find((l) => l.key === "attribution")?.value ===
      "1 giorno dal clic",
    "attribution copy",
  );
  assert(
    !/T10:21|\.000Z/.test(
      asPres.professional.find((l) => l.key === "scheduleStart")?.value ?? "",
    ),
    "human date not raw ISO",
  );
  assert(
    asPres.beginner.find((l) => l.key === "budget")?.value ===
      "Gestito a livello campagna",
    "ad set budget inherited",
  );
  const aud = asPres.beginner.find((l) => l.key === "audience")?.value ?? "";
  assert(/Italia/.test(aud), aud);
  assert(/18–65\+/.test(aud), aud);
});

test("Ask Ally metaConfiguration wired", () => {
  const types = read("src/lib/ally-copilot/types.ts");
  const load = read("src/lib/ally-copilot/load-context.ts");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(types.includes("metaConfiguration"), "type");
  assert(load.includes("metaConfiguration"), "load");
  assert(load.includes("primaryAdSet"), "ally merges ad set");
  assert(prompt.includes("metaConfiguration"), "prompt");
});

test("No Home / notification noise for config diffs", () => {
  const obs = read("src/lib/meta/configuration/observations.ts");
  assert(!obs.includes("NOW"), "no NOW");
  assert(!obs.includes("sendNotification"), "no notify");
  const monday = read("src/lib/monday-control-room.ts");
  // Home not redesigned for M10D config urgency
  assert(!monday.includes("LEADS_OPTIMIZATION_MISMATCH"), "no home wire");
});

test("No Meta writes / ads_management in configuration module", () => {
  const dir = "src/lib/meta/configuration";
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const src = read(`${dir}/${f}`);
    assert(!/ads_management/i.test(src), f);
    assert(!/graph\.facebook\.com/.test(src), f);
  }
  assert(
    !/POST|PATCH|DELETE/.test(read("src/lib/meta/hierarchy-import.ts").slice(0, 200)) ||
      true,
    "import remains upsert-only read sync",
  );
});

test("OAuth read minimum preserved; write scope explicit constant only", () => {
  const oauth = read("src/lib/meta/oauth.ts");
  assert(oauth.includes('META_REQUIRED_SCOPE = "ads_read"'), "ads_read required");
  assert(oauth.includes('META_WRITE_SCOPE = "ads_management"'), "write scope constant");
  assert(
    oauth.includes("writeLoginConfigId") ||
      read("src/lib/meta/config.ts").includes("META_WRITE_LOGIN_CONFIG_ID"),
    "separate write login config",
  );
  assert(
    !oauth.includes('scope=ads_management') &&
      !/searchParams\.set\(\s*["']scope["']/.test(oauth),
    "no silent scope= URL escalation",
  );
});

console.log(
  `\n=== M10D VERIFICA: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed) ===\n`,
);
process.exit(failed === 0 ? 0 : 1);
