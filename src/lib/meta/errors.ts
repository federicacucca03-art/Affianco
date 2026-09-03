export const META_ERROR_CODES = [
  "META_CONFIG_MISSING",
  "META_TOKEN_ENCRYPTION_FAILED",
  "META_TOKEN_DECRYPTION_FAILED",
  "META_CONNECTION_NOT_FOUND",
  "META_CONNECTION_INVALID",
  "META_REAUTH_REQUIRED",
  "META_PERMISSION_MISSING",
  "META_OAUTH_STATE_INVALID",
  "META_OAUTH_STATE_EXPIRED",
  "META_OAUTH_CANCELLED",
  "META_CODE_EXCHANGE_FAILED",
  "META_TOKEN_RESPONSE_INVALID",
  "META_DISCONNECT_FAILED",
  "META_NO_AD_ACCOUNTS",
  "META_ACCOUNT_DISCOVERY_FAILED",
  "META_AD_ACCOUNT_NOT_SELECTED",
  "META_AD_ACCOUNT_ACCESS_LOST",
  "META_CAMPAIGN_DISCOVERY_FAILED",
  "META_INSIGHTS_DISCOVERY_FAILED",
  "META_INSIGHTS_EMPTY",
  "META_CAMPAIGN_ACCESS_LOST",
  "META_TOKEN_EXPIRED",
  "META_RATE_LIMIT",
  "META_TEMPORARY_ERROR",
] as const;

export type MetaErrorCode = (typeof META_ERROR_CODES)[number];

export class MetaError extends Error {
  readonly code: MetaErrorCode;

  constructor(code: MetaErrorCode, message: string) {
    super(message);
    this.name = "MetaError";
    this.code = code;
  }
}

export function isMetaError(error: unknown): error is MetaError {
  return error instanceof MetaError;
}

export function messaggioMetaErrore(error: unknown): string {
  if (isMetaError(error)) return error.message;
  return "Operazione Meta non riuscita.";
}
