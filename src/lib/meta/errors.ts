export const META_ERROR_CODES = [
  "META_CONFIG_MISSING",
  "META_TOKEN_ENCRYPTION_FAILED",
  "META_TOKEN_DECRYPTION_FAILED",
  "META_CONNECTION_NOT_FOUND",
  "META_CONNECTION_INVALID",
  "META_REAUTH_REQUIRED",
  "META_PERMISSION_MISSING",
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
