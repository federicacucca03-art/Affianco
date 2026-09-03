import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
import {
  deleteMetaConnection,
  getDecryptedMetaAccessToken,
  getMetaConnectionForClient,
} from "@/lib/meta/connections";
import { isMetaError, MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import { revokeMetaUserToken } from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }

  try {
    await assertClientOwnedByUser(userId, clientId);
    const existing = await getMetaConnectionForClient(userId, clientId);
    if (!existing) {
      return NextResponse.json({ disconnected: true, remoteRevoked: false });
    }

    let remoteRevoked = false;
    try {
      const token = await getDecryptedMetaAccessToken(userId, clientId, {
        ignoreStatus: true,
      });
      remoteRevoked = await revokeMetaUserToken(token);
    } catch (error) {
      if (isMetaError(error) && error.code === "META_CONNECTION_NOT_FOUND") {
        return NextResponse.json({ disconnected: true, remoteRevoked: false });
      }
      remoteRevoked = false;
    }

    try {
      await deleteMetaConnection(userId, clientId);
    } catch (error) {
      if (!(isMetaError(error) && error.code === "META_CONNECTION_NOT_FOUND")) {
        throw new MetaError(
          "META_DISCONNECT_FAILED",
          "Disconnessione locale non riuscita.",
        );
      }
    }

    return NextResponse.json({ disconnected: true, remoteRevoked });
  } catch (error) {
    const message = isMetaError(error)
      ? error.message
      : "Disconnessione non riuscita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
