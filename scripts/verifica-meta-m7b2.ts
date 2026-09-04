/**
 * M7B.2 — Notification persistence + inbox verification
 * Behavior via in-memory store. Security via migration structure.
 */

import fs from "node:fs";
import {
  createMemoryNotificationStore,
  evaluateAndPersistCampaignNotification,
  snapshotFromControlRoomFields,
  type NotificationCampaignSnapshot,
} from "../src/lib/campaign-notifications";

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

const MIGRATION = "./supabase/migrations/20260909_notifications.sql";

async function main() {
  console.log("\nM7B.2 — Notification persistence + inbox\n");

  await test("A–C: RLS owner-only select/update, no cross-user", () => {
    const sql = read(MIGRATION);
    assert(sql.includes('create policy "notifications_select_own"'), "select");
    assert(sql.includes('create policy "notifications_update_own"'), "update");
    assert(sql.includes("user_id = auth.uid()"), "uid");
    assert(!/create policy "notifications_insert/i.test(sql), "no insert policy");
  });

  await test("D: browser cannot insert arbitrary notification", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications inserts are server-only"), "server insert");
    assert(
      !sql.includes("grant insert on table public.notifications to authenticated"),
      "no insert grant",
    );
  });

  await test("E: anon direct access denied", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("revoke all on table public.notifications from anon"), "notif anon");
    assert(
      sql.includes(
        "revoke all on table public.notification_monitoring_state from anon",
      ),
      "state anon",
    );
  });

  await test("F: dedupe unique per user", () => {
    const sql = read(MIGRATION);
    assert(
      sql.includes("constraint notifications_user_dedupe_unique unique (user_id, dedupe_key)"),
      "unique",
    );
  });

  await test("G: service-side creation allowed", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications inserts are server-only"), "gate");
    assert(read("./src/lib/campaign-notifications/store-admin.ts").includes("createSupabaseAdmin"), "admin");
  });

  await test("H: client ownership enforced", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications.client_id ownership mismatch"), "client");
    assert(sql.includes("notifications.campaign_id ownership mismatch"), "campaign");
    assert(sql.includes("notifications.meta_campaign_id ownership mismatch"), "meta");
  });

  await test("I: no plaintext Meta token", () => {
    for (const f of fs.readdirSync("./src/lib/campaign-notifications")) {
      const c = read(`./src/lib/campaign-notifications/${f}`);
      assert(!c.includes("access_token"), f);
      assert(!c.includes("decryptMetaToken"), f);
    }
  });

  await test("J: no raw Graph payload persistence", () => {
    const sql = read(MIGRATION);
    assert(!sql.includes("graph_payload"), "sql");
    assert(!sql.includes("raw_insight"), "sql2");
    for (const f of fs.readdirSync("./src/lib/campaign-notifications")) {
      const c = read(`./src/lib/campaign-notifications/${f}`);
      assert(!c.includes("graph.facebook"), f);
    }
  });

  await test("K: first observation stores baseline, no notify", async () => {
    const store = createMemoryNotificationStore();
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ attentionState: "NEEDS_ATTENTION", health: "RED", urgencyLevel: "SOON" }),
      clientName: "Acme",
      campaignName: "Campagna",
    });
    assert(r.firstObservation, "first");
    assert(!r.persisted, "no notify");
    assert(store.states.length === 1, "baseline");
    assert(store.notifications.length === 0, "no row");
  });

  await test("L: STABLE → NEEDS_ATTENTION creates one notification", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ attentionState: "STABLE" }),
    });
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        attentionState: "NEEDS_ATTENTION",
        health: "RED",
        urgencyLevel: "SOON",
      }),
      clientName: "Acme",
      campaignName: "X",
    });
    assert(r.persisted, "created");
    assert(store.notifications.length === 1, "one");
    assert(store.notifications[0].notification_type === "PERFORMANCE_DROPPED", "type");
    assert(store.notifications[0].source === "META", "meta source");
    assert(store.notifications[0].meta_campaign_id != null, "meta id");
    assert(store.notifications[0].campaign_id == null, "no native id");
  });

  await test("M: repeated NEEDS_ATTENTION does not duplicate", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ attentionState: "STABLE" }),
    });
    const cur = snap({
      attentionState: "NEEDS_ATTENTION",
      health: "RED",
      urgencyLevel: "SOON",
    });
    await evaluateAndPersistCampaignNotification({ store, current: cur });
    const r2 = await evaluateAndPersistCampaignNotification({ store, current: cur });
    assert(!r2.persisted, "no second");
    assert(store.notifications.length === 1, "still one");
  });

  await test("N: NEEDS_ATTENTION → CRITICAL creates HIGH", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        attentionState: "NEEDS_ATTENTION",
        health: "RED",
        urgencyLevel: "SOON",
      }),
    });
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        attentionState: "CRITICAL",
        health: "RED",
        urgencyLevel: "NOW",
      }),
    });
    assert(r.persisted, "created");
    assert(store.notifications[0].severity === "HIGH", "high");
    assert(store.notifications[0].notification_type === "CRITICAL_STATE", "type");
  });

  await test("O: repeated CRITICAL no duplicate", async () => {
    const store = createMemoryNotificationStore();
    const crit = snap({
      attentionState: "CRITICAL",
      health: "RED",
      urgencyLevel: "NOW",
    });
    await evaluateAndPersistCampaignNotification({ store, current: crit });
    const r = await evaluateAndPersistCampaignNotification({ store, current: crit });
    assert(!r.persisted && store.notifications.length === 0, "baseline then same");
  });

  await test("P: CRITICAL → STABLE creates RECOVERED", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        attentionState: "CRITICAL",
        health: "RED",
        urgencyLevel: "NOW",
      }),
    });
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ attentionState: "STABLE", health: "GREEN" }),
    });
    assert(r.persisted, "recovered");
    assert(store.notifications[0].notification_type === "RECOVERED", "type");
  });

  await test("Q: FRESH → STALE creates one", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ freshness: "FRESH" }),
    });
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ freshness: "STALE" }),
    });
    assert(r.persisted, "stale");
    assert(store.notifications[0].notification_type === "DATA_STALE", "type");
  });

  await test("R: repeated STALE no duplicate", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ freshness: "FRESH" }),
    });
    const stale = snap({ freshness: "STALE" });
    await evaluateAndPersistCampaignNotification({ store, current: stale });
    const r2 = await evaluateAndPersistCampaignNotification({ store, current: stale });
    assert(!r2.persisted && store.notifications.length === 1, "one");
  });

  await test("S: new revision creates one", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        source: "NATIVE",
        campaignStatus: "ACTIVE",
        attentionState: "STABLE",
      }),
    });
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        source: "NATIVE",
        campaignStatus: "REVISION_REQUESTED",
        attentionState: "NEEDS_ATTENTION",
        health: null,
        href: "/campagne/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    });
    assert(r.persisted, "rev");
    assert(store.notifications[0].notification_type === "CLIENT_REVISION", "type");
    assert(store.notifications[0].campaign_id != null, "native id");
    assert(store.notifications[0].meta_campaign_id == null, "no meta");
  });

  await test("T: repeated revision no duplicate", async () => {
    const store = createMemoryNotificationStore();
    const rev = snap({
      source: "NATIVE",
      campaignStatus: "REVISION_REQUESTED",
      attentionState: "NEEDS_ATTENTION",
      health: null,
    });
    await evaluateAndPersistCampaignNotification({ store, current: rev });
    const r2 = await evaluateAndPersistCampaignNotification({ store, current: rev });
    assert(!r2.persisted && store.notifications.length === 0, "first was baseline");
  });

  await test("U: linked Native suppressed", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        source: "NATIVE",
        suppressedByLink: false,
        attentionState: "STABLE",
      }),
    });
    const r = await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        source: "NATIVE",
        suppressedByLink: true,
        attentionState: "NEEDS_ATTENTION",
        health: "RED",
        urgencyLevel: "SOON",
      }),
    });
    assert(!r.persisted, "suppressed");
    assert(r.decision.reasonCode === "SUPPRESSED_LINK_SKIP", r.decision.reasonCode);
  });

  await test("V: Meta active row creates correct source identity", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ source: "META", attentionState: "STABLE" }),
    });
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({
        source: "META",
        attentionState: "NEEDS_ATTENTION",
        health: "RED",
        urgencyLevel: "SOON",
      }),
    });
    const n = store.notifications[0];
    assert(n.source === "META", "source");
    assert(n.meta_campaign_id === "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "meta");
    assert(n.campaign_id == null, "native null");
  });

  await test("W–AA: inbox read/dismiss/unread helpers present", () => {
    const inbox = read("./src/lib/campaign-notifications/inbox-client.ts");
    assert(inbox.includes("markNotificationRead"), "W");
    assert(inbox.includes("markAllNotificationsRead"), "X");
    assert(inbox.includes("dismissNotification"), "Y");
    assert(inbox.includes('eq("is_dismissed", false)'), "Z");
    assert(inbox.includes("fetchUnreadNotificationCount"), "AA");
    assert(inbox.includes('eq("is_read", false)'), "unread filter");
  });

  await test("Prohibited: email/push/Slack/AI/Meta writes", () => {
    const root = "./src/lib/campaign-notifications";
    for (const f of fs.readdirSync(root)) {
      const c = read(`${root}/${f}`).toLowerCase();
      assert(!c.includes("sendemail"), f);
      assert(!c.includes("resend"), f);
      assert(!c.includes("web-push"), f);
      assert(!c.includes("slack"), f);
      assert(!c.includes("notification.requestpermission"), f);
      assert(!c.includes("anthropic"), f);
      assert(!c.includes("ads_management"), f);
      assert(!c.includes("business_management"), f);
      assert(!c.includes("graph.facebook"), f);
    }
    const cron = read("./src/lib/meta/meta-sync-cron.ts").toLowerCase();
    assert(!cron.includes("sendemail"), "cron email");
    assert(cron.includes("evaluateallmetanotificationsaftercron"), "wired");
  });

  await test("Inbox UI + bell route present", () => {
    assert(fs.existsSync("./src/app/notifiche/page.tsx"), "page");
    const top = read("./src/components/BarraSuperiore.tsx");
    assert(top.includes('href="/notifiche"'), "bell link");
    assert(top.includes("fetchUnreadNotificationCount"), "count");
    const inbox = read("./src/components/notifiche/NotificheInbox.tsx");
    assert(inbox.includes("Segna tutte come lette"), "mark all");
    assert(inbox.includes("Nascondi"), "dismiss");
    assert(!inbox.includes("Metti in pausa"), "no pause");
  });

  await test("Native evaluation path documented as API (not Meta cron)", () => {
    const runners = read("./src/lib/campaign-notifications/evaluate-runners.ts");
    assert(runners.includes("evaluateNativeNotificationsForUser"), "native fn");
    const api = read("./src/app/api/notifications/evaluate/route.ts");
    assert(api.includes("evaluateNativeNotificationsForUser"), "api");
    assert(
      !read("./src/lib/meta/meta-sync-cron.ts").includes(
        "evaluateNativeNotificationsForUser",
      ),
      "not in meta cron",
    );
  });

  await test("No AI / no delivery in evaluate API", () => {
    const api = read("./src/app/api/notifications/evaluate/route.ts");
    assert(!api.includes("Anthropic"), "ai");
    assert(!api.includes("sendEmail"), "email");
  });

  // ---- Pre-deploy persistence review matrix ----

  await test("Review D: browser DELETE blocked", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications deletes are not allowed from clients"), "trig");
    assert(sql.includes("revoke insert, delete on table public.notifications from authenticated"), "revoke");
  });

  await test("Review E: immutable notification fields locked for user", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications update may only change read/dismiss fields"), "immut");
    for (const field of [
      "user_id",
      "client_id",
      "campaign_id",
      "meta_campaign_id",
      "notification_type",
      "severity",
      "reason_code",
      "title",
      "message",
      "dedupe_key",
      "recommended_href",
    ]) {
      assert(sql.includes(`new.${field} is distinct from old.${field}`), field);
    }
  });

  await test("Review G: monitoring snapshot browser write blocked", () => {
    const sql = read(MIGRATION);
    assert(
      sql.includes("notification_monitoring_state writes are server-only"),
      "write",
    );
    assert(
      sql.includes(
        "revoke all on table public.notification_monitoring_state from authenticated",
      ),
      "no auth grants",
    );
  });

  await test("Review H: exact-one campaign identity enforced", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications_identity_chk"), "notif");
    assert(sql.includes("notification_monitoring_state_identity_chk"), "state");
    assert(sql.includes("source = 'NATIVE'"), "native");
    assert(sql.includes("and campaign_id is not null"), "native camp");
    assert(sql.includes("and meta_campaign_id is null"), "native meta null");
    assert(sql.includes("source = 'META'"), "meta");
    assert(sql.includes("and meta_campaign_id is not null"), "meta id");
    assert(sql.includes("and campaign_id is null"), "meta camp null");
  });

  await test("Review I: client ownership matches campaign rows", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("notifications.client_id must match campaigns.client_id"), "native");
    assert(
      sql.includes("notifications.client_id must match meta_campaigns.client_id"),
      "meta",
    );
  });

  await test("Review K: concurrent dedupe via unique constraint", () => {
    const sql = read(MIGRATION);
    assert(sql.includes("unique (user_id, dedupe_key)"), "unique");
    const store = read("./src/lib/campaign-notifications/store-admin.ts");
    assert(store.includes('code === "23505"') || store.includes("23505"), "pg unique");
  });

  await test("Review L: failed insert does not advance snapshot", async () => {
    const base = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store: base,
      current: snap({ attentionState: "STABLE" }),
    });
    const before = JSON.stringify(base.states[0]);
    const failing = {
      ...base,
      async insertNotification() {
        throw new Error("INSERT_FAILED");
      },
    };
    let threw = false;
    try {
      await evaluateAndPersistCampaignNotification({
        store: failing,
        current: snap({
          attentionState: "NEEDS_ATTENTION",
          health: "RED",
          urgencyLevel: "SOON",
        }),
      });
    } catch {
      threw = true;
    }
    assert(threw, "must throw");
    assert(JSON.stringify(base.states[0]) === before, "snapshot unchanged");
    assert(base.notifications.length === 0, "no notif");
  });

  await test("Review L2: duplicate conflict may advance snapshot", async () => {
    const store = createMemoryNotificationStore();
    await evaluateAndPersistCampaignNotification({
      store,
      current: snap({ attentionState: "STABLE" }),
    });
    const cur = snap({
      attentionState: "NEEDS_ATTENTION",
      health: "RED",
      urgencyLevel: "SOON",
    });
    await evaluateAndPersistCampaignNotification({ store, current: cur });
    // Simulate concurrent duplicate: same transition again after resetting state
    // to previous while notification already exists.
    store.states[0] = {
      ...store.states[0],
      attention_state: "STABLE",
      health: "GREEN",
      urgency_level: "NONE",
    };
    const r = await evaluateAndPersistCampaignNotification({ store, current: cur });
    assert(r.duplicateSuppressed, "dup");
    assert(store.states[0].attention_state === "NEEDS_ATTENTION", "advanced");
    assert(store.notifications.length === 1, "still one");
  });

  await test("Review N: Meta sync before notification eval", () => {
    const cron = read("./src/lib/meta/meta-sync-cron.ts");
    const fnStart = cron.indexOf("export async function runScheduledMetaInsightsSync");
    assert(fnStart >= 0, "fn");
    const fnBody = cron.slice(fnStart, fnStart + 1200);
    const syncIdx = fnBody.indexOf("await syncMetaInsightTargets");
    const notifIdx = fnBody.indexOf("evaluateAllMetaNotificationsAfterCron");
    assert(syncIdx >= 0 && notifIdx > syncIdx, "order in runner");
    assert(cron.includes("NOTIF_EVAL"), "isolated log");
    assert(cron.includes("category=BATCH_FAILED"), "batch fail safe");
  });

  await test("Review O: per-user notification failure isolated", () => {
    const runners = read("./src/lib/campaign-notifications/evaluate-runners.ts");
    assert(runners.includes("USER_META_FAILED"), "user isolation");
    assert(runners.includes("META_ERROR"), "campaign isolation");
  });

  await test("Review mark-all-read scoped filters", () => {
    const inbox = read("./src/lib/campaign-notifications/inbox-client.ts");
    const fn = inbox.slice(inbox.indexOf("markAllNotificationsRead"));
    assert(fn.includes('.eq("is_read", false)'), "unread only");
    assert(fn.includes('.eq("is_dismissed", false)'), "non-dismissed");
    assert(!fn.includes(".delete("), "no delete");
  });

  await test("Review dismiss soft-delete only", () => {
    const inbox = read("./src/lib/campaign-notifications/inbox-client.ts");
    const fn = inbox.slice(inbox.indexOf("dismissNotification"));
    assert(fn.includes("is_dismissed: true"), "flag");
    assert(fn.includes("dismissed_at"), "ts");
    assert(!fn.includes(".delete("), "no hard delete");
  });

  await test("Review no Graph/token in persistence path", () => {
    for (const f of [
      "evaluate-runners.ts",
      "meta-loader-admin.ts",
      "store-admin.ts",
      "evaluate-persist.ts",
    ]) {
      const c = read(`./src/lib/campaign-notifications/${f}`);
      assert(!c.includes("access_token"), f);
      assert(!c.includes("ads_management"), f);
    }
  });

  console.log("\n" + "━".repeat(56));
  console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
  if (failed > 0) process.exit(1);
  console.log("\n  ✓ Tutti i test M7B.2 sono passati.\n");
  process.exit(0);
}

void main();
