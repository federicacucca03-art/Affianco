/**
 * M7A — Protected Meta insights cron.
 * GET/POST /api/cron/meta-sync
 * Auth: Authorization: Bearer ${CRON_SECRET}
 * No user JWT. No clientId trust from body.
 *
 * Hobby MVP: scheduled daily via vercel.json (`0 6 * * *` UTC).
 */

import { NextResponse } from "next/server";
import {
  assertCronAuthorized,
  runScheduledMetaInsightsSync,
} from "@/lib/meta/meta-sync-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow long-running batch within Vercel limits. */
export const maxDuration = 300;

async function handle(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  // Reject trusted ownership spoofing via query/body.
  try {
    const url = new URL(request.url);
    if (url.searchParams.has("userId") || url.searchParams.has("clientId")) {
      return NextResponse.json({ error: "Parametri non ammessi." }, { status: 400 });
    }
  } catch {
    // ignore
  }

  try {
    const summary = await runScheduledMetaInsightsSync();
    return NextResponse.json({
      ok: true,
      connections_checked: summary.connectionsChecked,
      campaigns_checked: summary.campaignsChecked,
      campaigns_synced: summary.campaignsSynced,
      campaigns_skipped: summary.campaignsSkipped,
      errors_count: summary.errorsCount,
      rate_limited: summary.rateLimited,
      elapsed_ms: summary.elapsedMs,
    });
  } catch {
    console.error("[META_CRON] FATAL category=RUN_FAILED");
    return NextResponse.json(
      { error: "Sincronizzazione automatica non riuscita." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
