import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import {
  getMetaCampaignTarget,
  setMetaCampaignTarget,
  clearMetaCampaignTarget,
  ALLOWED_KPI,
  type MetaMonitoringKpi,
} from "@/lib/meta/campaign-target";
import { isMetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ------------------------------------------------------------------
// GET /api/meta/campaign-target?clientId=&campaignId=
// ------------------------------------------------------------------
export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim() ?? "";
  const campaignId = url.searchParams.get("campaignId")?.trim() ?? "";
  if (!isUuid(clientId) || !isUuid(campaignId)) {
    return NextResponse.json(
      { error: "clientId e campaignId richiesti." },
      { status: 400 },
    );
  }
  try {
    const target = await getMetaCampaignTarget(userId, clientId, campaignId);
    return NextResponse.json({ target });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Lettura target non riuscita." },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------------
// POST /api/meta/campaign-target
// { clientId, campaignId, primaryKpi, targetValue }
// ------------------------------------------------------------------
export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: {
    clientId?: unknown;
    campaignId?: unknown;
    primaryKpi?: unknown;
    targetValue?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Body JSON non valido." },
      { status: 400 },
    );
  }
  const clientId =
    typeof body.clientId === "string" ? body.clientId.trim() : "";
  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  const primaryKpi = body.primaryKpi;
  const targetValueRaw = body.targetValue;

  if (!isUuid(clientId) || !isUuid(campaignId)) {
    return NextResponse.json(
      { error: "clientId e campaignId richiesti." },
      { status: 400 },
    );
  }
  if (
    typeof primaryKpi !== "string" ||
    !(ALLOWED_KPI as string[]).includes(primaryKpi)
  ) {
    return NextResponse.json(
      {
        error: `KPI non valido. Valori consentiti: ${ALLOWED_KPI.join(", ")}`,
      },
      { status: 400 },
    );
  }
  const targetValue =
    targetValueRaw == null
      ? null
      : typeof targetValueRaw === "number"
        ? targetValueRaw
        : typeof targetValueRaw === "string" && targetValueRaw.trim()
          ? Number(targetValueRaw)
          : null;

  try {
    const target = await setMetaCampaignTarget(
      userId,
      clientId,
      campaignId,
      primaryKpi as MetaMonitoringKpi,
      targetValue,
    );
    return NextResponse.json({ target });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Salvataggio target non riuscito." },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------------
// DELETE /api/meta/campaign-target
// { clientId, campaignId }
// ------------------------------------------------------------------
export async function DELETE(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: { clientId?: unknown; campaignId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Body JSON non valido." },
      { status: 400 },
    );
  }
  const clientId =
    typeof body.clientId === "string" ? body.clientId.trim() : "";
  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!isUuid(clientId) || !isUuid(campaignId)) {
    return NextResponse.json(
      { error: "clientId e campaignId richiesti." },
      { status: 400 },
    );
  }
  try {
    await clearMetaCampaignTarget(userId, clientId, campaignId);
    return NextResponse.json({ cleared: true });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Rimozione target non riuscita." },
      { status: 500 },
    );
  }
}
