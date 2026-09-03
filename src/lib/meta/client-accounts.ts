import "server-only";
import {
  getAccessibleMetaAdAccounts,
  type MetaAdAccountSummary,
} from "@/lib/meta/accounts";
import { getMetaConnectionForClient } from "@/lib/meta/connections";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ClientMetaAccountMapping = {
  clientId: string;
  metaConnectionId: string;
  metaAdAccountId: string;
  metaAdAccountName: string | null;
  metaAccountId: string | null;
  currency: string | null;
  timezoneName: string | null;
};

type MappingRow = {
  client_id: string;
  meta_connection_id: string;
  meta_ad_account_id: string;
  meta_ad_account_name: string | null;
  meta_account_id: string | null;
  currency: string | null;
  timezone_name: string | null;
};

export { isUuid };

function adminClient() {
  try {
    return createSupabaseAdmin();
  } catch {
    throw new MetaError(
      "META_CONFIG_MISSING",
      "Persistenza server non configurata.",
    );
  }
}

function toMapping(row: MappingRow): ClientMetaAccountMapping {
  return {
    clientId: row.client_id,
    metaConnectionId: row.meta_connection_id,
    metaAdAccountId: row.meta_ad_account_id,
    metaAdAccountName: row.meta_ad_account_name,
    metaAccountId: row.meta_account_id,
    currency: row.currency,
    timezoneName: row.timezone_name,
  };
}

export async function assertClientOwnedByUser(
  userId: string,
  clientId: string,
): Promise<{ id: string; name: string }> {
  if (!isUuid(clientId)) {
    throw new MetaError("META_CONNECTION_INVALID", "Cliente non valido.");
  }
  const { data, error } = await adminClient()
    .from("clients")
    .select("id, name, user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) {
    throw new MetaError("META_CONNECTION_INVALID", "Lettura cliente non riuscita.");
  }
  const row = data as { id: string; name: string; user_id: string | null } | null;
  if (!row || row.user_id !== userId) {
    throw new MetaError("META_CONNECTION_INVALID", "Cliente non trovato.");
  }
  return { id: row.id, name: row.name };
}

export function findAccessibleAccount(
  accounts: MetaAdAccountSummary[],
  metaAdAccountId: string,
): MetaAdAccountSummary | null {
  const wanted = metaAdAccountId.trim();
  if (!wanted) return null;
  return (
    accounts.find((a) => a.id === wanted || a.accountId === wanted) ?? null
  );
}

export async function getClientMetaAccount(
  userId: string,
  clientId: string,
): Promise<ClientMetaAccountMapping | null> {
  await assertClientOwnedByUser(userId, clientId);
  const { data, error } = await adminClient()
    .from("client_ad_accounts")
    .select(
      "client_id, meta_connection_id, meta_ad_account_id, meta_ad_account_name, meta_account_id, currency, timezone_name",
    )
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    throw new MetaError("META_CONNECTION_INVALID", "Lettura collegamento non riuscita.");
  }
  if (!data) return null;
  return toMapping(data as MappingRow);
}

export async function setClientMetaAccount(
  userId: string,
  clientId: string,
  metaAdAccountId: string,
): Promise<ClientMetaAccountMapping> {
  await assertClientOwnedByUser(userId, clientId);
  const connection = await getMetaConnectionForClient(userId, clientId);
  if (!connection || connection.clientId !== clientId) {
    throw new MetaError("META_CONNECTION_NOT_FOUND", "Nessuna connessione Meta.");
  }
  const accounts = await getAccessibleMetaAdAccounts(userId, clientId);
  const account = findAccessibleAccount(accounts, metaAdAccountId);
  if (!account) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Account pubblicitario non disponibile.",
    );
  }

  const payload = {
    user_id: userId,
    client_id: clientId,
    meta_connection_id: connection.id,
    meta_ad_account_id: account.id,
    meta_ad_account_name: account.name,
    meta_account_id: account.accountId,
    currency: account.currency,
    timezone_name: account.timezoneName,
  };

  const { data, error } = await adminClient()
    .from("client_ad_accounts")
    .upsert(payload, { onConflict: "user_id,client_id" })
    .select(
      "client_id, meta_connection_id, meta_ad_account_id, meta_ad_account_name, meta_account_id, currency, timezone_name",
    )
    .single();

  if (error || !data) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Salvataggio collegamento non riuscito.",
    );
  }
  return toMapping(data as MappingRow);
}

export async function removeClientMetaAccount(
  userId: string,
  clientId: string,
): Promise<void> {
  await assertClientOwnedByUser(userId, clientId);
  const { error } = await adminClient()
    .from("client_ad_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Rimozione collegamento non riuscita.",
    );
  }
}
