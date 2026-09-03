/**
 * M5C — explicit Meta ↔ Affianco campaign link
 */

import fs from "node:fs";
import {
  isValidCampaignLinkOwnership,
  resolveLinkedKpiCompatibility,
  resolveLinkedMonitoringTarget,
  type LinkedAffiancoCampaignSnapshot,
} from "../src/lib/meta/campaign-link-compatibility";
import { mapMetaCampaignToMonitoringRow } from "../src/lib/meta/meta-campaign-monitoring-row";
import { refreshAfterMetaTargetMutation } from "../src/lib/meta/meta-campaign-monitoring-row";
import { etichettaHealthAvailability } from "../src/lib/meta/insights-control-room";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return fs.readFileSync(path, "utf8");
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const CLIENT_A = "33333333-3333-4333-8333-333333333333";
const CLIENT_B = "44444444-4444-4444-8444-444444444444";

function leadsNative(
  overrides: Partial<LinkedAffiancoCampaignSnapshot> = {},
): LinkedAffiancoCampaignSnapshot {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Piano Lead Technon",
    objective: "LEADS",
    status: "APPROVED",
    maxSustainableCpa: 18,
    estimatedCpm: null,
    targetMargin: 50,
    bookingServiceValue: null,
    showUpRate: null,
    averageOrderValue: null,
    productMargin: null,
    averageReceipt: null,
    storeMargin: null,
    recoveryValue: null,
    recoveryMargin: null,
    ...overrides,
  };
}

function awarenessNative(): LinkedAffiancoCampaignSnapshot {
  return leadsNative({
    id: "66666666-6666-4666-8666-666666666666",
    name: "Piano Awareness",
    objective: "AWARENESS",
    maxSustainableCpa: null,
    estimatedCpm: 12,
  });
}

function bookingsNative(): LinkedAffiancoCampaignSnapshot {
  return leadsNative({
    id: "77777777-7777-4777-8777-777777777777",
    name: "Piano Prenotazioni",
    objective: "BOOKINGS",
    maxSustainableCpa: null,
    bookingServiceValue: 80,
    showUpRate: 75,
  });
}

function metaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "88888888-8888-4888-8888-888888888888",
    client_id: CLIENT_A,
    meta_campaign_id: "120232108867250161",
    name: "[B2B Lead Gen] Technon",
    effective_status: "PAUSED",
    raw_objective: "OUTCOME_LEADS",
    last_synced_at: "2026-08-31T12:00:00Z",
    insights_period_since: "2026-08-01",
    insights_period_until: "2026-08-31",
    insights_period_frequency: 1.55,
    primary_kpi: "CPC" as const,
    target_value: 0.3,
    affianco_campaign_id: null as string | null,
    ...overrides,
  };
}

const confidentLeadsAgg = {
  spend: 100,
  impressions: 14647,
  linkClicks: 420,
  primaryResults: 10,
  primaryResultType: "lead",
  resultMappingConfidence: "CONFIDENT" as const,
};

console.log("\nM5C — explicit Meta ↔ Affianco link\n");

test("A: same-client same-user ownership accepted", () => {
  assert(
    isValidCampaignLinkOwnership({
      authUserId: USER_A,
      requestedClientId: CLIENT_A,
      metaUserId: USER_A,
      metaClientId: CLIENT_A,
      nativeUserId: USER_A,
      nativeClientId: CLIENT_A,
    }),
    "same client/user must be valid",
  );
});

test("B: cross-client link rejected", () => {
  assert(
    !isValidCampaignLinkOwnership({
      authUserId: USER_A,
      requestedClientId: CLIENT_A,
      metaUserId: USER_A,
      metaClientId: CLIENT_A,
      nativeUserId: USER_A,
      nativeClientId: CLIENT_B,
    }),
    "cross-client must be rejected",
  );
});

test("C: cross-user link rejected", () => {
  assert(
    !isValidCampaignLinkOwnership({
      authUserId: USER_A,
      requestedClientId: CLIENT_A,
      metaUserId: USER_A,
      metaClientId: CLIENT_A,
      nativeUserId: USER_B,
      nativeClientId: CLIENT_A,
    }),
    "cross-user must be rejected",
  );
});

