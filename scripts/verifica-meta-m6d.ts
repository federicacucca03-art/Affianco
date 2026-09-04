/**
 * M6D — Next action recommendation verification
 * Pure logic + structural security. No live Anthropic / Meta.
 */

import fs from "node:fs";
import {
  actionConsistentWithDiagnosis,
  actionTypeFromDiagnosisArea,
  etichettaNextAction,
  PROHIBITED_ACTION_PHRASES,
  resolveNextAction,
  shouldShowNextAction,
  type ResolveNextActionInput,
} from "../src/lib/campaign-next-action";
import type { CampaignAiDiagnosis } from "../src/lib/campaign-diagnosis/types";
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

function baseInput(
  overrides: Partial<ResolveNextActionInput> = {},
): ResolveNextActionInput {
  return {
    campaignId: "11111111-1111-4111-8111-111111111111",
    source: "NATIVE",
    campaignStatus: "ACTIVE",
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    healthAvailability: null,
    configurationKind: null,
    resultsCount: 12,
    rowHref: "/risultati?campaignId=11111111-1111-4111-8111-111111111111",
    diagnosis: null,
    ...overrides,
  };
}

function diagnosis(
  partial: Partial<CampaignAiDiagnosis> = {},
): CampaignAiDiagnosis {
  return {
    summary: "Sintesi di test.",
    likely_area: "CREATIVE",
    confidence: "MEDIUM",
    evidence: ["Evidenza A", "Evidenza B"],
    uncertainty: "Incertezza di test.",
    what_not_to_conclude: null,
    ...partial,
  };
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
    healthStatus: "RED",
    ...overrides,
  };
}

console.log("\nM6D — Next action recommendation\n");

test("A: target required → SET_TARGET", () => {
  const a = resolveNextAction(
    baseInput({
      attentionState: "CONFIGURATION_REQUIRED",
      health: null,
      healthAvailability: "TARGET_REQUIRED",
      configurationKind: "ACTIVE_MISSING_TARGET",
    }),
  );
  assert(a.actionType === "SET_TARGET", a.actionType);
  assert(a.actionSource === "DETERMINISTIC", a.actionSource);
  assert(etichettaNextAction(a.actionType) === "Imposta un target", a.title);
});

test("B: result mapping → VERIFY_TRACKING", () => {
  const a = resolveNextAction(
    baseInput({
      attentionState: "CONFIGURATION_REQUIRED",
      health: null,
      healthAvailability: "RESULT_MAPPING_REQUIRED",
      configurationKind: "RESULT_MAPPING",
    }),
  );
  assert(a.actionType === "VERIFY_TRACKING", a.actionType);
  assert(a.actionSource === "DETERMINISTIC", a.actionSource);
});

test("C: draft → REVIEW_CAMPAIGN_SETUP", () => {
  const a = resolveNextAction(
    baseInput({
      campaignStatus: "DRAFT",
      attentionState: "CONFIGURATION_REQUIRED",
      health: null,
      configurationKind: "DRAFT",
    }),
  );
  assert(a.actionType === "REVIEW_CAMPAIGN_SETUP", a.actionType);
  assert(a.title === "Completa la configurazione", a.title);
});

test("D: revision requested → CONTACT_CLIENT", () => {
  const a = resolveNextAction(
    baseInput({
      campaignStatus: "REVISION_REQUESTED",
      attentionState: "NEEDS_ATTENTION",
      health: null,
    }),
  );
  assert(a.actionType === "CONTACT_CLIENT", a.actionType);
  assert(a.title === "Gestisci la revisione cliente", a.title);
});

test("E: insufficient → WAIT_FOR_MORE_DATA", () => {
  const a = resolveNextAction(
    baseInput({
      attentionState: "INSUFFICIENT_DATA",
      health: "INSUFFICIENT",
    }),
  );
  assert(a.actionType === "WAIT_FOR_MORE_DATA", a.actionType);
  assert(a.eligibility === "ACTION_BLOCKED_INSUFFICIENT_DATA", a.eligibility);
});

test("F: green stable → NO_ACTION", () => {
  const a = resolveNextAction(
    baseInput({
      attentionState: "STABLE",
      health: "GREEN",
    }),
  );
  assert(a.actionType === "NO_ACTION", a.actionType);
  assert(!shouldShowNextAction(a.actionType), "hidden on home");
});

