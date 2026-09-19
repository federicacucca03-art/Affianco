/**
 * M10F — Deep diagnosis verification (deterministic).
 * No live Graph / Anthropic. No Meta writes.
 */

import fs from "node:fs";
import path from "node:path";
import { buildTrackingHealth } from "../src/lib/meta/tracking-health";
import {
  buildDeepDiagnosis,
  MATERIAL_CHANGE_PCT,
  formatCtrPercentagePoints,
} from "../src/lib/meta/deep-diagnosis";
import type { MetaTrendResult } from "../src/lib/meta/meta-trend";
import type { DeepDiagnosisInput } from "../src/lib/meta/deep-diagnosis";

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

function baseTracking(opts: {
  objective: string;
  optimizationGoal: string;
  destinationType: string;
  observedActionTypes: string[];
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  promotedObject?: Record<string, unknown> | null;
  hasPurchaseValue?: boolean;
}) {
  return buildTrackingHealth({
    objective: opts.objective,
    optimizationGoal: opts.optimizationGoal,
    destinationType: opts.destinationType,
    promotedObject: opts.promotedObject ?? { page_id: "1" },
    attributionSpec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    observedActionTypes: opts.observedActionTypes,
    hasPurchaseValue: opts.hasPurchaseValue ?? false,
    resultMappingConfidence: opts.resultMappingConfidence,
    primaryResultType:
      opts.resultMappingConfidence === "CONFIDENT" ? "lead" : null,
    spend: 100,
    impressions: 5000,
    linkClicks: 100,
    landingPageViews: 40,
  });
}

function twoWindowTrend(input: {
  ctrCur: number;
  ctrPrev: number;
  cpcCur: number;
  cpcPrev: number;
  resultsCur: number;
  resultsPrev: number;
  linkCur: number;
  linkPrev: number;
  mapping?: "CONFIDENT" | "AMBIGUOUS";
}): MetaTrendResult {
  const mapping = input.mapping ?? "CONFIDENT";
  const ctrDelta =
    Math.round(((input.ctrCur - input.ctrPrev) / input.ctrPrev) * 1000) / 10;
  const cpcDelta =
    Math.round(((input.cpcCur - input.cpcPrev) / input.cpcPrev) * 1000) / 10;
  const ctrDir =
    Math.abs(ctrDelta) < 0.1
      ? ("STABLE" as const)
      : input.ctrCur > input.ctrPrev
        ? ("IMPROVING" as const)
        : ("WORSENING" as const);
  const cpcDir =
    Math.abs(cpcDelta) < 0.1
      ? ("STABLE" as const)
      : input.cpcCur < input.cpcPrev
        ? ("IMPROVING" as const)
        : ("WORSENING" as const);

  const mkAgg = (results: number, link: number, ctr: number, cpc: number) =>
    ({
      spend: 50,
      impressions: 2000,
      clicks: link,
      linkClicks: link,
      periodReach: null,
      periodFrequency: null,
      ctr,
      cpc,
      cpm: 10,
      primaryResultType: "lead",
      primaryResults: results,
      primaryResultValue: null,
      resultMappingConfidence: mapping,
      cpl: results > 0 ? 50 / results : null,
      roas: null,
      dayCount: 7,
    }) as MetaTrendResult["currentAggregate"];

  return {
    level: "TWO_WINDOW_COMPARISON",
    windowDays: 7,
    currentWindow: { since: "2026-09-01", until: "2026-09-07" },
    previousWindow: { since: "2026-08-25", until: "2026-08-31" },
    currentAggregate: mkAgg(
      input.resultsCur,
      input.linkCur,
      input.ctrCur,
      input.cpcCur,
    ),
    previousAggregate: mkAgg(
      input.resultsPrev,
      input.linkPrev,
      input.ctrPrev,
      input.cpcPrev,
    ),
    primary: {
      metric: "cpl",
      current: 20,
      previous: 10,
      direction: "WORSENING",
      deltaPercent: 100,
    },
    diagnostics: [
      {
        metric: "ctr",
        current: input.ctrCur,
        previous: input.ctrPrev,
        direction: ctrDir,
        deltaPercent: ctrDelta,
      },
      {
        metric: "cpc",
        current: input.cpcCur,
        previous: input.cpcPrev,
        direction: cpcDir,
        deltaPercent: cpcDelta,
      },
    ],
    insufficientReason: null,
  };
}

