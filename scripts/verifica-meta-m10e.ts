/**
 * M10E — Tracking health verification (deterministic).
 * No live Graph / Anthropic. No Meta writes.
 */

import fs from "node:fs";
import path from "node:path";
import { buildTrackingHealth } from "../src/lib/meta/tracking-health";

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

console.log("\n=== M10E TRACKING HEALTH ===\n");

test("Native lead Technon-like: no Pixel required; ambiguity separate", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    promotedObject: { page_id: "128281257265071", smart_pse_enabled: false },
    attributionSpec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    observedActionTypes: ["lead", "onsite_conversion.lead_grouped"],
    hasPurchaseValue: false,
    resultMappingConfidence: "AMBIGUOUS",
    primaryResultType: null,
    spend: 99.97,
    impressions: 5000,
    linkClicks: 100,
    landingPageViews: null,
  });
  assert(h.status === "AMBIGUOUS", `status=${h.status}`);
  assert(h.reliability === "PARZIALE", h.reliability);
  assert(h.performanceConfidence === "LIMITED", h.performanceConfidence);
  assert(
    !/pixel mancante|install pixel|tracking rotto/i.test(h.beginnerSummary),
    h.beginnerSummary,
  );
  assert(
    h.signals.some((s) => s.code === "DESTINATION_NATIVE_META"),
    "native dest",
  );
  assert(
    h.signals.some((s) => s.code === "RESULT_MAPPING_AMBIGUOUS"),
    "ambiguous signal",
  );
  assert(
    !h.issues.some((i) => /pixel/i.test(i.title) && i.severity === "ISSUE"),
    "no pixel ISSUE",
  );
  assert(h.pixelVisibility === "UNAVAILABLE", h.pixelVisibility);
});

test("Website Sales healthy: purchase + value", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_SALES",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    promotedObject: { pixel_id: "123" },
    attributionSpec: [{ event_type: "CLICK_THROUGH", window_days: 7 }],
    observedActionTypes: ["purchase", "offsite_conversion.fb_pixel_purchase"],
    hasPurchaseValue: true,
    resultMappingConfidence: "CONFIDENT",
    primaryResultType: "purchase",
    spend: 200,
    impressions: 10000,
    linkClicks: 50,
    landingPageViews: 40,
  });
  assert(h.status === "HEALTHY", h.status);
  assert(h.reliability === "AFFIDABILE", h.reliability);
  assert(h.performanceConfidence === "FULL", h.performanceConfidence);
  assert(h.signals.some((s) => s.code === "PURCHASE_EVENT_PRESENT"), "purchase");
  assert(h.signals.some((s) => s.code === "PURCHASE_VALUE_PRESENT"), "value");
});

test("Website Sales unknown: no purchase evidence", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_SALES",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    promotedObject: null,
    attributionSpec: null,
    observedActionTypes: [],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: 150,
    impressions: 8000,
    linkClicks: 30,
    landingPageViews: 20,
  });
  assert(
    h.status === "CONFIGURATION_REQUIRED" || h.status === "PARTIAL",
    h.status,
  );
  assert(h.performanceConfidence === "BLOCKED", h.performanceConfidence);
  assert(
    !/campaign failing|falliment|performance pessima/i.test(h.beginnerSummary),
    h.beginnerSummary,
  );
});

test("Native lead form fixture: no Pixel requirement", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    promotedObject: { page_id: "999" },
    attributionSpec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    observedActionTypes: ["lead"],
    hasPurchaseValue: false,
    resultMappingConfidence: "CONFIDENT",
    primaryResultType: "lead",
    spend: 50,
    impressions: 2000,
    linkClicks: null,
    landingPageViews: null,
  });
  assert(h.status === "HEALTHY", h.status);
  assert(h.reliability === "AFFIDABILE", h.reliability);
  assert(!/Pixel/i.test(h.beginnerSummary), h.beginnerSummary);
});

test("Traffic LPV vs link-click only", () => {
  const lpv = buildTrackingHealth({
    objective: "OUTCOME_TRAFFIC",
    optimizationGoal: "LANDING_PAGE_VIEWS",
    destinationType: "WEBSITE",
    promotedObject: null,
    attributionSpec: null,
    observedActionTypes: ["landing_page_view", "link_click"],
    hasPurchaseValue: false,
    resultMappingConfidence: "CONFIDENT",
    primaryResultType: "landing_page_view",
    spend: 40,
    impressions: 3000,
    linkClicks: 80,
    landingPageViews: 60,
  });
  assert(lpv.status === "HEALTHY", lpv.status);
  assert(lpv.signals.some((s) => s.code === "LPV_SIGNAL_PRESENT"), "lpv");

  const clicks = buildTrackingHealth({
    objective: "OUTCOME_TRAFFIC",
    optimizationGoal: "LINK_CLICKS",
    destinationType: "WEBSITE",
    promotedObject: null,
    attributionSpec: null,
    observedActionTypes: ["link_click"],
    hasPurchaseValue: false,
    resultMappingConfidence: "CONFIDENT",
    primaryResultType: "link_click",
    spend: 40,
    impressions: 3000,
    linkClicks: 80,
    landingPageViews: null,
  });
  assert(clicks.status === "PARTIAL", clicks.status);
  assert(clicks.signals.some((s) => s.code === "LINK_CLICK_ONLY"), "link only");
  assert(
    clicks.issues.some((i) => i.code === "TRAFFIC_LINK_CLICK_NOT_LPV"),
    "not lpv issue",
  );
});

