/**
 * M7A — Automatic Meta monitoring foundation verification
 * Pure logic + structural. No live Meta Graph / no real cron secret required beyond env fixture.
 */

import fs from "node:fs";
import { MetaError } from "../src/lib/meta/errors";
import {
  etichettaFreshness,
  resolveMetaDataFreshness,
  FRESH_MAX_MS,
  AGING_MAX_MS,
} from "../src/lib/meta/freshness";
import {
  assertCronAuthorized,
  isCampaignDueForScheduledSync,
  isTerminalHistoricalStatus,
  syncMetaInsightTargets,
  PAUSED_RESYNC_MIN_MS,
  type MetaSyncTarget,
} from "../src/lib/meta/meta-sync-cron";
import type { CampaignInsightsSummary } from "../src/lib/meta/insight-import";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const run = Promise.resolve().then(fn);
  return run
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((e) => {
      console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`);
      failed++;
    });
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function read(path: string): string {
  return fs.readFileSync(path, "utf8");
}

function target(partial: Partial<MetaSyncTarget> = {}): MetaSyncTarget {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    campaignUuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    metaCampaignId: "120232108867250161",
    effectiveStatus: "ACTIVE",
    insightsLastSyncedAt: null,
    mode: "ACTIVE_MONITORING",
    ...partial,
  };
}

const emptySummary = (): CampaignInsightsSummary => ({
  metaCampaignId: "120232108867250161",
  syncedAt: new Date().toISOString(),
  emptyValid: false,
  lookbackTruncated: false,
  dateRangeFallback: null,
  since: null,
  until: null,
  currency: null,
  inserted: 0,
  updated: 0,
  aggregate: null,
});

async function main() {
  console.log("\nM7A — Automatic Meta monitoring\n");

  await test("A: anonymous cron request blocked", () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-m7a";
    try {
      const req = new Request("https://example.com/api/cron/meta-sync");
      assert(!assertCronAuthorized(req), "no auth");
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  await test("B: wrong cron secret blocked", () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-m7a";
    try {
      const req = new Request("https://example.com/api/cron/meta-sync", {
        headers: { Authorization: "Bearer wrong" },
      });
      assert(!assertCronAuthorized(req), "wrong secret");
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  await test("C: valid cron invocation allowed", () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-m7a";
    try {
      const req = new Request("https://example.com/api/cron/meta-sync", {
        headers: { Authorization: "Bearer test-secret-m7a" },
      });
      assert(assertCronAuthorized(req), "valid");
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });

  await test("D: eligible active due when never synced", () => {
    const d = isCampaignDueForScheduledSync({
      effectiveStatus: "ACTIVE",
      insightsLastSyncedAt: null,
    });
    assert(d.due, "due");
  });

  await test("E: disconnected status policy via terminal helpers", () => {
    // Structural: cron enumeration skips non-ACTIVE connections
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    assert(cron.includes('row.status !== "ACTIVE"'), "skip non-active");
    assert(cron.includes("skippedDisconnected"), "counter");
  });

  await test("F: unmapped client skipped structurally", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    assert(cron.includes("client_ad_accounts"), "accounts");
    assert(cron.includes("skippedUnmapped"), "unmapped");
  });

  await test("G: legacy unassigned connection skipped", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    assert(cron.includes("skippedLegacy"), "legacy");
    assert(cron.includes("!row.client_id"), "null client");
  });

  await test("H: Client A isolated from Client B", async () => {
    const calls: string[] = [];
    const a = target({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      campaignUuid: "11111111-1111-4111-8111-111111111111",
    });
    const b = target({
      userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      clientId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      campaignUuid: "22222222-2222-4222-8222-222222222222",
    });
    await syncMetaInsightTargets([a, b], {
      importFn: async (userId, clientId) => {
        calls.push(`${userId}:${clientId}`);
        return emptySummary();
      },
    });
    assert(calls.length === 2, String(calls.length));
    assert(calls[0] !== calls[1], "distinct");
  });

  await test("I: one client failure does not abort others", async () => {
    const synced: string[] = [];
    const a = target({
      clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      campaignUuid: "11111111-1111-4111-8111-111111111111",
    });
    const b = target({
      clientId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      campaignUuid: "22222222-2222-4222-8222-222222222222",
    });
    const summary = await syncMetaInsightTargets([a, b], {
      importFn: async (_u, clientId) => {
        if (clientId === a.clientId) {
          throw new MetaError("META_TEMPORARY_ERROR", "fail A");
        }
        synced.push(clientId);
        return emptySummary();
      },
    });
    assert(summary.errorsCount === 1, String(summary.errorsCount));
    assert(summary.campaignsSynced === 1, String(summary.campaignsSynced));
    assert(synced[0] === b.clientId, synced.join(","));
  });

  await test("J: active campaign syncs on every daily cron", () => {
    const now = Date.now();
    const never = isCampaignDueForScheduledSync({
      effectiveStatus: "ACTIVE",
      insightsLastSyncedAt: null,
      nowMs: now,
    });
    assert(never.due, "never synced");
    const recent = isCampaignDueForScheduledSync({
      effectiveStatus: "ACTIVE",
      insightsLastSyncedAt: new Date(now - 60_000).toISOString(),
      nowMs: now,
    });
    assert(recent.due, "active always due on daily cron");
    const dayOld = isCampaignDueForScheduledSync({
      effectiveStatus: "ACTIVE",
      insightsLastSyncedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      nowMs: now,
    });
    assert(dayOld.due, "active day-old still due");
  });

  await test("K: historical campaign status policy respected", () => {
    assert(isTerminalHistoricalStatus("ARCHIVED"), "archived");
    assert(isTerminalHistoricalStatus("DELETED"), "deleted");
    const archivedSynced = isCampaignDueForScheduledSync({
      effectiveStatus: "ARCHIVED",
      insightsLastSyncedAt: "2026-01-01T00:00:00Z",
    });
    assert(!archivedSynced.due && archivedSynced.reason === "ARCHIVED_SKIP", "skip");
    const archivedNever = isCampaignDueForScheduledSync({
      effectiveStatus: "ARCHIVED",
      insightsLastSyncedAt: null,
    });
    assert(archivedNever.due, "one-shot");
    const now = Date.now();
    const pausedRecent = isCampaignDueForScheduledSync({
      effectiveStatus: "PAUSED",
      insightsLastSyncedAt: new Date(now - 60_000).toISOString(),
      nowMs: now,
    });
    assert(!pausedRecent.due, "paused not daily yet");
    const pausedOld = isCampaignDueForScheduledSync({
      effectiveStatus: "PAUSED",
      insightsLastSyncedAt: new Date(
        now - PAUSED_RESYNC_MIN_MS - 1000,
      ).toISOString(),
      nowMs: now,
    });
    assert(pausedOld.due, "paused daily");
  });

  await test("L: daily insight upsert remains idempotent", () => {
    const imp = read("./src/lib/meta/insight-import.ts");
    assert(imp.includes("onConflict"), "upsert");
    assert(
      imp.includes("user_id, client_id, meta_campaign_id, date_start") ||
        imp.includes("user_id,client_id,meta_campaign_id,date_start"),
      "identity",
    );
  });

  await test("M: manual sync still works", () => {
    const route = read("./src/app/api/meta/campaign-insights/import/route.ts");
    assert(route.includes("requireRouteUserId"), "jwt");
    assert(route.includes("importClientCampaignInsights"), "canonical");
    const ui = read("./src/components/clienti/PannelloAccountMetaCliente.tsx");
    assert(ui.includes("Sincronizza dati") || ui.includes("Importa dati Meta"), "cta");
  });

  await test("N: scheduled + manual share canonical importer", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    const route = read("./src/app/api/meta/campaign-insights/import/route.ts");
    assert(cron.includes("importClientCampaignInsights"), "cron uses");
    assert(route.includes("importClientCampaignInsights"), "manual uses");
    assert(!cron.includes("fetchInsightsPages"), "no duplicate graph");
  });

  await test("O: no campaign_checks writes", () => {
    for (const f of [
      "./src/lib/meta/meta-sync-cron.ts",
      "./src/app/api/cron/meta-sync/route.ts",
    ]) {
      const c = read(f);
      assert(!c.includes("inserisciCampaignCheck"), f);
      assert(!c.includes("campaign_checks"), f);
    }
  });

  await test("P: no Meta writes", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    assert(!cron.includes("ads_management"), "no ads mgmt");
    assert(!/POST.*campaigns/.test(cron), "no post campaigns");
    // Graph import is GET insights via shared importer only
    assert(cron.includes("importClientCampaignInsights"), "read path");
  });

  await test("Q: no AI calls", () => {
    for (const f of [
      "./src/lib/meta/meta-sync-cron.ts",
      "./src/app/api/cron/meta-sync/route.ts",
    ]) {
      const c = read(f);
      assert(!c.includes("Anthropic"), f);
      assert(!c.includes("runCampaignAiDiagnosis"), f);
      assert(!c.includes("resolveNextAction"), f);
    }
  });

  await test("R: no notifications", () => {
    for (const f of [
      "./src/lib/meta/meta-sync-cron.ts",
      "./src/app/api/cron/meta-sync/route.ts",
    ]) {
      const c = read(f).toLowerCase();
      assert(!c.includes("sendemail"), f);
      assert(!c.includes("slack"), f);
      assert(!c.includes("resend"), f);
      assert(!c.includes("web-push"), f);
      assert(!c.includes("browser notification"), f);
    }
  });

  await test("S: no ads_management", () => {
    assert(!read("./src/lib/meta/meta-sync-cron.ts").includes("ads_management"), "cron");
    assert(!read("./src/app/api/cron/meta-sync/route.ts").includes("ads_management"), "route");
  });

  await test("T: no business_management", () => {
    assert(!read("./src/lib/meta/meta-sync-cron.ts").includes("business_management"), "cron");
  });

  await test("U: no plaintext token", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    assert(!cron.includes("access_token"), "no token field");
    assert(!cron.includes("decryptMetaToken"), "decrypt only in importer chain");
    assert(!cron.includes("console.log"), "no info logs");
  });

  await test("V: safe logging", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    assert(cron.includes("[META_CRON]"), "prefix");
    assert(cron.includes("RATE_LIMIT"), "rate");
    assert(cron.includes("TOKEN_INVALID"), "token cat");
    assert(cron.includes("elapsed_ms"), "elapsed");
  });

  await test("W: rate-limit handling safe", async () => {
    let calls = 0;
    const summary = await syncMetaInsightTargets(
      [
        target({ campaignUuid: "11111111-1111-4111-8111-111111111111" }),
        target({ campaignUuid: "22222222-2222-4222-8222-222222222222" }),
        target({
          userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          clientId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          campaignUuid: "33333333-3333-4333-8333-333333333333",
        }),
      ],
      {
        importFn: async () => {
          calls += 1;
          if (calls === 1) {
            throw new MetaError("META_RATE_LIMIT", "rate");
          }
          return emptySummary();
        },
      },
    );
    assert(summary.rateLimited, "flag");
    // After rate limit, remaining skipped (including other clients in this MVP)
    assert(summary.campaignsSynced === 0, String(summary.campaignsSynced));
    assert(calls === 1, String(calls));
  });

  await test("X: freshness derived deterministically (daily cadence)", () => {
    const now = Date.now();
    assert(resolveMetaDataFreshness(null) === "UNKNOWN", "unknown");
    assert(
      resolveMetaDataFreshness(new Date(now - 1000).toISOString(), now) === "FRESH",
      "fresh recent",
    );
    assert(
      resolveMetaDataFreshness(
        new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        now,
      ) === "FRESH",
      "fresh 24h",
    );
    assert(
      resolveMetaDataFreshness(
        new Date(now - FRESH_MAX_MS - 1000).toISOString(),
        now,
      ) === "AGING",
      "aging >30h",
    );
    assert(
      resolveMetaDataFreshness(
        new Date(now - 40 * 60 * 60 * 1000).toISOString(),
        now,
      ) === "AGING",
      "aging 40h",
    );
    assert(
      resolveMetaDataFreshness(
        new Date(now - AGING_MAX_MS - 1000).toISOString(),
        now,
      ) === "STALE",
      "stale >48h",
    );
    assert(
      etichettaFreshness("STALE", new Date(now - AGING_MAX_MS - 1000).toISOString(), now) ===
        "Dati da aggiornare",
      "stale label",
    );
    assert(
      /aggiornat/i.test(
        etichettaFreshness(
          "FRESH",
          new Date(now - 3 * 60 * 60 * 1000).toISOString(),
          now,
        ) ?? "",
      ),
      "fresh label",
    );
  });

  await test("Cron route rejects userId/clientId params", () => {
    const route = read("./src/app/api/cron/meta-sync/route.ts");
    assert(route.includes("assertCronAuthorized"), "auth");
    assert(route.includes("userId"), "reject userId");
    assert(route.includes("Parametri non ammessi"), "400");
    assert(!route.includes("requireRouteUserId"), "no jwt trust");
  });

  await test("Vercel cron config present (Hobby daily)", () => {
    const v = JSON.parse(read("./vercel.json")) as {
      crons: { path: string; schedule: string }[];
    };
    assert(v.crons.length === 1, "single cron");
    assert(v.crons.some((c) => c.path === "/api/cron/meta-sync"), "path");
    assert(v.crons.some((c) => c.schedule === "0 6 * * *"), "daily 06:00 UTC");
    assert(!v.crons.some((c) => c.schedule.includes("*/6")), "no 6h");
    const cronSrc = read("./src/lib/meta/meta-sync-cron.ts");
    assert(/Hobby/i.test(cronSrc), "hobby note");
  });

  await test("Monday freshness UX present", () => {
    const ui = read("./src/components/dashboard/MondayControlRoomSection.tsx");
    assert(ui.includes("etichettaFreshness"), "label");
    assert(ui.includes("resolveMetaDataFreshness"), "freshness");
  });

  await test("No M7A migration", () => {
    const files = fs.readdirSync("./supabase/migrations");
    assert(!files.some((f) => /m7a|meta.?cron|meta.?sync/i.test(f)), "none");
  });

  console.log("\n" + "━".repeat(56));
  console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
  if (failed > 0) process.exit(1);
  console.log("\n  ✓ Tutti i test M7A sono passati.\n");
  process.exit(0);
}

void main();
