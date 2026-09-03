import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
import { getMetaServerConfig, isMetaServerConfigReady } from "@/lib/meta/config";
import { isMetaError } from "@/lib/meta/errors";
import { metaHttpStatus } from "@/lib/meta/graph";
import { isUuid } from "@/lib/meta/ids";
import { buildMetaAuthorizationUrl } from "@/lib/meta/oauth";
import {
  META_OAUTH_STATE_COOKIE,
  createMetaOAuthState,
  metaOAuthCookieOptions,
} from "@/lib/meta/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: Request) {
  const userId = await requireRouteUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  if (!isMetaServerConfigReady()) {
    return NextResponse.json(
      { error: "Configurazione Meta incompleta." },
      { status: 503 },
    );
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
    const config = getMetaServerConfig();
    const state = createMetaOAuthState(userId, clientId);
    const authorizationUrl = buildMetaAuthorizationUrl(config, state.nonce);
    const res = NextResponse.json({ authorizationUrl });
    res.cookies.set(
      META_OAUTH_STATE_COOKIE,
      state.cookieValue,
      metaOAuthCookieOptions(state.maxAgeSec),
    );
    return res;
  } catch (error) {
    if (isMetaError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: metaHttpStatus(error.code) },
      );
    }
    return NextResponse.json(
      { error: "Collegamento Meta non riuscito." },
      { status: 500 },
    );
  }
}