console.log("\n=== M10F DEEP DIAGNOSIS ===\n");

test("Technon-like: historical + ambiguous → LIMITED measurement focus", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    observedActionTypes: ["lead", "onsite_conversion.lead_grouped"],
    resultMappingConfidence: "AMBIGUOUS",
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "PAUSED",
    isHistorical: true,
    spend: 99.97,
    impressions: 14647,
    linkClicks: 420,
    landingPageViews: null,
    ctr: 2.87,
    cpc: 0.24,
    frequency: null,
    resultMappingConfidence: "AMBIGUOUS",
    primaryResults: null,
    costPerResult: null,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: true,
    trackingHealth: th,
    configuration: null,
    plannedVsActual: null,
    trend: null,
    hierarchyFocus: null,
  });
  assert(d.evaluability === "LIMITED", `eval=${d.evaluability}`);
  assert(d.primaryFocus === "MEASUREMENT", `focus=${d.primaryFocus}`);
  assert(/traffico è misurabile/i.test(d.beginnerSummary), d.beginnerSummary);
  assert(
    d.facts.some((f) => /CTR osservato: 2,87%/.test(f)),
    d.facts.join("|"),
  );
  assert(!d.facts.some((f) => /286/.test(f)), "no double-scaled CTR");
  assert(
    !/landing|creativ|pubblico sbagliato|CPL alto|ROAS/i.test(
      d.beginnerSummary + d.hypotheses.join(" "),
    ),
    "no fake root causes",
  );
  assert(
    !d.facts.some((f) =>
      /costo per risultato osservato|CPL\s*=/i.test(f),
    ),
    "no fake CPL fact",
  );
  assert(
    /Nessuna azione urgente: campagna storica/i.test(d.nextCheck ?? ""),
    d.nextCheck ?? "",
  );
});

test("Click-stage fixture: CTR/CPC worse, conversion stable → TRAFFIC", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "WEBSITE",
    observedActionTypes: ["lead", "landing_page_view", "link_click"],
    resultMappingConfidence: "CONFIDENT",
    promotedObject: { pixel_id: "1" },
  });
  assert(th.performanceConfidence === "FULL" || th.reliability === "AFFIDABILE" || th.performanceConfidence === "LIMITED", th.performanceConfidence);
  // Force FULL path: use health with FULL if possible — rebuild expects FULL for conversion claims
  const thFull = { ...th, performanceConfidence: "FULL" as const, reliability: "AFFIDABILE" as const, status: "HEALTHY" as const };
  const trend = twoWindowTrend({
    ctrCur: 2.0,
    ctrPrev: 3.0,
    cpcCur: 0.4,
    cpcPrev: 0.25,
    resultsCur: 10,
    resultsPrev: 10,
    linkCur: 100,
    linkPrev: 100,
  });
  // conversion rate stable 10%
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "WEBSITE",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 200,
    impressions: 10000,
    linkClicks: 200,
    landingPageViews: 80,
    ctr: 2.0,
    cpc: 0.4,
    frequency: null,
    resultMappingConfidence: "CONFIDENT",
    primaryResults: 10,
    costPerResult: 25,
    hasTarget: true,
    targetValue: 15,
    sampleSufficient: true,
    trackingHealth: thFull,
    configuration: null,
    plannedVsActual: null,
    trend,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus === "TRAFFIC", `focus=${d.primaryFocus}`);
  assert(
    d.hypotheses.some((h) =>
      /generazione del clic|prima della conversione/i.test(h),
    ),
    d.hypotheses.join("|"),
  );
  assert(
    d.professionalLines.some((l) => l.key === "comparisonMetrics"),
    "temporal evidence visible",
  );
  assert(
    !/creativit[aà] (è|e) (debole|bad)|pubblico (è|e) sbagliato/i.test(
      JSON.stringify(d),
    ),
    "no creative/audience blame",
  );
  assert(d.facts.some((f) => /sopra il target/i.test(f)), "economic fact");
});

