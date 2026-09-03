import "server-only";
import { getMetaServerConfig } from "@/lib/meta/config";
import {
  getDecryptedMetaAccessToken,
  getMetaConnectionForClient,
  type MetaConnectionRecord,
} from "@/lib/meta/connections";
import { MetaError } from "@/lib/meta/errors";
import { graphApiBase, mapGraphErrorToMetaError } from "@/lib/meta/graph";
import { META_REQUIRED_SCOPE } from "@/lib/meta/oauth";
import { assertMetaConnectionHasScope } from "@/lib/meta/scopes";

export const META_AD_ACCOUNT_FIELDS =
  "id,account_id,name,account_status,currency,timezone_name";
export const META_AD_ACCOUNTS_PAGE_LIMIT = 50;
export const META_AD_ACCOUNTS_MAX_PAGES = 10;

export type MetaAdAccountSummary = {
  id: string;
  accountId: string | null;
  name: string | null;
  status: number | null;
  currency: string | null;
  timezoneName: string | null;
};

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeMetaAdAccount(raw: unknown): MetaAdAccountSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  if (!id) return null;
  const accountId = asText(row.account_id);
  const status =
    typeof row.account_status === "number" && Number.isFinite(row.account_status)
      ? row.account_status
      : null;
  return {
    id,
    accountId,
    name: asText(row.name),
    status,
    currency: asText(row.currency),
    timezoneName: asText(row.timezone_name),
  };
}

export function parseAdAccountsPage(raw: unknown): {
  accounts: MetaAdAccountSummary[];
  after: string | null;
} {
  if (!raw || typeof raw !== "object") {
    throw new MetaError(
      "META_ACCOUNT_DISCOVERY_FAILED",
      "Lettura account Meta non riuscita.",
    );
  }
  const obj = raw as { data?: unknown; paging?: { cursors?: { after?: unknown } } };
  const data = Array.isArray(obj.data) ? obj.data : [];
  const accounts = data
    .map(normalizeMetaAdAccount)
    .filter((a): a is MetaAdAccountSummary => a != null);
  const after =
    obj.paging &&
    obj.paging.cursors &&
    typeof obj.paging.cursors.after === "string" &&
    obj.paging.cursors.after.trim()
      ? obj.paging.cursors.after.trim()
      : null;
  return { accounts, after };
}

export function isSafeMetaPagingCursor(after: string): boolean {
  return /^[A-Za-z0-9_-]{1,512}$/.test(after);
}

export function assertMetaConnectionReadyForAdsRead(
  connection: MetaConnectionRecord | null,
): MetaConnectionRecord {
  if (!connection) {
    throw new MetaError("META_CONNECTION_NOT_FOUND", "Nessuna connessione Meta.");
  }
  if (
    connection.status === "REAUTH_REQUIRED" ||
    connection.status === "REVOKED" ||
    connection.status === "EXPIRED"
  ) {
    throw new MetaError("META_REAUTH_REQUIRED", "Ricollega Meta per continuare.");
  }
  if (connection.status !== "ACTIVE") {
    throw new MetaError("META_REAUTH_REQUIRED", "Ricollega Meta per continuare.");
  }
  if (
    connection.tokenExpiresAt &&
    Number.isFinite(Date.parse(connection.tokenExpiresAt)) &&
    Date.parse(connection.tokenExpiresAt) < Date.now()
  ) {
    throw new MetaError("META_TOKEN_EXPIRED", "Sessione Meta scaduta.");
  }
  assertMetaConnectionHasScope(connection, META_REQUIRED_SCOPE);
  return connection;
}

export async function fetchAdAccountPages(
  accessToken: string,
  version: string,
  fetchImpl: FetchLike,
): Promise<MetaAdAccountSummary[]> {
  const collected: MetaAdAccountSummary[] = [];
  let after: string | null = null;

  for (let page = 0; page < META_AD_ACCOUNTS_MAX_PAGES; page += 1) {
    const url = new URL(graphApiBase(version, "me/adaccounts"));
    url.searchParams.set("fields", META_AD_ACCOUNT_FIELDS);
    url.searchParams.set("limit", String(META_AD_ACCOUNTS_PAGE_LIMIT));
    if (after) {
      if (!isSafeMetaPagingCursor(after)) break;
      url.searchParams.set("after", after);
    }

    let json: unknown;
    let ok = false;
    try {
      const res = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      json = await res.json();
      ok = res.ok;
    } catch (error) {
      if (error instanceof MetaError) throw error;
      throw new MetaError(
        "META_ACCOUNT_DISCOVERY_FAILED",
        "Lettura account Meta non riuscita.",
      );
    }

    if (!ok) {
      throw mapGraphErrorToMetaError(json);
    }

    const parsed = parseAdAccountsPage(json);
    collected.push(...parsed.accounts);
    if (!parsed.after || parsed.after === after) break;
    after = parsed.after;
  }

  return collected;
}

export async function getAccessibleMetaAdAccounts(
  userId: string,
  clientId: string,
  options?: { fetchImpl?: FetchLike },
): Promise<MetaAdAccountSummary[]> {
  const connection = await getMetaConnectionForClient(userId, clientId);
  assertMetaConnectionReadyForAdsRead(connection);
  const token = await getDecryptedMetaAccessToken(userId, clientId);
  const config = getMetaServerConfig();
  const fetchImpl = options?.fetchImpl ?? fetch;
  return fetchAdAccountPages(token, config.graphApiVersion, fetchImpl);
}
