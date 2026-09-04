/**
 * M7B.1 — Notification state engine verification
 * Pure transition evaluator. No delivery / DB / Meta / AI.
 */

import fs from "node:fs";
import {
  resolveNotificationDecision,
  snapshotFromControlRoomFields,
  type NotificationCampaignSnapshot,
} from "../src/lib/campaign-notifications";
import {
  resolveAttentionFromSignals,
  resolveUrgencyFromSignals,
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

function snap(
  partial: Partial<NotificationCampaignSnapshot> = {},
): NotificationCampaignSnapshot {
  return snapshotFromControlRoomFields({
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    campaignId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    source: "META",
    campaignStatus: "ACTIVE",
    attentionState: "STABLE",
    urgencyLevel: "NONE",
    health: "GREEN",
    trend: "STABLE",
    healthAvailability: "AVAILABLE",
    configurationKind: null,
    freshness: "FRESH",
    resultsCount: 20,
    suppressedByLink: false,
    href: "/risultati",
    nextActionType: null,
    ...partial,
  });
}

console.log("\nM7B.1 — Notification state engine\n");

test("A: STABLE → NEEDS_ATTENTION => notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({ attentionState: "STABLE", health: "GREEN" }),
    current: snap({
      attentionState: "NEEDS_ATTENTION",
      health: "RED",
      urgencyLevel: "SOON",
    }),
  });
  assert(d.shouldNotify, "notify");
  assert(d.notificationType === "PERFORMANCE_DROPPED", String(d.notificationType));
  assert(d.severity === "MEDIUM" || d.severity === "HIGH", String(d.severity));
  assert(d.title === "Costo fuori soglia", String(d.title));
  assert(!!d.dedupeKey, "dedupe");
});

test("B: NEEDS_ATTENTION → NEEDS_ATTENTION => no notify", () => {
  const base = snap({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    urgencyLevel: "SOON",
  });
  const d = resolveNotificationDecision({ previous: base, current: { ...base } });
  assert(!d.shouldNotify, "no notify");
  assert(d.reasonCode === "UNCHANGED_SKIP", d.reasonCode);
});

test("C: NEEDS_ATTENTION → CRITICAL => notify HIGH", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      attentionState: "NEEDS_ATTENTION",
      urgencyLevel: "SOON",
      health: "RED",
    }),
    current: snap({
      attentionState: "CRITICAL",
      urgencyLevel: "NOW",
      health: "RED",
    }),
  });
  assert(d.shouldNotify, "notify");
  assert(d.notificationType === "CRITICAL_STATE", String(d.notificationType));
  assert(d.severity === "HIGH", String(d.severity));
});

test("D: CRITICAL → CRITICAL => no notify", () => {
  const base = snap({
    attentionState: "CRITICAL",
    urgencyLevel: "NOW",
    health: "RED",
  });
  const d = resolveNotificationDecision({ previous: base, current: { ...base } });
  assert(!d.shouldNotify, "no");
});

test("E: CRITICAL → STABLE => recovery notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      attentionState: "CRITICAL",
      urgencyLevel: "NOW",
      health: "RED",
    }),
    current: snap({
      attentionState: "STABLE",
      urgencyLevel: "NONE",
      health: "GREEN",
    }),
  });
  assert(d.shouldNotify, "notify");
  assert(d.notificationType === "RECOVERED", String(d.notificationType));
  assert(d.severity === "LOW", String(d.severity));
  assert(/stabile/i.test(d.title ?? ""), String(d.title));
});

test("F: STABLE → STABLE => no notify", () => {
  const base = snap();
  const d = resolveNotificationDecision({ previous: base, current: { ...base } });
  assert(!d.shouldNotify, "no");
});

test("G: FRESH → STALE on ACTIVE Meta => notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({ freshness: "FRESH" }),
    current: snap({ freshness: "STALE" }),
  });
  assert(d.shouldNotify, "notify");
  assert(d.notificationType === "DATA_STALE", String(d.notificationType));
});

test("H: STALE → STALE => no notify", () => {
  const base = snap({ freshness: "STALE" });
  const d = resolveNotificationDecision({ previous: base, current: { ...base } });
  assert(!d.shouldNotify, "no");
});

test("I: historical stale => no notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      attentionState: "HISTORICAL",
      campaignStatus: "PAUSED",
      freshness: "FRESH",
    }),
    current: snap({
      attentionState: "HISTORICAL",
      campaignStatus: "PAUSED",
      freshness: "STALE",
    }),
  });
  assert(!d.shouldNotify, "no");
  assert(d.reasonCode === "HISTORICAL_SKIP", d.reasonCode);
});

