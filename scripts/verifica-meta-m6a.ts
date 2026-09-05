/**
 * M6A — Monday Control Room foundation verification
 */

import fs from "node:fs";
import type { Campagna } from "../src/types/campagne";
import type { CampaignCheck } from "../src/lib/campaign-checks-db";
import type { MetaCampaignMonitoringRow } from "../src/lib/meta/meta-campaign-monitoring-row";
import {
  applyLinkedCampaignSuppression,
  ATTENTION_ORDER,
  buildMetaAttentionItem,
  buildMondayControlRoom,
  buildNativeAttentionItem,
  collectActiveLinkedNativeIds,
  resolveAttentionFromSignals,
  sortAttentionItems,
  URGENT_STATES,
} from "../src/lib/monday-control-room";

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
    id: "native-1",
    nomeCliente: "Technon",
    iniziali: "TE",
    stato: "Attiva",
    giudizio: "Va bene",
    objective: "LEADS",
    nomeCampagna: "Lead Gen Ally",
    status: "ACTIVE",
    ...overrides,
  };
}

function check(overrides: Partial<CampaignCheck> = {}): CampaignCheck {
  return {
    id: "check-1",
    campaignId: "native-1",
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
    id: "meta-uuid-1",
    clientId: "client-a",
    clientName: "Technon",
    metaCampaignId: "120232108867250161",
    name: "[B2B Lead Gen] Technon",
    effectiveStatus: "ACTIVE",
    rawObjective: "OUTCOME_LEADS",
    lastSyncedAt: "2026-09-01T12:00:00Z",
    insightsPeriodSince: "2026-08-01",
    insightsPeriodUntil: "2026-08-31",
    insightsLastSyncedAt: null,
    spend: 100,
    impressions: 10000,
    linkClicks: 200,
    ctr: 2,
    cpc: 0.5,
    cpm: 10,
    frequency: 1.5,
    primaryResults: null,
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

console.log("\nM6A — Monday Control Room foundation\n");

test("A: RED + worsening → CRITICAL", () => {
  const r = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "WORSENING",
  });
  assert(r.state === "CRITICAL", r.state);
  assert(r.reason.includes("peggiorando"), r.reason);
});

test("B: RED + stable → NEEDS_ATTENTION", () => {
  const r = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  assert(r.state === "NEEDS_ATTENTION", r.state);
  assert(!r.reason.toLowerCase().includes("peggior"), r.reason);
});

test("C: YELLOW + worsening → NEEDS_ATTENTION", () => {
  const r = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "YELLOW",
    trend: "WORSENING",
  });
  assert(r.state === "NEEDS_ATTENTION", r.state);
});

test("D: GREEN + stable → STABLE", () => {
  const r = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "GREEN",
    trend: "STABLE",
  });
  assert(r.state === "STABLE", r.state);
});

test("E: no target → CONFIGURATION_REQUIRED (not RED)", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
      primaryKpi: null,
      targetValue: null,
    }),
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.healthStatus === null, "health must stay null");
  assert(item.reason.includes("target"), item.reason);
});

test("F: ambiguous Meta result → CONFIGURATION_REQUIRED", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "RESULT_MAPPING_REQUIRED",
      healthStatus: null,
    }),
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.reason.toLowerCase().includes("risultato"), item.reason);
});

test("G: insufficient data → INSUFFICIENT_DATA", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "INSUFFICIENT_DATA",
      healthStatus: null,
    }),
  });
  assert(item.attentionState === "INSUFFICIENT_DATA", item.attentionState);
});

test("H: paused → HISTORICAL", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      mode: "HISTORICAL_REVIEW",
      effectiveStatus: "PAUSED",
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
    }),
  });
  assert(item.attentionState === "HISTORICAL", item.attentionState);
});

test("I: paused not urgent", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      mode: "HISTORICAL_REVIEW",
      effectiveStatus: "PAUSED",
      healthStatus: "RED",
      healthAvailability: "AVAILABLE",
    }),
  });
  assert(!URGENT_STATES.has(item.attentionState), item.attentionState);
});

