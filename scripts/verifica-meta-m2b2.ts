/**
 * M2B.2 — Meta OAuth connect/callback/disconnect (fake Meta only).
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m2b2.ts
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MetaError } from "@/lib/meta/errors";
import {
  decryptMetaToken,
  encryptMetaToken,
  metaTokenEncryptionKeyBytes,
} from "@/lib/meta/token-crypto";
import {
  buildMetaAuthorizationUrl,
  expiryIsoFromTokenResponses,
  metaOAuthReturnUrl,
  oauthResultFromMetaErrorParams,
  parseDebugTokenResponse,
  parseOAuthTokenResponse,
} from "@/lib/meta/oauth";
import {
  consumeMetaOAuthState,
  createMetaOAuthState,
} from "@/lib/meta/oauth-state";
import { assertMetaConnectionHasScope } from "@/lib/meta/scopes";

let falliti = 0;
function assert(cond: unknown, msg: string): boolean {
  if (!cond) {
    falliti += 1;
    console.error(`FAIL  ${msg}`);
    return false;
  }
  console.log(`PASS  ${msg}`);
  return true;
}

const FAKE_TOKEN = "E2E_FAKE_META_USER_TOKEN_DO_NOT_LOG";
const FAKE_CODE = "E2E_FAKE_AUTH_CODE_DO_NOT_LOG";
const FAKE_SECRET = "e2e-fake-meta-app-secret";
const TEST_KEY_HEX = randomBytes(32).toString("hex");

process.env.META_TOKEN_ENCRYPTION_KEY = TEST_KEY_HEX;
process.env.META_APP_ID = "111222333";
process.env.META_APP_SECRET = FAKE_SECRET;
process.env.META_LOGIN_CONFIG_ID = "cfg_readonly_test";
process.env.META_REDIRECT_URI =
  "https://affianco.vercel.app/api/meta/oauth/callback";
process.env.META_GRAPH_API_VERSION = "v21.0";

const root = join(import.meta.dirname, "..");
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const config = {
  appId: "111222333",
  loginConfigId: "cfg_readonly_test",
  redirectUri: "https://affianco.vercel.app/api/meta/oauth/callback",
  graphApiVersion: "v21.0",
};

console.log("\n=== M2B.2 A–D authorization URL + state ===");
const CLIENT_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const s1 = createMetaOAuthState("user-a", CLIENT_A);
const s2 = createMetaOAuthState("user-a", CLIENT_A);
const url1 = buildMetaAuthorizationUrl(config, s1.nonce);
const url2 = buildMetaAuthorizationUrl(config, s2.nonce);
const parsed = new URL(url1);
assert(parsed.origin === "https://www.facebook.com", "A host Facebook");
assert(parsed.pathname === "/v21.0/dialog/oauth", "A version da env");
assert(parsed.searchParams.get("client_id") === config.appId, "A client_id");
assert(parsed.searchParams.get("config_id") === config.loginConfigId, "A config_id");
assert(parsed.searchParams.get("redirect_uri") === config.redirectUri, "A redirect_uri");
assert(parsed.searchParams.get("response_type") === "code", "A response_type=code");
assert(!parsed.searchParams.has("scope"), "A niente scope ridondante");
assert(!url1.includes("ads_management"), "B ads_management assente");
assert(!url1.includes("business_management"), "C business_management assente");
assert(s1.nonce !== s2.nonce && url1 !== url2, "D state casuale");
assert(s1.cookieValue.startsWith("v2."), "cookie versionata");
assert(!s1.nonce.includes("user-a"), "state URL senza user_id");

console.log("\n=== M2B.2 E–G CSRF / code ===");
let eCode = "";
try {
  consumeMetaOAuthState(s1.cookieValue, s2.nonce);
} catch (error) {
  eCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(eCode === "META_OAUTH_STATE_INVALID", "E state mismatch");

const expiredBody = Buffer.from(
  JSON.stringify({ u: "user-a", c: CLIENT_A, n: s1.nonce, e: Date.now() - 1000 }),
  "utf8",
).toString("base64url");
const expiredSig = createHmac("sha256", metaTokenEncryptionKeyBytes("META_OAUTH_STATE_INVALID"))
  .update(expiredBody, "utf8")
  .digest()
  .toString("base64url");
let fCode = "";
try {
  consumeMetaOAuthState(`v2.${expiredBody}.${expiredSig}`, s1.nonce);
} catch (error) {
  fCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(fCode === "META_OAUTH_STATE_EXPIRED", "F state scaduto");

let gCode = "";
try {
  parseOAuthTokenResponse({});
} catch (error) {
  gCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(gCode === "META_TOKEN_RESPONSE_INVALID", "G token/code assente rifiutato");
assert(
  consumeMetaOAuthState(s1.cookieValue, s1.nonce).userId === "user-a" &&
    consumeMetaOAuthState(s2.cookieValue, s2.nonce).clientId === CLIENT_A,
  "state valido recupera userId",
);

console.log("\n=== M2B.2 H cancellation + redirect ===");
assert(
  oauthResultFromMetaErrorParams("access_denied", "user_denied") === "cancelled",
  "H cancellazione",
);
assert(oauthResultFromMetaErrorParams("server_error", null) === "error", "H errore generico");

const evil = metaOAuthReturnUrl(
  "https://affianco.vercel.app/api/meta/oauth/callback?next=https://evil.example&code=abc",
  "connected",
  CLIENT_A,
);
assert(evil.startsWith(`https://affianco.vercel.app/clienti/${CLIENT_A}`), "O path interno");
assert(!evil.includes("evil.example"), "O niente host esterno");
assert(new URL(evil).searchParams.get("meta") === "connected", "O solo meta=connected");
assert(!evil.includes(FAKE_CODE) && !evil.includes(FAKE_TOKEN), "O niente code/token");

console.log("\n=== M2B.2 I–L token persist ===");
const parsedToken = parseOAuthTokenResponse({
  access_token: FAKE_TOKEN,
  token_type: "bearer",
  expires_in: 3600,
});
const debug = parseDebugTokenResponse({
  data: {
    is_valid: true,
    user_id: "999888777",
    scopes: ["ads_read", "public_profile"],
    expires_at: 0,
  },
});
assert(parsedToken.accessToken === FAKE_TOKEN, "parse token");
assert(debug.scopes.includes("ads_read"), "scope confermato da debug");
assertMetaConnectionHasScope({ scopes: debug.scopes }, "ads_read");
const encrypted = encryptMetaToken(parsedToken.accessToken);
assert(encrypted !== FAKE_TOKEN && !encrypted.includes(FAKE_TOKEN), "J ciphertext");
assert(decryptMetaToken(encrypted) === FAKE_TOKEN, "J roundtrip");
const saveSrc = read("src/lib/meta/connections.ts");
assert(saveSrc.includes('onConflict: "user_id,client_id"'), "L upsert stessa riga utente+cliente");
assert(saveSrc.includes("access_token_encrypted: encrypted"), "K DB payload cifrato");
assert(!saveSrc.includes("access_token:"), "K niente plaintext field");
assert(expiryIsoFromTokenResponses(parsedToken, debug), "expiry da expires_in se debug=0");
const debugNoExp = parseDebugTokenResponse({
  data: { is_valid: true, scopes: ["pages_show_list"], expires_at: 0 },
});
let pCode = "";
try {
  assertMetaConnectionHasScope({ scopes: debugNoExp.scopes }, "ads_read");
} catch (error) {
  pCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(pCode === "META_PERMISSION_MISSING", "ads_read non assunto");

console.log("\n=== M2B.2 M–P routes / secrets ===");
const startSrc = read("src/app/api/meta/oauth/start/route.ts");
const cbSrc = read("src/app/api/meta/oauth/callback/route.ts");
const stSrc = read("src/app/api/meta/connection/route.ts");
const dsSrc = read("src/app/api/meta/disconnect/route.ts");
const uiSrc = read("src/components/clienti/PannelloAccountMetaCliente.tsx");
assert(startSrc.includes("requireRouteUserId"), "start auth");
assert(startSrc.includes("{ authorizationUrl }"), "I solo URL al client");
assert(startSrc.includes("assertClientOwnedByUser"), "start ownership cliente");
assert(!startSrc.includes("access_token"), "I start senza token");
assert(cbSrc.includes("metaOAuthReturnUrl"), "callback redirect helper");
assert(!cbSrc.includes('searchParams.get("next")'), "O niente next=");
assert(stSrc.includes("requireRouteUserId"), "status auth");
assert(stSrc.includes("clientId"), "status richiede clientId");
assert(!stSrc.includes("access_token_encrypted"), "M status senza ciphertext");
assert(!stSrc.includes("encryptMetaToken") && !stSrc.includes("decryptMetaToken"), "M no token fn");
assert(dsSrc.includes("requireRouteUserId"), "N disconnect auth");
assert(dsSrc.includes("body.clientId"), "N richiede clientId");
assert(dsSrc.includes("getMetaConnectionForClient(userId, clientId)"), "N solo caller+cliente");
assert(uiSrc.includes("window.location.assign(data.authorizationUrl)"), "client redirect Meta");
assert(!uiSrc.includes("META_APP_SECRET"), "UI senza secret");
assert(!uiSrc.includes("dialog/oauth"), "UI non costruisce OAuth URL");

const oauthSrc = read("src/lib/meta/oauth.ts");
assert(!oauthSrc.includes("adaccounts"), "M2C adaccounts assente");
assert(!oauthSrc.includes("ads_management"), "ads_management assente dal modulo");
assert(oauthSrc.includes("META_LONG_LIVED_EXCHANGE_ENABLED = false"), "no fake long-lived");
assert(!/console\.(log|info|debug|error|warn)\(/.test(oauthSrc), "P no console oauth");

const errObj = new MetaError("META_CODE_EXCHANGE_FAILED", "Scambio codice non riuscito.");
const serial = `${String(errObj)}\n${JSON.stringify(errObj)}\n${errObj.stack ?? ""}`;
assert(!serial.includes(FAKE_TOKEN), "P token assente da errori");
assert(!serial.includes(FAKE_SECRET), "P secret assente da errori");
assert(!serial.includes(FAKE_CODE), "P code assente da errori");

assert(!read("src/lib/meta/config.ts").includes("NEXT_PUBLIC_META"), "no public meta env");

if (falliti > 0) {
  console.error(`\nM2B.2 FALLITO: ${falliti} assert`);
  process.exit(1);
}
console.log("\nM2B.2 OK");