test("J: new REVISION_REQUESTED => notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      source: "NATIVE",
      campaignStatus: "ACTIVE",
      attentionState: "NEEDS_ATTENTION",
    }),
    current: snap({
      source: "NATIVE",
      campaignStatus: "REVISION_REQUESTED",
      attentionState: "NEEDS_ATTENTION",
      health: null,
      href: "/campagne/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    }),
  });
  assert(d.shouldNotify, "notify");
  assert(d.notificationType === "CLIENT_REVISION", String(d.notificationType));
  assert(d.ctaLabel === "Gestisci revisione", String(d.ctaLabel));
});

test("K: repeated REVISION_REQUESTED => no notify", () => {
  const base = snap({
    source: "NATIVE",
    campaignStatus: "REVISION_REQUESTED",
    attentionState: "NEEDS_ATTENTION",
    health: null,
  });
  const d = resolveNotificationDecision({ previous: base, current: { ...base } });
  assert(!d.shouldNotify, "no");
});

test("L: ACTIVE becomes TARGET_REQUIRED => notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      attentionState: "NEEDS_ATTENTION",
      healthAvailability: "AVAILABLE",
      health: "RED",
    }),
    current: snap({
      attentionState: "CONFIGURATION_REQUIRED",
      healthAvailability: "TARGET_REQUIRED",
      health: null,
      configurationKind: "ACTIVE_MISSING_TARGET",
    }),
  });
  assert(d.shouldNotify, "notify");
  assert(d.notificationType === "CONFIGURATION_REQUIRED", String(d.notificationType));
});

test("M: initial draft target missing => no notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      source: "NATIVE",
      campaignStatus: "DRAFT",
      attentionState: "CONFIGURATION_REQUIRED",
      configurationKind: "DRAFT",
      health: null,
      healthAvailability: null,
    }),
    current: snap({
      source: "NATIVE",
      campaignStatus: "DRAFT",
      attentionState: "CONFIGURATION_REQUIRED",
      configurationKind: "DRAFT",
      health: null,
      healthAvailability: "TARGET_REQUIRED",
    }),
  });
  assert(!d.shouldNotify, "no");
  assert(d.reasonCode === "DRAFT_SKIP", d.reasonCode);
});

test("N: insufficient data only => no notify", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      attentionState: "MONITOR",
      health: "YELLOW",
    }),
    current: snap({
      attentionState: "INSUFFICIENT_DATA",
      health: "INSUFFICIENT",
    }),
  });
  assert(!d.shouldNotify, "no");
  assert(d.reasonCode === "INSUFFICIENT_ONLY_SKIP", d.reasonCode);
});

test("O: small sample only => no notify", () => {
  const prev = snap({ resultsCount: 2, attentionState: "MONITOR", health: "GREEN" });
  const curr = snap({ resultsCount: 2, attentionState: "MONITOR", health: "GREEN" });
  const d = resolveNotificationDecision({ previous: prev, current: curr });
  assert(!d.shouldNotify, "no");
});

test("P: Meta linked/native duplicate => single candidate (suppressed skip)", () => {
  const d = resolveNotificationDecision({
    previous: snap({
      source: "NATIVE",
      suppressedByLink: false,
      attentionState: "STABLE",
    }),
    current: snap({
      source: "NATIVE",
      suppressedByLink: true,
      attentionState: "NEEDS_ATTENTION",
      health: "RED",
    }),
  });
  assert(!d.shouldNotify, "suppressed native skipped");
  assert(d.reasonCode === "SUPPRESSED_LINK_SKIP", d.reasonCode);

  const meta = resolveNotificationDecision({
    previous: snap({ source: "META", attentionState: "STABLE" }),
    current: snap({
      source: "META",
      suppressedByLink: false,
      attentionState: "NEEDS_ATTENTION",
      health: "RED",
      urgencyLevel: "SOON",
    }),
  });
  assert(meta.shouldNotify, "meta notifies");
});

test("Q: no Meta writes", () => {
  const root = "./src/lib/campaign-notifications";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`);
    assert(!c.includes("graph.facebook"), f);
    assert(!c.includes("ads_management"), f);
  }
});

test("R: no AI calls", () => {
  const root = "./src/lib/campaign-notifications";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`);
    assert(!c.includes("Anthropic"), f);
    assert(!c.includes("runCampaignAiDiagnosis"), f);
    assert(!c.includes("resolveNextAction"), f);
  }
});

