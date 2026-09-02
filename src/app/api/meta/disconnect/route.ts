import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import {
  deleteMetaConnection,
  getDecryptedMetaAccessToken,
  getMetaConnectionForUser,
} from "@/lib/meta/connections";
import { isMetaError, MetaError } from "@/lib/meta/errors";
import { revokeMetaUserToken } from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  try {
    const existing = await getMetaConnectionForUser(userId);
    if (!existing) {
      return NextResponse.json({ disconnected: true, remoteRevoked: false });
    }

    let remoteRevoked = false;
    try {
      const token = await getDecryptedMetaAccessToken(userId, {
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
      await deleteMetaConnection(userId);
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