test("D/E: unlink sets null and is idempotent (service + SQL)", () => {
  const svc = read("./src/lib/meta/campaign-link.ts");
  assert(svc.includes("affianco_campaign_id: null"), "unlink writes null");
  assert(svc.includes("idempotent"), "unlink documented idempotent");
  const api = read("./src/app/api/meta/campaign-link/route.ts");
  assert(api.includes("export async function DELETE"), "DELETE unlink route");
});

test("F: no auto-link by name / fuzzy / dates", () => {
  const files = [
    "./src/lib/meta/campaign-link.ts",
    "./src/lib/meta/campaign-link-compatibility.ts",
    "./src/app/api/meta/campaign-link/route.ts",
    "./src/components/risultati/MetaCampagneSection.tsx",
  ];
  for (const file of files) {
    const content = read(file).toLowerCase();
    assert(!content.includes("fuzzy"), `${file}: fuzzy`);
    assert(!content.includes("auto-link"), `${file}: auto-link`);
    assert(!content.includes("auto_link"), `${file}: auto_link`);
    assert(!content.includes("match by name"), `${file}: name match`);
    assert(!content.includes(".ilike("), `${file}: ilike name match`);
  }
  const svc = read("./src/lib/meta/campaign-link.ts");
  assert(
    !svc.includes(".eq(\"name\"") && !svc.includes(".eq('name'"),
    "service must not match campaigns by name",
  );
});

test("G: native threshold precedes Meta explicit target", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: leadsNative().id,
      primary_kpi: "CPC",
      target_value: 0.3,
    }),
    confidentLeadsAgg,
    "Technon",
    leadsNative(),
  );
  assert(row.targetSource === "LINKED_AFFIANCO", `source: ${row.targetSource}`);
  assert(row.primaryKpi === "CPL", `kpi: ${row.primaryKpi}`);
  assert(row.targetValue === 18, `target: ${row.targetValue}`);
  assert(row.healthStatus != null, "health from native CPL");
});

test("H: Meta explicit target preserved while linked", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: leadsNative().id,
      primary_kpi: "CPC",
      target_value: 0.3,
    }),
    confidentLeadsAgg,
    "Technon",
    leadsNative(),
  );
  assert(row.storedPrimaryKpi === "CPC", `stored kpi: ${row.storedPrimaryKpi}`);
  assert(row.storedTargetValue === 0.3, `stored target: ${row.storedTargetValue}`);
});

test("I: unlink restores Meta explicit target", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: null,
      primary_kpi: "CPC",
      target_value: 0.3,
    }),
    { spend: 99.97, impressions: 14647, linkClicks: 420 },
    "Technon",
    null,
  );
  assert(row.linkState === "UNLINKED", `state: ${row.linkState}`);
  assert(row.targetSource === "META_EXPLICIT", `source: ${row.targetSource}`);
  assert(row.primaryKpi === "CPC", `kpi: ${row.primaryKpi}`);
  assert(row.targetValue === 0.3, `target: ${row.targetValue}`);
  assert(row.healthAvailability === "AVAILABLE", row.healthAvailability);
});

test("J: compatible CPL link uses native threshold + health", () => {
  const compat = resolveLinkedKpiCompatibility({
    nativeObjective: "LEADS",
    nativeThreshold: 18,
    nativeThresholdSource: "max_sustainable_cpa",
    metaRawObjective: "OUTCOME_LEADS",
    resultMappingConfidence: "CONFIDENT",
    primaryResultType: "lead",
  });
  assert(compat.compatible && compat.primaryKpi === "CPL", "CPL compatible");
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({ affianco_campaign_id: leadsNative().id, primary_kpi: null, target_value: null }),
    confidentLeadsAgg,
    "Technon",
    leadsNative(),
  );
  assert(row.primaryKpi === "CPL", `kpi: ${row.primaryKpi}`);
  assert(row.targetValue === 18, `target: ${row.targetValue}`);
  assert(row.healthAvailability === "AVAILABLE", row.healthAvailability);
  assert(row.healthStatus === "GREEN", `health: ${row.healthStatus}`);
});

