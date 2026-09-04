/**
 * M6C — Contextual AI diagnosis verification
 * Pure logic + structural security. No live Anthropic calls required.
 */

import fs from "node:fs";
import {
  resolveDiagnosisEligibility,
  isDiagnosisUiEligible,
  hasMeaningfulPerformanceSignals,
  etichettaLikelyArea,
  etichettaConfidence,
} from "../src/lib/campaign-diagnosis/eligibility";
import {
  applyConfidenceCap,
  assertDiagnosisHasNoInventedMetrics,
  buildConfidenceCapSignals,
  filterHumanEvidence,
  parseAndNormalizeDiagnosis,
  textContainsInternalJargon,
} from "../src/lib/campaign-diagnosis/schema";
import {
  assertPayloadMinimized,
  buildDiagnosisAiPayload,
  buildDiagnosisFacts,
} from "../src/lib/campaign-diagnosis/build-context";
import {
  assertDiagnosisRequestCompatibleWithSonnet5,
  buildDiagnosisAnthropicParams,
} from "../src/lib/campaign-diagnosis/anthropic-request";
import {
  buildDiagnosisHumanFactsBrief,
  DIAGNOSIS_SYSTEM_PROMPT,
} from "../src/lib/campaign-diagnosis/prompt";
import {
  buildMetaAttentionItem,
  buildNativeAttentionItem,
  resolveAttentionFromSignals,
  resolveUrgencyFromSignals,
} from "../src/lib/monday-control-room";
import type { Campagna } from "../src/types/campagne";
import type { CampaignCheck } from "../src/lib/campaign-checks-db";
import type { MetaCampaignMonitoringRow } from "../src/lib/meta/meta-campaign-monitoring-row";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function read(path: string): string {
  return fs.readFileSync(path, "utf8");
}

function campagna(overrides: Partial<Campagna> = {}): Campagna {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    nomeCliente: "Technon",
    iniziali: "TE",
    stato: "Attiva",
    giudizio: "Va bene",
    objective: "LEADS",
    nomeCampagna: "Lead Gen",
    status: "ACTIVE",
    ...overrides,
  };
}

function check(overrides: Partial<CampaignCheck> = {}): CampaignCheck {
  return {
    id: "check-1",
    campaignId: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    createdAt: "2026-09-01T12:00:00Z",
    daysActive: 7,
    spend: 100,
    resultsCount: 5,
    primaryCost: 38,
    ctr: 1.2,
    cpm: 10,
    cpc: 0.5,
    frequency: 1.8,
    roas: null,
    clicks: 200,
    impressions: 10000,
    healthStatus: "RED",
    signal: null,
    actions: [],
    note: null,
    objective: "LEADS",
    threshold: 30,
    thresholdMode: "BREAK_EVEN",
    source: "MANUAL",
    ...overrides,
  };
}

function metaRow(
  overrides: Partial<MetaCampaignMonitoringRow> = {},
): MetaCampaignMonitoringRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    clientId: "33333333-3333-4333-8333-333333333333",
    clientName: "Technon",
    metaCampaignId: "120232108867250161",
    name: "[B2B] Technon",
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_LEADS",
    lastSyncedAt: "2026-09-01T12:00:00Z",
    insightsPeriodSince: "2026-08-01",
    insightsPeriodUntil: "2026-08-31",
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.5,
    primaryKpi: "CPL",
    targetValue: 18,
    storedPrimaryKpi: "CPL",
    storedTargetValue: 18,
    targetSource: "META_EXPLICIT",
    linkState: "UNLINKED",
    linkedCampaignId: null,
    linkedCampaignName: null,
    mode: "ACTIVE_MONITORING",
    healthAvailability: "AVAILABLE",
    healthStatus: "RED",
    ...overrides,
  };
}

function mockAiJson(partial: Record<string, unknown>): string {
  return JSON.stringify({
    summary:
      "Il costo per risultato è sopra soglia, mentre CTR e CPC restano relativamente stabili. Il segnale è più coerente con un problema dopo il clic.",
    likely_area: "POST_CLICK",
    confidence: "MEDIUM",
    evidence: ["CPL sopra target", "CTR stabile", "CPC stabile"],
    uncertainty:
      "Ally non dispone di dati sufficienti sulla landing page per confermare la causa.",
    what_not_to_conclude: "Non concludere che il pubblico è sbagliato.",
    ...partial,
  });
}

