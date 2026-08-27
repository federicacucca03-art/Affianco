/**
 * Messaggi AI user-facing (safe per client e server).
 * Nessun import next/server.
 */

const FALLBACK =
  "Non siamo riusciti a generare il contenuto. Riprova.";

export function messaggioAiUserFacing(
  errorField: unknown,
  fallback = FALLBACK,
): string {
  if (typeof errorField === "string" && errorField.trim()) {
    const t = errorField.trim();
    if (
      /request_id|not_found_error|"type"\s*:\s*"error"|api[_-]?key|anthropic/i.test(
        t,
      ) ||
      t.startsWith("{") ||
      t.length > 180
    ) {
      return fallback;
    }
    return t;
  }
  return fallback;
}