test("K: incompatible KPI → no health", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: bookingsNative().id,
      raw_objective: "OUTCOME_LEADS",
      primary_kpi: "CPC",
      target_value: 0.3,
    }),
    confidentLeadsAgg,
    "Technon",
    bookingsNative(),
  );
  assert(row.linkState === "LINKED_BUT_KPI_INCOMPATIBLE", row.linkState);
  assert(row.healthStatus === null, "no fabricated health");
  assert(row.healthAvailability === "LINKED_BUT_KPI_INCOMPATIBLE", row.healthAvailability);
  assert(row.primaryKpi === null, "must not inherit booking CPA as Meta CPL");
  assert(
    etichettaHealthAvailability("LINKED_BUT_KPI_INCOMPATIBLE").length > 0,
    "label exists",
  );
});

test("K2: native CPM must not apply to Meta leads", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: awarenessNative().id,
      raw_objective: "OUTCOME_LEADS",
    }),
    confidentLeadsAgg,
    "Technon",
    awarenessNative(),
  );
  assert(row.linkState === "LINKED_BUT_KPI_INCOMPATIBLE", row.linkState);
  assert(row.healthStatus === null, "no CPM health on leads campaign");
});

test("L: linked native missing → safe, Meta target resumes", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: leadsNative().id,
      primary_kpi: "CPC",
      target_value: 0.3,
    }),
    { spend: 99.97, impressions: 14647, linkClicks: 420 },
    "Technon",
    null,
  );
  assert(row.linkState === "LINKED_CAMPAIGN_MISSING", row.linkState);
  assert(row.targetSource === "META_EXPLICIT", row.targetSource);
  assert(row.primaryKpi === "CPC", row.primaryKpi ?? "");
  assert(row.healthStatus != null, "must not crash; Meta target usable");
});

test("L2: migration ON DELETE SET NULL", () => {
  const sql = read("./supabase/migrations/20260908_meta_campaign_affianco_link.sql");
  assert(sql.includes("on delete set null"), "FK set null");
  assert(sql.includes("affianco_campaign_id"), "column");
  assert(!sql.includes("unique (affianco_campaign_id)"), "no 1:1 unique");
});

test("M: no economics copied into meta_campaigns", () => {
  const files = [
    "./src/lib/meta/campaign-link.ts",
    "./src/app/api/meta/campaign-link/route.ts",
    "./supabase/migrations/20260908_meta_campaign_affianco_link.sql",
  ];
  for (const file of files) {
    const content = read(file);
    assert(!content.includes("max_sustainable_cpa"), `${file}: copied cpa`);
    assert(!content.includes("estimated_cpm"), `${file}: copied cpm`);
    assert(!content.includes("average_order_value"), `${file}: copied aov`);
    assert(!content.includes("show_up_rate"), `${file}: copied show-up`);
  }
});

test("N: no campaign_checks writes", () => {
  const files = [
    "./src/lib/meta/campaign-link.ts",
    "./src/lib/meta/campaign-link-compatibility.ts",
    "./src/app/api/meta/campaign-link/route.ts",
    "./src/lib/meta/meta-campaign-monitoring-row.ts",
  ];
  for (const file of files) {
    const content = read(file);
    assert(!content.includes("campaign_checks"), `${file}: campaign_checks`);
  }
});

test("O/P/Q: no Meta writes / ads_management / business_management", () => {
  const files = [
    "./src/lib/meta/campaign-link.ts",
    "./src/lib/meta/campaign-link-compatibility.ts",
    "./src/lib/meta/campaign-link-client.ts",
    "./src/app/api/meta/campaign-link/route.ts",
  ];
  for (const file of files) {
    const content = read(file);
    assert(!content.includes("ads_management"), `${file}: ads_management`);
    assert(!content.includes("business_management"), `${file}: business_management`);
    assert(!content.includes("graph.facebook.com"), `${file}: graph write`);
  }
});

test("R: Technon can remain unlinked", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({ affianco_campaign_id: null, primary_kpi: null, target_value: null }),
    { spend: 99.97, impressions: 14647, linkClicks: 420 },
    "Technon",
    null,
  );
  assert(row.linkState === "UNLINKED", row.linkState);
  assert(row.healthAvailability === "TARGET_REQUIRED", row.healthAvailability);
  assert(row.healthStatus === null, "unlinked Technon has no health");
});

