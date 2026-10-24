/**
 * M14.2 — Controlled QA write gate unit tests (no Meta mutations).
 */

import {
  ALLY_PRODUCTION_SUPABASE_PROJECT_REF,
  ALLY_QA_SUPABASE_PROJECT_REF,
  evaluateControlledQaWriteGate,
  isQaScopedMetaWritesEnvironment,
  maskMetaAdAccountId,
  supabaseProjectRefFromUrl,
} from "../src/lib/meta/publish/qa-write-gate";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

console.log("M14.2 controlled QA write gate\n");

test("project refs distinct QA vs production", () => {
  assert(
    String(ALLY_QA_SUPABASE_PROJECT_REF) !==
      String(ALLY_PRODUCTION_SUPABASE_PROJECT_REF),
    "refs differ",
  );
  assert(
    supabaseProjectRefFromUrl(
      `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
    ) === ALLY_QA_SUPABASE_PROJECT_REF,
    "parse QA",
  );
});

test("mask ad account never leaks full id", () => {
  const m = maskMetaAdAccountId("act_123456789012345");
  assert(m.includes("…"), "masked");
  assert(!m.includes("123456789012345"), "no full");
});

test("LIVE_OFF when META_WRITES_LIVE missing", () => {
  const r = evaluateControlledQaWriteGate({
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    metaAdAccountId: "act_1",
    confirmationToken: "tok",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
    },
  });
  assert(!r.ok && r.code === "LIVE_OFF", "live off");
});

test("rejects production Supabase even if LIVE=1", () => {
  const r = evaluateControlledQaWriteGate({
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    metaAdAccountId: "act_999",
    confirmationToken: "tok",
    env: {
      META_WRITES_LIVE: "1",
      // Pass secondary Preview gate so the PRODUCTION_SUPABASE check is reached.
      META_QA_LEGACY_WRITE_LIVE: "1",
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      META_QA_APPROVED_AD_ACCOUNT_ID: "act_999",
      META_QA_APPROVED_CAMPAIGN_ID: "11111111-1111-4111-8111-111111111111",
      META_QA_WRITE_CONFIRM_TOKEN: "tok",
    },
  });
  assert(!r.ok && r.code === "PRODUCTION_SUPABASE", "prod block");
});

test("rejects Vercel production", () => {
  const r = evaluateControlledQaWriteGate({
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    metaAdAccountId: "act_999",
    confirmationToken: "tok",
    env: {
      META_WRITES_LIVE: "1",
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
      META_QA_APPROVED_AD_ACCOUNT_ID: "act_999",
      META_QA_APPROVED_CAMPAIGN_ID: "11111111-1111-4111-8111-111111111111",
      META_QA_WRITE_CONFIRM_TOKEN: "tok",
    },
  });
  assert(!r.ok && r.code === "VERCEL_PRODUCTION", "vercel prod");
});

test("rejects campaign mismatch", () => {
  const r = evaluateControlledQaWriteGate({
    allyCampaignId: "22222222-2222-4222-8222-222222222222",
    metaAdAccountId: "act_999",
    confirmationToken: "tok",
    env: {
      META_WRITES_LIVE: "1",
      META_QA_LEGACY_WRITE_LIVE: "1",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
      META_QA_APPROVED_AD_ACCOUNT_ID: "act_999",
      META_QA_APPROVED_CAMPAIGN_ID: "11111111-1111-4111-8111-111111111111",
      META_QA_WRITE_CONFIRM_TOKEN: "tok",
    },
  });
  assert(!r.ok && r.code === "CAMPAIGN_MISMATCH", "campaign");
});

test("rejects ad account mismatch", () => {
  const r = evaluateControlledQaWriteGate({
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    metaAdAccountId: "act_111",
    confirmationToken: "tok",
    env: {
      META_WRITES_LIVE: "1",
      META_QA_LEGACY_WRITE_LIVE: "1",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
      META_QA_APPROVED_AD_ACCOUNT_ID: "act_999",
      META_QA_APPROVED_CAMPAIGN_ID: "11111111-1111-4111-8111-111111111111",
      META_QA_WRITE_CONFIRM_TOKEN: "tok",
    },
  });
  assert(!r.ok && r.code === "AD_ACCOUNT_MISMATCH", "account");
});

test("ok when all QA constraints satisfied", () => {
  const r = evaluateControlledQaWriteGate({
    allyCampaignId: "11111111-1111-4111-8111-111111111111",
    metaAdAccountId: "act_999888777",
    confirmationToken: "secret-qa-confirm",
    env: {
      META_WRITES_LIVE: "1",
      META_QA_LEGACY_WRITE_LIVE: "1",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
      META_QA_APPROVED_AD_ACCOUNT_ID: "act_999888777",
      META_QA_APPROVED_CAMPAIGN_ID: "11111111-1111-4111-8111-111111111111",
      META_QA_WRITE_CONFIRM_TOKEN: "secret-qa-confirm",
    },
  });
  assert(r.ok && r.code === "OK", "ok");
});

test("isQaScopedMetaWritesEnvironment false by default", () => {
  assert(
    !isQaScopedMetaWritesEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: `https://${ALLY_QA_SUPABASE_PROJECT_REF}.supabase.co`,
    }),
    "default off",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
