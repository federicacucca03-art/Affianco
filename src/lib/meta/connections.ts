import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta/token-crypto";
import {
  assertMetaConnectionHasScope,
  connectionHasScope,
} from "@/lib/meta/scopes";

export { assertMetaConnectionHasScope, connectionHasScope };

export type MetaConnectionStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "REAUTH_REQUIRED";

export type MetaConnectionRecord = {
  id: string;
  userId: string;
  clientId: string | null;
  metaUserId: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  status: MetaConnectionStatus;
  tokenType: string | null;
  createdAt: string;
  updatedAt: string;
};

type MetaConnectionRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  meta_user_id: string | null;
  access_token_encrypted: string;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: string;
  token_type: string | null;
  created_at: string;
  updated_at: string;
};

const STATI: MetaConnectionStatus[] = [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "REAUTH_REQUIRED",
];

const SELECT_COLS =
  "id, user_id, client_id, meta_user_id, access_token_encrypted, token_expires_at, scopes, status, token_type, created_at, updated_at";

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

function assertUserId(userId: string): string {
  const id = userId.trim();
  if (!id) {
    throw new MetaError("META_CONNECTION_INVALID", "Utente non valido.");
  }
  return id;
}

function assertClientId(clientId: string): string {
  const id = clientId.trim();
  if (!isUuid(id)) {
    throw new MetaError("META_CONNECTION_INVALID", "Cliente non valido.");
  }
  return id;
}

function parseStatus(raw: string): MetaConnectionStatus {
  if ((STATI as string[]).includes(raw)) return raw as MetaConnectionStatus;
  throw new MetaError("META_CONNECTION_INVALID", "Stato connessione non valido.");
}

function toRecord(row: MetaConnectionRow): MetaConnectionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    metaUserId: row.meta_user_id,
    tokenExpiresAt: row.token_expires_at,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: parseStatus(row.status),
    tokenType: row.token_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMetaConnectionForClient(
  userId: string,
  clientId: string,
): Promise<MetaConnectionRecord | null> {
  const uid = assertUserId(userId);
  const cid = assertClientId(clientId);
  const { data, error } = await adminClient()
    .from("meta_connections")
    .select(SELECT_COLS)
    .eq("user_id", uid)
    .eq("client_id", cid)
    .maybeSingle();

  if (error) {
    throw new MetaError("META_CONNECTION_INVALID", "Lettura connessione non riuscita.");
  }
  if (!data) return null;
  const record = toRecord(data as MetaConnectionRow);
  if (record.userId !== uid || record.clientId !== cid) {
    return null;
  }
  return record;
}

export async function getDecryptedMetaAccessToken(
  userId: string,
  clientId: string,
  options?: { ignoreStatus?: boolean },
): Promise<string> {
  const uid = assertUserId(userId);
  const cid = assertClientId(clientId);
  const { data, error } = await adminClient()
    .from("meta_connections")
    .select("access_token_encrypted, user_id, client_id, status")
    .eq("user_id", uid)
    .eq("client_id", cid)
    .maybeSingle();

  if (error) {
    throw new MetaError("META_CONNECTION_INVALID", "Lettura connessione non riuscita.");
  }
  if (!data) {
    throw new MetaError("META_CONNECTION_NOT_FOUND", "Nessuna connessione Meta.");
  }
  const row = data as Pick<
    MetaConnectionRow,
    "access_token_encrypted" | "user_id" | "client_id" | "status"
  >;
  if (row.user_id !== uid || row.client_id !== cid) {
    throw new MetaError("META_CONNECTION_NOT_FOUND", "Nessuna connessione Meta.");
  }
  if (
    !options?.ignoreStatus &&
    (row.status === "REAUTH_REQUIRED" || row.status === "REVOKED")
  ) {
    throw new MetaError("META_REAUTH_REQUIRED", "Ricollega Meta per continuare.");
  }
  return decryptMetaToken(row.access_token_encrypted);
}

export type SaveMetaConnectionInput = {
  userId: string;
  clientId: string;
  accessToken: string;
  metaUserId?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[];
  status?: MetaConnectionStatus;
  tokenType?: string | null;
};

export async function saveMetaConnection(
  input: SaveMetaConnectionInput,
): Promise<MetaConnectionRecord> {
  const uid = assertUserId(input.userId);
  const cid = assertClientId(input.clientId);
  const encrypted = encryptMetaToken(input.accessToken);
  const status = input.status ?? "ACTIVE";
  parseStatus(status);

  const payload = {
    user_id: uid,
    client_id: cid,
    meta_user_id: input.metaUserId?.trim() || null,
    access_token_encrypted: encrypted,
    token_expires_at: input.tokenExpiresAt ?? null,
    scopes: input.scopes ?? [],
    status,
    token_type: input.tokenType?.trim() || null,
  };

  const { data, error } = await adminClient()
    .from("meta_connections")
    .upsert(payload, { onConflict: "user_id,client_id" })
    .select(SELECT_COLS)
    .single();

  if (error || !data) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Salvataggio connessione non riuscito.",
    );
  }
  return toRecord(data as MetaConnectionRow);
}

export async function markMetaConnectionStatus(
  userId: string,
  clientId: string,
  status: MetaConnectionStatus,
): Promise<MetaConnectionRecord> {
  const uid = assertUserId(userId);
  const cid = assertClientId(clientId);
  parseStatus(status);

  const { data, error } = await adminClient()
    .from("meta_connections")
    .update({ status })
    .eq("user_id", uid)
    .eq("client_id", cid)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    throw new MetaError("META_CONNECTION_INVALID", "Aggiornamento stato non riuscito.");
  }
  if (!data) {
    throw new MetaError("META_CONNECTION_NOT_FOUND", "Nessuna connessione Meta.");
  }
  return toRecord(data as MetaConnectionRow);
}

export async function deleteMetaConnection(
  userId: string,
  clientId: string,
): Promise<void> {
  const uid = assertUserId(userId);
  const cid = assertClientId(clientId);
  const { error, count } = await adminClient()
    .from("meta_connections")
    .delete({ count: "exact" })
    .eq("user_id", uid)
    .eq("client_id", cid);

  if (error) {
    throw new MetaError("META_CONNECTION_INVALID", "Eliminazione connessione non riuscita.");
  }
  if (!count) {
    throw new MetaError("META_CONNECTION_NOT_FOUND", "Nessuna connessione Meta.");
  }
}
