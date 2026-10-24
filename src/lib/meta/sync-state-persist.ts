import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { MetaError } from "@/lib/meta/errors";
import { listMetaConnectionsForUser } from "@/lib/meta/connections";
import {
  deriveSyncStatusFromFingerprints,
  type MetaCampaignSyncStatus,
  type MetaSyncPersistRow,
} from "@/lib/meta/sync-state";
import {
  fingerprintAllyCampaignRow,
  fingerprintMetaCampaignRow,
} from "@/lib/meta/sync-fingerprint";

const SYNC_SELECT =
  "id, affianco_campaign_id, sync_status, last_verified_sync_at, last_sync_error_at, last_sync_error_message, verified_ally_fingerprint, verified_meta_fingerprint, current_ally_fingerprint, current_meta_fingerprint, name, raw_objective, status, effective_status, daily_budget, lifetime_budget, primary_kpi, target_value";

function admin() {
  try {
    return createSupabaseAdmin();
  } catch {
    throw new MetaError(
      "META_CONFIG_MISSING",
      "Persistenza server non configurata.",
    );
  }
}

function asSyncRow(data: Record<string, unknown>): MetaSyncPersistRow {
  return {
    affianco_campaign_id:
      typeof data.affianco_campaign_id === "string"
        ? data.affianco_campaign_id
        : null,
    sync_status: (data.sync_status as MetaCampaignSyncStatus) ?? "UNLINKED",
    last_verified_sync_at:
      typeof data.last_verified_sync_at === "string"
        ? data.last_verified_sync_at
        : null,
    last_sync_error_at:
      typeof data.last_sync_error_at === "string"
        ? data.last_sync_error_at
        : null,
    last_sync_error_message:
      typeof data.last_sync_error_message === "string"
        ? data.last_sync_error_message
        : null,
    verified_ally_fingerprint:
      typeof data.verified_ally_fingerprint === "string"
        ? data.verified_ally_fingerprint
        : null,
    verified_meta_fingerprint:
      typeof data.verified_meta_fingerprint === "string"
        ? data.verified_meta_fingerprint
        : null,
    current_ally_fingerprint:
      typeof data.current_ally_fingerprint === "string"
        ? data.current_ally_fingerprint
        : null,
    current_meta_fingerprint:
      typeof data.current_meta_fingerprint === "string"
        ? data.current_meta_fingerprint
        : null,
  };
}

async function persistSyncPatch(
  metaRowId: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin()
    .from("meta_campaigns")
    .update(patch)
    .eq("id", metaRowId)
    .eq("user_id", userId);
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Aggiornamento stato sync non riuscito.",
    );
  }
}

function metaFpFromRow(data: Record<string, unknown>): string {
  return fingerprintMetaCampaignRow({
    name: (data.name as string | null) ?? null,
    raw_objective: (data.raw_objective as string | null) ?? null,
    status: (data.status as string | null) ?? null,
    effective_status: (data.effective_status as string | null) ?? null,
    daily_budget: (data.daily_budget as number | null) ?? null,
    lifetime_budget: (data.lifetime_budget as number | null) ?? null,
    primary_kpi: (data.primary_kpi as string | null) ?? null,
    target_value: (data.target_value as number | null) ?? null,
  });
}

async function loadAllyFingerprint(
  affiancoCampaignId: string,
): Promise<string | null> {
  const { data, error } = await admin()
    .from("campaigns")
    .select(
      "name, objective, status, daily_budget, page_id, form_id, citta, raggio_km, eta_min, eta_max, target_margin, max_sustainable_cpa",
    )
    .eq("id", affiancoCampaignId)
    .maybeSingle();
  if (error || !data) return null;
  return fingerprintAllyCampaignRow(data as Parameters<typeof fingerprintAllyCampaignRow>[0]);
}