test("Post-click fixture: CTR/CPC stable, conversion down → CONVERSION", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    observedActionTypes: ["lead", "landing_page_view"],
    resultMappingConfidence: "CONFIDENT",
    promotedObject: { pixel_id: "1" },
  });
  const thFull = {
    ...th,
    performanceConfidence: "FULL" as const,
    reliability: "AFFIDABILE" as const,
    status: "HEALTHY" as const,
  };
  const trend = twoWindowTrend({
    ctrCur: 3.0,
    ctrPrev: 3.0,
    cpcCur: 0.25,
    cpcPrev: 0.25,
    resultsCur: 5,
    resultsPrev: 12,
    linkCur: 100,
    linkPrev: 100,
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "WEBSITE",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 200,
    impressions: 10000,
    linkClicks: 200,
    landingPageViews: 80,
    ctr: 3.0,
    cpc: 0.25,
    frequency: null,
    resultMappingConfidence: "CONFIDENT",
    primaryResults: 5,
    costPerResult: 40,
    hasTarget: true,
    targetValue: 15,
    sampleSufficient: true,
    trackingHealth: thFull,
    configuration: null,
    plannedVsActual: null,
    trend,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus === "CONVERSION", `focus=${d.primaryFocus}`);
  assert(/dopo il clic/i.test(d.beginnerSummary), d.beginnerSummary);
  assert(
    d.hypotheses.some((h) => /landing|form|offerta/i.test(h)),
    "hypothesis present",
  );
  assert(
    d.unknowns.some((u) => /non può determinare/i.test(u)),
    "unknown marked",
  );
});

test("Tracking-blocked Sales: zero purchases → BLOCKED MEASUREMENT", () => {
  const th = buildTrackingHealth({
    objective: "OUTCOME_SALES",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
    promotedObject: null,
    attributionSpec: null,
    observedActionTypes: ["link_click"],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: 150,
    impressions: 8000,
    linkClicks: 90,
    landingPageViews: null,
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_SALES",
    performanceFamily: "SALES",
    destinationType: "WEBSITE",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 150,
    impressions: 8000,
    linkClicks: 90,
    landingPageViews: null,
    ctr: 2.0,
    cpc: 1.6,
    frequency: null,
    resultMappingConfidence: "UNKNOWN",
    primaryResults: 0,
    costPerResult: null,
    hasTarget: true,
    targetValue: 20,
    sampleSufficient: true,
    trackingHealth: th,
    configuration: null,
    plannedVsActual: null,
    trend: null,
    hierarchyFocus: null,
  });
  assert(
    d.evaluability === "BLOCKED" || d.primaryFocus === "MEASUREMENT",
    `eval=${d.evaluability} focus=${d.primaryFocus}`,
  );
  assert(
    !/ROAS|sales campaign failing|conversion rate zero/i.test(
      d.beginnerSummary + d.facts.join(" "),
    ),
    "no fake sales failure",
  );
});

test("Delivery fixture: active, no delivery → DELIVERY", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    observedActionTypes: [],
    resultMappingConfidence: "UNKNOWN",
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 0,
    impressions: 0,
    linkClicks: null,
    landingPageViews: null,
    ctr: null,
    cpc: null,
    frequency: null,
    resultMappingConfidence: "UNKNOWN",
    primaryResults: null,
    costPerResult: null,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: false,
    trackingHealth: th,
    configuration: null,
    plannedVsActual: null,
    trend: null,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus === "DELIVERY", `focus=${d.primaryFocus}`);
  assert(
    !d.findings.some((f) => f.code === "POST_CLICK_CONVERSION_PRESSURE"),
    "no conversion diagnosis",
  );
});

