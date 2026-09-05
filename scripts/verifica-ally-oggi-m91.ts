/**
 * M9.1 — Ally oggi operational brief verification
 * Pure logic + structural security. No live Anthropic calls.
 */

import fs from "node:fs";
import type { Campagna } from "../src/types/campagne";
import type { CampaignCheck } from "../src/lib/campaign-checks-db";
import type { MetaCampaignMonitoringRow } from "../src/lib/meta/meta-campaign-monitoring-row";
import {
  buildMetaAttentionItem,
  buildNativeAttentionItem,
} from "../src/lib/monday-control-room";
import {
  buildAllyOggiBriefContext,
  estimateAllyOggiPromptChars,
} from "../src/lib/ally-oggi/build-context";
import { buildAllyOggiFallback } from "../src/lib/ally-oggi/fallback";
import { parseAllyOggiBrief } from "../src/lib/ally-oggi/parse";
import {
  sanitizeAllyOggiBriefContext,
  shouldGenerateAllyOggiBrief,
} from "../src/lib/ally-oggi/sanitize-context";
import {
  assertAllyOggiRequestCompatibleWithSonnet5,
  buildAllyOggiAnthropicParams,
} from "../src/lib/ally-oggi/anthropic-request";
import { ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT } from "../src/lib/ally-oggi/types";
import { allyOggiCacheFingerprint } from "../src/lib/ally-oggi/session-cache";
import { isSmallSample } from "../src/lib/campaign-next-action";

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
    nomeCliente: "Aurora",
    iniziali: "AU",
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
    primaryCost: 25,
    ctr: 1,
    cpm: 10,
    cpc: 0.5,
    frequency: 1.2,
    roas: null,
    clicks: 200,
    impressions: 10000,
    healthStatus: "RED",
    signal: null,
    actions: [],
    note: null,
    objective: "LEADS",
    threshold: 18,
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
    clientId: "client-a",
    clientName: "Technon",
    metaCampaignId: "120232108867250161",
    name: "[B2B] Technon",
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_LEADS",
    lastSyncedAt: "2026-09-01T12:00:00Z",
    insightsPeriodSince: "2026-08-01",
    insightsPeriodUntil: "2026-08-31",
    insightsLastSyncedAt: "2026-09-01T12:00:00Z",
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.5,
    primaryResults: 8,
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
    healthStatus: "GREEN",
    ...overrides,
  };
}

console.log("\nM9.1 — Ally oggi operational brief\n");

test("A: no campaigns → should not generate AI", () => {
  assert(
    !shouldGenerateAllyOggiBrief({
      isFirstRunOnboarding: false,
      totalMonitored: 0,
    }),
    "zero campaigns must skip",
  );
});

test("B: onboarding incomplete → should not generate AI", () => {
  assert(
    !shouldGenerateAllyOggiBrief({
      isFirstRunOnboarding: true,
      totalMonitored: 5,
    }),
    "onboarding must skip",
  );
});

test("C: one CRITICAL → fallback prioritizes it", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna({ nomeCliente: "Aurora" }),
    check: check({ healthStatus: "RED", resultsCount: 8 }),
    checksForTrend: [
      check({
        createdAt: "2026-08-20T12:00:00Z",
        primaryCost: 20,
        healthStatus: "YELLOW",
      }),
      check({
        createdAt: "2026-09-01T12:00:00Z",
        primaryCost: 30,
        healthStatus: "RED",
      }),
    ],
  });
  const ctx = buildAllyOggiBriefContext([item]);
  const fb = buildAllyOggiFallback(ctx);
  assert(ctx.counts.critical + ctx.counts.needsAttention >= 1, "attn count");
  assert(fb.priorityItems.length >= 1, "priority item");
  assert(
    fb.priorityItems[0].title.toLowerCase().includes("aurora"),
    fb.priorityItems[0].title,
  );
  assert(!/grande lavoro|ottimo!/i.test(fb.summary), fb.summary);
});

