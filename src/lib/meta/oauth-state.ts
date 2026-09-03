import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import { metaTokenEncryptionKeyBytes } from "@/lib/meta/token-crypto";

export const META_OAUTH_STATE_COOKIE = "affianco_meta_oauth";
export const META_OAUTH_STATE_TTL_SEC = 10 * 60;
export const META_OAUTH_STATE_VERSION = "v2";

export type MetaOAuthStateIdentity = {
  userId: string;
  clientId: string;
};

type StatePayload = {
  u: string;
  c: string;
  n: string;
  e: number;
};

function hmac(data: string): Buffer {
  const key = metaTokenEncryptionKeyBytes("META_OAUTH_STATE_INVALID");
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function decodeSignedPayload(cookieValue: string): StatePayload {
  const cookie = cookieValue.trim();
  const parts = cookie.split(".");
  if (parts.length !== 3 || parts[0] !== META_OAUTH_STATE_VERSION) {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }

  const body = parts[1] ?? "";
  const sig = Buffer.from(parts[2] ?? "", "base64url");
  const expected = hmac(body);
  if (!safeEqual(sig, expected)) {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  } catch {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }

  if (
    typeof payload.u !== "string" ||
    typeof payload.c !== "string" ||
    typeof payload.n !== "string" ||
    typeof payload.e !== "number" ||
    !payload.u.trim() ||
    !isUuid(payload.c)
  ) {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }

  if (payload.e < Date.now()) {
    throw new MetaError("META_OAUTH_STATE_EXPIRED", "Sessione di collegamento scaduta.");
  }

  return payload;
}

export function createMetaOAuthState(
  userId: string,
  clientId: string,
): {
  nonce: string;
  cookieValue: string;
  maxAgeSec: number;
} {
  const uid = userId.trim();
  const cid = clientId.trim();
  if (!uid || !isUuid(cid)) {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }
  const nonce = randomBytes(32).toString("base64url");
  const payload: StatePayload = {
    u: uid,
    c: cid,
    n: nonce,
    e: Date.now() + META_OAUTH_STATE_TTL_SEC * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const cookieValue = `${META_OAUTH_STATE_VERSION}.${body}.${hmac(body).toString("base64url")}`;
  return { nonce, cookieValue, maxAgeSec: META_OAUTH_STATE_TTL_SEC };
}

export function peekMetaOAuthState(
  cookieValue: string | undefined,
): MetaOAuthStateIdentity | null {
  if (!cookieValue?.trim()) return null;
  try {
    const payload = decodeSignedPayload(cookieValue);
    return { userId: payload.u, clientId: payload.c };
  } catch {
    return null;
  }
}

export function consumeMetaOAuthState(
  cookieValue: string | undefined,
  queryState: string | undefined,
): MetaOAuthStateIdentity {
  const cookie = cookieValue?.trim() ?? "";
  const query = queryState?.trim() ?? "";
  if (!cookie || !query) {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }

  const payload = decodeSignedPayload(cookie);
  const nonceBuf = Buffer.from(payload.n);
  const queryBuf = Buffer.from(query);
  if (!safeEqual(nonceBuf, queryBuf)) {
    throw new MetaError("META_OAUTH_STATE_INVALID", "Stato OAuth non valido.");
  }

  return { userId: payload.u, clientId: payload.c };
}

export function metaOAuthCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