test("S: no notifications sent", () => {
  const root = "./src/lib/campaign-notifications";
  for (const f of fs.readdirSync(root)) {
    const c = read(`${root}/${f}`).toLowerCase();
    assert(!c.includes("sendemail"), f);
    assert(!c.includes("resend"), f);
    assert(!c.includes("web-push"), f);
    assert(!c.includes("slack"), f);
  }
});

test("T: no database mutation", () => {
  // M7B.1 pure evaluator files only — M7B.2 persistence lives in sibling modules.
  for (const f of ["types.ts", "copy.ts", "resolve.ts", "index.ts"]) {
    const c = read(`./src/lib/campaign-notifications/${f}`);
    assert(!c.includes(".insert("), f);
    assert(!c.includes(".update("), f);
    assert(!c.includes("createSupabaseAdmin"), f);
  }
  const files = fs.readdirSync("./supabase/migrations");
  assert(!files.some((f) => /m7b1/i.test(f)), "no m7b1 migration");
});

test("U: no ads_management", () => {
  for (const f of fs.readdirSync("./src/lib/campaign-notifications")) {
    assert(!read(`./src/lib/campaign-notifications/${f}`).includes("ads_management"), f);
  }
});

test("V: no business_management", () => {
  for (const f of fs.readdirSync("./src/lib/campaign-notifications")) {
    assert(
      !read(`./src/lib/campaign-notifications/${f}`).includes("business_management"),
      f,
    );
  }
});

test("MONITOR → NEEDS_ATTENTION notifies", () => {
  const d = resolveNotificationDecision({
    previous: snap({ attentionState: "MONITOR", health: "YELLOW" }),
    current: snap({
      attentionState: "NEEDS_ATTENTION",
      health: "RED",
      urgencyLevel: "SOON",
    }),
  });
  assert(d.shouldNotify, "notify");
});

test("NEEDS_ATTENTION → STABLE recovery notifies", () => {
  const d = resolveNotificationDecision({
    previous: snap({ attentionState: "NEEDS_ATTENTION", health: "RED" }),
    current: snap({ attentionState: "STABLE", health: "GREEN" }),
  });
  assert(d.shouldNotify && d.notificationType === "RECOVERED", String(d.notificationType));
});

test("copy has no raw enums", () => {
  const d = resolveNotificationDecision({
    previous: snap({ attentionState: "STABLE" }),
    current: snap({ attentionState: "NEEDS_ATTENTION", health: "RED", urgencyLevel: "SOON" }),
  });
  const blob = `${d.title} ${d.message}`;
  assert(!/NEEDS_ATTENTION|CRITICAL|RED|WORSENING/.test(blob), blob);
});

test("health/urgency resolvers unchanged by notification module", () => {
  const before = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  resolveNotificationDecision({
    previous: snap({ attentionState: "STABLE" }),
    current: snap({ attentionState: "NEEDS_ATTENTION", health: "RED" }),
  });
  const after = resolveAttentionFromSignals({
    historical: false,
    configurationRequired: false,
    insufficientData: false,
    health: "RED",
    trend: "STABLE",
  });
  assert(before.state === after.state, before.state);
  const u1 = resolveUrgencyFromSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    campaignStatus: "ACTIVE",
  });
  const u2 = resolveUrgencyFromSignals({
    attentionState: "NEEDS_ATTENTION",
    health: "RED",
    trend: "STABLE",
    campaignStatus: "ACTIVE",
  });
  assert(u1.level === u2.level, u1.level);
});

test("dedupeKey is transition-based not timestamp-only", () => {
  const d = resolveNotificationDecision({
    previous: snap({ attentionState: "STABLE" }),
    current: snap({ attentionState: "NEEDS_ATTENTION", health: "RED", urgencyLevel: "SOON" }),
  });
  assert(d.dedupeKey != null && d.dedupeKey.includes("PERFORMANCE_DROPPED"), d.dedupeKey!);
  assert(d.dedupeKey!.includes("STABLE->NEEDS_ATTENTION"), d.dedupeKey!);
  assert(!/T\d{2}:\d{2}/.test(d.dedupeKey!), "no clock");
});

console.log("\n" + "━".repeat(56));
console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
console.log("\n  ✓ Tutti i test M7B.1 sono passati.\n");
process.exit(0);
