/**
 * M2C — Meta ad account discovery + client mapping (fake Graph only).
 * Esegui: npx tsx --conditions=react-server scripts/verifica-meta-m2c.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MetaError } from "@/lib/meta/errors";
import {
  META_AD_ACCOUNTS_MAX_PAGES,
  assertMetaConnectionReadyForAdsRead,
  fetchAdAccountPages,
  isSafeMetaPagingCursor,
  normalizeMetaAdAccount,
  parseAdAccountsPage,
} from "@/lib/meta/accounts";
import { findAccessibleAccount, isUuid } from "@/lib/meta/client-accounts";
import { mapGraphErrorToMetaError } from "@/lib/meta/graph";
import type { MetaConnectionRecord } from "@/lib/meta/connections";

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

process.env.META_GRAPH_API_VERSION = "v21.0";

const conn = (over: Partial<MetaConnectionRecord>): MetaConnectionRecord => ({
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  metaUserId: "99",
  tokenExpiresAt: null,
  scopes: ["ads_read", "public_profile"],
  status: "ACTIVE",
  tokenType: "bearer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

console.log("\n=== M2C A ads_read / J expiry ===");
let aCode = "";
try {
  assertMetaConnectionReadyForAdsRead(conn({ scopes: ["public_profile"] }));
} catch (error) {
  aCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(aCode === "META_PERMISSION_MISSING", "A ads_read richiesto");

let jCode = "";
try {
  assertMetaConnectionReadyForAdsRead(
    conn({ tokenExpiresAt: "2000-01-01T00:00:00.000Z" }),
  );
} catch (error) {
  jCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(jCode === "META_TOKEN_EXPIRED", "J token scaduto → reauth/expired");

let rCode = "";
try {
  assertMetaConnectionReadyForAdsRead(conn({ status: "REAUTH_REQUIRED" }));
} catch (error) {
  rCode = error instanceof MetaError ? error.code : "OTHER";
}
assert(rCode === "META_REAUTH_REQUIRED", "J status REAUTH_REQUIRED");

console.log("\n=== M2C D–H normalize / pagination ===");
const one = normalizeMetaAdAccount({
  id: "act_1",
  account_id: "1",
  name: "Studio",
  account_status: 1,
  currency: "EUR",
  timezone_name: "Europe/Rome",
});
assert(one?.id === "act_1" && one.accountId === "1", "D normalizza campi");
assert(one?.status === 1 && one.currency === "EUR", "D status/currency");

const page = parseAdAccountsPage({
  data: [
    { id: "act_1", account_id: "1", name: "A", account_status: 1, currency: "EUR" },
    { id: "act_2", account_id: "2", name: "B", account_status: 2, currency: "USD" },
  ],
  paging: { cursors: { after: "CURSOR2" } },
});
assert(page.accounts.length === 2, "E più account");
assert(page.after === "CURSOR2", "G cursore after");
assert(parseAdAccountsPage({ data: [] }).accounts.length === 0, "F lista vuota");
assert(isSafeMetaPagingCursor("CURSOR2"), "G cursore sicuro");
assert(!isSafeMetaPagingCursor("https://evil.example/x"), "G URL next rifiutato");

void (async () => {
let calls = 0;
const accounts = await fetchAdAccountPages(
  "FAKE_TOKEN_DO_NOT_LOG",
  "v21.0",
  async (url, init) => {
    calls += 1;
    assert(
      !url.includes("FAKE_TOKEN_DO_NOT_LOG"),
      "B token non in query URL",
    );
    const auth = String(
      (init?.headers as Record<string, string> | undefined)?.Authorization ?? "",
    );
    assert(auth === "Bearer FAKE_TOKEN_DO_NOT_LOG", "B token solo Authorization");
    return {
      ok: true,
      json: async () => ({
        data: [{ id: `act_${calls}`, name: `Acc ${calls}` }],
        paging: { cursors: { after: `c${calls}` } },
      }),
    };
  },
);
assert(calls === META_AD_ACCOUNTS_MAX_PAGES, "H cap pagine");
assert(accounts.length === META_AD_ACCOUNTS_MAX_PAGES, "H raccolti fino al cap");

console.log("\n=== M2C I Graph error ===");
assert(
  mapGraphErrorToMetaError({ error: { code: 190 } }).code === "META_TOKEN_EXPIRED",
  "I 190 → TOKEN_EXPIRED",
);
assert(
  mapGraphErrorToMetaError({ error: { code: 17 } }).code === "META_RATE_LIMIT",
  "I rate limit",
);
assert(
  mapGraphErrorToMetaError({ error: { message: "secret-token-xyz", code: 1 } })
    .message !== "secret-token-xyz",
  "I niente raw Graph message",
);

console.log("\n=== M2C N mapping account id ===");
const list = [
  { id: "act_9", accountId: "9", name: "N", status: 1, currency: "EUR", timezoneName: null },
];
assert(findAccessibleAccount(list, "act_9")?.id === "act_9", "N id Graph");
assert(findAccessibleAccount(list, "9")?.id === "act_9", "N account_id");
assert(findAccessibleAccount(list, "act_evil") == null, "N id arbitrario rifiutato");
assert(!isUuid("cliente-123"), "L id localStorage non uuid");
assert(isUuid("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"), "L uuid ok");

console.log("\n=== M2C routes / SQL / M3 ===");
const accSrc = read("src/lib/meta/accounts.ts");
const mapSrc = read("src/lib/meta/client-accounts.ts");
const adRoute = read("src/app/api/meta/ad-accounts/route.ts");
const mapRoute = read("src/app/api/meta/client-account/route.ts");
const uiSrc = read("src/components/clienti/PannelloAccountMetaCliente.tsx");
const sql = read("supabase/migrations/20260903_client_ad_accounts.sql");

assert(accSrc.includes("getDecryptedMetaAccessToken"), "B decrypt server-side");
assert(accSrc.includes("me/adaccounts"), "discovery /me/adaccounts");
assert(!accSrc.includes("ads_management"), "ads_management assente");
assert(!accSrc.includes("business_management"), "business_management assente");
assert(!accSrc.includes("/campaigns"), "R no /campaigns");
assert(!accSrc.includes("insights"), "R no insights");
assert(adRoute.includes("requireRouteUserId"), "P auth discovery");
assert(adRoute.includes("accounts"), "C response accounts");
assert(!adRoute.includes("access_token"), "C API senza token");
assert(!adRoute.includes("access_token_encrypted"), "K no ciphertext");
assert(mapRoute.includes("requireRouteUserId"), "P mapping auth");
assert(!mapRoute.includes("body.userId"), "Q no userId dal body");
assert(mapSrc.includes('onConflict: "user_id,client_id"'), "O upsert one-per-client");
assert(mapSrc.includes("assertClientOwnedByUser"), "L ownership cliente");
assert(mapSrc.includes("getMetaConnectionForUser(userId)"), "M connection caller");
assert(mapSrc.includes("getAccessibleMetaAdAccounts"), "N revalidate accessibili");
assert(sql.includes("unique (user_id, client_id)"), "O UNIQUE SQL");
assert(sql.includes("enable row level security"), "RLS");
assert(sql.includes("revoke all on table public.client_ad_accounts from anon"), "P anon");
assert(sql.includes("writes are server-only"), "write server-only");
assert(uiSrc.includes("/api/meta/ad-accounts"), "K selector usa API");
assert(!uiSrc.includes("META_APP_SECRET"), "K UI senza secret");
assert(!uiSrc.includes("decryptMetaToken"), "K UI senza decrypt");
assert(!read("src/app/api/meta/ad-accounts/route.ts").includes("/act_"), "R no act_ campaigns");

if (falliti > 0) {
  console.error(`\nM2C FALLITO: ${falliti} assert`);
  process.exit(1);
}
console.log("\nM2C OK");
})();
