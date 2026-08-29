/**
 * Verifica identità token approval (fff / 000 / aaa / caso prod boundary-f).
 * Eseguire: node scripts/approval-token-identity-check.mjs
 */
const APPROVAL_TOKEN_HEX_LENGTH = 32;

function normalizzaApprovalToken(raw) {
  const token = raw?.trim();
  return token ? token : undefined;
}

function assertApprovalTokenIdentico(tokenDb, tokenLink) {
  if (tokenDb.length !== tokenLink.length) {
    throw new Error(
      `Approval token length mismatch: db=${tokenDb.length} link=${tokenLink.length}`,
    );
  }
  if (tokenDb !== tokenLink) {
    throw new Error("Approval token value mismatch (db !== link)");
  }
}

function urlApprovazioneDaToken(token, origin = "https://example.test") {
  const opaque = normalizzaApprovalToken(token);
  if (!opaque) throw new Error("Approval token mancante");
  return `${origin}/approvazione/${opaque}`;
}

function runChecks() {
  const casi = [
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0123456789abcffffdef0123456789ab",
    "00000000000000000000000000000000",
    "62b44efff417dfd37a96e531f25de710",
    "deadbeef000000000000000000000000",
  ];

  for (const token of casi) {
    assertApprovalTokenIdentico(token, normalizzaApprovalToken(token));
    const url = urlApprovazioneDaToken(token);
    const estratto = url.split("/approvazione/")[1];
    assertApprovalTokenIdentico(token, estratto);
    if (token.length !== APPROVAL_TOKEN_HEX_LENGTH) {
      throw new Error(`Expected length 32 for ${token}`);
    }
  }

  const campaignId = "62b44eff-f417-dfd3-7a96-e531f25de710";
  const dbToken = campaignId.replace(/-/g, "");
  const buggyLinkToken = "62b44eff417dfd37a96e531f25de710";
  if (dbToken === buggyLinkToken) {
    throw new Error("Regression guard: db token must differ from buggy link token");
  }
  assertApprovalTokenIdentico(dbToken, "62b44efff417dfd37a96e531f25de710");

  console.log("approval-token-identity-check: OK");
}

runChecks();