test("D: RED but stable → no panic 'peggior' language forced in fallback", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "RED", resultsCount: 10 }),
    checksForTrend: [
      check({ createdAt: "2026-08-20T12:00:00Z", primaryCost: 24 }),
      check({ createdAt: "2026-09-01T12:00:00Z", primaryCost: 25 }),
    ],
  });
  assert(item.attentionState === "NEEDS_ATTENTION", item.attentionState);
  const fb = buildAllyOggiFallback(buildAllyOggiBriefContext([item]));
  const text = `${fb.headline} ${fb.summary} ${fb.priorityItems.map((i) => i.sentence).join(" ")}`;
  assert(!/collasso|disastro|urgente subito/i.test(text), text);
});

test("E: small sample → conservative flag + wording", () => {
  assert(isSmallSample(2), "2 is small");
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "RED", resultsCount: 2 }),
    checksForTrend: [],
  });
  const ctx = buildAllyOggiBriefContext([item]);
  assert(ctx.campaigns[0]?.smallSample === true, "smallSample");
  const fb = buildAllyOggiFallback(ctx);
  const text = fb.priorityItems.map((i) => i.sentence).join(" ");
  assert(/piccolo|attendere|risultat/i.test(text), text);
});

test("F: missing target → configuration language", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      clientName: "Technon",
      targetValue: null,
      storedTargetValue: null,
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
      primaryResults: 4,
    }),
  });
  assert(
    item.attentionState === "CONFIGURATION_REQUIRED",
    item.attentionState,
  );
  const fb = buildAllyOggiFallback(buildAllyOggiBriefContext([item]));
  assert(fb.configurationItems.length >= 1, "config items");
  assert(
    /soglia|configur/i.test(fb.configurationItems[0].sentence),
    fb.configurationItems[0].sentence,
  );
  assert(fb.priorityItems.length === 0, "not performance priority");
});

test("G: all stable → no invented issue", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "GREEN", primaryCost: 10, resultsCount: 20 }),
    checksForTrend: [
      check({ createdAt: "2026-08-20T12:00:00Z", primaryCost: 12 }),
      check({ createdAt: "2026-09-01T12:00:00Z", primaryCost: 10 }),
    ],
  });
  assert(item.attentionState === "STABLE", item.attentionState);
  const fb = buildAllyOggiFallback(buildAllyOggiBriefContext([item]));
  assert(/non vedo critic/i.test(fb.headline), fb.headline);
  assert(fb.priorityItems.length === 0, "no priority");
});

test("H: mixed Native + Meta → unified context", () => {
  const native = buildNativeAttentionItem({
    campagna: campagna({
      id: "11111111-1111-4111-8111-111111111111",
      nomeCliente: "Aurora",
    }),
    check: check({ healthStatus: "RED", resultsCount: 6 }),
    checksForTrend: [],
  });
  const meta = buildMetaAttentionItem({
    row: metaRow({
      id: "22222222-2222-4222-8222-222222222222",
      clientName: "Technon",
      healthStatus: "GREEN",
    }),
  });
  const ctx = buildAllyOggiBriefContext([native, meta]);
  assert(ctx.totalMonitored === 2, String(ctx.totalMonitored));
  const sources = new Set(ctx.campaigns.map((c) => c.source));
  assert(sources.has("NATIVE") && sources.has("META"), "both sources");
});

test("I: stale Meta → staleMetaCount", () => {
  const old = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const item = buildMetaAttentionItem({
    row: metaRow({ insightsLastSyncedAt: old }),
  });
  const ctx = buildAllyOggiBriefContext([item]);
  assert(ctx.staleMetaCount === 1, String(ctx.staleMetaCount));
  assert(ctx.campaigns[0]?.staleMeta === true, "stale flag");
});

test("J: AI parse failure path → fallback usable", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "YELLOW", resultsCount: 5 }),
    checksForTrend: [],
  });
  const ctx = buildAllyOggiBriefContext([item]);
  const fb = buildAllyOggiFallback(ctx);
  assert(fb.fromAi === false, "fallback not AI");
  assert(typeof fb.summary === "string" && fb.summary.length > 0, "summary");
});

