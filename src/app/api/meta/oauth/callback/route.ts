import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isMetaError, MetaError } from "@/lib/meta/errors";
import {
  exchangeAuthorizationCode,
  inspectMetaUserToken,
  metaOAuthReturnUrl,
  oauthResultFromMetaErrorParams,
  persistExchangedMetaConnection,
  type MetaOAuthResultQuery,
} from "@/lib/meta/oauth";
import {
  META_OAUTH_STATE_COOKIE,
  consumeMetaOAuthState,
  metaOAuthCookieOptions,
  peekMetaOAuthState,
} from "@/lib/meta/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithClearedCookie(
  request: Request,
  result: MetaOAuthResultQuery,
  clientId?: string | null,
) {
  const res = NextResponse.redirect(
    metaOAuthReturnUrl(request.url, result, clientId),
  );
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
  const peeked = peekMetaOAuthState(cookieValue);

  if (errorParam) {
    return redirectWithClearedCookie(
      request,
      oauthResultFromMetaErrorParams(
        errorParam,
        url.searchParams.get("error_reason"),
      ),
      peeked?.clientId,
    );
  }

  try {
    const identity = consumeMetaOAuthState(cookieValue, state ?? undefined);
    if (!code?.trim()) {
      throw new MetaError(
        "META_TOKEN_RESPONSE_INVALID",
        "Codice di autorizzazione assente.",
      );
    }
    const token = await exchangeAuthorizationCode(code);
    const debug = await inspectMetaUserToken(token.accessToken);
    await persistExchangedMetaConnection(
      identity.userId,
      identity.clientId,
      token,
      debug,
    );
    return redirectWithClearedCookie(request, "connected", identity.clientId);
  } catch (error) {
    if (isMetaError(error) && error.code === "META_OAUTH_CANCELLED") {
      return redirectWithClearedCookie(request, "cancelled", peeked?.clientId);
    }
    return redirectWithClearedCookie(request, "error", peeked?.clientId);
  }
}