test("Config mismatch → CONFIGURATION HIGH confidence", () => {
  const th = baseTracking({
    objective: "OUTCOME_TRAFFIC",
    optimizationGoal: "LINK_CLICKS",
    destinationType: "WEBSITE",
    observedActionTypes: ["link_click"],
    resultMappingConfidence: "CONFIDENT",
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_TRAFFIC",
    performanceFamily: "TRAFFIC",
    destinationType: "WEBSITE",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 50,
    impressions: 3000,
    linkClicks: 80,
    landingPageViews: 40,
    ctr: 3.0,
    cpc: 0.6,
    frequency: null,
    resultMappingConfidence: "CONFIDENT",
    primaryResults: 80,
    costPerResult: 0.6,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: true,
    trackingHealth: { ...th, performanceConfidence: "FULL" },
    configuration: null,
    plannedVsActual: [
      {
        field: "objective",
        label: "Obiettivo",
        state: "DIFFERENT",
        plannedLabel: "Contatti",
        actualLabel: "Traffico",
        note: null,
      },
    ],
    trend: null,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus === "CONFIGURATION", `focus=${d.primaryFocus}`);
  assert(d.confidence === "ALTA", d.confidence);
});

test("Healthy fixture: within target → no forced problem", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    observedActionTypes: ["lead"],
    resultMappingConfidence: "CONFIDENT",
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 80,
    impressions: 5000,
    linkClicks: 100,
    landingPageViews: null,
    ctr: 3.0,
    cpc: 0.8,
    frequency: null,
    resultMappingConfidence: "CONFIDENT",
    primaryResults: 10,
    costPerResult: 8,
    hasTarget: true,
    targetValue: 15,
    sampleSufficient: true,
    trackingHealth: {
      ...th,
      performanceConfidence: "FULL",
      reliability: "AFFIDABILE",
      status: "HEALTHY",
    },
    configuration: null,
    plannedVsActual: [],
    trend: {
      level: "INSUFFICIENT_TREND_DATA",
      windowDays: 7,
      currentWindow: null,
      previousWindow: null,
      currentAggregate: null,
      previousAggregate: null,
      primary: null,
      diagnostics: [],
      insufficientReason: "Servono almeno 14 giorni",
    },
    hierarchyFocus: null,
  });
  assert(
    d.primaryFocus == null ||
      d.findings.some((f) => f.code === "NO_FORCED_DIAGNOSIS"),
    `focus=${d.primaryFocus}`,
  );
  assert(
    !/richiede attenzione urgente|campaign failing/i.test(d.beginnerSummary),
    d.beginnerSummary,
  );
});