test("K: max campaigns capped; one prompt params", () => {
  const items = Array.from({ length: 12 }, (_, i) => {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, "0")}`;
    return buildNativeAttentionItem({
      campagna: campagna({
        id,
        nomeCliente: `Cliente ${i}`,
        nomeCampagna: `Campagna ${i}`,
      }),
      check: check({
        campaignId: id,
        healthStatus: i === 0 ? "RED" : "GREEN",
        resultsCount: 5 + i,
      }),
      checksForTrend: [],
    });
  });
  const ctx = buildAllyOggiBriefContext(items);
  assert(
    ctx.campaigns.length <= ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT,
    String(ctx.campaigns.length),
  );
  const params = buildAllyOggiAnthropicParams(ctx);
  assert(params.messages.length === 1, "one user message");
  assertAllyOggiRequestCompatibleWithSonnet5(
    params as unknown as Record<string, unknown>,
  );
  const chars = estimateAllyOggiPromptChars(ctx);
  assert(chars < 12_000, `prompt too large: ${chars}`);
});

test("K2: 20 campaigns — CRITICAL last in load order still in top-8", () => {
  const criticalId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const stables = Array.from({ length: 19 }, (_, i) => {
    const id = `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb${String(i).padStart(2, "0")}`;
    return buildNativeAttentionItem({
      campagna: campagna({
        id,
        nomeCliente: `Stable ${i}`,
        nomeCampagna: `Camp ${i}`,
      }),
      check: check({
        campaignId: id,
        healthStatus: "GREEN",
        primaryCost: 10,
        resultsCount: 20,
      }),
      checksForTrend: [
        check({
          campaignId: id,
          createdAt: "2026-08-20T12:00:00Z",
          primaryCost: 11,
          healthStatus: "GREEN",
        }),
        check({
          campaignId: id,
          createdAt: "2026-09-01T12:00:00Z",
          primaryCost: 10,
          healthStatus: "GREEN",
        }),
      ],
    });
  });
  const critical = buildNativeAttentionItem({
    campagna: campagna({
      id: criticalId,
      nomeCliente: "Aurora Critica",
      nomeCampagna: "Lead Gen Critica",
    }),
    check: check({
      campaignId: criticalId,
      healthStatus: "RED",
      primaryCost: 40,
      resultsCount: 12,
    }),
    checksForTrend: [
      check({
        campaignId: criticalId,
        createdAt: "2026-08-20T12:00:00Z",
        primaryCost: 20,
        healthStatus: "YELLOW",
      }),
      check({
        campaignId: criticalId,
        createdAt: "2026-09-01T12:00:00Z",
        primaryCost: 40,
        healthStatus: "RED",
      }),
    ],
  });
  assert(
    critical.attentionState === "CRITICAL" ||
      critical.attentionState === "NEEDS_ATTENTION",
    critical.attentionState,
  );
  // CRITICAL appended last — must still win truncation.
  const ctx = buildAllyOggiBriefContext([...stables, critical]);
  assert(ctx.totalMonitored === 20, String(ctx.totalMonitored));
  assert(ctx.campaigns.length === 8, String(ctx.campaigns.length));
  assert(
    ctx.campaigns.some((c) => c.campaignId === criticalId),
    "CRITICAL displaced by load order",
  );
  assert(
    ctx.campaigns[0]?.campaignId === criticalId,
    `expected critical first, got ${ctx.campaigns[0]?.campaignId} (${ctx.campaigns[0]?.attentionState})`,
  );
  const fb = buildAllyOggiFallback(ctx);
  assert(fb.priorityItems.some((i) => i.campaignId === criticalId), "priority");
  assert(/richiede attenzione|richiedono attenzione/i.test(fb.summary), fb.summary);
});

test("K3: cache fingerprint invalidates on health change", () => {
  const base = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "RED", resultsCount: 8 }),
    checksForTrend: [],
  });
  const a = buildAllyOggiBriefContext([base]);
  const b = buildAllyOggiBriefContext([
    {
      ...base,
      healthStatus: "YELLOW",
    },
  ]);
  assert(
    allyOggiCacheFingerprint(a) !== allyOggiCacheFingerprint(b),
    "fingerprint must change with health",
  );
});

test("L: sanitize rejects secrets / emails keys", () => {
  let threw = false;
  try {
    sanitizeAllyOggiBriefContext({
      totalMonitored: 1,
      counts: {
        critical: 0,
        needsAttention: 0,
        monitor: 0,
        stable: 1,
        configurationRequired: 0,
        insufficientData: 0,
        historical: 0,
      },
      staleMetaCount: 0,
      access_token: "secret",
      campaigns: [],
    });
  } catch {
    threw = true;
  }
  assert(threw, "must reject token field");
});

test("M: parse maps href from facts; rejects unknown campaign", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "RED", resultsCount: 5 }),
    checksForTrend: [],
  });
  const ctx = buildAllyOggiBriefContext([item]);
  const id = ctx.campaigns[0].campaignId;
  const brief = parseAllyOggiBrief(
    JSON.stringify({
      headline: "Priorità chiara.",
      summary: "Ho controllato 1 campagna.",
      priority_items: [
        {
          campaignId: id,
          source: "NATIVE",
          title: "Aurora · Lead Gen",
          sentence: "Questa è la campagna che guarderei per prima.",
          recommendedHref: "/hacker",
        },
        {
          campaignId: "00000000-0000-4000-8000-000000000099",
          source: "NATIVE",
          title: "Fake",
          sentence: "Inventata.",
          recommendedHref: "/x",
        },
      ],
      watch_items: [],
      configuration_items: [],
      closing_note: null,
    }),
    ctx,
  );
  assert(brief.priorityItems.length === 1, "only known campaign");
  assert(
    brief.priorityItems[0].recommendedHref === ctx.campaigns[0].href,
    brief.priorityItems[0].recommendedHref,
  );
  assert(brief.fromAi === true, "fromAi");
});

test("N: structural — no Meta writes / no health mutation / no cron AI", () => {
  const files = [
    "src/lib/ally-oggi/service.ts",
    "src/lib/ally-oggi/build-context.ts",
    "src/lib/ally-oggi/fallback.ts",
    "src/lib/ally-oggi/parse.ts",
    "src/app/api/ally-oggi/route.ts",
    "src/components/dashboard/AllyOggiBrief.tsx",
    "src/components/dashboard/DashboardHome.tsx",
  ];
  const mutateRe =
    /\b(healthStatus|urgencyLevel|attentionState)\s*=(?!=)/;
  for (const f of files) {
    const src = read(f);
    assert(!/ads_management|pauseCampaign|updateAdSet|\/act_\d+/i.test(src), f);
    if (f.includes("ally-oggi/") || f.includes("api/ally-oggi")) {
      assert(!mutateRe.test(src), `no domain mutation assign in ${f}`);
      assert(
        !/\.update\(|\.upsert\(|from\(["']campaign_checks/.test(src),
        `no DB write ${f}`,
      );
      assert(!/cron|setInterval\(|node-cron/i.test(src), `no background ${f}`);
    }
  }
  const home = read("src/components/dashboard/DashboardHome.tsx");
  assert(home.includes("AllyOggiBriefPanel"), "Home wires Ally oggi");
  const blockMatch = home.match(
    /showControlRoom[\s\S]*?AllyOggiBriefPanel[\s\S]*?MondayControlRoomSection/,
  );
  assert(Boolean(blockMatch), "Ally oggi above Control Room in Home JSX");
});

test("O: multi-client names present in context", () => {
  const a = buildNativeAttentionItem({
    campagna: campagna({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      nomeCliente: "Aurora",
    }),
    check: check({ healthStatus: "RED", resultsCount: 5 }),
    checksForTrend: [],
  });
  const b = buildMetaAttentionItem({
    row: metaRow({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      clientName: "Technon",
      healthAvailability: "TARGET_REQUIRED",
      targetValue: null,
      storedTargetValue: null,
      healthStatus: null,
    }),
  });
  const ctx = buildAllyOggiBriefContext([
    { ...a, campaignId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    b,
  ]);
  const names = ctx.campaigns.map((c) => c.clientName).join(",");
  assert(names.includes("Aurora") && names.includes("Technon"), names);
});

console.log(`\nM9.1 result: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