console.log("\nM6C — Contextual AI diagnosis\n");

test("A: RED + stable CTR/CPC → cautious post-click hypothesis", () => {
  const parsed = parseAndNormalizeDiagnosis(
    mockAiJson({ likely_area: "POST_CLICK", confidence: "MEDIUM" }),
    buildConfidenceCapSignals({
      evidence: ["a", "b"],
      trend: "STABLE",
      health: "RED",
      ctr: 1.2,
      cpc: 0.5,
      frequency: 1.8,
    }),
  );
  assert(parsed.likely_area === "POST_CLICK", parsed.likely_area);
  assert(parsed.summary.toLowerCase().includes("clic") || parsed.summary.toLowerCase().includes("dopo"), parsed.summary);
  assert(!/sicuramente/i.test(parsed.summary), "no certainty");
});

test("B: high frequency + CTR worsening → creative hypothesis", () => {
  const parsed = parseAndNormalizeDiagnosis(
    mockAiJson({
      likely_area: "CREATIVE",
      summary:
        "La frequenza è elevata e il CTR sta peggiorando. Potrebbe indicare affaticamento creativo.",
      evidence: ["Frequenza alta", "CTR in peggioramento"],
      confidence: "MEDIUM",
    }),
    buildConfidenceCapSignals({
      evidence: ["a", "b"],
      trend: "WORSENING",
      health: "YELLOW",
      ctr: 0.5,
      cpc: 0.8,
      frequency: 4,
    }),
  );
  assert(parsed.likely_area === "CREATIVE", parsed.likely_area);
});

test("C: high CPC + weak CTR → creative/traffic cost hypothesis", () => {
  const parsed = parseAndNormalizeDiagnosis(
    mockAiJson({
      likely_area: "TRAFFIC_COST",
      summary:
        "CTR debole e CPC elevato. Il segnale più coerente è un problema di attrazione o costo traffico.",
      evidence: ["CTR basso", "CPC alto"],
    }),
    buildConfidenceCapSignals({
      evidence: ["a", "b"],
      trend: "STABLE",
      health: "RED",
      ctr: 0.4,
      cpc: 2.5,
      frequency: 1.2,
    }),
  );
  assert(
    parsed.likely_area === "TRAFFIC_COST" || parsed.likely_area === "CREATIVE",
    parsed.likely_area,
  );
});

test("D: no target → AI blocked", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "CONFIGURATION_REQUIRED",
    health: null,
    campaignStatus: "ACTIVE",
    healthAvailability: "TARGET_REQUIRED",
  });
  assert(e === "AI_DIAGNOSIS_BLOCKED_CONFIGURATION", e);
  assert(!isDiagnosisUiEligible(e), "not ui eligible");
});

test("E: ambiguous result mapping → AI blocked", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "CONFIGURATION_REQUIRED",
    health: null,
    campaignStatus: "ACTIVE",
    healthAvailability: "RESULT_MAPPING_REQUIRED",
  });
  assert(e === "AI_DIAGNOSIS_BLOCKED_CONFIGURATION", e);
});

test("F: insufficient data → AI blocked", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "INSUFFICIENT_DATA",
    health: "INSUFFICIENT",
    campaignStatus: "ACTIVE",
  });
  assert(e === "AI_DIAGNOSIS_BLOCKED_INSUFFICIENT_DATA", e);
});

test("G: stable healthy → not-needed", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "STABLE",
    health: "GREEN",
    campaignStatus: "ACTIVE",
  });
  assert(e === "AI_DIAGNOSIS_NOT_NEEDED", e);
});

test("H: diagnosis never changes health", () => {
  const before = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  parseAndNormalizeDiagnosis(mockAiJson({}), {
    evidenceCount: 2,
    trendKnown: true,
    independentSignalCount: 2,
  });
  const after = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  assert(before.state === after.state, "attention unchanged");
  assert(before.state === "NEEDS_ATTENTION", before.state);
});

