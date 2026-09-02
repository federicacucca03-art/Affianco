import "server-only";
import { MetaError } from "@/lib/meta/errors";
import {
  getMetaAppSecret,
  getMetaServerConfig,
  type MetaServerConfig,
} from "@/lib/meta/config";
import {
  saveMetaConnection,
  type MetaConnectionRecord,
} from "@/lib/meta/connections";
import { assertMetaConnectionHasScope } from "@/lib/meta/scopes";

export const META_REQUIRED_SCOPE = "ads_read";
export const META_INTEGRATIONS_PATH = "/impostazioni/integrazioni";

export type MetaOAuthResultQuery = "connected" | "cancelled" | "error";

export type ParsedMetaTokenResponse = {
  accessToken: string;
  tokenType: string | null;
  expiresInSec: number | null;
};

export type ParsedMetaDebugToken = {
  userId: string | null;
  scopes: string[];
  expiresAtIso: string | null;
  isValid: boolean;
};

function graphBase(version: string, path: string): string {
  const v = version.replace(/^\/+|\/+$/g, "");
  const p = path.replace(/^\/+/, "");
  return `https://graph.facebook.com/${v}/${p}`;
}

/**
 * Facebook Login for Business: i permessi li definisce la login configuration
 * (META_LOGIN_CONFIG_ID). Non si aggiunge `scope` nell'URL.
 *
 * Parametri: client_id, redirect_uri, state, config_id, response_type=code.
 */
export function buildMetaAuthorizationUrl(
  config: MetaServerConfig,
  state: string,
): string {
  const version = config.graphApiVersion.replace(/^\/+|\/+$/g, "");
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("config_id", config.loginConfigId);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export function oauthResultFromMetaErrorParams(
  error: string | null,
  errorReason: string | null,
): MetaOAuthResultQuery {
  if (error === "access_denied" || errorReason === "user_denied") {
    return "cancelled";
  }
  return "error";
}

export function integrazioniRedirectUrl(
  requestUrl: string,
  result: MetaOAuthResultQuery,
): string {
  const origin = new URL(requestUrl).origin;
  const dest = new URL(META_INTEGRATIONS_PATH, origin);
  dest.searchParams.set("meta", result);
  return dest.toString();
}

export function parseOAuthTokenResponse(raw: unknown): ParsedMetaTokenResponse {
  if (!raw || typeof raw !== "object") {
    throw new MetaError(
      "META_TOKEN_RESPONSE_INVALID",
      "Risposta token Meta non valida.",
    );
  }
  const obj = raw as Record<string, unknown>;
  const accessToken =
    typeof obj.access_token === "string" ? obj.access_token.trim() : "";
  if (!accessToken) {
    throw new MetaError(
      "META_TOKEN_RESPONSE_INVALID",
      "Risposta token Meta non valida.",
    );
  }
  const expiresIn =
    typeof obj.expires_in === "number" && Number.isFinite(obj.expires_in)
      ? obj.expires_in
      : null;
  const tokenType =
    typeof obj.token_type === "string" ? obj.token_type.trim() || null : null;
  return { accessToken, tokenType, expiresInSec: expiresIn };
}

export function parseDebugTokenResponse(raw: unknown): ParsedMetaDebugToken {
  if (!raw || typeof raw !== "object") {
    throw new MetaError(
      "META_TOKEN_RESPONSE_INVALID",
      "Validazione token Meta non riuscita.",
    );
  }
  const data = (raw as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== "object") {
    throw new MetaError(
      "META_TOKEN_RESPONSE_INVALID",
      "Validazione token Meta non riuscita.",
    );
  }
  const userId = typeof data.user_id === "string" ? data.user_id.trim() || null : null;
  const scopes = Array.isArray(data.scopes)
    ? data.scopes.filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    : [];
  const expiresAt =
    typeof data.expires_at === "number" && data.expires_at > 0
      ? new Date(data.expires_at * 1000).toISOString()
      : null;
  const isValid = data.is_valid === true;
  return { userId, scopes, expiresAtIso: expiresAt, isValid };
}

export function expiryIsoFromTokenResponses(
  token: ParsedMetaTokenResponse,
  debug: ParsedMetaDebugToken,
): string | null {
  if (debug.expiresAtIso) return debug.expiresAtIso;
  if (token.expiresInSec && token.expiresInSec > 0) {
    return new Date(Date.now() + token.expiresInSec * 1000).toISOString();
  }
  return null;
}

export async function exchangeAuthorizationCode(
  code: string,
): Promise<ParsedMetaTokenResponse> {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new MetaError("META_TOKEN_RESPONSE_INVALID", "Codice di autorizzazione assente.");
  }
  const config = getMetaServerConfig();
  const secret = getMetaAppSecret();
  const endpoint = graphBase(config.graphApiVersion, "oauth/access_token");
  const body = new URLSearchParams({
    client_id: config.appId,
    client_secret: secret,
    redirect_uri: config.redirectUri,
    code: trimmed,
  });

  let json: unknown;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    json = await res.json();
    if (!res.ok) {
      throw new Error("exchange failed");
    }
  } catch (error) {
    if (error instanceof MetaError) throw error;
    throw new MetaError(
      "META_CODE_EXCHANGE_FAILED",
      "Scambio codice non riuscito.",
    );
  }
  return parseOAuthTokenResponse(json);
}

