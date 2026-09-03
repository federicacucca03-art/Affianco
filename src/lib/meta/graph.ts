import "server-only";
import { MetaError, type MetaErrorCode } from "@/lib/meta/errors";

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);
const TEMP_CODES = new Set([1, 2]);

export function graphApiBase(version: string, path: string): string {
  const v = version.replace(/^\/+|\/+$/g, "");
  const p = path.replace(/^\/+/, "");
  return `https://graph.facebook.com/${v}/${p}`;
}

export function mapGraphErrorToMetaError(json: unknown): MetaError {
  const code =
    json &&
    typeof json === "object" &&
    "error" in json &&
    json.error &&
    typeof json.error === "object" &&
    "code" in json.error &&
    typeof (json.error as { code?: unknown }).code === "number"
      ? (json.error as { code: number }).code
      : null;

  if (code === 190) {
    return new MetaError("META_TOKEN_EXPIRED", "Sessione Meta scaduta.");
  }
  if (code === 10 || code === 200) {
    return new MetaError("META_PERMISSION_MISSING", "Permesso Meta mancante.");
  }
  if (code != null && RATE_LIMIT_CODES.has(code)) {
    return new MetaError("META_RATE_LIMIT", "Limite Meta temporaneo.");
  }
  if (code != null && TEMP_CODES.has(code)) {
    return new MetaError("META_TEMPORARY_ERROR", "Meta non disponibile.");
  }
  return new MetaError(
    "META_ACCOUNT_DISCOVERY_FAILED",
    "Lettura account Meta non riuscita.",
  );
}

export function metaHttpStatus(code: MetaErrorCode): number {
  switch (code) {
    case "META_REAUTH_REQUIRED":
    case "META_TOKEN_EXPIRED":
    case "META_PERMISSION_MISSING":
      return 403;
    case "META_CONNECTION_NOT_FOUND":
      return 404;
    case "META_RATE_LIMIT":
      return 429;
    case "META_TEMPORARY_ERROR":
      return 503;
    case "META_CONFIG_MISSING":
      return 503;
    default:
      return 400;
  }
}