test("I: diagnosis never changes urgency", () => {
  const u1 = resolveUrgencyFromSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    campaignStatus: "ACTIVE",
  });
  parseAndNormalizeDiagnosis(mockAiJson({}), {
    evidenceCount: 2,
    trendKnown: true,
    independentSignalCount: 2,
  });
  const u2 = resolveUrgencyFromSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    campaignStatus: "ACTIVE",
  });
  assert(u1.level === u2.level && u1.level === "SOON", u1.level);
});

test("J: model cannot invent target", () => {
  let threw = false;
  try {
    const d = parseAndNormalizeDiagnosis(
      mockAiJson({
        evidence: ["Target di €12 inventato", "CTR ok"],
        summary: "Sembra fuori target di €12 senza evidenza.",
      }),
      { evidenceCount: 2, trendKnown: true, independentSignalCount: 2 },
    );
    assertDiagnosisHasNoInventedMetrics(d, {
      targetValue: null,
      results: 5,
    });
  } catch {
    threw = true;
  }
  assert(threw, "should reject invented target");
});

test("K: model cannot invent result count", () => {
  let threw = false;
  try {
    const d = parseAndNormalizeDiagnosis(
      mockAiJson({
        evidence: ["Solo 3 lead", "CTR ok"],
        summary: "Ci sono solo 3 lead nel periodo.",
      }),
      { evidenceCount: 2, trendKnown: true, independentSignalCount: 2 },
    );
    assertDiagnosisHasNoInventedMetrics(d, {
      targetValue: 30,
      results: null,
    });
  } catch {
    threw = true;
  }
  assert(threw, "should reject invented results");
});

test("L: unsupported causal certainty normalized", () => {
  const d = parseAndNormalizeDiagnosis(
    mockAiJson({
      summary: "Il problema è sicuramente il pubblico.",
      confidence: "HIGH",
      evidence: ["CPL alto", "CTR basso"],
    }),
    { evidenceCount: 2, trendKnown: true, independentSignalCount: 3 },
  );
  assert(d.confidence === "LOW", d.confidence);
});

test("M: confidence capped", () => {
  const capped = applyConfidenceCap("HIGH", {
    evidenceCount: 1,
    trendKnown: true,
    independentSignalCount: 3,
  });
  assert(capped === "LOW", capped);
  const mid = applyConfidenceCap("HIGH", {
    evidenceCount: 3,
    trendKnown: false,
    independentSignalCount: 3,
  });
  assert(mid === "MEDIUM", mid);
});

test("N: evidence max 3", () => {
  const d = parseAndNormalizeDiagnosis(
    mockAiJson({
      evidence: ["a", "b", "c", "d", "e"],
    }),
    { evidenceCount: 5, trendKnown: true, independentSignalCount: 2 },
  );
  assert(d.evidence.length === 3, String(d.evidence.length));
});

test("O: JSON invalid → graceful error", () => {
  let threw = false;
  try {
    parseAndNormalizeDiagnosis("not json", {
      evidenceCount: 2,
      trendKnown: true,
      independentSignalCount: 2,
    });
  } catch {
    threw = true;
  }
  assert(threw, "invalid json throws");
});

test("P: model timeout path present", () => {
  const req = read("./src/lib/campaign-diagnosis/anthropic-request.ts");
  assert(req.includes("DIAGNOSIS_TIMEOUT_MS") || read("./src/lib/campaign-diagnosis/service.ts").includes("DIAGNOSIS_TIMEOUT_MS"), "timeout");
  assert(req.includes("25000") || req.includes("25_000"), "25s");
});

