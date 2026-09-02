import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isMetaError, MetaError } from "@/lib/meta/errors";
import {
  exchangeAuthorizationCode,
  inspectMetaUserToken,
  integrazioniRedirectUrl,
  oauthResultFromMetaErrorParams,
  persistExchangedMetaConnection,
  type MetaOAuthResultQuery,
} from "@/lib/meta/oauth";
import {
  META_OAUTH_STATE_COOKIE,
  consumeMetaOAuthState,
  metaOAuthCookieOptions,
} from "@/lib/meta/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithClearedCookie(request: Request, result: MetaOAuthResultQuery) {
  const res = NextResponse.redirect(integrazioniRedirectUrl(request.url, result));
  res.cookies.set(META_OAUTH_STATE_COOKIE, "", metaOAuthCookieOptions(0));
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const cookieValue = jar.get(META_OAUTH_STATE_COOKIE)?.value;

  if (errorParam) {
    return redirectWithClearedCookie(
      request,
      oauthResultFromMetaErrorParams(
        errorParam,
        url.searchParams.get("error_reason"),
      ),
    );
  }

  try {
    const userId = consumeMetaOAuthState(cookieValue, state ?? undefined);
    if (!code?.trim()) {
      throw new MetaError(
        "META_TOKEN_RESPONSE_INVALID",
        "Codice di autorizzazione assente.",
      );
    }
    const token = await exchangeAuthorizationCode(code);
    const debug = await inspectMetaUserToken(token.accessToken);
    await persistExchangedMetaConnection(userId, token, debug);
    return redirectWithClearedCookie(request, "connected");
  } catch (error) {
    if (isMetaError(error) && error.code === "META_OAUTH_CANCELLED") {
      return redirectWithClearedCookie(request, "cancelled");
    }
    return redirectWithClearedCookie(request, "error");
  }
}
