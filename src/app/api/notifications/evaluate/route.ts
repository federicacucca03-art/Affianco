/**
 * M7B.2 — Authenticated Native (+ optional Meta) notification evaluation.
 * Derives state server-side. Does not accept client-supplied snapshots.
 * POST /api/notifications/evaluate
 */

import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import {
  evaluateMetaNotificationsForUser,
  evaluateNativeNotificationsForUser,
} from "@/lib/campaign-notifications/evaluate-runners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let scope: "native" | "meta" | "all" = "native";
  try {
    const body = (await request.json()) as { scope?: unknown };
    if (body.scope === "meta" || body.scope === "all" || body.scope === "native") {
      scope = body.scope;
    }
  } catch {
    // empty body → native default
  }

  try {
    let notificationsCreated = 0;
    let campaignsEvaluated = 0;
    let errors = 0;

    if (scope === "native" || scope === "all") {
      const native = await evaluateNativeNotificationsForUser(userId);
      notificationsCreated += native.notificationsCreated;
      campaignsEvaluated += native.campaignsEvaluated;
      errors += native.errors;
    }
    if (scope === "meta" || scope === "all") {
      const meta = await evaluateMetaNotificationsForUser(userId);
      notificationsCreated += meta.notificationsCreated;
      campaignsEvaluated += meta.campaignsEvaluated;
      errors += meta.errors;
    }

    return NextResponse.json({
      ok: true,
      scope,
      campaigns_evaluated: campaignsEvaluated,
      notifications_created: notificationsCreated,
      errors,
    });
  } catch {
    console.error("[NOTIF_EVAL] API_FAILED");
    return NextResponse.json(
      { error: "Valutazione notifiche non riuscita." },
      { status: 500 },
    );
  }
}