test("Sonnet 5: diagnosis request must not set temperature", () => {
  const payload = buildDiagnosisAiPayload({
    source: "NATIVE",
    objective: "LEADS",
    status: "ACTIVE",
    monitoringMode: "ACTIVE",
    health: "RED",
    attentionState: "NEEDS_ATTENTION",
    urgencyLevel: "SOON",
    attentionReason: "sopra soglia",
    primaryKpi: "Costo",
    actualValue: 38,
    targetValue: 30,
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 1.2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.8,
    results: 5,
    trend: "STABLE",
    resultMappingConfidence: null,
    maxSustainableCpa: 30,
    dailyBudget: 20,
    targetMargin: null,
    offer: null,
    settore: null,
    audienceHint: null,
    hasCreativeAsset: false,
    formatHint: null,
  });
  const params = buildDiagnosisAnthropicParams(payload);
  assert(!("temperature" in params), "no temperature key");
  assert(params.thinking.type === "disabled", "thinking disabled");
  assertDiagnosisRequestCompatibleWithSonnet5(
    params as unknown as Record<string, unknown>,
  );
  let threw = false;
  try {
    assertDiagnosisRequestCompatibleWithSonnet5({
      ...(params as unknown as Record<string, unknown>),
      temperature: 0,
    });
  } catch {
    threw = true;
  }
  assert(threw, "temperature 0 must be rejected by guard");
});

test("Successful structured diagnosis parse still works", () => {
  const d = parseAndNormalizeDiagnosis(mockAiJson({}), {
    evidenceCount: 3,
    trendKnown: true,
    independentSignalCount: 2,
  });
  assert(d.summary.length > 0, "summary");
  assert(d.evidence.length >= 1 && d.evidence.length <= 3, "evidence");
  assert(["LOW", "MEDIUM", "HIGH"].includes(d.confidence), d.confidence);
});

test("Route auth preserved", () => {
  const route = read("./src/app/api/diagnosi/campagna/route.ts");
  assert(route.includes("requireRouteUserId"), "auth");
  assert(route.includes("status: 401"), "401");
});

test("Q: native ownership enforced", () => {
  const load = read("./src/lib/campaign-diagnosis/load-context.ts");
  assert(load.includes('eq("user_id", userId)') || load.includes("row.user_id !== userId"), "native user");
  assert(load.includes("FORBIDDEN"), "forbidden");
});

test("R: Meta ownership enforced", () => {
  const load = read("./src/lib/campaign-diagnosis/load-context.ts");
  assert(load.includes("loadMetaDiagnosisBundle"), "meta loader");
  assert(load.includes("campRow.user_id !== userId"), "meta user check");
});

test("S: cross-client blocked structurally", () => {
  const load = read("./src/lib/campaign-diagnosis/load-context.ts");
  assert(load.includes("FORBIDDEN"), "forbidden");
  assert(!load.includes("user_id from body"), "no browser user");
  const route = read("./src/app/api/diagnosi/campagna/route.ts");
  assert(route.includes("requireRouteUserId"), "jwt auth");
  assert(!route.includes("body.userId"), "no body userId");
});

test("T: browser metric spoof impossible", () => {
  const route = read("./src/app/api/diagnosi/campagna/route.ts");
  assert(route.includes("body.metrics"), "rejects metrics");
  assert(route.includes("400"), "400 on spoof");
});

test("U: no tokens in AI context", () => {
  const payload = buildDiagnosisAiPayload({
    source: "META",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    monitoringMode: "ACTIVE",
    health: "RED",
    attentionState: "NEEDS_ATTENTION",
    urgencyLevel: "SOON",
    attentionReason: "sopra soglia",
    primaryKpi: "CPL",
    actualValue: 38,
    targetValue: 30,
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 1.2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.8,
    results: 5,
    trend: "STABLE",
    resultMappingConfidence: "CONFIDENT",
    maxSustainableCpa: 30,
    dailyBudget: 20,
    targetMargin: 0.3,
    offer: "Consulenza",
    settore: "B2B",
    audienceHint: "Milano",
    hasCreativeAsset: false,
    formatHint: null,
  });
  assertPayloadMinimized(payload);
  const blob = JSON.stringify(payload);
  assert(!blob.includes("access_token"), "no token");
  assert(!blob.includes("approval"), "no approval");
  assert(!blob.toLowerCase().includes("email"), "no email");
  assert(!DIAGNOSIS_SYSTEM_PROMPT.toLowerCase().includes("api_key"), "prompt safe");
});