export async function inspectMetaUserToken(
  accessToken: string,
): Promise<ParsedMetaDebugToken> {
  const config = getMetaServerConfig();
  const secret = getMetaAppSecret();
  const appToken = `${config.appId}|${secret}`;
  const endpoint = new URL(graphBase(config.graphApiVersion, "debug_token"));
  endpoint.searchParams.set("input_token", accessToken);
  endpoint.searchParams.set("access_token", appToken);

  let json: unknown;
  try {
    const res = await fetch(endpoint.toString(), { method: "GET" });
    json = await res.json();
    if (!res.ok) {
      throw new Error("debug failed");
    }
  } catch (error) {
    if (error instanceof MetaError) throw error;
    throw new MetaError(
      "META_TOKEN_RESPONSE_INVALID",
      "Validazione token Meta non riuscita.",
    );
  }
  return parseDebugTokenResponse(json);
}

export async function persistExchangedMetaConnection(
  userId: string,
  token: ParsedMetaTokenResponse,
  debug: ParsedMetaDebugToken,
): Promise<MetaConnectionRecord> {
  if (!debug.isValid) {
    throw new MetaError(
      "META_TOKEN_RESPONSE_INVALID",
      "Token Meta non valido.",
    );
  }
  assertMetaConnectionHasScope({ scopes: debug.scopes }, META_REQUIRED_SCOPE);
  return saveMetaConnection({
    userId,
    accessToken: token.accessToken,
    metaUserId: debug.userId,
    tokenExpiresAt: expiryIsoFromTokenResponses(token, debug),
    scopes: debug.scopes,
    tokenType: token.tokenType,
    status: "ACTIVE",
  });
}

/** Revoca permessi lato Meta. Non lanciare il token. Fallimento remoto normalizzato. */
export async function revokeMetaUserToken(accessToken: string): Promise<boolean> {
  const trimmed = accessToken.trim();
  if (!trimmed) return false;
  try {
    const config = getMetaServerConfig();
    const endpoint = new URL(graphBase(config.graphApiVersion, "me/permissions"));
    endpoint.searchParams.set("access_token", trimmed);
    const res = await fetch(endpoint.toString(), { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Exchange long-lived: supportato da Meta (`grant_type=fb_exchange_token`)
 * ma NON invocato in M2B.2. Nessuna durata inventata.
 */
export const META_LONG_LIVED_EXCHANGE_ENABLED = false;