/** Capture baselines when user explicitly links Meta ↔ Ally. */
export async function establishSyncBaselineOnLink(
  userId: string,
  metaCampaignUuid: string,
  affiancoCampaignId: string,
): Promise<void> {
  const { data, error } = await admin()
    .from("meta_campaigns")
    .select(SYNC_SELECT)
    .eq("id", metaCampaignUuid)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return;

  const metaFp = metaFpFromRow(data as Record<string, unknown>);
  const allyFp = await loadAllyFingerprint(affiancoCampaignId);
  const now = new Date().toISOString();

  const row: MetaSyncPersistRow = {
    ...asSyncRow(data as Record<string, unknown>),
    affianco_campaign_id: affiancoCampaignId,
    current_meta_fingerprint: metaFp,
    current_ally_fingerprint: allyFp,
    verified_meta_fingerprint: metaFp,
    verified_ally_fingerprint: allyFp,
    last_verified_sync_at: now,
    sync_status: "SYNCED",
  };

  await persistSyncPatch(metaCampaignUuid, userId, {
    affianco_campaign_id: affiancoCampaignId,
    current_meta_fingerprint: metaFp,
    current_ally_fingerprint: allyFp,
    verified_meta_fingerprint: metaFp,
    verified_ally_fingerprint: allyFp,
    last_verified_sync_at: now,
    sync_status: deriveSyncStatusFromFingerprints(row),
  });
}

export async function clearSyncStateOnUnlink(
  userId: string,
  metaCampaignUuid: string,
): Promise<void> {
  await persistSyncPatch(metaCampaignUuid, userId, {
    sync_status: "UNLINKED",
    last_verified_sync_at: null,
    verified_ally_fingerprint: null,
    verified_meta_fingerprint: null,
    current_ally_fingerprint: null,
    current_meta_fingerprint: null,
  });
}

/** After Meta read/import updates campaign fields (not verification). */
export async function touchMetaSideAfterRead(
  userId: string,
  clientId: string,
  metaCampaignIdExternal: string,
): Promise<void> {
  const { data, error } = await admin()
    .from("meta_campaigns")
    .select(SYNC_SELECT)
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("meta_campaign_id", metaCampaignIdExternal)
    .maybeSingle();
  if (error || !data) return;

  const metaFp = metaFpFromRow(data as Record<string, unknown>);
  const row = asSyncRow(data as Record<string, unknown>);
  row.current_meta_fingerprint = metaFp;

  await persistSyncPatch(data.id as string, userId, {
    current_meta_fingerprint: metaFp,
    sync_status: deriveSyncStatusFromFingerprints(row),
  });
}

export async function touchMetaSideAfterReadByUuid(
  userId: string,
  metaCampaignUuid: string,
): Promise<void> {
  const { data, error } = await admin()
    .from("meta_campaigns")
    .select(SYNC_SELECT)
    .eq("id", metaCampaignUuid)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return;

  const metaFp = metaFpFromRow(data as Record<string, unknown>);
  const row = asSyncRow(data as Record<string, unknown>);
  row.current_meta_fingerprint = metaFp;

  await persistSyncPatch(metaCampaignUuid, userId, {
    current_meta_fingerprint: metaFp,
    sync_status: deriveSyncStatusFromFingerprints(row),
  });
}

export async function touchAllySideAfterChange(
  userId: string,
  affiancoCampaignId: string,
): Promise<void> {
  const { data: links, error } = await admin()
    .from("meta_campaigns")
    .select(SYNC_SELECT)
    .eq("user_id", userId)
    .eq("affianco_campaign_id", affiancoCampaignId);
  if (error || !links?.length) return;

  const allyFp = await loadAllyFingerprint(affiancoCampaignId);
  if (!allyFp) return;

  for (const raw of links as Record<string, unknown>[]) {
    const row = asSyncRow(raw);
    row.current_ally_fingerprint = allyFp;
    await persistSyncPatch(raw.id as string, userId, {
      current_ally_fingerprint: allyFp,
      sync_status: deriveSyncStatusFromFingerprints(row),
    });
  }
}

export async function recordSyncError(
  userId: string,
  metaCampaignUuid: string,
  safeMessage: string,
): Promise<void> {
  const now = new Date().toISOString();
  await persistSyncPatch(metaCampaignUuid, userId, {
    sync_status: "SYNC_ERROR",
    last_sync_error_at: now,
    last_sync_error_message: safeMessage.slice(0, 500),
  });
}

export type MetaIntegrationAdAccountSummary = {
  metaAdAccountId: string;
  metaAdAccountName: string | null;
  metaAccountId: string | null;
  currency: string | null;
  timezoneName: string | null;
};

/**
 * Canonical workspace Meta connection summary.
 * Source of truth: meta_connections + client_ad_accounts (same as publish-plan).
 * Campaign import inventory is orthogonal and must not imply disconnect.
 */
export type MetaIntegrationConnectionSummary = {
  connected: boolean;
  status: string | null;
  connectionCount: number;
  activeConnectionCount: number;
  clientId: string | null;
  clientName: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  metaUserId: string | null;
  updatedAt: string | null;
  adAccount: MetaIntegrationAdAccountSummary | null;
};