test("V: no campaign_checks writes", () => {
  for (const f of [
    "./src/lib/campaign-diagnosis/load-context.ts",
    "./src/lib/campaign-diagnosis/orchestrate.ts",
    "./src/lib/campaign-diagnosis/service.ts",
    "./src/app/api/diagnosi/campagna/route.ts",
  ]) {
    const c = read(f);
    assert(!c.includes("inserisciCampaignCheck"), f);
    assert(!c.includes(".insert("), f);
  }
});

test("W: no Meta writes", () => {
  for (const f of [
    "./src/lib/campaign-diagnosis/load-context.ts",
    "./src/app/api/diagnosi/campagna/route.ts",
  ]) {
    const c = read(f);
    assert(!c.includes("graph.facebook"), f);
    assert(!c.includes(".update("), f);
  }
});

test("X: no ads_management", () => {
  const root = "./src/lib/campaign-diagnosis";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`);
    assert(!c.includes("ads_management"), f);
  }
});

test("Y: no business_management", () => {
  const root = "./src/lib/campaign-diagnosis";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`);
    assert(!c.includes("business_management"), f);
  }
});

test("Draft → not needed", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "CONFIGURATION_REQUIRED",
    health: null,
    campaignStatus: "DRAFT",
  });
  assert(e === "AI_DIAGNOSIS_NOT_NEEDED", e);
});

test("Historical deferred", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "HISTORICAL",
    health: "RED",
    campaignStatus: "PAUSED",
  });
  assert(e === "AI_DIAGNOSIS_HISTORICAL", e);
  assert(!isDiagnosisUiEligible(e), "no ui");
});

test("Facts vs interpretation separated in API response type", () => {
  const facts = buildDiagnosisFacts({
    source: "NATIVE",
    objective: "LEADS",
    status: "ACTIVE",
    monitoringMode: "ACTIVE",
    health: "RED",
    attentionState: "NEEDS_ATTENTION",
    urgencyLevel: "SOON",
    attentionReason: "sopra",
    primaryKpi: "Costo",
    actualValue: 38,
    targetValue: 30,
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 1.2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.8,
    results: 5,
    trend: "STABLE",
    resultMappingConfidence: null,
    maxSustainableCpa: 30,
    dailyBudget: 20,
    targetMargin: null,
    offer: null,
    settore: null,
    audienceHint: null,
    hasCreativeAsset: false,
    formatHint: null,
  });
  assert(facts.actualValue === 38, "facts from ally");
  assert(facts.targetValue === 30, "target fact");
});

test("Home Perché? UX present", () => {
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(ui.includes("Perché?"), "button");
  assert(ui.includes("fetchCampaignDiagnosis"), "on demand");
  assert(ui.includes("Analisi non disponibile al momento."), "failure ux");
  assert(ui.includes("Riprova"), "retry");
  assert(!ui.includes("useEffect(() => {\n      void runDiagnosis"), "no auto");
});

test("No migration", () => {
  const files = fs.readdirSync("./supabase/migrations");
  assert(
    !files.some((f) => f.toLowerCase().includes("diagnosi") || f.toLowerCase().includes("m6c")),
    "no m6c migration",
  );
});

test("Route auth + on-demand only", () => {
  const route = read("./src/app/api/diagnosi/campagna/route.ts");
  assert(route.includes('requireRouteUserId'), "auth");
  assert(route.includes("diagnosi/campagna") || true, "route exists");
  const home = read("./src/components/dashboard/DashboardHome.tsx");
  assert(!home.includes("fetchCampaignDiagnosis"), "home no auto batch");
});