test("Awareness: delivery sufficient; no conversion demand", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_AWARENESS",
    optimizationGoal: "REACH",
    destinationType: "ON_AD",
    promotedObject: { page_id: "1" },
    attributionSpec: null,
    observedActionTypes: [],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: 30,
    impressions: 20000,
    linkClicks: null,
    landingPageViews: null,
  });
  assert(h.status === "HEALTHY", h.status);
  assert(h.performanceConfidence === "FULL", h.performanceConfidence);
  assert(
    !/Pixel missing|tracking broken|purchase/i.test(h.beginnerSummary),
    h.beginnerSummary,
  );
});

test("Unknown objective: neutral, no invented requirements", () => {
  const h = buildTrackingHealth({
    objective: null,
    optimizationGoal: null,
    destinationType: null,
    promotedObject: null,
    attributionSpec: null,
    observedActionTypes: [],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: null,
    impressions: null,
    linkClicks: null,
    landingPageViews: null,
  });
  assert(h.status === "UNKNOWN", h.status);
  assert(h.reliability === "NON_VERIFICABILE", h.reliability);
  assert(
    !/Purchase event missing|Install Pixel|No leads tracked/i.test(
      h.beginnerSummary,
    ),
    h.beginnerSummary,
  );
});

test("Delivery alone ≠ tracking healthy for Sales", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_SALES",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    promotedObject: { pixel_id: "1" },
    attributionSpec: null,
    observedActionTypes: [],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: 100,
    impressions: 5000,
    linkClicks: 10,
    landingPageViews: 5,
  });
  assert(h.status !== "HEALTHY", h.status);
  assert(h.performanceConfidence !== "FULL", h.performanceConfidence);
});

test("Cross-objective copy leakage scan", () => {
  const cases = [
    buildTrackingHealth({
      objective: "OUTCOME_AWARENESS",
      optimizationGoal: "REACH",
      destinationType: "ON_AD",
      promotedObject: null,
      attributionSpec: null,
      observedActionTypes: [],
      hasPurchaseValue: false,
      resultMappingConfidence: "UNKNOWN",
      primaryResultType: null,
      spend: 10,
      impressions: 1000,
      linkClicks: null,
      landingPageViews: null,
    }),
    buildTrackingHealth({
      objective: "OUTCOME_LEADS",
      optimizationGoal: "LEAD_GENERATION",
      destinationType: "ON_AD",
      promotedObject: { page_id: "1" },
      attributionSpec: null,
      observedActionTypes: ["lead"],
      hasPurchaseValue: false,
      resultMappingConfidence: "CONFIDENT",
      primaryResultType: "lead",
      spend: 10,
      impressions: 1000,
      linkClicks: null,
      landingPageViews: null,
    }),
    buildTrackingHealth({
      objective: "OUTCOME_TRAFFIC",
      optimizationGoal: "LINK_CLICKS",
      destinationType: "WEBSITE",
      promotedObject: null,
      attributionSpec: null,
      observedActionTypes: ["link_click"],
      hasPurchaseValue: false,
      resultMappingConfidence: "CONFIDENT",
      primaryResultType: "link_click",
      spend: 10,
      impressions: 1000,
      linkClicks: 20,
      landingPageViews: null,
    }),
  ];
  const blob = cases.map((c) => c.beginnerSummary + c.issues.map((i) => i.title + i.explanation).join("")).join("\n");
  assert(!/Pixel missing — tracking broken/i.test(blob), "awareness pixel");
  assert(!/Install Pixel/i.test(blob), "native install pixel");
  assert(!/No leads tracked/i.test(blob), "traffic leads");
  assert(!/Purchase event missing/i.test(blob), "unknown purchase");
});

test("UI + Ask Ally wired; no ads_management; no migration auto-apply", () => {
  const ui = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(ui.includes("Affidabilità misurazione"), "ui label");
  assert(ui.includes("TrackingHealthSummary"), "component");
  const load = read("src/lib/ally-copilot/load-context.ts");
  assert(load.includes("trackingHealth"), "ally load");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(prompt.includes("trackingHealth"), "ally prompt");
  const types = read("src/lib/ally-copilot/types.ts");
  assert(types.includes("AllyCopilotTrackingHealth"), "ally type");
  const dir = "src/lib/meta/tracking-health";
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const src = read(`${dir}/${f}`);
    assert(!/ads_management/i.test(src), f);
    assert(!/graph\.facebook\.com/.test(src), f);
  }
  assert(!fs.existsSync("supabase/migrations/20260918_meta_tracking_m10e.sql"), "no m10e mig");
});

test("Hierarchy load includes trackingHealth", () => {
  const src = read("src/lib/meta/hierarchy-load.ts");
  assert(src.includes("buildTrackingHealth"), "builder");
  assert(src.includes("trackingHealth"), "field");
});