test("J: historical not mixed into active critical list", () => {
  const summary = buildMondayControlRoom([
    buildMetaAttentionItem({
      row: metaRow({
        id: "hist",
        mode: "HISTORICAL_REVIEW",
        effectiveStatus: "PAUSED",
        healthStatus: "RED",
        healthAvailability: "AVAILABLE",
      }),
    }),
    buildMetaAttentionItem({
      row: metaRow({
        id: "live",
        healthStatus: "RED",
        healthAvailability: "AVAILABLE",
      }),
      trendDirection: "WORSENING",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
  ]);
  assert(summary.urgent.every((i) => i.attentionState !== "HISTORICAL"), "no historical in urgent");
  assert(summary.urgent.some((i) => i.campaignId === "live"), "live present");
  assert(summary.historical.some((i) => i.campaignId === "hist"), "hist in historical");
});

test("K: target missing never RED attention", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
    }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.attentionState !== "CRITICAL", "must not be critical");
});

test("L: result mapping missing never RED", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "RESULT_MAPPING_REQUIRED",
      healthStatus: null,
    }),
  });
  assert(item.attentionState !== "CRITICAL", item.attentionState);
  assert(item.attentionState !== "NEEDS_ATTENTION", item.attentionState);
});

test("M: health and priority remain distinct", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "GREEN", healthAvailability: "AVAILABLE" }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.healthStatus === "GREEN", String(item.healthStatus));
  assert(item.attentionState === "MONITOR", item.attentionState);
});

test("N: native campaign supported", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "YELLOW" }),
  });
  assert(item.source === "NATIVE", item.source);
  assert(item.clientName === "Technon", item.clientName);
  assert(item.attentionState === "MONITOR" || item.attentionState === "NEEDS_ATTENTION", item.attentionState);
});

test("O: Meta campaign supported", () => {
  const item = buildMetaAttentionItem({ row: metaRow() });
  assert(item.source === "META", item.source);
  assert(item.campaignName.includes("Technon"), item.campaignName);
});

test("P: cross-client data isolation (structural)", () => {
  const loader = read("./src/lib/meta/monday-meta-loader.ts");
  assert(loader.includes('.eq("user_id", userId)'), "meta load scoped to user");
  const home = read("./src/components/dashboard/DashboardHome.tsx");
  assert(home.includes("user?.id") || home.includes("user.id"), "home uses auth user");
});

test("Q: source badge preserved", () => {
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(ui.includes("etichettaAttentionSource"), "source badge in UI");
  const lib = read("./src/lib/monday-control-room.ts");
  assert(lib.includes('"META"'), "META source");
  assert(lib.includes('"NATIVE"'), "NATIVE source");
  assert(lib.includes('? "Meta" : "Ally"'), "source labels");
});

test("R: client name present", () => {
  const item = buildMetaAttentionItem({ row: metaRow({ clientName: "Acme Spa" }) });
  assert(item.clientName === "Acme Spa", item.clientName);
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(ui.includes("item.clientName"), "UI shows client");
});