test("S: selector is same-client only (API + UI)", () => {
  const svc = read("./src/lib/meta/campaign-link.ts");
  assert(svc.includes(".eq(\"client_id\", clientId)"), "options filter client");
  assert(svc.includes(".eq(\"user_id\", userId)"), "options filter user");
  const ui = read("./src/components/risultati/MetaCampagneSection.tsx");
  assert(ui.includes("fetchMetaCampaignLink"), "selector uses API options");
  assert(ui.includes("Collega campagna Affianco"), "link CTA");
  assert(ui.includes("Scollega"), "unlink CTA");
  assert(ui.includes("Cambia"), "change CTA");
});

test("T: no manual refresh required (canonical reload)", () => {
  const ui = read("./src/components/risultati/MetaCampagneSection.tsx");
  assert(ui.includes("refreshAfterMetaTargetMutation"), "link uses canonical refresh");
  assert(ui.includes("saveMetaCampaignLink"), "POST link");
  assert(ui.includes("deleteMetaCampaignLink"), "DELETE unlink");
  void refreshAfterMetaTargetMutation;
});

test("API: GET/POST/DELETE + JWT user, no browser user_id", () => {
  const api = read("./src/app/api/meta/campaign-link/route.ts");
  assert(api.includes("requireRouteUserId"), "JWT user");
  assert(!api.includes("body.userId") && !api.includes("body.user_id"), "no user_id body");
  const client = read("./src/lib/meta/campaign-link-client.ts");
  assert(client.includes("Authorization"), "bearer");
  assert(
    client.includes("JSON.stringify({ clientId, metaCampaignId"),
    "body has no user_id field",
  );
});

test("Migration trigger enforces same user/client", () => {
  const sql = read("./supabase/migrations/20260908_meta_campaign_affianco_link.sql");
  assert(sql.includes("enforce_meta_campaigns_affianco_link"), "trigger fn");
  assert(sql.includes("affianco link user mismatch"), "user check");
  assert(sql.includes("affianco link client mismatch"), "client check");
  assert(sql.includes("grant select (affianco_campaign_id)"), "select grant");
});

test("No auto-create native campaign", () => {
  const svc = read("./src/lib/meta/campaign-link.ts");
  assert(!svc.includes(".insert("), "must not insert campaigns");
  assert(!svc.includes("creaCampagna"), "must not create native");
});

test("Multiple Meta → one native allowed (no unique FK)", () => {
  const resolved = resolveLinkedMonitoringTarget({
    affiancoCampaignId: leadsNative().id,
    linkedCampaign: leadsNative(),
    metaRawObjective: "OUTCOME_LEADS",
    storedPrimaryKpi: null,
    storedTargetValue: null,
    resultMappingConfidence: "CONFIDENT",
    primaryResultType: "lead",
  });
  assert(resolved.linkState === "LINKED", resolved.linkState);
  const sql = read("./supabase/migrations/20260908_meta_campaign_affianco_link.sql");
  assert(
    sql.includes("more Meta rows may share one native") ||
      sql.includes("No uniqueness"),
    "many-to-one documented",
  );
});

test("Awareness + planned CPM is compatible", () => {
  const row = mapMetaCampaignToMonitoringRow(
    metaRow({
      affianco_campaign_id: awarenessNative().id,
      raw_objective: "OUTCOME_AWARENESS",
      primary_kpi: null,
      target_value: null,
    }),
    { spend: 50, impressions: 10000, linkClicks: 10 },
    "Technon",
    awarenessNative(),
  );
  assert(row.targetSource === "LINKED_AFFIANCO", row.targetSource);
  assert(row.primaryKpi === "CPM", row.primaryKpi ?? "");
  assert(row.targetValue === 12, String(row.targetValue));
  assert(row.healthAvailability === "AVAILABLE", row.healthAvailability);
});

console.log("\n" + "━".repeat(56));
console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
if (failed > 0) {
  console.error("\n  ✗ Alcuni test sono falliti.\n");
  process.exit(1);
}
console.log("\n  ✓ Tutti i test M5C sono passati.\n");
process.exit(0);