test("Awareness: no CPL/lead diagnosis", () => {
  const th = buildTrackingHealth({
    objective: "OUTCOME_AWARENESS",
    optimizationGoal: "REACH",
    destinationType: "ON_AD",
    promotedObject: null,
    attributionSpec: null,
    observedActionTypes: [],
    hasPurchaseValue: false,
    resultMappingConfidence: "UNKNOWN",
    primaryResultType: null,
    spend: 40,
    impressions: 20000,
    linkClicks: null,
    landingPageViews: null,
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_AWARENESS",
    performanceFamily: "AWARENESS",
    destinationType: "ON_AD",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 40,
    impressions: 20000,
    linkClicks: null,
    landingPageViews: null,
    ctr: null,
    cpc: null,
    frequency: 1.2,
    resultMappingConfidence: "UNKNOWN",
    primaryResults: null,
    costPerResult: null,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: true,
    trackingHealth: th,
    configuration: null,
    plannedVsActual: null,
    trend: null,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus !== "CONVERSION", `focus=${d.primaryFocus}`);
  assert(
    d.unknowns.some((u) => /Awareness|CPL/i.test(u)),
    d.unknowns.join("|"),
  );
  assert(!/lead conversion|CPL problem/i.test(JSON.stringify(d)), "no leak");
});

test(`Material change gate is ${MATERIAL_CHANGE_PCT}%`, () => {
  assert(MATERIAL_CHANGE_PCT === 20, String(MATERIAL_CHANGE_PCT));
});

test("Cross-objective diagnosis leakage scan", () => {
  const cases: DeepDiagnosisInput[] = [
    {
      objective: "OUTCOME_AWARENESS",
      performanceFamily: "AWARENESS",
      destinationType: "ON_AD",
      effectiveStatus: "ACTIVE",
      isHistorical: false,
      spend: 10,
      impressions: 5000,
      linkClicks: null,
      landingPageViews: null,
      ctr: null,
      cpc: null,
      frequency: 1,
      resultMappingConfidence: "UNKNOWN",
      primaryResults: null,
      costPerResult: null,
      hasTarget: false,
      targetValue: null,
      sampleSufficient: true,
      trackingHealth: null,
      configuration: null,
      plannedVsActual: null,
      trend: null,
      hierarchyFocus: null,
    },
    {
      objective: "OUTCOME_TRAFFIC",
      performanceFamily: "TRAFFIC",
      destinationType: "WEBSITE",
      effectiveStatus: "ACTIVE",
      isHistorical: false,
      spend: 20,
      impressions: 3000,
      linkClicks: 50,
      landingPageViews: 30,
      ctr: 2.0,
      cpc: 0.4,
      frequency: null,
      resultMappingConfidence: "CONFIDENT",
      primaryResults: 30,
      costPerResult: null,
      hasTarget: false,
      targetValue: null,
      sampleSufficient: true,
      trackingHealth: null,
      configuration: null,
      plannedVsActual: null,
      trend: null,
      hierarchyFocus: null,
    },
  ];
  const blob = cases
    .map((c) => {
      const d = buildDeepDiagnosis(c);
      return d.beginnerSummary + d.facts.join("") + d.hypotheses.join("");
    })
    .join("\n");
  assert(!/CPL problem|lead quality|purchase failure/i.test(blob), blob);
});

test("UI + Ask Ally + hierarchy wired; no ads_management; no migration", () => {
  const ui = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(ui.includes("Diagnosi"), "ui diagnosis");
  assert(ui.includes("DeepDiagnosisSummary"), "component");
  const load = read("src/lib/ally-copilot/load-context.ts");
  assert(load.includes("deepDiagnosis"), "ally load");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(prompt.includes("deepDiagnosis"), "ally prompt");
  const types = read("src/lib/ally-copilot/types.ts");
  assert(types.includes("AllyCopilotDeepDiagnosis"), "ally type");
  const hier = read("src/lib/meta/hierarchy-load.ts");
  assert(hier.includes("buildDeepDiagnosis"), "hierarchy builder");
  const dir = "src/lib/meta/deep-diagnosis";
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const src = read(`${dir}/${f}`);
    assert(!/ads_management/i.test(src), f);
    assert(!/graph\.facebook\.com/.test(src), f);
  }
  assert(
    !fs.existsSync("supabase/migrations/20260918_meta_deep_diagnosis_m10f.sql"),
    "no m10f mig",
  );
});

