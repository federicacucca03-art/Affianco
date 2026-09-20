/**
 * M10G — Evidence-based creative intelligence verification.
 * Deterministic. No live Graph / Anthropic. No Meta writes.
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildCreativeIntelligence,
  etichettaComparisonMode,
  DELIVERY_IMBALANCE_SPEND_SHARE,
  MIN_IMPRESSIONS_FOR_COMPARE,
  type CreativeAdInput,
  type CreativeIntelligenceInput,
} from "../src/lib/meta/creative-intelligence";
import { MATERIAL_CHANGE_PCT } from "../src/lib/meta/deep-diagnosis";
import type { NormalizedDailyInsight } from "../src/lib/meta/insight-normalize";
import { scrubAllyCopilotUserFacingText } from "../src/lib/ally-copilot/parse";

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

function emptyRows(n: number, base: Partial<NormalizedDailyInsight> = {}): NormalizedDailyInsight[] {
  const out: NormalizedDailyInsight[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = `2026-01-${String(i + 1).padStart(2, "0")}`;
    out.push({
      metaCampaignId: "camp_test",
      dateStart: d,
      dateStop: d,
      spend: base.spend ?? 10,
      impressions: base.impressions ?? 2000,
      reach: null,
      clicks: base.clicks ?? 40,
      linkClicks: base.linkClicks ?? 40,
      metaCtr: null,
      metaCpc: null,
      metaCpm: null,
      frequency: base.frequency ?? null,
      actions: [],
      actionValues: [],
      primaryResultType: base.primaryResultType ?? null,
      primaryResults: base.primaryResults ?? null,
      primaryResultValue: null,
      resultMappingConfidence: base.resultMappingConfidence ?? "UNKNOWN",
      outcomeLimitation: null,
    });
  }
  return out;
}

function ad(partial: Partial<CreativeAdInput> & Pick<CreativeAdInput, "metaAdId" | "name">): CreativeAdInput {
  return {
    metaAdSetId: "as1",
    adSetName: "Gruppo 1",
    status: "PAUSED",
    effectiveStatus: "PAUSED",
    creativeId: null,
    creativeTitle: "Titolo",
    creativeBody: "Body",
    creativeCta: "LEARN_MORE",
    creativeLinkUrl: null,
    creativeThumbnailUrl: null,
    spend: 50,
    impressions: 5000,
    linkClicks: 100,
    ctr: 2,
    cpc: 0.5,
    cpm: 10,
    results: null,
    costPerResult: null,
    resultMappingConfidence: "AMBIGUOUS",
    dayCount: 7,
    insightRows: emptyRows(7),
    ...partial,
  };
}

function baseInput(
  ads: CreativeAdInput[],
  overrides: Partial<CreativeIntelligenceInput> = {},
): CreativeIntelligenceInput {
  return {
    objective: "OUTCOME_LEADS",
    performanceFamily: "LEADS",
    isHistorical: false,
    trackingPerformanceConfidence: "LIMITED",
    campaignResultMapping: "AMBIGUOUS",
    ads,
    ...overrides,
  };
}

console.log("\n=== M10G CREATIVE INTELLIGENCE ===\n");

test("REAL TECHNON-like: single ad → no cross-ad comparison", () => {
  const intel = buildCreativeIntelligence(
    baseInput(
      [
        ad({
          metaAdId: "ad1",
          name: "Nuova inserzione Contatti",
          spend: 99.97,
          impressions: 14647,
          linkClicks: 420,
          ctr: 2.87,
          cpc: 0.24,
          dayCount: 10,
          insightRows: emptyRows(10, {
            spend: 10,
            impressions: 1464,
            linkClicks: 42,
            frequency: 1.2,
          }),
        }),
      ],
      { isHistorical: true, campaignResultMapping: "AMBIGUOUS" },
    ),
  );
  assert(intel.comparisonMode === "SINGLE_AD_ONLY" || intel.comparisonMode === "SELF_TREND", "mode");
  assert(
    intel.primaryObservation === "NO_COMPARISON_AVAILABLE" ||
      intel.primaryObservation === "ONE_AD_CONCENTRATES_TRAFFIC_DECLINE" ||
      intel.primaryObservation === "POSSIBLE_FATIGUE_SIGNAL",
    "primary ok",
  );
  assert(intel.findings.some((f) => f.code === "SINGLE_VARIANT_ONLY"), "single variant");
  assert(
    !/migliore creativ|better creative|qualità creativa|creative quality|winner|loser/i.test(
      intel.beginnerSummary,
    ),
    "no winner language",
  );
  assert(intel.unknowns.some((u) => /sola inserzione|varianti/i.test(u)), "unknown comparison");
  assert(!intel.facts.some((f) => /\bCPL\b/.test(f) && /€/.test(f)), "no fake CPL fact");
});

test("TWO-AD FIXTURE: CTR difference → CLICK_RESPONSE_DIFFERENCE", () => {
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "a",
        name: "Ad A",
        ctr: 1.2,
        cpc: 0.8,
        spend: 80,
        impressions: 8000,
        linkClicks: 96,
        dayCount: 7,
      }),
      ad({
        metaAdId: "b",
        name: "Ad B",
        ctr: 2.6,
        cpc: 0.38,
        spend: 70,
        impressions: 7000,
        linkClicks: 182,
        dayCount: 7,
      }),
    ]),
  );
  assert(intel.comparisonMode === "CROSS_AD", "cross ad");
  assert(
    intel.primaryObservation === "ONE_AD_HAS_HIGHER_CLICK_EFFICIENCY",
    `primary=${intel.primaryObservation}`,
  );
  assert(
    intel.findings.some((f) => f.code === "CLICK_RESPONSE_DIFFERENCE"),
    "click finding",
  );
  assert(
    !/\bbetter creative\b|\bcreative quality\b|\bworst ad\b|\bbest ad\b/i.test(
      JSON.stringify(intel),
    ),
    "no quality claim",
  );
  assert(intel.hypotheses.length >= 1, "hypothesis present");
  assert(intel.unknowns.some((u) => /elemento creativo|causat/i.test(u)), "cause unknown");
});

test("DELIVERY-IMBALANCE FIXTURE", () => {
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "a",
        name: "Ad A",
        spend: 90,
        impressions: 10000,
        ctr: 2,
        dayCount: 7,
      }),
      ad({
        metaAdId: "b",
        name: "Ad B",
        spend: 10,
        impressions: 400,
        ctr: 1,
        dayCount: 7,
      }),
    ]),
  );
  assert(
    intel.evaluability === "NOT_COMPARABLE" ||
      intel.primaryObservation === "DELIVERY_IMBALANCE",
    `eval=${intel.evaluability} primary=${intel.primaryObservation}`,
  );
  assert(intel.findings.some((f) => f.code === "DELIVERY_IMBALANCE"), "imbalance finding");
  assert(
    !/sottoperformante|underperform/i.test(intel.beginnerSummary),
    "no underperformer on B",
  );
  assert(DELIVERY_IMBALANCE_SPEND_SHARE === 0.85, "gate constant");
});

test("RESULT-STAGE FIXTURE: confident mapping allows cost/result fact", () => {
  const intel = buildCreativeIntelligence(
    baseInput(
      [
        ad({
          metaAdId: "a",
          name: "Ad A",
          results: 4,
          costPerResult: 25,
          resultMappingConfidence: "CONFIDENT",
          ctr: 2,
          spend: 100,
          impressions: 5000,
          dayCount: 7,
        }),
        ad({
          metaAdId: "b",
          name: "Ad B",
          results: 10,
          costPerResult: 10,
          resultMappingConfidence: "CONFIDENT",
          ctr: 2.1,
          spend: 100,
          impressions: 5000,
          dayCount: 7,
        }),
      ],
      {
        campaignResultMapping: "CONFIDENT",
        trackingPerformanceConfidence: "FULL",
      },
    ),
  );
  assert(
    intel.findings.some((f) => f.code === "RESULT_RESPONSE_DIFFERENCE") ||
      intel.primaryObservation === "RESULT_STAGE_DIFFERENCE" ||
      intel.facts.some((f) => /CPL|costo\/risultato/i.test(f)),
    "result-stage evidence",
  );
  assert(intel.unknowns.some((u) => /perché|caus/i.test(u)), "cause unknown");
});

test("AMBIGUOUS-RESULT FIXTURE: traffic ok, CPL blocked", () => {
  const intel = buildCreativeIntelligence(
    baseInput(
      [
        ad({
          metaAdId: "a",
          name: "Ad A",
          ctr: 1.2,
          cpc: 0.8,
          results: null,
          costPerResult: null,
          resultMappingConfidence: "AMBIGUOUS",
          spend: 80,
          impressions: 8000,
          dayCount: 7,
        }),
        ad({
          metaAdId: "b",
          name: "Ad B",
          ctr: 2.6,
          cpc: 0.38,
          results: null,
          costPerResult: null,
          resultMappingConfidence: "AMBIGUOUS",
          spend: 70,
          impressions: 7000,
          dayCount: 7,
        }),
      ],
      { campaignResultMapping: "AMBIGUOUS" },
    ),
  );
  assert(
    intel.findings.some((f) => f.code === "CLICK_RESPONSE_DIFFERENCE"),
    "traffic comparison",
  );
  assert(
    !intel.findings.some((f) => f.code === "RESULT_RESPONSE_DIFFERENCE"),
    "no result winner",
  );
  assert(intel.unknowns.some((u) => /mapping|risultat/i.test(u)), "result stage blocked");
});

test("FATIGUE FIXTURE: freq rise + CTR fall → hypothesis only", () => {
  const rows: NormalizedDailyInsight[] = [];
  for (let i = 0; i < 14; i += 1) {
    const d = `2026-02-${String(i + 1).padStart(2, "0")}`;
    const late = i >= 7;
    rows.push({
      metaCampaignId: "camp_test",
      dateStart: d,
      dateStop: d,
      spend: 12,
      impressions: 2000,
      reach: null,
      clicks: late ? 30 : 60,
      linkClicks: late ? 30 : 60,
      metaCtr: null,
      metaCpc: null,
      metaCpm: null,
      frequency: late ? 2.2 : 1.4,
      actions: [],
      actionValues: [],
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      resultMappingConfidence: "UNKNOWN",
      outcomeLimitation: null,
    });
  }
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "solo",
        name: "Solo",
        insightRows: rows,
        dayCount: 14,
        impressions: 28000,
        spend: 168,
        ctr: 1.5,
        cpc: 0.4,
      }),
    ]),
  );
  assert(
    intel.findings.some((f) => f.code === "POSSIBLE_FATIGUE_PATTERN") ||
      intel.hypotheses.some((h) => /saturazione|perdita di risposta/i.test(h)),
    "fatigue hypothesis",
  );
  assert(!/\bconfirmed fatigue\b|fatigue confirmed/i.test(JSON.stringify(intel)), "not confirmed");
});

test("FREQUENCY-ONLY FIXTURE: no fatigue without CTR fall", () => {
  const rows: NormalizedDailyInsight[] = [];
  for (let i = 0; i < 14; i += 1) {
    const d = `2026-03-${String(i + 1).padStart(2, "0")}`;
    rows.push({
      metaCampaignId: "camp_test",
      dateStart: d,
      dateStop: d,
      spend: 12,
      impressions: 2000,
      reach: null,
      clicks: 50,
      linkClicks: 50,
      metaCtr: null,
      metaCpc: null,
      metaCpm: null,
      frequency: i >= 7 ? 2.5 : 1.5,
      actions: [],
      actionValues: [],
      primaryResultType: null,
      primaryResults: null,
      primaryResultValue: null,
      resultMappingConfidence: "UNKNOWN",
      outcomeLimitation: null,
    });
  }
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "solo",
        name: "Solo",
        insightRows: rows,
        dayCount: 14,
        impressions: 28000,
        spend: 168,
        ctr: 2.5,
      }),
    ]),
  );
  assert(
    !intel.findings.some((f) => f.code === "POSSIBLE_FATIGUE_PATTERN"),
    "no fatigue on freq-only",
  );
});

test("HEALTHY-DIFFERENCE FIXTURE: small CTR gap → neutral", () => {
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "a",
        name: "Ad A",
        ctr: 2.0,
        cpc: 0.5,
        spend: 80,
        impressions: 8000,
        dayCount: 7,
      }),
      ad({
        metaAdId: "b",
        name: "Ad B",
        ctr: 2.1,
        cpc: 0.48,
        spend: 75,
        impressions: 7500,
        dayCount: 7,
      }),
    ]),
  );
  assert(intel.primaryObservation === "NEUTRAL_DIFFERENCE", "neutral");
  assert(
    !intel.findings.some((f) => f.code === "CLICK_RESPONSE_DIFFERENCE"),
    "no forced winner",
  );
});

test("AWARENESS FIXTURE: no CPL / no CTR primary judgement", () => {
  const intel = buildCreativeIntelligence(
    baseInput(
      [
        ad({
          metaAdId: "a",
          name: "Ad A",
          cpm: 8,
          ctr: 0.5,
          spend: 80,
          impressions: 10000,
          dayCount: 7,
        }),
        ad({
          metaAdId: "b",
          name: "Ad B",
          cpm: 12,
          ctr: 1.5,
          spend: 70,
          impressions: 9000,
          dayCount: 7,
        }),
      ],
      {
        objective: "OUTCOME_AWARENESS",
        performanceFamily: "AWARENESS",
        campaignResultMapping: "UNKNOWN",
      },
    ),
  );
  const blob = JSON.stringify(intel);
  assert(!/\bCPL\b/.test(blob), "no CPL");
  assert(!/lead/i.test(blob) || /mapping/i.test(blob), "no lead quality");
  assert(
    !intel.findings.some((f) => f.code === "CLICK_RESPONSE_DIFFERENCE"),
    "CTR not primary for awareness",
  );
});

test("Material change gate reused from M10F", () => {
  assert(MATERIAL_CHANGE_PCT === 20, "shared 20%");
  assert(MIN_IMPRESSIONS_FOR_COMPARE >= 500, "sample gate");
});

test("Cross-objective creative copy leakage scan", () => {
  const src = read("src/lib/meta/creative-intelligence/build.ts");
  assert(!/industry standard|Meta benchmark|scientific/i.test(src), "no fake authority");
  assert(/PERFORMANCE|qualità|QUALITY/i.test(src) || /Non implica/i.test(src), "quality≠perf safety");
  const aw = buildCreativeIntelligence(
    baseInput(
      [
        ad({ metaAdId: "a", name: "A", spend: 80, impressions: 10000, dayCount: 7, cpm: 9 }),
        ad({ metaAdId: "b", name: "B", spend: 70, impressions: 9000, dayCount: 7, cpm: 11 }),
      ],
      { performanceFamily: "AWARENESS", objective: "OUTCOME_AWARENESS" },
    ),
  );
  assert(!/\bCPL\b/.test(JSON.stringify(aw)), "awareness no CPL");
});

test("UI + Ask Ally + session wiring; no ads_management; no migration", () => {
  const panel = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(panel.includes("Intelligenza creativa"), "UI label");
  assert(panel.includes("creativeEvidenceOpen"), "session disclosure");
  assert(panel.includes("CreativeIntelligenceSummary"), "summary component");

  const load = read("src/lib/meta/hierarchy-load.ts");
  assert(load.includes("buildCreativeIntelligence"), "hierarchy wired");
  assert(load.includes("creativeIntelligence"), "field present");

  const types = read("src/lib/ally-copilot/types.ts");
  assert(types.includes("AllyCopilotCreativeIntelligence"), "Ask Ally type");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(prompt.includes("creativeIntelligence"), "Ask Ally prompt");
  assert(prompt.includes("comparisonModeLabelIt"), "Ask Ally italian mode");
  assert(prompt.includes("metaStatusLabelIt"), "Ask Ally status field");
  assert(!/comparisonMode SINGLE_AD_ONLY/.test(prompt), "no enum teaching");

  const sessionTypes = read("src/lib/ally-session-ui/types.ts");
  assert(sessionTypes.includes("creativeEvidenceOpen"), "session key");

  const ci = read("src/lib/meta/creative-intelligence/build.ts");
  assert(!/ads_management/.test(ci), "no ads_management");
  assert(!/localStorage/.test(ci), "no localStorage canonical");

  const migrations = fs.readdirSync(path.join(process.cwd(), "supabase/migrations"));
  assert(!migrations.some((m) => /m10g|creative.intelligence/i.test(m)), "no m10g migration");
});

test("CASE A: PAUSED ad — never call it attiva in creative facts/summary", () => {
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "ad1",
        name: "Nuova inserzione Contatti",
        status: "PAUSED",
        effectiveStatus: "PAUSED",
        spend: 99.97,
        impressions: 14647,
        dayCount: 10,
      }),
    ], { isHistorical: true }),
  );
  const blob = [
    intel.beginnerSummary,
    ...intel.facts,
    ...intel.unknowns,
    intel.nextTest ?? "",
    ...intel.professionalLines.map((l) => l.value),
  ].join("\n");
  assert(!/inserzione attiva/i.test(blob), "no attiva wording");
  assert(/presente una sola inserzione/i.test(blob), "presente wording");
  assert(/In pausa su Meta/i.test(blob), "paused status fact");
});

test("CASE B: SELF_TREND — Italian label, no raw enum in user-facing lines", () => {
  const rows = emptyRows(14, {
    spend: 12,
    impressions: 2000,
    linkClicks: 50,
  });
  // Force two-window by enough delivery days; CTR stable ok
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({
        metaAdId: "solo",
        name: "Solo",
        insightRows: rows,
        dayCount: 14,
        impressions: 28000,
        spend: 168,
      }),
    ]),
  );
  assert(
    intel.comparisonMode === "SELF_TREND" ||
      intel.comparisonMode === "SINGLE_AD_ONLY",
    "mode internal ok",
  );
  if (intel.comparisonMode === "SELF_TREND") {
    assert(
      intel.comparisonModeLabelIt ===
        etichettaComparisonMode("SELF_TREND"),
      "italian label",
    );
  }
  const userFacing = [
    intel.comparisonModeLabelIt,
    ...intel.professionalLines.map((l) => `${l.label}: ${l.value}`),
    intel.beginnerSummary,
  ].join("\n");
  assert(!/\bSELF_TREND\b/.test(userFacing), "no raw SELF_TREND");
  assert(!/\bCROSS_AD\b/.test(userFacing), "no raw CROSS_AD");
  assert(!/\bSINGLE_AD_ONLY\b/.test(userFacing), "no raw SINGLE_AD_ONLY");
});

test("CASE C: scrub Ask Ally prose — attiva + SELF_TREND", () => {
  const scrubbed = scrubAllyCopilotUserFacingText(
    "C'è una sola inserzione attiva. comparisonMode SELF_TREND spiega il calo.",
  );
  assert(!/inserzione attiva/i.test(scrubbed), "scrub attiva");
  assert(!/\bSELF_TREND\b/.test(scrubbed), "scrub enum");
  assert(/andamento della stessa inserzione/i.test(scrubbed), "italian trend");
});

test("Next test copy prefers same ad set + distribution", () => {
  const intel = buildCreativeIntelligence(
    baseInput([
      ad({ metaAdId: "ad1", name: "Solo", dayCount: 10, impressions: 12000 }),
    ]),
  );
  assert(intel.nextTest, "has next test");
  assert(
    /stesso gruppo di inserzioni/i.test(intel.nextTest!),
    "same ad set",
  );
  assert(
    /distribuzione/i.test(intel.nextTest!),
    "distribution not only audience",
  );
});

test("No AI/vision on render (structural)", () => {
  const panel = read("src/components/risultati/MetaHierarchyPanel.tsx");
  assert(!/anthropic|openai|vision|analyze-creative/i.test(panel), "no AI in panel");
  const load = read("src/lib/meta/hierarchy-load.ts");
  assert(!/anthropic|openai/.test(load), "no AI in hierarchy load");
});

console.log(`\n=== M10G VERIFICA: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed) ===\n`);
process.exit(failed === 0 ? 0 : 1);
