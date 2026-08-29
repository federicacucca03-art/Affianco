/** Token approval pubblico: 16 byte → 32 hex. Stringa opaca, nessuna trasformazione. */
export const APPROVAL_TOKEN_HEX_LENGTH = 32;

const APPROVAL_TOKEN_HEX_RE = /^[0-9a-f]{32}$/i;

/** Solo trim — il token non va parsato, abbreviato o normalizzato oltre agli spazi. */
export function normalizzaApprovalToken(
  raw: string | null | undefined,
): string | undefined {
  const token = raw?.trim();
  return token ? token : undefined;
}

export function isApprovalTokenHexPlausibile(token: string): boolean {
  return APPROVAL_TOKEN_HEX_RE.test(token);
}

/** Verifica identità carattere-per-carattere (DB vs link). */
export function assertApprovalTokenIdentico(
  tokenDb: string,
  tokenLink: string,
): void {
  if (tokenDb.length !== tokenLink.length) {
    throw new Error(
      `Approval token length mismatch: db=${tokenDb.length} link=${tokenLink.length}`,
    );
  }
  if (tokenDb !== tokenLink) {
    throw new Error("Approval token value mismatch (db !== link)");
  }
}

/** `${origin}/approvazione/${token}` — token opaco, nessuna modifica. */
export function urlApprovazioneDaToken(token: string): string {
  const opaque = normalizzaApprovalToken(token);
  if (!opaque) {
    throw new Error("Approval token mancante per costruire il link.");
  }
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/approvazione/${opaque}`;
}

/** Estrae il token dal path `/approvazione/[token]` senza alterarlo. */
export function tokenDaPathApprovazione(pathSegment: string): string | undefined {
  return normalizzaApprovalToken(pathSegment);
}

/**
 * Regression: caratteri ripetuti (fff, 000, aaa) non devono essere compressi.
 * Eseguibile via `node scripts/approval-token-identity-check.mjs`.
 */
export function runApprovalTokenIdentityChecks(): void {
  const casi = [
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0123456789abcffffdef0123456789ab",
    "00000000000000000000000000000000",
    "62b44efff417dfd37a96e531f25de710",
    "deadbeef000000000000000000000000",
  ];

  for (const token of casi) {
    assertApprovalTokenIdentico(token, normalizzaApprovalToken(token)!);
    const url = urlApprovazioneDaToken(token);
    const estratto = url.split("/approvazione/")[1];
    assertApprovalTokenIdentico(token, estratto);
    if (token.length !== APPROVAL_TOKEN_HEX_LENGTH) {
      throw new Error(`Expected length 32 for ${token}`);
    }
  }

  // Il bug prod: dedup boundary UUID segment → perde una 'f'
  const campaignId = "62b44eff-f417-dfd3-7a96-e531f25de710";
  const dbToken = campaignId.replace(/-/g, "");
  const buggyLinkToken = "62b44eff417dfd37a96e531f25de710";
  if (dbToken === buggyLinkToken) {
    throw new Error("Regression guard: db token must differ from buggy link token");
  }
  assertApprovalTokenIdentico(dbToken, "62b44efff417dfd37a96e531f25de710");
}
