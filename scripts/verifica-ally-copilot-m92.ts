/**
 * M9.2 / M9.2A — Ask Ally campaign copilot verification
 * Pure logic + structural security. No live Anthropic calls.
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildAllyCampaignCopilotContext,
  estimateAllyCopilotInputChars,
  assertAllyCopilotPayloadSafe,
  fitAllyCopilotInput,
  type AllyCopilotIdentityInput,
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
import {
  buildAllyCopilotConfigurationInventory,
  type AllyCopilotNativePlanningSnapshot,
} from "../src/lib/ally-copilot/configuration-inventory";

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

function baseSnapshot(
  overrides: Partial<AllyCopilotNativePlanningSnapshot> = {},
): AllyCopilotNativePlanningSnapshot {
  return {
    objective: "LEADS",
    clientName: "Aurora",
    settore: "Dentista",
    citta: "Milano",
    offer: "Visita di controllo",
    dailyBudget: 20,
    maxSustainableCpa: 35,
    targetMargin: 50,
    etaMin: 25,
    etaMax: 55,
    raggioKm: 15,
    targetType: "B2C",
    targetAge: "25-50",
    headline: "Prenota ora",
    copyVariants: ["Variante A", "Variante B"],
    hasCreativeAsset: true,
    creativeFormatHint: "1080×1080",
    pageId: null,
    formId: null,
    website: null,
    bookingChannel: null,
    status: "DRAFT",
    approvedAt: null,
    ...overrides,
  };
}

function baseIdentity(
  overrides: Partial<AllyCopilotIdentityInput> = {},
): AllyCopilotIdentityInput {
  const snap =
    "planningSnapshot" in overrides
      ? overrides.planningSnapshot ?? null
      : baseSnapshot();
  return {
    campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    source: "NATIVE",
    clientName:
      snap && "clientName" in snap ? snap.clientName : "Aurora",
    campaignName: "Lead Gen",
    href: "/campagne/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    linkedNativeId: null,
    planningSnapshot: snap,
    configurationKind: "DRAFT",
    nextActionType: "REVIEW_CAMPAIGN_SETUP",
    nextActionTitle: "Completa configurazione",
    nextActionHref: "/campagne/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ...overrides,
  };
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
    identity: baseIdentity(),
    payload: basePayload(),
  });
  assert(ctx.performance.results == null, "no results");
  assert(ctx.performance.noPerformanceDataYet === true, "no perf flag");
  assert(ctx.planning.offer === "Visita di controllo", "offer present");
  assert(ctx.planning.copyVariants.length === 2, "copy");
  assert(ctx.configuration.fields.length > 0, "inventory present");
  const sug = buildAllyCopilotSuggestions(ctx);
  assert(sug.some((s) => /lancio|pronta|tester/i.test(s)), sug.join("|"));
});

test("B: Meta with target + data → performance-oriented suggestions", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity({
      source: "META",
      href: "/risultati",
      planningSnapshot: null,
      configurationKind: null,
      nextActionType: "REVIEW_CREATIVE",
      nextActionTitle: "Rivedi creatività",
      nextActionHref: "/risultati",
    }),
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
  assert(
    sug.some((s) => /attenzione|interverr|sostenibile/i.test(s)),
    sug.join("|"),
  );
  assert(ctx.economics.targetValue === 30, "target");
});

test("C: small sample → conservative flag + confidence cap on parse", () => {
  assert(isSmallSample(2), "2 is small");
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity({
      configurationKind: null,
      planningSnapshot: baseSnapshot({ status: "APPROVED", approvedAt: "2026-01-01" }),
    }),
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
    identity: baseIdentity({
      source: "META",
      href: "/risultati",
      planningSnapshot: null,
      configurationKind: "ACTIVE_MISSING_TARGET",
    }),
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

test("E: lead quality without CRM → missing info in prompt rules", () => {
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/qualità lead|missing_information|UNKNOWN/i.test(prompt), "prompt");
});

test("F: creative failure without evidence → hypothesis only", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity(),
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
  assert(/immagine non funziona|IPOTESI|hasCreativeAnalysisEvidence/i.test(prompt), "prompt");
});

test("G: configuration-required suggestions explain missing config", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity({
      source: "META",
      href: "/risultati",
      planningSnapshot: null,
      configurationKind: "ACTIVE_MISSING_TARGET",
    }),
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
    identity: baseIdentity({
      source: "LINKED",
      href: "/risultati",
      linkedNativeId: "22222222-2222-4222-8222-222222222222",
      planningSnapshot: baseSnapshot(),
    }),
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
  assert(ctx.configuration.fields.length > 0, "planning from linked native");
});

test("I/J: ownership validated server-side (structural)", () => {
  const load = read("src/lib/ally-copilot/load-context.ts");
  const route = read("src/app/api/ally-copilot/route.ts");
  assert(load.includes("FORBIDDEN"), "forbidden");
  assert(route.includes("requireRouteUserId"), "auth");
  assert(route.includes("body.context != null"), "reject client context");
});

test("K: Anthropic failure → fallback usable", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity(),
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
  const bootBlock = ui.slice(ui.indexOf("useEffect"), ui.indexOf("async function ask"));
  assert(!bootBlock.includes('method: "POST"'), "bootstrap is GET-only");
});

test("O: no Meta writes", () => {
  for (const f of [
    "src/lib/ally-copilot/service.ts",
    "src/lib/ally-copilot/prompt.ts",
    "src/app/api/ally-copilot/route.ts",
  ]) {
    assert(!/graph\.facebook|pauseCampaign|updateBudget/i.test(read(f)), f);
  }
});

test("Sanitize question + history bounds", () => {
  assert(sanitizeAllyCopilotQuestion("  Ciao?  ") === "Ciao?", "trim");
  const hist = sanitizeAllyCopilotHistory(
    Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: String(i),
    })),
  );
  assert(hist.length <= 6, String(hist.length));
});

test("Anthropic Sonnet 5 compatibility + input size", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity(),
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
  assert(read("src/app/campagne/[id]/page.tsx").includes("ChiediAdAllyPanel"), "native");
  assert(read("src/components/risultati/MetaCampagneSection.tsx").includes('source="META"'), "meta");
});

test("No localStorage campaign truth in copilot", () => {
  for (const f of [
    "src/lib/ally-copilot/load-context.ts",
    "src/lib/ally-copilot/build-context.ts",
  ]) {
    assert(!read(f).includes("getCampaigns"), f);
  }
});

test("Truncation: drop oldest history first; preserve question + canonical facts", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity({
      planningSnapshot: baseSnapshot({
        offer: "O".repeat(300),
        copyVariants: ["A".repeat(400), "B".repeat(400)],
      }),
    }),
    payload: basePayload({ targetValue: 35, primaryKpi: "CPL" }),
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
  assert(fitted.droppedHistoryTurns > 0, "history reduced");
  assert(fitted.context.economics.maxSustainableCpa === 35, "target kept");
  assert(
    fitted.context.workflow.attentionState === "CONFIGURATION_REQUIRED",
    "attention kept",
  );
});

test("Route uses fitAllyCopilotInput before AI", () => {
  assert(read("src/app/api/ally-copilot/route.ts").includes("fitAllyCopilotInput"), "fit");
});

test("Confidence does not masquerade as Control Room; creative/visual safety", () => {
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/NON sostituisce/i.test(prompt), "CR confidence");
  assert(/confidence UNKNOWN|UNKNOWN/i.test(prompt), "UNKNOWN");
  assert(/immagine non funziona/i.test(prompt), "no fake visual");
});

// ——— M9.2A configuration inventory ———

test("M9.2A A: field complete → inventory complete", () => {
  const inv = buildAllyCopilotConfigurationInventory(baseSnapshot());
  const budget = inv.fields.find((f) => f.id === "budget");
  assert(budget?.status === "complete", String(budget?.status));
  assert(budget?.value?.includes("20"), String(budget?.value));
});

test("M9.2A B: field missing → inventory missing", () => {
  const inv = buildAllyCopilotConfigurationInventory(
    baseSnapshot({ pageId: null, formId: null, website: null }),
  );
  const page = inv.fields.find((f) => f.id === "pageId");
  assert(page?.status === "missing", String(page?.status));
  assert(inv.launchReadiness.items.some((i) => i.id === "pageId" && !i.ok), "LR missing page");
});

test("M9.2A C: unavailable ≠ missing (Strategic Score / CTA)", () => {
  const inv = buildAllyCopilotConfigurationInventory(baseSnapshot());
  const score = inv.fields.find((f) => f.id === "strategicScore");
  assert(score?.status === "unavailable", "score unavailable");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/unavailable.*NON dire che manca|NON dire che manca/i.test(prompt), "prompt rule");
});

test("M9.2A D: pre-launch question — performance absence only as flag", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity(),
    payload: basePayload(),
  });
  assert(ctx.performance.noPerformanceDataYet === true, "flag");
  const prompt = read("src/lib/ally-copilot/prompt.ts");
  assert(/UNA breve precisazione|noPerformanceDataYet/i.test(prompt), "brief perf");
});

test("M9.2A E: UI no raw English confidence/fatti labels", () => {
  const ui = read("src/components/campagne/ChiediAdAllyPanel.tsx");
  assert(ui.includes("Cosa so"), "cosa so");
  assert(ui.includes("Cosa manca o non è verificabile"), "cosa manca");
  assert(ui.includes("Prossimo passo"), "next");
  assert(!ui.includes("Confidenza: {latest.confidence}"), "no raw confidence always");
  assert(!ui.includes(">Fatti<") && !ui.includes("Fatti\n"), "no Fatti header");
});

test("M9.2A F: confidence aligned — scrub internal labels", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity(),
    payload: basePayload(),
  });
  const parsed = parseAllyCopilotAnswer(
    JSON.stringify({
      answer: "La campagna è in DRAFT e CONFIGURATION_REQUIRED.",
      confidence: "HIGH",
      evidence: ["Attention reason: bozza"],
      hypotheses: [],
      missing_information: [],
      suggested_next_questions: ["Vuoi che controlli il copy?"],
      recommended_action_href: null,
    }),
    ctx,
  );
  assert(!/CONFIGURATION_REQUIRED|Attention reason|\bDRAFT\b/.test(parsed.answer), parsed.answer);
  assert(!/Attention reason/.test(parsed.evidence.join(" ")), "evidence scrubbed");
});

test("M9.2A G: no second readiness engine — reuses calculateLaunchReadiness", () => {
  const invMod = read("src/lib/ally-copilot/configuration-inventory.ts");
  assert(invMod.includes("calculateLaunchReadiness"), "reuses LR");
  assert(!invMod.includes("function inventReadiness"), "no invent");
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity({
      planningSnapshot: baseSnapshot({
        pageId: "123",
        formId: "456",
        hasCreativeAsset: true,
        status: "APPROVED",
        approvedAt: "2026-01-01",
      }),
    }),
    payload: basePayload({ status: "APPROVED" }),
  });
  assert(ctx.configuration.launchReadiness != null, "LR present");
  assert(Array.isArray(ctx.configuration.launchReadiness?.missingLabels), "labels");
});

test("M9.2A Aurora-like: some complete some missing", () => {
  const ctx = buildAllyCampaignCopilotContext({
    identity: baseIdentity({
      planningSnapshot: baseSnapshot({
        dailyBudget: 25,
        offer: "Sbiancamento",
        pageId: null,
        formId: null,
        hasCreativeAsset: false,
      }),
    }),
    payload: basePayload(),
  });
  const byId = Object.fromEntries(
    ctx.configuration.fields.map((f) => [f.id, f.status]),
  );
  assert(byId.budget === "complete", "budget complete");
  assert(byId.offer === "complete", "offer complete");
  assert(byId.pageId === "missing", "page missing");
  assert(byId.creative === "missing", "creative missing");
  assert(byId.strategicScore === "unavailable", "score unavailable");
  assert(ctx.workflow.statusLabelIt === "Bozza", ctx.workflow.statusLabelIt);
});

console.log(`\nM9.2 result: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