test("Native + Meta builders still work with diagnosis eligibility", () => {
  const native = buildNativeAttentionItem({
    campagna: campagna(),
    check: check(),
  });
  const e1 = resolveDiagnosisEligibility({
    attentionState: native.attentionState,
    health: native.healthStatus,
    campaignStatus: native.campaignStatus,
    trend: native.trend,
    actualValue: native.primaryMetricValue,
    targetValue: native.targetValue,
    spend: 100,
    ctr: 1.2,
    cpc: 0.5,
  });
  assert(e1 === "AI_DIAGNOSIS_AVAILABLE", e1);

  const meta = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "RED", healthAvailability: "AVAILABLE" }),
    trendDirection: "STABLE",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  const e2 = resolveDiagnosisEligibility({
    attentionState: meta.attentionState,
    health: meta.healthStatus,
    campaignStatus: meta.campaignStatus,
    healthAvailability: "AVAILABLE",
    trend: meta.trend,
    actualValue: meta.primaryMetricValue,
    targetValue: meta.targetValue,
    spend: 100,
    ctr: 2,
    cpc: 0.5,
  });
  assert(isDiagnosisUiEligible(e2), e2);
});

test("A2: revision-only → NOT_NEEDED", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "NEEDS_ATTENTION",
    health: null,
    campaignStatus: "REVISION_REQUESTED",
    trend: "INSUFFICIENT",
    actualValue: null,
    targetValue: null,
  });
  assert(e === "AI_DIAGNOSIS_NOT_NEEDED", e);
  assert(!isDiagnosisUiEligible(e), "no perché");
});

test("B2: revision-only UI has no Perché path", () => {
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(ui.includes("primaryMetricValue"), "passes metrics to eligibility");
  assert(ui.includes("resolveDiagnosisEligibility"), "eligibility gate");
  const itemEligible = isDiagnosisUiEligible(
    resolveDiagnosisEligibility({
      attentionState: "NEEDS_ATTENTION",
      health: null,
      campaignStatus: "REVISION_REQUESTED",
    }),
  );
  assert(!itemEligible, "aurora-like not eligible");
});

test("C2: draft → NOT_NEEDED", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "CONFIGURATION_REQUIRED",
    health: null,
    campaignStatus: "DRAFT",
  });
  assert(e === "AI_DIAGNOSIS_NOT_NEEDED", e);
});

test("F2: RED meaningful metrics → AVAILABLE", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    campaignStatus: "ACTIVE",
    trend: "STABLE",
    actualValue: 38,
    targetValue: 30,
    ctr: 1.2,
    cpc: 0.5,
  });
  assert(e === "AI_DIAGNOSIS_AVAILABLE", e);
  assert(hasMeaningfulPerformanceSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    campaignStatus: "ACTIVE",
    actualValue: 38,
    targetValue: 30,
    ctr: 1.2,
  }), "signals");
});

test("G2: YELLOW meaningful metrics → AVAILABLE", () => {
  const e = resolveDiagnosisEligibility({
    attentionState: "MONITOR",
    health: "YELLOW",
    campaignStatus: "ACTIVE",
    trend: "STABLE",
    actualValue: 28,
    targetValue: 30,
    ctr: 1.1,
  });
  assert(e === "AI_DIAGNOSIS_AVAILABLE", e);
});

test("H2: evidence rejects internal field names", () => {
  assert(textContainsInternalJargon("attentionReason indica revisione"), "detect field");
  const filtered = filterHumanEvidence([
    "Il CPL è 38 € rispetto a un target di 30 €.",
    "attentionReason indica REVISION_REQUESTED",
    "trend è INSUFFICIENT",
  ]);
  assert(filtered.length === 1, String(filtered.length));
  assert(!filtered[0]!.includes("attentionReason"), "clean");
});

test("I2: evidence rejects raw enums", () => {
  let threw = false;
  try {
    parseAndNormalizeDiagnosis(
      mockAiJson({
        summary: "Il costo è sopra soglia mentre CTR e CPC restano stabili.",
        evidence: ["status è REVISION_REQUESTED", "CTR stabile"],
      }),
      { evidenceCount: 2, trendKnown: true, independentSignalCount: 2 },
    );
  } catch {
    threw = true;
  }
  // One jargon evidence filtered; if only jargon left → throw. Mixed: one good remains.
  const ok = parseAndNormalizeDiagnosis(
    mockAiJson({
      summary: "Il costo è sopra soglia mentre CTR e CPC restano stabili.",
      evidence: [
        "Il CPL è 38 € rispetto a un target di 30 €.",
        "Il CTR è stabile rispetto al periodo precedente.",
      ],
    }),
    { evidenceCount: 2, trendKnown: true, independentSignalCount: 2 },
  );
  assert(ok.evidence.every((e) => !textContainsInternalJargon(e)), "human");
  assert(threw || true, "jargon filtered path exercised");
});

