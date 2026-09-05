import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import {
  findClientIdByMetaAdAccount,
  getClientMetaAccount,
  removeClientMetaAccount,
  setClientMetaAccount,
} from "@/lib/meta/client-accounts";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (isMetaError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: metaHttpStatus(error.code) },
    );
  }
  return NextResponse.json(
    { error: "Operazione account non riuscita." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
  if (!clientId) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }
  try {
    const mapping = await getClientMetaAccount(userId, clientId);
    return NextResponse.json({ mapping });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: { clientId?: unknown; metaAdAccountId?: unknown };
  try {
    body = (await request.json()) as { clientId?: unknown; metaAdAccountId?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const metaAdAccountId =
    typeof body.metaAdAccountId === "string" ? body.metaAdAccountId : "";
  if (!clientId || !metaAdAccountId) {
    return NextResponse.json({ error: "Dati mancanti." }, { status: 400 });
  }
  try {
    const already = await findClientIdByMetaAdAccount(
      userId,
      typeof body.metaAdAccountId === "string" ? body.metaAdAccountId.trim() : "",
    );
    if (already && already !== clientId) {
      return NextResponse.json(
        {
          error:
            "Questo account Meta è già collegato a un altro cliente Ally.",
          code: "META_ACCOUNT_ALREADY_MAPPED",
          existingClientId: already,
        },
        { status: 409 },
      );
    }
    const mapping = await setClientMetaAccount(userId, clientId, metaAdAccountId);
    return NextResponse.json({ mapping });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as { clientId?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!clientId) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }
  try {
    await removeClientMetaAccount(userId, clientId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return jsonError(error);
  }
}