test("G: historical → HISTORICAL_LEARNING", () => {
  const a = resolveNextAction(
    baseInput({
      attentionState: "HISTORICAL",
      health: null,
      campaignStatus: "PAUSED",
    }),
  );
  assert(a.actionType === "HISTORICAL_LEARNING", a.actionType);
  assert(a.eligibility === "ACTION_HISTORICAL_ONLY", a.eligibility);
  assert(!/budget|creativ/i.test(a.rationale) || /riferimento/.test(a.rationale), a.rationale);
});

test("H: UNKNOWN + LOW → WAIT_FOR_MORE_DATA", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "UNKNOWN",
        confidence: "LOW",
      }),
    }),
  );
  assert(a.actionType === "WAIT_FOR_MORE_DATA", a.actionType);
  assert(a.confidence === "LOW", a.confidence);
});

test("I: CREATIVE + MEDIUM → REVIEW_CREATIVE", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "CREATIVE",
        confidence: "MEDIUM",
      }),
    }),
  );
  assert(a.actionType === "REVIEW_CREATIVE", a.actionType);
  assert(a.actionSource === "AI_SUPPORTED", a.actionSource);
  assert(a.relatedDiagnosisArea === "CREATIVE", String(a.relatedDiagnosisArea));
});

test("J: POST_CLICK + MEDIUM → REVIEW_LANDING_OR_FORM", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "POST_CLICK",
        confidence: "MEDIUM",
      }),
    }),
  );
  assert(a.actionType === "REVIEW_LANDING_OR_FORM", a.actionType);
});

test("K: TRACKING → VERIFY_TRACKING", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "TRACKING",
        confidence: "MEDIUM",
      }),
    }),
  );
  assert(a.actionType === "VERIFY_TRACKING", a.actionType);
});

test("L: low confidence cannot create aggressive action", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "CREATIVE",
        confidence: "LOW",
      }),
    }),
  );
  assert(a.actionType === "WAIT_FOR_MORE_DATA", a.actionType);
  assert(a.actionType !== "CREATE_CREATIVE_VARIANT", "no variant");
  assert(
    actionTypeFromDiagnosisArea("CREATIVE", "LOW") === "WAIT_FOR_MORE_DATA",
    "map",
  );
});

test("M: action cannot contradict diagnosis", () => {
  const d = diagnosis({ likely_area: "UNKNOWN", confidence: "LOW" });
  assert(actionConsistentWithDiagnosis("WAIT_FOR_MORE_DATA", d), "wait ok");
  assert(!actionConsistentWithDiagnosis("REVIEW_CREATIVE", d), "creative bad");
  const creative = diagnosis({ likely_area: "CREATIVE", confidence: "MEDIUM" });
  assert(actionConsistentWithDiagnosis("REVIEW_CREATIVE", creative), "match");
  assert(
    !actionConsistentWithDiagnosis("REVIEW_LANDING_OR_FORM", creative),
    "landing contradict",
  );
});

test("N: no direct Meta writes", () => {
  const root = "./src/lib/campaign-next-action";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`);
    assert(!c.includes("graph.facebook"), f);
    assert(!/\.update\(/.test(c) || f.includes("test"), f);
  }
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(!ui.includes("graph.facebook"), "ui");
});

test("O: no pause action", () => {
  const root = "./src/lib/campaign-next-action";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`).toLowerCase();
    assert(!c.includes("pause_campaign"), f);
    assert(!c.includes('"pause"'), f);
  }
  const a = resolveNextAction(baseInput({ diagnosis: diagnosis() }));
  assert(!/metti in pausa|pause campaign/i.test(a.rationale), a.rationale);
});

test("P: no budget mutation", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "DELIVERY",
        confidence: "MEDIUM",
      }),
    }),
  );
  assert(a.actionType === "REVIEW_BUDGET", a.actionType);
  assert(!/aumenta|riduci|increase|decrease/i.test(a.rationale), a.rationale);
  assert(/valuta/i.test(a.rationale), a.rationale);
  for (const p of PROHIBITED_ACTION_PHRASES) {
    assert(!a.rationale.toLowerCase().includes(p), p);
  }
});

test("Q: health unchanged", () => {
  const before = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  resolveNextAction(baseInput());
  const after = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  assert(before.state === after.state, before.state);
});

test("R: urgency unchanged", () => {
  const u1 = resolveUrgencyFromSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    campaignStatus: "ACTIVE",
  });
  resolveNextAction(baseInput());
  const u2 = resolveUrgencyFromSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    campaignStatus: "ACTIVE",
  });
  assert(u1.level === u2.level, u1.level);
});

