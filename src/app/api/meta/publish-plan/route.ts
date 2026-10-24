import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { isMetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import {
  buildMetaPublishPlan,
  dryRunMetaPublishPlan,
  executeMetaPublishPlan,
} from "@/lib/meta/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/publish-plan?allyCampaignId=
export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  const allyCampaignId =
    new URL(request.url).searchParams.get("allyCampaignId")?.trim() ?? "";
  if (!isUuid(allyCampaignId)) {
    return NextResponse.json(
      { error: "allyCampaignId richiesto." },
      { status: 400 },
    );
  }
  try {
    const plan = await buildMetaPublishPlan({ userId, allyCampaignId });
    return NextResponse.json({ plan });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Lettura piano pubblicazione non riuscita." },
      { status: 500 },
    );
  }
}

// POST /api/meta/publish-plan  { allyCampaignId, action: "dry_run" | "execute" }
export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: {
    allyCampaignId?: unknown;
    action?: unknown;
    fingerprint?: unknown;
    humanConfirmed?: unknown;
    qaConfirmToken?: unknown;
    stopAfter?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Body JSON non valido." },
      { status: 400 },
    );
  }
  const allyCampaignId =
    typeof body.allyCampaignId === "string" ? body.allyCampaignId.trim() : "";
  const action =
    typeof body.action === "string" ? body.action.trim().toLowerCase() : "dry_run";
  if (!isUuid(allyCampaignId)) {
    return NextResponse.json(
      { error: "allyCampaignId richiesto." },
      { status: 400 },
    );
  }
  try {
    if (action === "execute") {
      const fingerprint =
        typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
      const humanConfirmed = body.humanConfirmed === true;
      // Prefer server-side QA confirm token — never require clients to hold the secret.
      // Explicit body token still accepted for controlled QA tooling.
      const qaConfirmToken =
        typeof body.qaConfirmToken === "string" && body.qaConfirmToken.trim()
          ? body.qaConfirmToken.trim()
          : humanConfirmed
            ? (process.env.META_QA_WRITE_CONFIRM_TOKEN ?? "").trim() || null
            : null;
      const stopAfter =
        body.stopAfter === "CREATE_ADSET"
          ? ("CREATE_ADSET" as const)
          : body.stopAfter === "MEDIA_UPLOAD"
            ? ("MEDIA_UPLOAD" as const)
            : body.stopAfter === "CREATE_CREATIVE"
              ? ("CREATE_CREATIVE" as const)
              : null;
      const result = await executeMetaPublishPlan({
        userId,
        allyCampaignId,
        fingerprint,
        humanConfirmed,
        qaConfirmToken,
        stopAfter,
      });
      return NextResponse.json({ result });
    }
    const result = await dryRunMetaPublishPlan({ userId, allyCampaignId });
    return NextResponse.json({ result });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Piano pubblicazione non riuscito." },
      { status: 500 },
    );
  }
}
