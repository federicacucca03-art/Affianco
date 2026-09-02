import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { MetaError, type MetaErrorCode } from "@/lib/meta/errors";

const VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function metaTokenEncryptionKeyBytes(failed: MetaErrorCode): Buffer {
  const raw = process.env.META_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new MetaError(failed, "Cifratura token non configurata.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const fromB64 = Buffer.from(raw, "base64");
    if (fromB64.length === KEY_LENGTH) return fromB64;
  } catch {
    // chiave non valida: errore generico sotto
  }

  throw new MetaError(failed, "Chiave di cifratura non valida.");
}

function toB64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

/**
 * Serializza AES-256-GCM: v1.<iv>.<ciphertext>.<tag> (base64url).
 * Non loggare plaintext né chiave.
 */
export function encryptMetaToken(token: string): string {
  const plaintext = token.trim();
  if (!plaintext) {
    throw new MetaError(
      "META_TOKEN_ENCRYPTION_FAILED",
      "Token da cifrare assente.",
    );
  }

  try {
    const key = metaTokenEncryptionKeyBytes("META_TOKEN_ENCRYPTION_FAILED");
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    if (tag.length !== AUTH_TAG_LENGTH) {
      throw new Error("auth tag length");
    }
    return `${VERSION}.${toB64Url(iv)}.${toB64Url(encrypted)}.${toB64Url(tag)}`;
  } catch (error) {
    if (error instanceof MetaError) throw error;
    throw new MetaError(
      "META_TOKEN_ENCRYPTION_FAILED",
      "Cifratura token non riuscita.",
    );
  }
}

export function decryptMetaToken(payload: string): string {
  const serialized = payload.trim();
  const parts = serialized.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new MetaError(
      "META_TOKEN_DECRYPTION_FAILED",
      "Payload cifrato non valido.",
    );
  }

  try {
    const key = metaTokenEncryptionKeyBytes("META_TOKEN_DECRYPTION_FAILED");
    const iv = fromB64Url(parts[1] ?? "");
    const encrypted = fromB64Url(parts[2] ?? "");
    const tag = fromB64Url(parts[3] ?? "");
    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
      throw new Error("payload shape");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof MetaError) throw error;
    throw new MetaError(
      "META_TOKEN_DECRYPTION_FAILED",
      "Decifratura token non riuscita.",
    );
  }
}
