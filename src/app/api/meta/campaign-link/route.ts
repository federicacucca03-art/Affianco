import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import {
  getMetaCampaignLink,
  setMetaCampaignLink,
  clearMetaCampaignLink,
} from "@/lib/meta/campaign-link";
import { isMetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/campaign-link?clientId=&metaCampaignId=
export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim() ?? "";
  const metaCampaignId = url.searchParams.get("metaCampaignId")?.trim() ?? "";
  if (!isUuid(clientId) || !isUuid(metaCampaignId)) {
    return NextResponse.json(
      { error: "clientId e metaCampaignId richiesti." },
      { status: 400 },
    );
  }
  try {
    const link = await getMetaCampaignLink(userId, clientId, metaCampaignId);
    return NextResponse.json({ link });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Lettura collegamento non riuscita." },
      { status: 500 },
    );
  }
}

// POST /api/meta/campaign-link
export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: {
    clientId?: unknown;
    metaCampaignId?: unknown;
    affiancoCampaignId?: unknown;
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
  const metaCampaignId =
    typeof body.metaCampaignId === "string" ? body.metaCampaignId.trim() : "";
  const affiancoCampaignId =
    typeof body.affiancoCampaignId === "string"
      ? body.affiancoCampaignId.trim()
      : "";
  if (!isUuid(clientId) || !isUuid(metaCampaignId) || !isUuid(affiancoCampaignId)) {
    return NextResponse.json(
      { error: "clientId, metaCampaignId e affiancoCampaignId richiesti." },
      { status: 400 },
    );
  }
  try {
    const link = await setMetaCampaignLink(
      userId,
      clientId,
      metaCampaignId,
      affiancoCampaignId,
    );
    return NextResponse.json({ link });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Collegamento campagna non riuscito." },
      { status: 500 },
    );
  }
}

// DELETE /api/meta/campaign-link
export async function DELETE(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: { clientId?: unknown; metaCampaignId?: unknown };
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
  const metaCampaignId =
    typeof body.metaCampaignId === "string" ? body.metaCampaignId.trim() : "";
  if (!isUuid(clientId) || !isUuid(metaCampaignId)) {
    return NextResponse.json(
      { error: "clientId e metaCampaignId richiesti." },
      { status: 400 },
    );
  }
  try {
    const link = await clearMetaCampaignLink(userId, clientId, metaCampaignId);
    return NextResponse.json({ link, cleared: true });
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Scollegamento campagna non riuscito." },
      { status: 500 },
    );
  }
}