export type MetaIntegrationSyncHealth = {
  connectedCampaigns: number;
  linkedCampaigns: number;
  campaignsWithSyncIssues: number;
  lastSuccessfulMetaReadAt: string | null;
  connection: MetaIntegrationConnectionSummary;
};

async function loadWorkspaceMetaConnectionSummary(
  userId: string,
): Promise<MetaIntegrationConnectionSummary> {
  const empty: MetaIntegrationConnectionSummary = {
    connected: false,
    status: null,
    connectionCount: 0,
    activeConnectionCount: 0,
    clientId: null,
    clientName: null,
    scopes: [],
    tokenExpiresAt: null,
    metaUserId: null,
    updatedAt: null,
    adAccount: null,
  };

  const connections = await listMetaConnectionsForUser(userId);
  if (connections.length === 0) return empty;

  const { data: accountRows, error: accountError } = await admin()
    .from("client_ad_accounts")
    .select(
      "client_id, meta_connection_id, meta_ad_account_id, meta_ad_account_name, meta_account_id, currency, timezone_name",
    )
    .eq("user_id", userId);
  if (accountError) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura stato integrazione non riuscita.",
    );
  }
  const accounts = (accountRows ?? []) as {
    client_id: string;
    meta_connection_id: string;
    meta_ad_account_id: string;
    meta_ad_account_name: string | null;
    meta_account_id: string | null;
    currency: string | null;
    timezone_name: string | null;
  }[];
  const accountByClient = new Map(accounts.map((a) => [a.client_id, a]));

  const active = connections.filter((c) => c.status === "ACTIVE");
  const primary =
    active.find((c) => c.clientId && accountByClient.has(c.clientId)) ??
    active[0] ??
    connections[0]!;

  const clientId = primary.clientId;
  let clientName: string | null = null;
  if (clientId) {
    const { data: clientRow } = await admin()
      .from("clients")
      .select("id, name, user_id")
      .eq("id", clientId)
      .eq("user_id", userId)
      .maybeSingle();
    const name = (clientRow as { name?: string } | null)?.name;
    clientName = typeof name === "string" && name.trim() ? name.trim() : null;
  }

  const mapped = clientId ? accountByClient.get(clientId) ?? null : null;

  return {
    connected: primary.status === "ACTIVE",
    status: primary.status,
    connectionCount: connections.length,
    activeConnectionCount: active.length,
    clientId,
    clientName,
    scopes: primary.scopes,
    tokenExpiresAt: primary.tokenExpiresAt,
    metaUserId: primary.metaUserId,
    updatedAt: primary.updatedAt,
    adAccount: mapped
      ? {
          metaAdAccountId: mapped.meta_ad_account_id,
          metaAdAccountName: mapped.meta_ad_account_name,
          metaAccountId: mapped.meta_account_id,
          currency: mapped.currency,
          timezoneName: mapped.timezone_name,
        }
      : null,
  };
}

export async function loadMetaIntegrationSyncHealth(
  userId: string,
): Promise<MetaIntegrationSyncHealth> {
  const { data, error } = await admin()
    .from("meta_campaigns")
    .select(
      "affianco_campaign_id, sync_status, last_synced_at",
    )
    .eq("user_id", userId);
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura stato integrazione non riuscita.",
    );
  }
  const rows = (data ?? []) as {
    affianco_campaign_id: string | null;
    sync_status: string;
    last_synced_at: string | null;
  }[];
  let lastRead: string | null = null;
  for (const r of rows) {
    if (r.last_synced_at && (!lastRead || r.last_synced_at > lastRead)) {
      lastRead = r.last_synced_at;
    }
  }
  const issueStatuses = new Set([
    "SYNC_ERROR",
    "ALLY_CHANGES_PENDING",
    "META_CHANGES_DETECTED",
    "BOTH_CHANGES",
    "NEEDS_VERIFICATION",
  ]);
  const connection = await loadWorkspaceMetaConnectionSummary(userId);
  return {
    connectedCampaigns: rows.length,
    linkedCampaigns: rows.filter((r) => r.affianco_campaign_id).length,
    campaignsWithSyncIssues: rows.filter(
      (r) => r.affianco_campaign_id && issueStatuses.has(r.sync_status),
    ).length,
    lastSuccessfulMetaReadAt: lastRead,
    connection,
  };
}
