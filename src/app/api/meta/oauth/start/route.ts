import { NextResponse } from "next/server";
import { requireRouteUserId } from "@/lib/api-auth";
import { getMetaServerConfig, isMetaServerConfigReady } from "@/lib/meta/config";
import { isMetaError } from "@/lib/meta/errors";
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

  try {
    const config = getMetaServerConfig();
    const state = createMetaOAuthState(userId);
    const authorizationUrl = buildMetaAuthorizationUrl(config, state.nonce);
    const res = NextResponse.json({ authorizationUrl });
    res.cookies.set(
      META_OAUTH_STATE_COOKIE,
      state.cookieValue,
      metaOAuthCookieOptions(state.maxAgeSec),
    );
    return res;
  } catch (error) {
    const message = isMetaError(error)
      ? error.message
      : "Collegamento Meta non riuscito.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
