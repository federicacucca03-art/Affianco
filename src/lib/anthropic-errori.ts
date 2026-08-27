import { NextResponse } from "next/server";

/**
 * Errori Anthropic → categorie sanificate per API response.
 * Mai esporre JSON provider, request_id, stack, chiavi.
 */

export type AnthropicErrorCode =
  | "CONFIG"
  | "RATE_LIMIT"
  | "MODEL_NOT_FOUND"
  | "NETWORK"
  | "PROVIDER"
  | "UNKNOWN";

export type AnthropicMappedError = {
  code: AnthropicErrorCode;
  status: number;
  /** Messaggio user-facing (IT). */
  message: string;
};

const MSG: Record<AnthropicErrorCode, string> = {
  CONFIG: "Il servizio AI non è configurato correttamente.",
  RATE_LIMIT: "Il servizio AI è temporaneamente occupato. Riprova tra poco.",
  MODEL_NOT_FOUND: "Il servizio AI non è temporaneamente disponibile.",
  NETWORK: "Non siamo riusciti a contattare il servizio AI. Riprova.",
  PROVIDER: "Non siamo riusciti a generare il contenuto. Riprova.",
  UNKNOWN: "Non siamo riusciti a generare il contenuto. Riprova.",
};

function statusDaErrore(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as { status?: unknown; statusCode?: unknown };
  if (typeof o.status === "number") return o.status;
  if (typeof o.statusCode === "number") return o.statusCode;
  return undefined;
}

function testoErrore(err: unknown): string {
  if (err instanceof Error) return err.message || "";
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

export function mapAnthropicError(err: unknown): AnthropicMappedError {
  const status = statusDaErrore(err);
  const msg = testoErrore(err).toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /invalid.?api.?key|authentication|unauthorized|permission/i.test(msg)
  ) {
    return { code: "CONFIG", status: 503, message: MSG.CONFIG };
  }

  if (
    status === 404 ||
    /not_found_error|model:?\s*['`]?[\w.-]+['`]?\s*not found|could not find.*model|model_not_found/i.test(
      msg,
    )
  ) {
    return {
      code: "MODEL_NOT_FOUND",
      status: 503,
      message: MSG.MODEL_NOT_FOUND,
    };
  }

  if (status === 429 || /rate.?limit|overloaded|too many requests/i.test(msg)) {
    return { code: "RATE_LIMIT", status: 429, message: MSG.RATE_LIMIT };
  }

  if (
    err instanceof TypeError ||
    /failed to fetch|network|econnreset|etimedout|enotfound|socket|fetch failed/i.test(
      msg,
    )
  ) {
    return { code: "NETWORK", status: 502, message: MSG.NETWORK };
  }

  if (status && status >= 500) {
    return { code: "PROVIDER", status: 502, message: MSG.PROVIDER };
  }

  if (status && status >= 400) {
    return { code: "PROVIDER", status: 502, message: MSG.PROVIDER };
  }

  return { code: "UNKNOWN", status: 502, message: MSG.UNKNOWN };
}

/** Risposta JSON sanificata per le route AI. */
export function anthropicErrorResponse(err: unknown): NextResponse {
  const mapped = mapAnthropicError(err);
  if (process.env.NODE_ENV !== "production") {
    const raw = testoErrore(err);
    console.error("[anthropic]", mapped.code, raw.slice(0, 200));
  }
  return NextResponse.json(
    { error: mapped.message, code: mapped.code },
    { status: mapped.status },
  );
}

export function anthropicConfigMissingResponse(): NextResponse {
  return NextResponse.json(
    { error: MSG.CONFIG, code: "CONFIG" as const },
    { status: 503 },
  );
}
