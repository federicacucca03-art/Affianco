/**
 * M6B — Priority + urgency layer verification
 *
 * Urgency ≠ health ≠ attention. No LLM. No notifications. No DB writes.
 */

import fs from "node:fs";
import type { Campagna } from "../src/types/campagne";
import type { CampaignCheck } from "../src/lib/campaign-checks-db";
import type { MetaCampaignMonitoringRow } from "../src/lib/meta/meta-campaign-monitoring-row";
import {
  buildMetaAttentionItem,
  buildMondayControlRoom,
  buildNativeAttentionItem,
  resolveAttentionFromSignals,
  resolveUrgencyFromSignals,
  sortAttentionItems,
  URGENCY_ORDER,
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

console.log("\nM6B — Priority + urgency layer\n");

test("A: RED + worsening → NOW", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "RED", healthAvailability: "AVAILABLE" }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "CRITICAL", item.attentionState);
  assert(item.urgencyLevel === "NOW", item.urgencyLevel);
  assert(item.urgencyReason.toLowerCase().includes("peggior"), item.urgencyReason);
});

test("B: RED + stable → SOON", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "RED", healthAvailability: "AVAILABLE" }),
    trendDirection: "STABLE",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "NEEDS_ATTENTION", item.attentionState);
  assert(item.urgencyLevel === "SOON", item.urgencyLevel);
  assert(item.urgencyReason.toLowerCase().includes("stabile"), item.urgencyReason);
});

test("C: YELLOW + worsening → SOON", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "YELLOW", healthAvailability: "AVAILABLE" }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "NEEDS_ATTENTION", item.attentionState);
  assert(item.urgencyLevel === "SOON", item.urgencyLevel);
});

test("D: YELLOW + stable → LATER", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "YELLOW", healthAvailability: "AVAILABLE" }),
    trendDirection: "STABLE",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "MONITOR", item.attentionState);
  assert(item.urgencyLevel === "LATER", item.urgencyLevel);
});

test("E: GREEN + stable → NONE", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "GREEN", healthAvailability: "AVAILABLE" }),
    trendDirection: "STABLE",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "STABLE", item.attentionState);
  assert(item.urgencyLevel === "NONE", item.urgencyLevel);
});

test("F: GREEN + worsening → LATER", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "GREEN", healthAvailability: "AVAILABLE" }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "MONITOR", item.attentionState);
  assert(item.urgencyLevel === "LATER", item.urgencyLevel);
});

test("G: target missing draft → not NOW", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna({ status: "DRAFT", nomeCampagna: "Bozza Aurora" }),
    check: null,
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.urgencyLevel !== "NOW", item.urgencyLevel);
  assert(item.urgencyLevel === "LATER", item.urgencyLevel);
});

test("H: target missing launch-blocking → SOON", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      effectiveStatus: "ACTIVE",
      mode: "ACTIVE_MONITORING",
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
      primaryKpi: null,
      targetValue: null,
    }),
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.urgencyLevel === "SOON", item.urgencyLevel);
});

test("I: ambiguous result mapping active → SOON config, not RED", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "RESULT_MAPPING_REQUIRED",
      healthStatus: null,
    }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.healthStatus === null, "health null");
  assert(item.urgencyLevel === "SOON", item.urgencyLevel);
  assert(item.urgencyLevel !== "NOW", "must not be NOW");
});

test("J: historical → NONE", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      mode: "HISTORICAL_REVIEW",
      effectiveStatus: "PAUSED",
      healthStatus: "RED",
      healthAvailability: "AVAILABLE",
    }),
  });
  assert(item.attentionState === "HISTORICAL", item.attentionState);
  assert(item.urgencyLevel === "NONE", item.urgencyLevel);
});

test("K: paused → NONE", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      mode: "HISTORICAL_REVIEW",
      effectiveStatus: "PAUSED",
    }),
  });
  assert(item.urgencyLevel === "NONE", item.urgencyLevel);
});

test("L: health and urgency distinct", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "GREEN", healthAvailability: "AVAILABLE" }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.healthStatus === "GREEN", String(item.healthStatus));
  assert(item.urgencyLevel === "LATER", item.urgencyLevel);
  assert(item.attentionState === "MONITOR", item.attentionState);
});

test("M: attention and urgency distinct", () => {
  const draft = buildNativeAttentionItem({
    campagna: campagna({ status: "DRAFT" }),
    check: null,
  });
  const activeMissing = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
      primaryKpi: null,
      targetValue: null,
    }),
  });
  assert(draft.attentionState === activeMissing.attentionState, "same attention");
  assert(draft.urgencyLevel === "LATER", draft.urgencyLevel);
  assert(activeMissing.urgencyLevel === "SOON", activeMissing.urgencyLevel);
});

