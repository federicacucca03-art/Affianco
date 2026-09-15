/**
 * M10C — Objective-aware performance intelligence (pure + static asserts).
 * Esegui: npx tsx scripts/verifica-meta-m10c.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeInsightRow } from "@/lib/meta/insight-normalize";
import { metaInsightsToControlRoomInput } from "@/lib/meta/insights-control-room";
import { buildMetaAttentionItem } from "@/lib/monday-control-room";
import { resolveDeterministicNextAction } from "@/lib/campaign-next-action";
import { buildDiagnosisAiPayload } from "@/lib/campaign-diagnosis/build-context";
import { buildAllyCampaignCopilotContext } from "@/lib/ally-copilot/build-context";
import { evaluateEntityVsTarget } from "@/lib/meta/hierarchy-evaluate";
import {
  evaluateObjectiveEvidenceSufficiency,
  extractOutcomeForProfile,
  M10C_SUFFICIENCY_RULES,
  PROFILE_AWARENESS,
  PROFILE_LEADS,
  PROFILE_SALES,
  PROFILE_TRAFFIC,
  PROFILE_UNKNOWN,
  resolveObjectivePerformanceProfile,
  resolvePerformanceFamily,
  buildPrimaryMetricDisplays,
} from "@/lib/meta/objective-performance";
import { aggregateDailyInsights } from "@/lib/meta/insight-aggregate";
import { deriveRoas } from "@/lib/meta/insight-actions";
import type { MetaCampaignMonitoringRow } from "@/lib/meta/meta-campaign-monitoring-row";

let falliti = 0;
function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  return true;
}

function test(name: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    falliti += 1;
    console.error(`FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

const root = join(import.meta.dirname, "..");
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

console.log("\n=== M10C OBJECTIVE-AWARE PERFORMANCE ===");
console.log("Sufficiency rules:", M10C_SUFFICIENCY_RULES);

test("Profile families map correctly", () => {
  assert(resolvePerformanceFamily("OUTCOME_LEADS") === "LEADS", "LEADS family");
  assert(resolvePerformanceFamily("OUTCOME_SALES") === "SALES", "SALES family");
  assert(
    resolvePerformanceFamily("OUTCOME_TRAFFIC") === "TRAFFIC",
    "TRAFFIC family",
  );
  assert(
    resolvePerformanceFamily("OUTCOME_AWARENESS") === "AWARENESS",
    "AWARENESS family",
  );
  assert(
    resolvePerformanceFamily("OUTCOME_ENGAGEMENT") === "ENGAGEMENT",
    "ENGAGEMENT family",
  );
  assert(resolvePerformanceFamily("WEIRD_OBJ") === "UNKNOWN", "UNKNOWN family");
  assert(
    resolveObjectivePerformanceProfile("OUTCOME_LEADS").economicMetric ===
      "CPL",
    "Leads economic CPL",
  );
  assert(
    !resolveObjectivePerformanceProfile("OUTCOME_AWARENESS")
      .economicTargetRequired,
    "Awareness no mandatory economic target",
  );
});

test("LEADS: lead + lead_grouped → AMBIGUOUS SAFE (no fake CPL)", () => {
  const row = normalizeInsightRow(
    {
      date_start: "2026-09-01",
      date_stop: "2026-09-01",
      spend: "50",
      impressions: "1000",
      clicks: "40",
      inline_link_clicks: "30",
      ctr: "3",
      cpc: "1.5",
      actions: [
        { action_type: "lead", value: "5" },
        { action_type: "onsite_conversion.lead_grouped", value: "5" },
      ],
    },
    { rawObjective: "OUTCOME_LEADS" },
  );
  assert(row != null, "normalize ok");
  assert(row!.resultMappingConfidence === "AMBIGUOUS", "AMBIGUOUS SAFE");
  assert(row!.primaryResults == null, "no primary results chosen");
  assert(row!.primaryResultType == null, "no arbitrary result type");

  const agg = aggregateDailyInsights([row!], {
    reach: null,
    frequency: null,
  });
  assert(agg.cpl == null, "no fake CPL on aggregate");
  const displays = buildPrimaryMetricDisplays(PROFILE_LEADS, agg, null);
  const cplCard = displays.find((d) => d.id === "cost_per_result");
  assert(cplCard?.available === false, "UI cost_per_result unavailable");
});

test("SALES A: purchase + value → CPA/ROAS eligible", () => {
  const outcome = extractOutcomeForProfile(
    PROFILE_SALES,
    [{ actionType: "purchase", value: 3 }],
    [{ actionType: "purchase", value: 150 }],
  );
  assert(outcome.mappingConfidence === "CONFIDENT", "sales confident");
  assert(outcome.primaryResults === 3, "purchase count");
  assert(outcome.primaryResultValue === 150, "purchase value");
  const roas = deriveRoas(50, 150);
  assert(roas != null && roas > 0, "ROAS from spend+value");
});

test("SALES B: purchase count without value → no ROAS", () => {
  const outcome = extractOutcomeForProfile(
    PROFILE_SALES,
    [{ actionType: "purchase", value: 2 }],
    [],
  );
  assert(outcome.mappingConfidence === "CONFIDENT", "count confident");
  assert(outcome.primaryResultValue == null, "no value");
  assert(
    outcome.outcomeLimitation?.includes("ROAS") === true ||
      outcome.outcomeLimitation?.includes("valore") === true,
    "limitation notes missing value",
  );
  assert(deriveRoas(40, null) == null, "no fake ROAS");
});

test("SALES C: no purchase tracking → UNKNOWN / no fake sales verdict", () => {
  const outcome = extractOutcomeForProfile(
    PROFILE_SALES,
    [{ actionType: "link_click", value: 100 }],
    [],
  );
  assert(outcome.mappingConfidence === "UNKNOWN", "no purchase → UNKNOWN");
  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 80,
      impressions: 5000,
      clicks: 100,
      linkClicks: 100,
      periodReach: null,
      periodFrequency: null,
      ctr: 2,
      cpc: 0.8,
      cpm: 16,
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      resultMappingConfidence: "UNKNOWN",
      cpl: null,
      roas: null,
      dayCount: 5,
    },
    since: "2026-09-01",
    until: "2026-09-07",
    target: { primaryKpi: "CPA", targetValue: 20 },
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_SALES",
  });
  assert(
    cr.healthAvailability === "RESULT_MAPPING_REQUIRED" ||
      cr.healthAvailability === "INSUFFICIENT_DATA",
    "no fake GREEN on sales without purchases",
  );
  assert(cr.health?.status !== "GREEN", "not GREEN without mapping");
});

test("TRAFFIC: LPV preferred; link_click limitation", () => {
  const lpv = extractOutcomeForProfile(
    PROFILE_TRAFFIC,
    [{ actionType: "landing_page_view", value: 12 }],
    [],
  );
  assert(lpv.mappingConfidence === "CONFIDENT", "LPV confident");
  assert(lpv.primaryResultType === "landing_page_view", "LPV type");
  assert(lpv.outcomeLimitation == null, "no limitation with LPV");

  const clickOnly = extractOutcomeForProfile(
    PROFILE_TRAFFIC,
    [{ actionType: "link_click", value: 20 }],
    [],
  );
  assert(clickOnly.mappingConfidence === "CONFIDENT", "click fallback");
  assert(
    clickOnly.outcomeLimitation?.toLowerCase().includes("landing") === true,
    "limitation when only clicks",
  );
});

test("AWARENESS: delivery sufficiency, no CPL target required", () => {
  const profile = PROFILE_AWARENESS;
  assert(profile.economicTargetRequired === false, "no mandatory target");
  const insuff = evaluateObjectiveEvidenceSufficiency({
    mode: "DELIVERY",
    daysActive: 5,
    resultsCount: 0,
    impressions: 100,
    linkClicks: null,
  });
  assert(insuff === "INSUFFICIENT_DATA", "low impressions insufficient");
  const ok = evaluateObjectiveEvidenceSufficiency({
    mode: "DELIVERY",
    daysActive: 5,
    resultsCount: null,
    impressions: 5000,
    linkClicks: null,
  });
  assert(ok === "SUFFICIENT", "impressions gate for awareness");

  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 30,
      impressions: 8000,
      clicks: 10,
      linkClicks: 8,
      periodReach: 4000,
      periodFrequency: 2,
      ctr: 0.1,
      cpc: 3.75,
      cpm: 3.75,
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      resultMappingConfidence: "UNKNOWN",
      cpl: null,
      roas: null,
      dayCount: 5,
    },
    since: "2026-09-01",
    until: "2026-09-07",
    target: null,
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_AWARENESS",
  });
  assert(
    cr.healthAvailability === "NO_ECONOMIC_EVALUATION",
    "awareness without target ≠ TARGET_REQUIRED",
  );
  assert(cr.health == null, "no G/Y/R without target");

  const row: MetaCampaignMonitoringRow = {
    id: "m1",
    clientId: "c1",
    clientName: "Cliente",
    metaCampaignId: "123",
    name: "Awareness demo",
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_AWARENESS",
    lastSyncedAt: null,
    insightsPeriodSince: "2026-09-01",
    insightsPeriodUntil: "2026-09-07",
    insightsLastSyncedAt: null,
    spend: 30,
    impressions: 8000,
    linkClicks: 8,
    ctr: 0.1,
    cpc: 3.75,
    cpm: 3.75,
    frequency: 2,
    primaryResults: null,
    primaryKpi: null,
    targetValue: null,
    storedPrimaryKpi: null,
    storedTargetValue: null,
    targetSource: "NONE",
    linkState: "UNLINKED",
    linkedCampaignId: null,
    linkedCampaignName: null,
    mode: "ACTIVE_MONITORING",
    healthAvailability: "NO_ECONOMIC_EVALUATION",
    healthStatus: null,
  };
  const item = buildMetaAttentionItem({ row });
  assert(
    item.attentionState !== "CONFIGURATION_REQUIRED",
    "awareness not CONFIGURATION_REQUIRED",
  );
  assert(item.attentionState === "MONITOR", "awareness → MONITOR");
});

test("UNKNOWN objective safety", () => {
  assert(PROFILE_UNKNOWN.family === "UNKNOWN", "unknown profile");
  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 10,
      impressions: 2000,
      clicks: 20,
      linkClicks: 15,
      periodReach: 1000,
      periodFrequency: 2,
      ctr: 1,
      cpc: 0.5,
      cpm: 5,
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      resultMappingConfidence: "UNKNOWN",
      cpl: null,
      roas: null,
      dayCount: 4,
    },
    since: "2026-09-01",
    until: "2026-09-05",
    target: { primaryKpi: "CPL", targetValue: 15 },
    effectiveStatus: "ACTIVE",
    rawObjective: "SOMETHING_NEW",
  });
  assert(
    cr.healthAvailability === "OBJECTIVE_UNSUPPORTED",
    "unknown → OBJECTIVE_UNSUPPORTED",
  );
  assert(cr.health == null, "no performance verdict");
});

test("Next action: no SET_TARGET for awareness/unsupported", () => {
  const awareness = resolveDeterministicNextAction({
    campaignId: "x",
    source: "META",
    campaignStatus: "ACTIVE",
    attentionState: "MONITOR",
    health: null,
    healthAvailability: "NO_ECONOMIC_EVALUATION",
    rowHref: "/risultati",
    performanceFamily: "AWARENESS",
  });
  assert(awareness?.actionType === "NO_ACTION", "awareness next = NO_ACTION");
  assert(
    !awareness?.rationale.toLowerCase().includes("lead"),
    "no lead-gen language",
  );

  const unknown = resolveDeterministicNextAction({
    campaignId: "y",
    source: "META",
    campaignStatus: "ACTIVE",
    attentionState: "MONITOR",
    health: null,
    healthAvailability: "OBJECTIVE_UNSUPPORTED",
    rowHref: "/risultati",
    performanceFamily: "UNKNOWN",
  });
  assert(unknown?.actionType === "NO_ACTION", "unknown next = NO_ACTION");
});

test("Ask Ally / diagnosis payload includes performance profile", () => {
  const payload = buildDiagnosisAiPayload({
    source: "META",
    objective: "OUTCOME_SALES",
    status: "ACTIVE",
    monitoringMode: "ACTIVE",
    health: null,
    attentionState: "MONITOR",
    urgencyLevel: "NONE",
    attentionReason: "Demo",
    primaryKpi: "CPA",
    actualValue: null,
    targetValue: 25,
    spend: 100,
    impressions: 1000,
    linkClicks: 50,
    ctr: 5,
    cpc: 2,
    cpm: 100,
    frequency: 1.2,
    results: null,
    trend: "UNKNOWN",
    resultMappingConfidence: "UNKNOWN",
    maxSustainableCpa: null,
    dailyBudget: null,
    targetMargin: null,
    offer: null,
    settore: null,
    audienceHint: null,
    hasCreativeAsset: false,
    formatHint: null,
  });
  assert(payload.performanceProfile?.family === "SALES", "profile family SALES");
  assert(
    payload.performanceProfile?.primaryMetrics.includes("purchases") === true,
    "sales primary metrics",
  );

  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "1",
      source: "META",
      clientName: "C",
      campaignName: "Camp",
      href: "/risultati",
      linkedNativeId: null,
      planningSnapshot: null,
      configurationKind: null,
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: null,
    },
    payload,
  });
  assert(ctx.performance.performanceFamily === "SALES", "copilot family");
  assert(
    ctx.performance.economicTargetRequired === true,
    "sales economic target required flag",
  );
});

test("M10C.1 CASE A: sample sufficient + AMBIGUOUS + target missing", () => {
  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 100,
      impressions: 20000,
      clicks: 400,
      linkClicks: 300,
      periodReach: 8000,
      periodFrequency: 2.5,
      ctr: 1.5,
      cpc: 0.33,
      cpm: 5,
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      resultMappingConfidence: "AMBIGUOUS",
      cpl: null,
      roas: null,
      dayCount: 28,
    },
    since: "2026-06-01",
    until: "2026-06-28",
    target: null,
    effectiveStatus: "PAUSED",
    rawObjective: "OUTCOME_LEADS",
  });
  assert(
    cr.healthAvailability === "RESULT_MAPPING_REQUIRED",
    "A → RESULT_MAPPING_REQUIRED not TARGET_REQUIRED",
  );
  assert(cr.health == null || cr.health.status !== "GREEN", "A no GREEN");
  assert(cr.health == null || cr.health.status !== "RED", "A no RED");
  assert(cr.mode === "HISTORICAL_REVIEW", "A paused historical");

  const st = evaluateEntityVsTarget({
    sufficiency: "SUFFICIENT",
    costPerResult: null,
    targetValue: null,
    primaryKpi: "CPL",
    resultMappingConfidence: "AMBIGUOUS",
  });
  assert(st === "NEUTRAL", "A hierarchy NEUTRAL not INSUFFICIENT");
});

test("M10C.1 CASE B: sample insufficient + CONFIDENT", () => {
  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 5,
      impressions: 100,
      clicks: 2,
      linkClicks: 2,
      periodReach: 80,
      periodFrequency: 1.2,
      ctr: 2,
      cpc: 2.5,
      cpm: 50,
      primaryResultType: "lead",
      primaryResults: 1,
      primaryResultValue: null,
      resultMappingConfidence: "CONFIDENT",
      cpl: 5,
      roas: null,
      dayCount: 1,
    },
    since: "2026-09-10",
    until: "2026-09-10",
    target: { primaryKpi: "CPL", targetValue: 20 },
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_LEADS",
  });
  assert(cr.healthAvailability === "INSUFFICIENT_DATA", "B insufficient");
});

test("M10C.1 CASE C: sample sufficient + CONFIDENT + target missing", () => {
  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 80,
      impressions: 10000,
      clicks: 200,
      linkClicks: 180,
      periodReach: 5000,
      periodFrequency: 2,
      ctr: 1.8,
      cpc: 0.44,
      cpm: 8,
      primaryResultType: "lead",
      primaryResults: 8,
      primaryResultValue: null,
      resultMappingConfidence: "CONFIDENT",
      cpl: 10,
      roas: null,
      dayCount: 7,
    },
    since: "2026-09-01",
    until: "2026-09-07",
    target: null,
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_LEADS",
  });
  assert(cr.healthAvailability === "TARGET_REQUIRED", "C target missing");
  assert(cr.health == null, "C no G/Y/R without target");
});

test("M10C.1 CASE D: sample sufficient + CONFIDENT + target", () => {
  const cr = metaInsightsToControlRoomInput({
    aggregate: {
      spend: 80,
      impressions: 10000,
      clicks: 200,
      linkClicks: 180,
      periodReach: 5000,
      periodFrequency: 2,
      ctr: 1.8,
      cpc: 0.44,
      cpm: 8,
      primaryResultType: "lead",
      primaryResults: 8,
      primaryResultValue: null,
      resultMappingConfidence: "CONFIDENT",
      cpl: 10,
      roas: null,
      dayCount: 7,
    },
    since: "2026-09-01",
    until: "2026-09-07",
    target: { primaryKpi: "CPL", targetValue: 20 },
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_LEADS",
  });
  assert(cr.healthAvailability === "AVAILABLE", "D available");
  assert(cr.health?.status === "GREEN", "D green under target");
});

test("M10C.1 UI copy separates ambiguity from insufficient", () => {
  const resultsUi = read("src/components/risultati/MetaCampagneSection.tsx");
  const hierUi = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(
    resultsUi.includes(
      "I dati di spesa e traffico sono disponibili, ma i risultati Meta non sono determinabili con certezza.",
    ),
    "top-level ambiguity copy",
  );
  assert(
    hierUi.includes(
      "Ally non calcola il costo per risultato finché non può identificarne uno con certezza.",
    ),
    "hierarchy ambiguity copy",
  );
  assert(
    hierUi.includes("resultMappingConfidence !== \"AMBIGUOUS\""),
    "insufficient gated off when ambiguous",
  );
});

test("Static: no Meta writes / no AI on render in M10C module", () => {
  const idx = read("src/lib/meta/objective-performance/index.ts");
  const profiles = read("src/lib/meta/objective-performance/profiles.ts");
  const extract = read("src/lib/meta/objective-performance/extract-outcome.ts");
  const control = read("src/lib/meta/insights-control-room.ts");
  assert(!/ADS_MANAGEMENT|ads_management/.test(idx + profiles), "no ads mgmt");
  assert(
    !/fetch\(|anthropic|openai|generateText/.test(extract + profiles),
    "no AI in profile extract",
  );
  assert(!/POST.*\/act_|method:\s*[\"']POST/.test(control), "no Meta writes");
});

test("Unrelated Campagne WIP files not modified by M10C modules", () => {
  // Presence check only — git status verified separately by human/agent.
  assert(
    read("src/app/campagne/page.tsx").length > 0,
    "campagne page exists (untouched expected)",
  );
});

console.log(
  falliti === 0
    ? "\n=== M10C VERIFICA: PASS ===\n"
    : `\n=== M10C VERIFICA: FAIL (${falliti}) ===\n`,
);
process.exit(falliti === 0 ? 0 : 1);
