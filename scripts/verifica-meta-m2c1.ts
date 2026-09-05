/**
 * M2C.1 — Meta connections scoped by Ally user + client.
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m2c1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MetaError } from "@/lib/meta/errors";
import { metaOAuthReturnUrl } from "@/lib/meta/oauth";
import {
  consumeMetaOAuthState,
  createMetaOAuthState,
} from "@/lib/meta/oauth-state";

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

const root = join(import.meta.dirname, "..");
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

process.env.META_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
process.env.META_APP_ID = "111222333";
process.env.META_APP_SECRET = "e2e-fake-meta-app-secret";
process.env.META_LOGIN_CONFIG_ID = "cfg_readonly_test";
process.env.META_REDIRECT_URI =
  "https://affianco.vercel.app/api/meta/oauth/callback";
process.env.META_GRAPH_API_VERSION = "v21.0";

const USER = "user-a";
const CLIENT_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CLIENT_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const CLIENT_C = "cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa";

const connSrc = read("src/lib/meta/connections.ts");
const startSrc = read("src/app/api/meta/oauth/start/route.ts");
const cbSrc = read("src/app/api/meta/oauth/callback/route.ts");
const stSrc = read("src/app/api/meta/connection/route.ts");
const dsSrc = read("src/app/api/meta/disconnect/route.ts");
const adSrc = read("src/app/api/meta/ad-accounts/route.ts");
const mapSrc = read("src/lib/meta/client-accounts.ts");
const accSrc = read("src/lib/meta/accounts.ts");
const oauthSrc = read("src/lib/meta/oauth.ts");
const uiClient = read("src/components/clienti/PannelloAccountMetaCliente.tsx");
const uiInteg = read("src/components/impostazioni/PannelloIntegrazioneMeta.tsx");
const sql = read("supabase/migrations/20260904_meta_connections_client_scope.sql");
const sqlM2b1 = read("supabase/migrations/20260902_meta_connections.sql");

console.log("\n=== M2C.1 A–C two clients / callback clientId ===");
const sA = createMetaOAuthState(USER, CLIENT_A);
const sB = createMetaOAuthState(USER, CLIENT_B);
assert(sA.nonce !== sB.nonce, "A state indipendenti");
const idA = consumeMetaOAuthState(sA.cookieValue, sA.nonce);
const idB = consumeMetaOAuthState(sB.cookieValue, sB.nonce);
assert(idA.userId === USER && idA.clientId === CLIENT_A, "C callback client A");
assert(idB.userId === USER && idB.clientId === CLIENT_B, "C callback client B");
assert(idA.clientId !== idB.clientId, "A due clientId distinti");
assert(connSrc.includes('onConflict: "user_id,client_id"'), "B upsert per client");
assert(connSrc.includes("client_id: cid"), "B save include client_id");
assert(!connSrc.includes("getMetaConnectionForUser"), "K no getter globale");
assert(cbSrc.includes("persistExchangedMetaConnection"), "C persist da callback");
assert(cbSrc.includes("identity.clientId"), "C clientId da state firmato");

console.log("\n=== M2C.1 D state tampering ===");
const parts = sA.cookieValue.split(".");
const payload = JSON.parse(
  Buffer.from(parts[1] ?? "", "base64url").toString("utf8"),
) as { u: string; c: string; n: string; e: number };
payload.c = CLIENT_B;
const tamperedBody = Buffer.from(JSON.stringify(payload), "utf8").toString(
  "base64url",
);
const tampered = `v2.${tamperedBody}.${parts[2]}`;
let dCode = "";
try {
  consumeMetaOAuthState(tampered, sA.nonce);
} catch (error) {
  dCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(dCode === "META_OAUTH_STATE_INVALID", "D clientId manomesso rifiutato");

let v1Code = "";
try {
  consumeMetaOAuthState("v1.abc.def", sA.nonce);
} catch (error) {
  v1Code = error instanceof MetaError ? error.code : "OTHER";
}
assert(v1Code === "META_OAUTH_STATE_INVALID", "D cookie v1 rifiutato");

console.log("\n=== M2C.1 E ownership / F–I isolation ===");
assert(startSrc.includes("assertClientOwnedByUser"), "E OAuth start ownership");
assert(stSrc.includes("assertClientOwnedByUser"), "E status ownership");
assert(dsSrc.includes("assertClientOwnedByUser"), "E disconnect ownership");
assert(adSrc.includes("assertClientOwnedByUser"), "E discovery ownership");
assert(mapSrc.includes("assertClientOwnedByUser"), "E mapping ownership");
assert(adSrc.includes("getAccessibleMetaAdAccounts(userId, clientId)"), "F discovery scoped");
assert(accSrc.includes("getMetaConnectionForClient(userId, clientId)"), "F token per client");
assert(accSrc.includes("getDecryptedMetaAccessToken(userId, clientId)"), "F decrypt scoped");
assert(mapSrc.includes("getMetaConnectionForClient(userId, clientId)"), "G mapping connection scoped");
assert(mapSrc.includes("connection.clientId !== clientId"), "G mismatch client bloccato");
assert(dsSrc.includes("deleteMetaConnection(userId, clientId)"), "H disconnect scoped");
assert(dsSrc.includes(".eq(\"client_id\"") || connSrc.includes(".eq(\"client_id\", cid)"), "H delete filtra client");
assert(stSrc.includes("getMetaConnectionForClient(userId, clientId)"), "I status scoped");
assert(!stSrc.includes("getMetaConnectionForUser"), "I no status globale");

console.log("\n=== M2C.1 J–K legacy / no fallback ===");
assert(sql.includes("client_id uuid"), "J colonna client_id");
assert(sql.includes("drop constraint if exists meta_connections_user_unique"), "J drop UNIQUE(user_id)");
assert(sql.includes("meta_connections_user_client_unique unique (user_id, client_id)"), "J UNIQUE(user_id, client_id)");
assert(sql.includes("where client_id is null"), "J legacy unassigned index");
assert(sql.includes("NULL solo per connessione legacy"), "J commento legacy");
assert(!connSrc.includes('.is("client_id"'), "J codice non legge unassigned");
assert(!connSrc.includes("client_id is null"), "J no fallback SQL null");
assert(!accSrc.includes("getMetaConnectionForUser"), "K no fallback discovery");
assert(!uiClient.includes("/api/meta/ad-accounts\""), "K discovery con clientId");
assert(uiClient.includes("ad-accounts?clientId="), "K discovery query clientId");
assert(!uiClient.includes("use user's") && !connSrc.toLowerCase().includes("fallback"), "K no fallback");

console.log("\n=== M2C.1 L–P secrets / scopes / M3 ===");
assert(!stSrc.includes("access_token_encrypted"), "L status senza ciphertext");
assert(!adSrc.includes("access_token_encrypted"), "L discovery senza ciphertext");
assert(uiClient.includes("authorizationUrl"), "L UI solo URL");
assert(!uiClient.includes("decryptMetaToken"), "L UI senza decrypt");
assert(!uiInteg.includes("/api/meta/oauth/start"), "integrazioni senza OAuth globale");
assert(uiInteg.includes("per singolo cliente"), "integrazioni copy per-cliente");
assert(!uiInteg.includes("Connesso"), "integrazioni senza stato globale");
assert(oauthSrc.includes('META_REQUIRED_SCOPE = "ads_read"'), "M ads_read");
assert(!oauthSrc.includes("ads_management"), "O ads_management assente");
assert(!oauthSrc.includes("business_management"), "N business_management assente");
assert(!accSrc.includes("ads_management"), "O ads_management accounts");
assert(!accSrc.includes("business_management"), "N business_management accounts");
assert(!accSrc.includes("/campaigns"), "P no campaigns");
assert(!oauthSrc.includes("/campaigns"), "P no campaigns oauth");
assert(!adSrc.includes("/act_"), "P no act_ campaigns API");
assert(sql.includes("writes are server-only") || sqlM2b1.includes("writes are server-only"), "RLS write server");
assert(sql.includes("grant select ("), "RLS grant colonne sicure");
assert(!sql.includes("access_token_encrypted") || !sql.includes("grant select") || !sql.split("grant select")[1]?.includes("access_token_encrypted"), "ciphertext non granted");
assert(startSrc.includes("createMetaOAuthState(userId, clientId)"), "state bind user+client");
assert(!startSrc.includes("searchParams.set(\"clientId\""), "clientId non in query OAuth");
assert(cbSrc.includes("metaOAuthReturnUrl"), "redirect interno");
assert(!cbSrc.includes('searchParams.get("next")'), "no return URL arbitrario");
assert(uiClient.includes("Disconnetti Meta"), "disconnect CTA cliente");
assert(uiClient.includes("Collega Meta"), "connect CTA cliente");
assert(dsSrc.includes("JSON.stringify({ clientId })") || uiClient.includes('JSON.stringify({ clientId })'), "disconnect body clientId");

const evil = metaOAuthReturnUrl(
  "https://affianco.vercel.app/api/meta/oauth/callback?next=https://evil.example",
  "connected",
  CLIENT_C,
);
assert(evil.includes(`/clienti/${CLIENT_C}`), "redirect da clientId validato");
assert(!evil.includes("evil.example"), "open redirect bloccato");

if (falliti > 0) {
  console.error(`\nM2C.1 FALLITO: ${falliti} assert`);
  process.exit(1);
}
console.log("\nM2C.1 OK");