test("N: trend cannot override missing target", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
      primaryKpi: null,
      targetValue: null,
    }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.attentionState === "CONFIGURATION_REQUIRED", item.attentionState);
  assert(item.urgencyLevel !== "NOW", item.urgencyLevel);
  const u = resolveUrgencyFromSignals({
    attentionState: "CONFIGURATION_REQUIRED",
    health: null,
    trend: "WORSENING",
    campaignStatus: "ACTIVE",
    configurationKind: "ACTIVE_MISSING_TARGET",
  });
  assert(u.level === "SOON", u.level);
});

test("O: native supported", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna(),
    check: check({ healthStatus: "RED" }),
  });
  assert(item.source === "NATIVE", item.source);
  assert(item.urgencyLevel === "SOON" || item.urgencyLevel === "NOW", item.urgencyLevel);
});

test("P: Meta supported", () => {
  const item = buildMetaAttentionItem({
    row: metaRow({ healthStatus: "RED" }),
    trendDirection: "WORSENING",
    trendLevel: "TWO_WINDOW_COMPARISON",
  });
  assert(item.source === "META", item.source);
  assert(item.urgencyLevel === "NOW", item.urgencyLevel);
});

test("Q: client revision deterministic", () => {
  const item = buildNativeAttentionItem({
    campagna: campagna({ status: "REVISION_REQUESTED" }),
    check: check({ healthStatus: "GREEN" }),
  });
  assert(item.attentionState === "NEEDS_ATTENTION", item.attentionState);
  assert(item.urgencyLevel === "SOON", item.urgencyLevel);
  assert(item.urgencyReason.toLowerCase().includes("revisione"), item.urgencyReason);
});

