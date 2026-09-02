import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { getMetaConnectionForUser } from "@/lib/meta/connections";
import { isMetaError } from "@/lib/meta/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  try {
    const row = await getMetaConnectionForUser(userId);
    if (!row) {
      return NextResponse.json({
        connected: false,
        status: null,
        tokenExpiresAt: null,
        scopes: [] as string[],
        metaUserId: null,
      });
    }
    return NextResponse.json({
      connected: row.status === "ACTIVE",
      status: row.status,
      tokenExpiresAt: row.tokenExpiresAt,
      scopes: row.scopes,
      metaUserId: row.metaUserId,
    });
  } catch (error) {
    const message = isMetaError(error)
      ? error.message
      : "Stato connessione non disponibile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