test("S: no DB writes", () => {
  const root = "./src/lib/campaign-next-action";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`);
    assert(!c.includes(".insert("), f);
    assert(!c.includes("inserisciCampaignCheck"), f);
  }
  const files = fs.readdirSync("./supabase/migrations");
  assert(!files.some((f) => /m6d|next.?action/i.test(f)), "no migration");
});

test("T: no notifications", () => {
  const root = "./src/lib/campaign-next-action";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`).toLowerCase();
    assert(!c.includes("notification"), f);
    assert(!c.includes("push"), f);
  }
});

test("U: no ads_management", () => {
  const root = "./src/lib/campaign-next-action";
  for (const f of fs.readdirSync(root)) {
    assert(!read(`${root}/${f}`).includes("ads_management"), f);
  }
});

test("V: no business_management", () => {
  const root = "./src/lib/campaign-next-action";
  for (const f of fs.readdirSync(root)) {
    assert(!read(`${root}/${f}`).includes("business_management"), f);
  }
});

test("Aurora 2-result fixture → WAIT_FOR_MORE_DATA", () => {
  const a = resolveNextAction(
    baseInput({
      attentionState: "MONITOR",
      health: "GREEN",
      resultsCount: 2,
      diagnosis: diagnosis({
        likely_area: "UNKNOWN",
        confidence: "LOW",
      }),
    }),
  );
  assert(a.actionType === "WAIT_FOR_MORE_DATA", a.actionType);
  assert(a.confidence === "LOW", a.confidence);
  assert(/2 risultati|troppo piccolo/i.test(a.rationale), a.rationale);
  assert(a.title === "Raccogli altri dati", a.title);
});

test("Home Prossimo passo UX present", () => {
  const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
  assert(ui.includes("Prossimo passo"), "label");
  assert(ui.includes("resolveNextAction"), "resolver");
  assert(ui.includes("shouldShowNextAction"), "gate");
  assert(!ui.includes("useEffect(() => {\n      void runDiagnosis"), "no auto AI");
});

test("Builders expose M6D context fields", () => {
  const native = buildNativeAttentionItem({
    campagna: campagna({ status: "REVISION_REQUESTED" }),
    check: check({ resultsCount: 2 }),
  });
  assert(native.resultsCount === 2, String(native.resultsCount));
  assert(native.configurationKind === null, "revision kind");

  const draft = buildNativeAttentionItem({
    campagna: campagna({ status: "DRAFT" }),
    check: null,
  });
  assert(draft.configurationKind === "DRAFT", String(draft.configurationKind));

  const meta = buildMetaAttentionItem({
    row: metaRow({
      healthAvailability: "TARGET_REQUIRED",
      healthStatus: null,
      primaryResults: 2,
    }),
  });
  assert(meta.healthAvailability === "TARGET_REQUIRED", String(meta.healthAvailability));
  assert(meta.resultsCount === 2, String(meta.resultsCount));
  assert(meta.configurationKind === "ACTIVE_MISSING_TARGET", String(meta.configurationKind));
});

test("CREATIVE HIGH → CREATE_CREATIVE_VARIANT (review phrasing)", () => {
  const a = resolveNextAction(
    baseInput({
      diagnosis: diagnosis({
        likely_area: "CREATIVE",
        confidence: "HIGH",
      }),
    }),
  );
  assert(a.actionType === "CREATE_CREATIVE_VARIANT", a.actionType);
  assert(/variante|prepar/i.test(a.rationale), a.rationale);
  assert(!/sostituisci/i.test(a.rationale), "no replace");
});

test("actionSource exposed", () => {
  const d = resolveNextAction(
    baseInput({ healthAvailability: "TARGET_REQUIRED", health: null, attentionState: "CONFIGURATION_REQUIRED", configurationKind: "ACTIVE_MISSING_TARGET" }),
  );
  assert(d.actionSource === "DETERMINISTIC", d.actionSource);
  const ai = resolveNextAction(
    baseInput({ diagnosis: diagnosis({ likely_area: "POST_CLICK" }) }),
  );
  assert(ai.actionSource === "AI_SUPPORTED", ai.actionSource);
});

console.log("\n" + "━".repeat(56));
console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
console.log("\n  ✓ Tutti i test M6D sono passati.\n");
process.exit(0);