test("M10E.1 Evidence consistency: lead signals match professional + Ally fields", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    promotedObject: { page_id: "128281257265071", smart_pse_enabled: false },
    attributionSpec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    observedActionTypes: [
      "lead",
      "onsite_conversion.lead_grouped",
      "link_click",
      "post_reaction",
      "post_engagement",
      "page_engagement",
      "video_view",
      "comment",
      "like",
    ],
    hasPurchaseValue: false,
    resultMappingConfidence: "AMBIGUOUS",
    primaryResultType: null,
    spend: 99.97,
    impressions: 5000,
    linkClicks: 100,
    landingPageViews: null,
  });
  assert(h.status === "AMBIGUOUS", `status=${h.status}`);
  assert(h.reliability === "PARZIALE", h.reliability);
  assert(/segnali di lead/i.test(h.beginnerSummary), h.beginnerSummary);
  assert(
    h.relevantResultActions.includes("lead"),
    `relevant=${h.relevantResultActions.join(",")}`,
  );
  assert(
    h.relevantResultActions.includes("onsite_conversion.lead_grouped"),
    "grouped lead",
  );
  assert(
    !h.relevantResultActions.includes("link_click"),
    "link_click not relevant result",
  );
  assert(
    h.otherObservedActions.includes("link_click"),
    "link_click in other",
  );
  assert(
    h.otherObservedActions.includes("post_engagement"),
    "engagement in other",
  );
  const relevantLine = h.professionalLines.find(
    (l) => l.key === "relevantResults",
  );
  assert(
    !!relevantLine && relevantLine.value.includes("Lead rilevati"),
    relevantLine?.value ?? "missing relevantResults",
  );
  const techLine = h.professionalLines.find(
    (l) => l.key === "relevantResultsRaw",
  );
  assert(
    !!techLine && techLine.value.includes("lead"),
    techLine?.value ?? "missing tech",
  );
  assert(
    !!techLine && techLine.value.includes("onsite_conversion.lead_grouped"),
    techLine?.value ?? "missing grouped",
  );
  const otherLine = h.professionalLines.find((l) => l.key === "otherActions");
  assert(
    !!otherLine && otherLine.value.includes("link_click"),
    otherLine?.value ?? "missing other",
  );
  assert(
    !/Action types osservati/.test(
      h.professionalLines.map((l) => l.label).join("|"),
    ),
    "old undifferentiated label gone",
  );
  assert(
    h.professionalLines.find((l) => l.key === "status")?.value === "Ambiguo",
    "IT status",
  );
  assert(
    h.professionalLines.find((l) => l.key === "destination")?.value ===
      "Sull'inserzione",
    "IT destination",
  );
  assert(
    h.professionalLines.find((l) => l.key === "optimization")?.value ===
      "Generazione contatti",
    "IT optimization",
  );
  assert(
    h.professionalLines.find((l) => l.key === "resultMapping")?.value ===
      "Ambiguo",
    "IT mapping",
  );
  assert(
    h.professionalLines.find((l) => l.key === "attribution")?.value ===
      "1 giorno dal clic",
    "attribution surfaced",
  );
  assert(
    h.signals.some(
      (s) =>
        s.code === "LEAD_EVENT_PRESENT" &&
        s.evidence.includes("lead") &&
        s.evidence.includes("onsite_conversion.lead_grouped"),
    ),
    "LEAD_EVENT evidence lists real types",
  );
});

test("M10E.1 Engagement alone does not claim lead signals", () => {
  const h = buildTrackingHealth({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    promotedObject: { page_id: "1" },
    attributionSpec: null,
    observedActionTypes: [
      "link_click",
      "post_reaction",
      "post_engagement",
      "page_engagement",
    ],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: 10,
    impressions: 1000,
    linkClicks: 20,
    landingPageViews: null,
  });
  assert(!/segnali di lead/i.test(h.beginnerSummary), h.beginnerSummary);
  assert(h.relevantResultActions.length === 0, "no relevant results");
  assert(
    !h.signals.some((s) => s.code === "LEAD_EVENT_PRESENT"),
    "no LEAD_EVENT",
  );
  const relevantLine = h.professionalLines.find(
    (l) => l.key === "relevantResults",
  );
  assert(
    relevantLine?.value === "Nessuno nel periodo",
    relevantLine?.value ?? "missing",
  );
});

test("M10E.1 Ask Ally types include relevantResultActions", () => {
  const types = read("src/lib/ally-copilot/types.ts");
  const load = read("src/lib/ally-copilot/load-context.ts");
  assert(types.includes("relevantResultActions"), "ally type field");
  assert(load.includes("relevantResultActions"), "ally load field");
  assert(load.includes("otherObservedActions"), "ally other field");
});

console.log(
  failed === 0
    ? `\n=== M10E VERIFICA: PASS (${passed} passed, 0 failed) ===\n`
    : `\n=== M10E VERIFICA: FAIL (${passed} passed, ${failed} failed) ===\n`,
);
process.exit(failed === 0 ? 0 : 1);
