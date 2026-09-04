/**
 * M7B.2 — Production schema verify (read-only + denied write probes).
 * Usage: npx tsx --env-file=.env.local scripts/verifica-meta-m7b2-prod-schema.ts
 */

import { createClient, type PostgrestError } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name]?.trim() ?? "";
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function projectUrl(): string {
  return env("NEXT_PUBLIC_SUPABASE_URL")
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

function isMissingTable(err: PostgrestError | null): boolean {
  if (!err) return false;
  return /could not find the table|does not exist|schema cache|relation .* does not exist/i.test(
    err.message,
  );
}

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  ✗ ${msg}`);
    return;
  }
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log("\nM7B.2 — Production schema verify\n");
  const url = projectUrl();
  const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const n = await admin.from("notifications").select("id").limit(1);
  assert(
    !n.error && !isMissingTable(n.error),
    `notifications exists (admin select): ${n.error?.message ?? `rows=${n.data?.length ?? 0}`}`,
  );

  const m = await admin
    .from("notification_monitoring_state")
    .select("id")
    .limit(1);
  assert(
    !m.error && !isMissingTable(m.error),
    `notification_monitoring_state exists (admin select): ${m.error?.message ?? `rows=${m.data?.length ?? 0}`}`,
  );

  // Control: known table must work (guards against total auth failure looking like PASS).
  const clients = await admin.from("clients").select("id").limit(1);
  assert(
    !clients.error,
    `control clients selectable: ${clients.error?.message ?? "ok"}`,
  );

  const anonIns = await anon.from("notifications").insert({
    user_id: "00000000-0000-4000-8000-000000000001",
    source: "META",
    meta_campaign_id: "00000000-0000-4000-8000-000000000002",
    notification_type: "RECOVERED",
    severity: "LOW",
    reason_code: "PROBE",
    title: "t",
    message: "m",
    dedupe_key: `probe-anon-insert-${Date.now()}`,
  });
  assert(
    !!anonIns.error,
    `browser/anon insert denied: ${anonIns.error?.message ?? "NONE"}`,
  );
  // If table missing, that's a migration failure — not a security pass.
  assert(
    !isMissingTable(anonIns.error),
    `anon insert denial is auth/policy (not missing table): ${anonIns.error?.message ?? ""}`,
  );

  const anonMon = await anon.from("notification_monitoring_state").insert({
    user_id: "00000000-0000-4000-8000-000000000001",
    source: "META",
    meta_campaign_id: "00000000-0000-4000-8000-000000000002",
    attention_state: "STABLE",
    urgency_level: "NONE",
  });
  assert(!!anonMon.error, `monitoring write denied: ${anonMon.error?.message ?? "NONE"}`);
  assert(
    !isMissingTable(anonMon.error),
    `monitoring denial is auth/policy (not missing table): ${anonMon.error?.message ?? ""}`,
  );

  const bad = await admin.from("notifications").insert({
    user_id: "00000000-0000-4000-8000-000000000099",
    source: "META",
    meta_campaign_id: "00000000-0000-4000-8000-000000000098",
    notification_type: "RECOVERED",
    severity: "LOW",
    reason_code: "PROBE",
    title: "t",
    message: "m",
    dedupe_key: `probe-fk-${Date.now()}`,
  });
  assert(!!bad.error, `spoof insert rejected: ${bad.error?.message ?? "NONE"}`);
  assert(
    !isMissingTable(bad.error),
    `spoof rejection is FK/ownership (not missing table): ${bad.error?.message ?? ""}`,
  );

  console.log("\n" + "━".repeat(56));
  console.log(`  Risultati: ${passed} passati, ${failed} falliti`);
  if (failed > 0) {
    console.log(
      "\n  If tables are missing: apply supabase/migrations/20260909_notifications.sql in Supabase SQL Editor, then reload schema.\n",
    );
    process.exit(1);
  }
  console.log("\n  ✓ Production schema checks passed.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