test("Saturation remains hypothesis-only", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    observedActionTypes: ["lead"],
    resultMappingConfidence: "CONFIDENT",
  });
  const trend = twoWindowTrend({
    ctrCur: 1.5,
    ctrPrev: 3.0,
    cpcCur: 0.3,
    cpcPrev: 0.3,
    resultsCur: 8,
    resultsPrev: 8,
    linkCur: 100,
    linkPrev: 100,
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 100,
    impressions: 8000,
    linkClicks: 120,
    landingPageViews: null,
    ctr: 1.5,
    cpc: 0.3,
    frequency: 4.2,
    resultMappingConfidence: "CONFIDENT",
    primaryResults: 8,
    costPerResult: 12.5,
    hasTarget: true,
    targetValue: 10,
    sampleSufficient: true,
    trackingHealth: {
      ...th,
      performanceConfidence: "FULL",
      reliability: "AFFIDABILE",
      status: "HEALTHY",
    },
    configuration: null,
    plannedVsActual: null,
    trend,
    hierarchyFocus: null,
  });
  assert(
    !/Audience exhausted|pubblico esaurito/i.test(JSON.stringify(d)),
    "no exhausted claim",
  );
  const sat = d.hypotheses.find((h) => /saturazione/i.test(h));
  if (sat) {
    assert(/ipotesi|non dimostrat/i.test(sat), sat);
  }
});

test("M10F.1 CASE A: CTR 2.87 percentage points renders 2,87% not 286,7%", () => {
  assert(formatCtrPercentagePoints(2.87) === "2,87%", formatCtrPercentagePoints(2.87));
  assert(!/286/.test(formatCtrPercentagePoints(2.87)), "no double scale");
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "PAUSED",
    isHistorical: true,
    spend: 99.97,
    impressions: 14647,
    linkClicks: 420,
    landingPageViews: null,
    ctr: 2.87,
    cpc: 0.24,
    frequency: null,
    resultMappingConfidence: "AMBIGUOUS",
    primaryResults: null,
    costPerResult: null,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: true,
    trackingHealth: null,
    configuration: null,
    plannedVsActual: null,
    trend: null,
    hierarchyFocus: null,
  });
  const blob = d.facts.join(" ") + d.professionalLines.map((l) => l.value).join(" ");
  assert(/2,87%/.test(blob), blob);
  assert(!/286/.test(blob), blob);
});

test("M10F.1 CASE B: material traffic change + ambiguous → traffic INFO, focus MEASUREMENT", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    observedActionTypes: ["lead", "onsite_conversion.lead_grouped"],
    resultMappingConfidence: "AMBIGUOUS",
  });
  const trend = twoWindowTrend({
    ctrCur: 2.9,
    ctrPrev: 3.6,
    cpcCur: 0.24,
    cpcPrev: 0.18,
    resultsCur: 0,
    resultsPrev: 0,
    linkCur: 100,
    linkPrev: 100,
    mapping: "AMBIGUOUS",
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 99.97,
    impressions: 14647,
    linkClicks: 420,
    landingPageViews: null,
    ctr: 2.9,
    cpc: 0.24,
    frequency: null,
    resultMappingConfidence: "AMBIGUOUS",
    primaryResults: null,
    costPerResult: null,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: true,
    trackingHealth: th,
    configuration: null,
    plannedVsActual: null,
    trend,
    hierarchyFocus: null,
  });
  assert(d.evaluability === "LIMITED", d.evaluability);
  assert(d.primaryFocus === "MEASUREMENT", `focus=${d.primaryFocus}`);
  assert(
    d.findings.some((f) => f.code === "CLICK_STAGE_PRESSURE" && f.severity === "INFO"),
    "traffic observation informational",
  );
  assert(
    d.professionalLines.some(
      (l) => l.key === "comparisonMetrics" && /CTR 3,6% → 2,9%/.test(l.value),
    ),
    d.professionalLines.map((l) => l.value).join("|"),
  );
  assert(d.comparisonMetrics?.ctrPrevious === 3.6, "ctr prev");
  assert(d.comparisonMetrics?.ctrCurrent === 2.9, "ctr cur");
});

