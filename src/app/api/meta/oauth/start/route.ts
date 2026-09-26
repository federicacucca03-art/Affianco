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

  let body: { clientId?: unknown; campaignId?: unknown; purpose?: unknown };
  try {
    body = (await request.json()) as {
      clientId?: unknown;
      campaignId?: unknown;
      purpose?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }
  let clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const campaignId =
    typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!isUuid(clientId) && isUuid(campaignId)) {
    const { createSupabaseAdmin } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdmin();
    const { data: camp } = await admin
      .from("campaigns")
      .select("client_id,user_id")
      .eq("id", campaignId)
      .maybeSingle();
    if (camp?.user_id === userId && isUuid(camp.client_id ?? "")) {
      clientId = camp.client_id!;
    }
  }
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: "Cliente mancante." }, { status: 400 });
  }
  const purpose =
    body.purpose === "write_upgrade" ? "write_upgrade" : "read";

  try {
    await assertClientOwnedByUser(userId, clientId);
    const config = getMetaServerConfig();
    if (purpose === "write_upgrade" && !config.writeLoginConfigId) {
      return NextResponse.json(
        {
          error:
            "Per autorizzare la creazione su Meta serve una configurazione Login for Business con permesso ads_management (META_WRITE_LOGIN_CONFIG_ID).",
          code: "META_WRITE_LOGIN_CONFIG_MISSING",
        },
        { status: 503 },
      );
    }
    const state = createMetaOAuthState(userId, clientId, purpose);
    const authorizationUrl = buildMetaAuthorizationUrl(
      config,
      state.nonce,
      purpose,
    );
    const res = NextResponse.json({
      authorizationUrl,
      purpose,
      writeScopeRequested: purpose === "write_upgrade",
    });
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