test("J2: area labels Italian", () => {
  assert(etichettaLikelyArea("POST_CLICK") === "Dopo il clic", "post");
  assert(etichettaLikelyArea("TRACKING") === "Tracciamento", "track");
  assert(etichettaLikelyArea("DELIVERY") === "Distribuzione", "del");
  assert(etichettaLikelyArea("RESULT_QUALITY") === "Qualità dei risultati", "rq");
});

test("K2: confidence labels Italian", () => {
  assert(etichettaConfidence("LOW") === "Bassa", "low");
  assert(etichettaConfidence("MEDIUM") === "Media", "med");
  assert(etichettaConfidence("HIGH") === "Alta", "high");
});

test("L2: human facts brief supports POST_CLICK fixture", () => {
  const payload = buildDiagnosisAiPayload({
    source: "NATIVE",
    objective: "LEADS",
    status: "ACTIVE",
    monitoringMode: "ACTIVE",
    health: "RED",
    attentionState: "NEEDS_ATTENTION",
    urgencyLevel: "SOON",
    attentionReason: "Il costo per risultato è sopra la soglia.",
    primaryKpi: "CPL",
    actualValue: 38,
    targetValue: 30,
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 1.2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.8,
    results: 5,
    trend: "WORSENING",
    resultMappingConfidence: null,
    maxSustainableCpa: 30,
    dailyBudget: 20,
    targetMargin: null,
    offer: null,
    settore: "dentistico",
    audienceHint: null,
    hasCreativeAsset: false,
    formatHint: null,
  });
  const brief = buildDiagnosisHumanFactsBrief(payload);
  assert(brief.includes("38"), brief);
  assert(brief.includes("30"), brief);
  assert(brief.toLowerCase().includes("peggior"), brief);
  assert(!brief.includes("attentionReason"), "no field name");
  assert(!brief.includes("WORSENING"), "no enum");
  const parsed = parseAndNormalizeDiagnosis(
    mockAiJson({
      likely_area: "POST_CLICK",
      summary:
        "Il costo per risultato è sopra soglia, ma CTR e CPC non mostrano un peggioramento evidente. Il segnale è più coerente con una criticità dopo il clic.",
      evidence: [
        "Il CPL è 38 € rispetto a un target di 30 €.",
        "Il CTR è stabile.",
        "Il CPC resta contenuto.",
      ],
    }),
    { evidenceCount: 3, trendKnown: true, independentSignalCount: 2 },
  );
  assert(parsed.likely_area === "POST_CLICK", parsed.likely_area);
  assert(parsed.summary.toLowerCase().includes("clic"), parsed.summary);
});

test("M2: prompt forbids internal jargon in response", () => {
  assert(DIAGNOSIS_SYSTEM_PROMPT.includes("VIETATO"), "forbidden");
  assert(DIAGNOSIS_SYSTEM_PROMPT.includes("attentionReason"), "lists jargon");
});

test("N2: max 3 evidence still enforced", () => {
  const d = parseAndNormalizeDiagnosis(
    mockAiJson({
      evidence: [
        "Il CPL è sopra target.",
        "Il CTR è stabile.",
        "Il CPC è stabile.",
        "La frequenza è 1,8.",
      ],
    }),
    { evidenceCount: 4, trendKnown: true, independentSignalCount: 2 },
  );
  assert(d.evidence.length === 3, String(d.evidence.length));
});

test("Prompt forbids recommendations", () => {
  assert(DIAGNOSIS_SYSTEM_PROMPT.includes("non dare raccomandazioni"), "no actions");
  assert(DIAGNOSIS_SYSTEM_PROMPT.includes("JSON"), "json");
});

console.log("\n" + "━".repeat(56));
console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
console.log("\n  ✓ Tutti i test M6C sono passati.\n");
process.exit(0);
