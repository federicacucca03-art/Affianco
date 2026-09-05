/**
 * M9.2 — Ask Ally campaign copilot verification
 * Pure logic + structural security. No live Anthropic calls.
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildAllyCampaignCopilotContext,
  estimateAllyCopilotInputChars,
  assertAllyCopilotPayloadSafe,
  fitAllyCopilotInput,
} from "../src/lib/ally-copilot/build-context";
import { buildAllyCopilotSuggestions } from "../src/lib/ally-copilot/suggestions";
import {
  sanitizeAllyCopilotQuestion,
  sanitizeAllyCopilotHistory,
} from "../src/lib/ally-copilot/sanitize";
import {
  parseAllyCopilotAnswer,
  buildAllyCopilotFallbackAnswer,
} from "../src/lib/ally-copilot/parse";
import {
  assertAllyCopilotRequestCompatibleWithSonnet5,
  buildAllyCopilotAnthropicParams,
} from "../src/lib/ally-copilot/anthropic-request";
import { ALLY_COPILOT_MAX_INPUT_CHARS } from "../src/lib/ally-copilot/types";
import type { CampaignDiagnosisAiPayload } from "../src/lib/campaign-diagnosis/types";
import { isSmallSample } from "../src/lib/campaign-next-action";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function basePayload(
  overrides: Partial<CampaignDiagnosisAiPayload> = {},
): CampaignDiagnosisAiPayload {
  return {
    source: "NATIVE",
    objective: "LEADS",
    status: "DRAFT",
    monitoringMode: "ACTIVE",
    health: null,
    attentionState: "CONFIGURATION_REQUIRED",
    urgencyLevel: "NONE",
    attentionReason: "Campagna in bozza.",
    primaryKpi: null,
    actualValue: null,
    targetValue: null,
    metrics: {
      spend: null,
      impressions: null,
      linkClicks: null,
      ctr: null,
      cpc: null,
      cpm: null,
      frequency: null,
      results: null,
    },
    comparisons: { ctr: null, cpc: null, cpm: null, frequency: null },
    hasDownstreamQualityEvidence: false,
    hasCreativeAnalysisEvidence: false,
    trend: "INSUFFICIENT",
    resultMappingConfidence: null,
    economics: {
      maxSustainableCpa: 35,
      dailyBudget: 20,
      targetMargin: 50,
    },
    campaignPlan: {
      objective: "LEADS",
      offer: "Visita di controllo",
      settore: "Dentista",
      audienceHint: "Milano, 25-55",
    },
    creativeContext: {
      hasCreativeAsset: true,
      formatHint: "static",
    },
    ...overrides,
  };
}

console.log("\nM9.2 — Ask Ally campaign copilot\n");

test("A: native DRAFT → planning suggestions, no fake performance in context", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "NATIVE",
      clientName: "Aurora",
      campaignName: "Lead Gen",
      href: "/campagne/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      linkedNativeId: null,
      citta: "Milano",
      copyVariants: ["Variante A", "Variante B"],
      headline: "Prenota ora",
      configurationKind: "DRAFT",
      nextActionType: "REVIEW_CAMPAIGN_SETUP",
      nextActionTitle: "Completa configurazione",
      nextActionHref: "/campagne/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
    payload: basePayload(),
  });
  assert(ctx.performance.results == null, "no results");
  assert(ctx.planning.offer === "Visita di controllo", "offer present");
  assert(ctx.planning.copyVariants.length === 2, "copy");
  const sug = buildAllyCopilotSuggestions(ctx);
  assert(sug.some((s) => /lancio|pronta|tester/i.test(s)), sug.join("|"));
  assert(!sug.some((s) => /CPL|critica/i.test(s)), "no perf chips");
});

test("B: Meta with target + data → performance-oriented suggestions", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      source: "META",
      clientName: "Technon",
      campaignName: "Meta Lead",
      href: "/risultati",
      linkedNativeId: null,
      citta: null,
      copyVariants: [],
      headline: null,
      configurationKind: null,
      nextActionType: "REVIEW_CREATIVE",
      nextActionTitle: "Rivedi creatività",
      nextActionHref: "/risultati",
    },
    payload: basePayload({
      source: "META",
      status: "ACTIVE",
      health: "RED",
      attentionState: "NEEDS_ATTENTION",
      urgencyLevel: "NOW",
      attentionReason: "Costo sopra soglia.",
      primaryKpi: "CPL",
      actualValue: 48,
      targetValue: 30,
      metrics: {
        spend: 240,
        impressions: 12000,
        linkClicks: 180,
        ctr: 1.5,
        cpc: 1.3,
        cpm: 20,
        frequency: 1.8,
        results: 5,
      },
      trend: "WORSENING",
    }),
  });
  const sug = buildAllyCopilotSuggestions(ctx);
  assert(sug.some((s) => /attenzione|interverr|sostenibile/i.test(s)), sug.join("|"));
  assert(ctx.economics.targetValue === 30, "target");
  assert(ctx.performance.actualValue === 48, "actual");
});

test("C: small sample → conservative flag + confidence cap on parse", () => {
  assert(isSmallSample(2), "2 is small");
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      source: "NATIVE",
      clientName: "Aurora",
      campaignName: "Lead",
      href: "/campagne/x",
      linkedNativeId: null,
      citta: null,
      copyVariants: [],
      headline: null,
      configurationKind: null,
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: null,
    },
    payload: basePayload({
      status: "APPROVED",
      attentionState: "INSUFFICIENT_DATA",
      metrics: {
        spend: 40,
        impressions: 2000,
        linkClicks: 30,
        ctr: 1.2,
        cpc: 1.3,
        cpm: 20,
        frequency: 1.1,
        results: 2,
      },
      actualValue: 20,
      targetValue: 30,
      health: "YELLOW",
    }),
  });
  assert(ctx.performance.smallSample === true, "smallSample");
  const sug = buildAllyCopilotSuggestions(ctx);
  assert(sug.some((s) => /Aspetteresti|dati/i.test(s)), sug.join("|"));
  const parsed = parseAllyCopilotAnswer(
    JSON.stringify({
      answer: "Con pochi risultati non interverrei ancora.",
      confidence: "HIGH",
      evidence: ["Ci sono solo 2 risultati."],
      hypotheses: [],
      missing_information: [],
      suggested_next_questions: [],
      recommended_action_href: null,
    }),
    ctx,
  );
  assert(parsed.confidence === "MEDIUM", "HIGH capped for small sample");
});

test("D: missing target → sustainability cannot be judged (suggestions)", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      source: "META",
      clientName: "X",
      campaignName: "Y",
      href: "/risultati",
      linkedNativeId: null,
      citta: null,
      copyVariants: [],
      headline: null,
      configurationKind: "ACTIVE_MISSING_TARGET",
      nextActionType: "SET_TARGET",
      nextActionTitle: "Imposta soglia",
      nextActionHref: "/risultati",
    },
    payload: basePayload({
      source: "META",
      status: "ACTIVE",
      attentionState: "CONFIGURATION_REQUIRED",
      attentionReason: "Manca la soglia.",
      targetValue: null,
      metrics: {
        spend: 100,
        impressions: 5000,
        linkClicks: 50,
        ctr: 1,
        cpc: 2,
        cpm: 20,
        frequency: 1.2,
        results: 4,
      },
    }),
  });
  assert(ctx.economics.targetValue == null, "no target");
  const sug = buildAllyCopilotSuggestions(ctx);
  assert(sug.some((s) => /configur|valutar/i.test(s)), sug.join("|"));
});

test("E: lead quality without CRM → missing info in prompt rules + parse shape", () => {
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/qualità lead|missing_information|UNKNOWN/i.test(prompt), "prompt");
  assert(/hasDownstreamQualityEvidence/i.test(prompt) || /evidenza/i.test(prompt), "evidence");
});

test("F: creative failure without evidence → hypothesis only (prompt + flags)", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      source: "NATIVE",
      clientName: "A",
      campaignName: "B",
      href: "/campagne/x",
      linkedNativeId: null,
      citta: null,
      copyVariants: ["Copy"],
      headline: "H",
      configurationKind: null,
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: null,
    },
    payload: basePayload({
      status: "APPROVED",
      attentionState: "NEEDS_ATTENTION",
      hasCreativeAnalysisEvidence: false,
      metrics: {
        spend: 80,
        impressions: 4000,
        linkClicks: 40,
        ctr: 1,
        cpc: 2,
        cpm: 20,
        frequency: 1.4,
        results: 5,
      },
    }),
  });
  assert(ctx.performance.hasCreativeAnalysisEvidence === false, "no creative analysis");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/non fingere|immagine creativa|IPOTESI/i.test(prompt), prompt.slice(0, 200));
});

test("G: configuration-required suggestions explain missing config", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      source: "META",
      clientName: "C",
      campaignName: "D",
      href: "/risultati",
      linkedNativeId: null,
      citta: null,
      copyVariants: [],
      headline: null,
      configurationKind: "ACTIVE_MISSING_TARGET",
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: null,
    },
    payload: basePayload({
      source: "META",
      attentionState: "CONFIGURATION_REQUIRED",
      attentionReason: "Serve la soglia.",
      status: "ACTIVE",
    }),
  });
  const sug = buildAllyCopilotSuggestions(ctx);
  assert(sug.some((s) => /configur|non può valutar/i.test(s)), sug.join("|"));
});

test("H: linked source marked LINKED without duplicate metrics fields", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "11111111-1111-4111-8111-111111111111",
      source: "LINKED",
      clientName: "Aurora",
      campaignName: "Meta+Native",
      href: "/risultati",
      linkedNativeId: "22222222-2222-4222-8222-222222222222",
      citta: "Milano",
      copyVariants: ["A"],
      headline: null,
      configurationKind: null,
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: null,
    },
    payload: basePayload({
      source: "META",
      status: "ACTIVE",
      attentionState: "STABLE",
      health: "GREEN",
      metrics: {
        spend: 50,
        impressions: 3000,
        linkClicks: 40,
        ctr: 1.3,
        cpc: 1.2,
        cpm: 16,
        frequency: 1.1,
        results: 8,
      },
    }),
  });
  assert(ctx.identity.source === "LINKED", "linked");
  assert(ctx.linkedNativeId != null, "native id");
  const keys = Object.keys(ctx.performance);
  assert(!keys.includes("nativeSpend"), "no duplicate native spend");
});

test("I/J: ownership validated server-side (structural)", () => {
  const load = read("src/lib/ally-copilot/load-context.ts");
  const route = read("src/app/api/ally-copilot/route.ts");
  assert(load.includes("FORBIDDEN"), "forbidden");
  assert(load.includes("user_id !== userId") || load.includes("loadDiagnosisBundle"), "ownership");
  assert(route.includes("requireRouteUserId"), "auth");
  assert(route.includes("body.context != null"), "reject client context");
  assert(route.includes("DiagnosisLoadError"), "map load errors");
});

test("K: Anthropic failure → fallback usable", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "NATIVE",
      clientName: "A",
      campaignName: "B",
      href: "/campagne/x",
      linkedNativeId: null,
      citta: null,
      copyVariants: [],
      headline: null,
      configurationKind: "DRAFT",
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: "/campagne/x",
    },
    payload: basePayload(),
  });
  const fb = buildAllyCopilotFallbackAnswer(ctx);
  assert(fb.fromAi === false, "not AI");
  assert(/Non riesco a rispondere/i.test(fb.answer), fb.answer);
});

test("L: one question → max 1 AI call (structural)", () => {
  const service = read("src/lib/ally-copilot/service.ts");
  const route = read("src/app/api/ally-copilot/route.ts");
  assert((service.match(/messages\.create/g) ?? []).length === 1, "one create");
  assert(route.includes("aiCalls: answer.fromAi ? 1 : 0"), "report 0/1");
});

test("M/N: page render + suggestions → 0 AI calls", () => {
  const ui = read("src/components/campagne/ChiediAdAllyPanel.tsx");
  const route = read("src/app/api/ally-copilot/route.ts");
  assert(ui.includes("/api/ally-copilot?"), "GET bootstrap");
  assert(route.includes("aiCalls: 0"), "GET 0 AI");
  assert(ui.includes("provisionalSuggestions"), "chips");
  // POST only inside ask(), not on mount bootstrap
  assert(ui.includes("async function ask"), "ask handler");
  assert(ui.includes('method: "POST"'), "POST on ask");
  const bootBlock = ui.slice(ui.indexOf("useEffect"), ui.indexOf("async function ask"));
  assert(!bootBlock.includes('method: "POST"'), "bootstrap is GET-only");
});

test("O: no Meta writes", () => {
  const files = [
    "src/lib/ally-copilot/service.ts",
    "src/lib/ally-copilot/prompt.ts",
    "src/app/api/ally-copilot/route.ts",
    "src/components/campagne/ChiediAdAllyPanel.tsx",
  ];
  for (const f of files) {
    const t = read(f);
    assert(!/graph\.facebook|pauseCampaign|updateBudget|meta\.com\/v/i.test(t), f);
  }
});

test("Sanitize question + history bounds", () => {
  assert(sanitizeAllyCopilotQuestion("  Ciao?  ") === "Ciao?", "trim");
  let threw = false;
  try {
    sanitizeAllyCopilotQuestion("");
  } catch {
    threw = true;
  }
  assert(threw, "empty throws");
  const hist = sanitizeAllyCopilotHistory([
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
    { role: "assistant", content: "d" },
    { role: "user", content: "e" },
    { role: "assistant", content: "f" },
    { role: "user", content: "g" },
    { role: "assistant", content: "h" },
  ]);
  assert(hist.length <= 6, String(hist.length));
});

test("Anthropic Sonnet 5 compatibility + input size", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "NATIVE",
      clientName: "Aurora",
      campaignName: "Lead",
      href: "/campagne/x",
      linkedNativeId: null,
      citta: "Milano",
      copyVariants: ["A", "B"],
      headline: "H",
      configurationKind: "DRAFT",
      nextActionType: null,
      nextActionTitle: null,
      nextActionHref: null,
    },
    payload: basePayload(),
  });
  assertAllyCopilotPayloadSafe(ctx);
  const chars = estimateAllyCopilotInputChars(ctx, "Cosa manca?", 2);
  assert(chars < ALLY_COPILOT_MAX_INPUT_CHARS, String(chars));
  const params = buildAllyCopilotAnthropicParams({
    context: ctx,
    question: "Cosa manca prima del lancio?",
    history: [],
  });
  assertAllyCopilotRequestCompatibleWithSonnet5(
    params as unknown as Record<string, unknown>,
  );
});

test("UI wired on native detail + Meta section", () => {
  const detail = read("src/app/campagne/[id]/page.tsx");
  const meta = read("src/components/risultati/MetaCampagneSection.tsx");
  assert(detail.includes("ChiediAdAllyPanel"), "native");
  assert(detail.includes('source="NATIVE"'), "native source");
  assert(meta.includes("ChiediAdAllyPanel"), "meta");
  assert(meta.includes('source="META"'), "meta source");
});

test("No localStorage campaign truth in copilot", () => {
  const files = [
    "src/lib/ally-copilot/load-context.ts",
    "src/lib/ally-copilot/build-context.ts",
    "src/components/campagne/ChiediAdAllyPanel.tsx",
  ];
  for (const f of files) {
    const t = read(f);
    assert(!t.includes("getCampaigns"), f);
    assert(!t.includes("affianco-campaign-memory"), f);
  }
});

test("Truncation: drop oldest history first; preserve question + canonical facts", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: {
      campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "NATIVE",
      clientName: "Aurora",
      campaignName: "Lead Gen",
      href: "/campagne/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      linkedNativeId: null,
      citta: "Milano",
      copyVariants: [
        "A".repeat(400),
        "B".repeat(400),
        "C".repeat(400),
      ],
      headline: "H".repeat(200),
      configurationKind: "DRAFT",
      nextActionType: "REVIEW_CAMPAIGN_SETUP",
      nextActionTitle: "Completa configurazione",
      nextActionHref: "/campagne/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
    payload: basePayload({
      campaignPlan: {
        objective: "LEADS",
        offer: "O".repeat(300),
        settore: "Dentista",
        audienceHint: "A".repeat(300),
      },
      targetValue: 35,
      primaryKpi: "CPL",
      actualValue: null,
      health: null,
      attentionState: "CONFIGURATION_REQUIRED",
      urgencyLevel: "NONE",
    }),
  });
  const question = "Cosa manca prima del lancio?";
  const history = Array.from({ length: 6 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `Turno storico molto lungo ${i} ${"x".repeat(800)}`,
  }));
  const fitted = fitAllyCopilotInput({
    context: ctx,
    question,
    history,
    maxChars: 3500,
  });
  assert(fitted.question === question, "question preserved");
  assert(
    fitted.droppedHistoryTurns > 0 || fitted.history.length < history.length,
    "history reduced",
  );
  assert(fitted.context.identity.campaignId === ctx.identity.campaignId, "id");
  assert(fitted.context.economics.targetValue === 35, "target kept");
  assert(
    fitted.context.workflow.attentionState === "CONFIGURATION_REQUIRED",
    "attention kept",
  );
  assert(
    fitted.context.decision.nextActionType === "REVIEW_CAMPAIGN_SETUP",
    "next action kept",
  );
  assert(
    estimateAllyCopilotInputChars(
      fitted.context,
      fitted.question,
      fitted.history,
    ) <= 3500 || fitted.history.length === 0,
    "under ceiling after history drop / planning trim",
  );
});

test("Route uses fitAllyCopilotInput before AI", () => {
  const route = read("src/app/api/ally-copilot/route.ts");
  assert(route.includes("fitAllyCopilotInput"), "fit used");
});

test("Confidence does not masquerade as Control Room; creative/visual safety", () => {
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/NON sostituisce.*Control Room|NON sostituisce health/i.test(prompt), "CR confidence");
  assert(/confidence UNKNOWN/i.test(prompt), "UNKNOWN for missing");
  assert(/immagine non funziona/i.test(prompt), "no fake visual claim");
});

console.log(`\nM9.2 result: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