test("M10F.1 CASE C: no material CTR/CPC change → no click-stage focus", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "WEBSITE",
    observedActionTypes: ["lead"],
    resultMappingConfidence: "CONFIDENT",
    promotedObject: { pixel_id: "1" },
  });
  const trend = twoWindowTrend({
    ctrCur: 3.0,
    ctrPrev: 3.1,
    cpcCur: 0.25,
    cpcPrev: 0.24,
    resultsCur: 10,
    resultsPrev: 10,
    linkCur: 100,
    linkPrev: 100,
  });
  // deltas ~3-4% — below 20% material gate
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "WEBSITE",
    effectiveStatus: "ACTIVE",
    isHistorical: false,
    spend: 100,
    impressions: 5000,
    linkClicks: 150,
    landingPageViews: 60,
    ctr: 3.0,
    cpc: 0.25,
    frequency: null,
    resultMappingConfidence: "CONFIDENT",
    primaryResults: 10,
    costPerResult: 10,
    hasTarget: true,
    targetValue: 15,
    sampleSufficient: true,
    trackingHealth: {
      ...th,
      performanceConfidence: "FULL",
      reliability: "AFFIDABILE",
      status: "HEALTHY",
    },
    configuration: null,
    plannedVsActual: null,
    trend,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus !== "TRAFFIC", `focus=${d.primaryFocus}`);
  assert(
    !d.findings.some((f) => f.code === "CLICK_STAGE_PRESSURE"),
    "no manufactured click-stage",
  );
});

test("M10F.1 CASE D: historical + traffic deterioration → MEASUREMENT, no urgency", () => {
  const th = baseTracking({
    objective: "OUTCOME_LEADS",
    optimizationGoal: "LEAD_GENERATION",
    destinationType: "ON_AD",
    observedActionTypes: ["lead", "onsite_conversion.lead_grouped"],
    resultMappingConfidence: "AMBIGUOUS",
  });
  const trend = twoWindowTrend({
    ctrCur: 2.87,
    ctrPrev: 3.6,
    cpcCur: 0.24,
    cpcPrev: 0.18,
    resultsCur: 0,
    resultsPrev: 0,
    linkCur: 200,
    linkPrev: 200,
    mapping: "AMBIGUOUS",
  });
  const d = buildDeepDiagnosis({
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    destinationType: "ON_AD",
    effectiveStatus: "PAUSED",
    isHistorical: true,
    spend: 99.97,
    impressions: 14647,
    linkClicks: 420,
    landingPageViews: null,
    ctr: 2.87,
    cpc: 0.24,
    frequency: null,
    resultMappingConfidence: "AMBIGUOUS",
    primaryResults: null,
    costPerResult: null,
    hasTarget: false,
    targetValue: null,
    sampleSufficient: true,
    trackingHealth: th,
    configuration: null,
    plannedVsActual: null,
    trend,
    hierarchyFocus: null,
  });
  assert(d.primaryFocus === "MEASUREMENT", `focus=${d.primaryFocus}`);
  assert(d.beginnerLabel === "Diagnosi limitata", d.beginnerLabel);
  assert(
    /Nessuna azione urgente: campagna storica/i.test(d.nextCheck ?? ""),
    d.nextCheck ?? "",
  );
  assert(
    d.findings.some(
      (f) => f.code === "CLICK_STAGE_PRESSURE" && f.severity === "INFO",
    ),
    "traffic informational only",
  );
  assert(
    !d.hypotheses.some((h) => /^Il peggioramento sembra iniziare/i.test(h)),
    d.hypotheses.join("|"),
  );
  assert(
    d.professionalLines.some((l) => l.key === "comparisonMetrics"),
    "temporal evidence visible",
  );
});

console.log(
  failed === 0
    ? `\n=== M10F VERIFICA: PASS (${passed} passed, 0 failed) ===\n`
    : `\n=== M10F VERIFICA: FAIL (${passed} passed, ${failed} failed) ===\n`,
);
process.exit(failed === 0 ? 0 : 1);
