import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
import { getMetaConnectionForClient } from "@/lib/meta/connections";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { isUuid } from "@/lib/meta/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }

  try {
    await assertClientOwnedByUser(userId, clientId);
    const row = await getMetaConnectionForClient(userId, clientId);
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
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Stato connessione non disponibile." },
      { status: 500 },
    );
  }
}