test("S: deterministic ordering", () => {
  const items = sortAttentionItems([
    buildMetaAttentionItem({
      row: metaRow({ id: "y", healthStatus: "YELLOW", healthAvailability: "AVAILABLE" }),
    }),
    buildMetaAttentionItem({
      row: metaRow({ id: "c", healthStatus: "RED", healthAvailability: "AVAILABLE" }),
      trendDirection: "WORSENING",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
    buildMetaAttentionItem({
      row: metaRow({
        id: "t",
        healthAvailability: "TARGET_REQUIRED",
        healthStatus: null,
        primaryKpi: null,
        targetValue: null,
      }),
    }),
  ]);
  assert(items[0]!.attentionState === "CRITICAL", items[0]!.attentionState);
  assert(ATTENTION_ORDER[items[0]!.attentionState] < ATTENTION_ORDER[items[1]!.attentionState], "order");
  assert(items.some((i) => i.attentionState === "CONFIGURATION_REQUIRED"), "config present");
});

test("T: no LLM calls", () => {
  for (const file of [
    "./src/lib/monday-control-room.ts",
    "./src/lib/meta/monday-meta-loader.ts",
    "./src/components/dashboard/MondayControlRoomSection.tsx",
    "./src/components/dashboard/DashboardHome.tsx",
  ]) {
    const c = read(file).toLowerCase();
    assert(!c.includes("anthropic"), `${file}: anthropic`);
    assert(!c.includes("openai"), `${file}: openai`);
    assert(!c.includes("claude"), `${file}: claude`);
    assert(!c.includes("gpt-"), `${file}: gpt`);
  }
});

test("U: no campaign_checks writes", () => {
  for (const file of [
    "./src/lib/monday-control-room.ts",
    "./src/lib/meta/monday-meta-loader.ts",
    "./src/components/dashboard/MondayControlRoomSection.tsx",
  ]) {
    const c = read(file);
    assert(!c.includes("inserisciCampaignCheck"), `${file}`);
    assert(!c.includes('.from("campaign_checks")'), `${file}`);
  }
});

test("V: no Meta writes", () => {
  const loader = read("./src/lib/meta/monday-meta-loader.ts");
  assert(!loader.includes(".update("), "loader no update");
  assert(!loader.includes(".insert("), "loader no insert");
  assert(!loader.includes("graph.facebook"), "no graph");
});

test("W/X: no ads_management / business_management", () => {
  for (const file of [
    "./src/lib/monday-control-room.ts",
    "./src/lib/meta/monday-meta-loader.ts",
  ]) {
    const c = read(file);
    assert(!c.includes("ads_management"), file);
    assert(!c.includes("business_management"), file);
  }
});

test("Linked suppress without merge", () => {
  const native = buildNativeAttentionItem({
    campagna: campagna({ id: "native-linked" }),
    check: check({ campaignId: "native-linked", healthStatus: "RED" }),
  });
  const meta = buildMetaAttentionItem({
    row: metaRow({
      linkState: "LINKED",
      linkedCampaignId: "native-linked",
      mode: "ACTIVE_MONITORING",
      healthStatus: "YELLOW",
    }),
  });
  const linked = collectActiveLinkedNativeIds([
    metaRow({
      linkState: "LINKED",
      linkedCampaignId: "native-linked",
      mode: "ACTIVE_MONITORING",
    }),
  ]);
  assert(linked.has("native-linked"), "linked id collected");
  const merged = applyLinkedCampaignSuppression([native, meta], linked);
  const summary = buildMondayControlRoom(merged);
  assert(
    !summary.items.some((i) => i.campaignId === "native-linked" && i.source === "NATIVE"),
    "native suppressed from visible items",
  );
  assert(
    summary.items.some((i) => i.source === "META"),
    "meta remains",
  );
});

test("No migration required", () => {
  const files = fs.readdirSync("./supabase/migrations");
  assert(
    !files.some((f) => f.toLowerCase().includes("monday") || f.toLowerCase().includes("m6a")),
    "no M6A migration",
  );
});

test("Home uses Monday section", () => {
  const home = read("./src/components/dashboard/DashboardHome.tsx");
  const monday = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(home.includes("MondayControlRoomSection"), "section wired");
  assert(
    monday.includes("Control Room") &&
      monday.includes("Le campagne che richiedono la tua attenzione"),
    "copy",
  );
  assert(home.includes("loadMetaMondayBundle"), "loads meta");
});

test("Empty urgent state copy", () => {
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(
    ui.includes("Nessuna campagna richiede attenzione urgente."),
    "empty state",
  );
  assert(ui.includes("Oggi"), "today summary");
});

test("Home focus: no duplicate status boards", () => {
  const home = read("./src/components/dashboard/DashboardHome.tsx");
  assert(!home.includes("Campagne in gestione"), "gestione removed");
  assert(!home.includes("LavoriAperti"), "lavori aperti removed from home");
  assert(!home.includes("MiniChartAttivita"), "large activity chart removed");
  assert(home.includes("Revisioni cliente"), "revisions kept");
  assert(home.includes("Attività recente"), "activity compact");
});

console.log("\n" + "━".repeat(56));
console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
if (failed > 0) {
  process.exit(1);
}
console.log("\n  ✓ Tutti i test M6A sono passati.\n");
process.exit(0);