test("R: ordering NOW before SOON", () => {
  const items = sortAttentionItems([
    buildMetaAttentionItem({
      row: metaRow({ id: "soon", healthStatus: "RED", healthAvailability: "AVAILABLE" }),
      trendDirection: "STABLE",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
    buildMetaAttentionItem({
      row: metaRow({ id: "now", healthStatus: "RED", healthAvailability: "AVAILABLE" }),
      trendDirection: "WORSENING",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
  ]);
  assert(items[0]!.urgencyLevel === "NOW", items[0]!.urgencyLevel);
  assert(items[1]!.urgencyLevel === "SOON", items[1]!.urgencyLevel);
  assert(URGENCY_ORDER.NOW < URGENCY_ORDER.SOON, "order map");
});

test("S: ordering SOON before LATER", () => {
  const items = sortAttentionItems([
    buildMetaAttentionItem({
      row: metaRow({ id: "later", healthStatus: "YELLOW", healthAvailability: "AVAILABLE" }),
      trendDirection: "STABLE",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
    buildMetaAttentionItem({
      row: metaRow({ id: "soon", healthStatus: "RED", healthAvailability: "AVAILABLE" }),
      trendDirection: "STABLE",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
  ]);
  assert(items[0]!.urgencyLevel === "SOON", items[0]!.urgencyLevel);
  assert(items[1]!.urgencyLevel === "LATER", items[1]!.urgencyLevel);
});

test("T: stable rows not in urgent list", () => {
  const summary = buildMondayControlRoom([
    buildMetaAttentionItem({
      row: metaRow({ id: "ok", healthStatus: "GREEN" }),
      trendDirection: "STABLE",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
    buildMetaAttentionItem({
      row: metaRow({ id: "bad", healthStatus: "RED" }),
      trendDirection: "STABLE",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
  ]);
  assert(
    summary.urgent.every((i) => i.urgencyLevel !== "NONE" || i.attentionState !== "STABLE"),
    "stable not urgent",
  );
  assert(
    !summary.urgent.some((i) => i.campaignId === "ok"),
    "green stable excluded from urgent",
  );
  assert(summary.urgencyCounts.NONE >= 1, "none counted");
  assert(summary.urgencyCounts.SOON >= 1, "soon counted");
});

test("U: no LLM", () => {
  for (const file of [
    "./src/lib/monday-control-room.ts",
    "./src/components/dashboard/MondayControlRoomSection.tsx",
  ]) {
    const c = read(file).toLowerCase();
    assert(!c.includes("anthropic"), file);
    assert(!c.includes("openai"), file);
    assert(!c.includes("claude"), file);
    assert(!c.includes("gpt-"), file);
  }
});

test("V: no notifications", () => {
  for (const file of [
    "./src/lib/monday-control-room.ts",
    "./src/components/dashboard/MondayControlRoomSection.tsx",
    "./src/components/dashboard/DashboardHome.tsx",
  ]) {
    const c = read(file).toLowerCase();
    assert(!c.includes("notification"), `${file}: notification`);
    assert(!c.includes("push(") || !c.includes("sendpush"), `${file}`);
    assert(!c.includes("webpush"), `${file}`);
  }
});

test("W: no DB writes", () => {
  const lib = read("./src/lib/monday-control-room.ts");
  assert(!lib.includes(".insert("), "no insert");
  assert(!lib.includes(".update("), "no update");
  assert(!lib.includes(".upsert("), "no upsert");
  assert(!lib.includes("createClient"), "no supabase client");
});

test("X: no campaign_checks writes", () => {
  for (const file of [
    "./src/lib/monday-control-room.ts",
    "./src/components/dashboard/MondayControlRoomSection.tsx",
  ]) {
    const c = read(file);
    assert(!c.includes("inserisciCampaignCheck"), file);
    assert(!c.includes('.from("campaign_checks")'), file);
  }
});

test("Y: no Meta writes", () => {
  const lib = read("./src/lib/monday-control-room.ts");
  assert(!lib.includes("graph.facebook"), "no graph");
  assert(!lib.includes("ads_management"), "no ads_management");
});

test("Z: no ads_management", () => {
  const lib = read("./src/lib/monday-control-room.ts");
  assert(!lib.includes("ads_management"), "ads_management");
});

test("AA: no business_management", () => {
  const lib = read("./src/lib/monday-control-room.ts");
  assert(!lib.includes("business_management"), "business_management");
});

test("Drafts do not outrank RED NOW", () => {
  const items = sortAttentionItems([
    buildNativeAttentionItem({
      campagna: campagna({ id: "d1", status: "DRAFT", nomeCliente: "Aurora" }),
      check: null,
    }),
    buildNativeAttentionItem({
      campagna: campagna({ id: "d2", status: "DRAFT", nomeCliente: "Aurora" }),
      check: null,
    }),
    buildMetaAttentionItem({
      row: metaRow({ id: "red", healthStatus: "RED" }),
      trendDirection: "WORSENING",
      trendLevel: "TWO_WINDOW_COMPARISON",
    }),
  ]);
  assert(items[0]!.campaignId === "red", items[0]!.campaignId);
  assert(items[0]!.urgencyLevel === "NOW", items[0]!.urgencyLevel);
  assert(items.every((i) => i.campaignId !== "d1" || i.urgencyLevel === "LATER"), "draft later");
});

test("UI shows urgency secondary to attention", () => {
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(ui.includes("etichettaUrgencyLevel"), "urgency label helper");
  assert(ui.includes("Priorità"), "priorità copy");
  assert(ui.includes("urgencySupportingText"), "supporting urgency text");
  assert(!ui.includes("urgencyCounts"), "oggi is attention-based");
  assert(ui.includes("da controllare"), "oggi attention chips");
  // Urgency must not be the old dominant uppercase MEDIA/ALTA first-line label.
  assert(
    !ui.includes("uppercase tracking-wide ${urgencyTone"),
    "no uppercase urgency labels",
  );
  assert(ui.includes("Priorità ${short.toLowerCase()}"), "lowercase priorità");
  assert(!ui.includes("etichettaPriorityBand"), "old band removed");
});

test("No M6B migration", () => {
  const files = fs.readdirSync("./supabase/migrations");
  assert(
    !files.some((f) => f.toLowerCase().includes("m6b") || f.toLowerCase().includes("urgency")),
    "no urgency migration",
  );
});

test("resolveUrgency unit matrix covers fundamentals", () => {
  const hist = resolveUrgencyFromSignals({
    attentionState: "HISTORICAL",
    health: "RED",
    trend: "WORSENING",
    campaignStatus: "PAUSED",
  });
  assert(hist.level === "NONE", hist.level);

  const crit = resolveUrgencyFromSignals({
    attentionState: "CRITICAL",
    health: "RED",
    trend: "WORSENING",
    campaignStatus: "ACTIVE",
  });
  assert(crit.level === "NOW", crit.level);

  const att = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  assert(att.state === "NEEDS_ATTENTION", att.state);
});

console.log("\n" + "━".repeat(56));
console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
if (failed > 0) {
  process.exit(1);
}
console.log("\n  ✓ Tutti i test M6B sono passati.\n");
process.exit(0);
