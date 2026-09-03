import "server-only";
import { discoverClientMetaCampaigns } from "@/lib/meta/campaigns";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
import type { MetaCampaignSummary } from "@/lib/meta/campaigns";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type ImportedMetaCampaign = MetaCampaignSummary & {
  lastSyncedAt: string;
};

type PersistRow = {
  meta_campaign_id: string;
  meta_ad_account_id: string;
  name: string;
  raw_objective: string | null;
  affianco_objective_candidate: string | null;
  objective_mapping_confidence: string | null;
  status: string | null;
  effective_status: string | null;
  buying_type: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  meta_created_at: string | null;
  meta_start_at: string | null;
  meta_stop_at: string | null;
  last_synced_at: string;
};

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

function toImported(row: PersistRow): ImportedMetaCampaign {
  return {
    metaCampaignId: row.meta_campaign_id,
    metaAdAccountId: row.meta_ad_account_id,
    name: row.name,
    rawObjective: row.raw_objective,
    affiancoObjectiveCandidate:
      (row.affianco_objective_candidate as ImportedMetaCampaign["affiancoObjectiveCandidate"]) ??
      null,
    mappingConfidence:
      (row.objective_mapping_confidence as ImportedMetaCampaign["mappingConfidence"]) ??
      "UNKNOWN",
    status: row.status,
    effectiveStatus: row.effective_status,
    buyingType: row.buying_type,
    createdAt: row.meta_created_at,
    startAt: row.meta_start_at,
    stopAt: row.meta_stop_at,
    dailyBudget: row.daily_budget,
    lifetimeBudget: row.lifetime_budget,
    lastSyncedAt: row.last_synced_at,
  };
}

const SELECT_COLS =
  "meta_campaign_id, meta_ad_account_id, name, raw_objective, affianco_objective_candidate, objective_mapping_confidence, status, effective_status, buying_type, daily_budget, lifetime_budget, meta_created_at, meta_start_at, meta_stop_at, last_synced_at";

export async function listImportedMetaCampaigns(
  userId: string,
  clientId: string,
): Promise<ImportedMetaCampaign[]> {
  await assertClientOwnedByUser(userId, clientId);
  const { data, error } = await adminClient()
    .from("meta_campaigns")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("last_synced_at", { ascending: false });
  if (error) {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura campagne importate non riuscita.",
    );
  }
  return ((data ?? []) as PersistRow[]).map(toImported);
}

export type OwnedImportedMetaCampaign = ImportedMetaCampaign & {
  userId: string;
  clientId: string;
  metaConnectionId: string;
};

type OwnedRow = PersistRow & {
  user_id: string;
  client_id: string;
  meta_connection_id: string;
};

export async function getOwnedImportedMetaCampaign(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<OwnedImportedMetaCampaign> {
  await assertClientOwnedByUser(userId, clientId);
  const wanted = metaCampaignId.trim();
  if (!wanted) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna Meta non valida.");
  }
  let query = adminClient()
    .from("meta_campaigns")
    .select(`${SELECT_COLS}, user_id, client_id, meta_connection_id`)
    .eq("user_id", userId)
    .eq("client_id", clientId);
  query = isUuid(wanted) ? query.eq("id", wanted) : query.eq("meta_campaign_id", wanted);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura campagna importata non riuscita.",
    );
  }
  if (!data) {
    throw new MetaError(
      "META_CAMPAIGN_ACCESS_LOST",
      "Campagna Meta non trovata per questo cliente.",
    );
  }
  const row = data as OwnedRow;
  if (row.user_id !== userId || row.client_id !== clientId) {
    throw new MetaError(
      "META_CAMPAIGN_ACCESS_LOST",
      "Campagna Meta non trovata per questo cliente.",
    );
  }
  return {
    ...toImported(row),
    userId: row.user_id,
    clientId: row.client_id,
    metaConnectionId: row.meta_connection_id,
  };
}

export async function importClientMetaCampaigns(
  userId: string,
  clientId: string,
): Promise<{
  imported: number;
  updated: number;
  truncated: boolean;
  campaigns: ImportedMetaCampaign[];
}> {
  const discovered = await discoverClientMetaCampaigns(userId, clientId);
  const existing = await adminClient()
    .from("meta_campaigns")
    .select("meta_campaign_id")
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (existing.error) {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura campagne importate non riuscita.",
    );
  }
  const known = new Set(
    ((existing.data ?? []) as { meta_campaign_id: string }[]).map(
      (r) => r.meta_campaign_id,
    ),
  );
  const now = new Date().toISOString();
  const payloads = discovered.campaigns.map((c) => ({
    user_id: userId,
    client_id: clientId,
    meta_connection_id: discovered.metaConnectionId,
    meta_ad_account_id: discovered.metaAdAccountId,
    meta_campaign_id: c.metaCampaignId,
    name: c.name,
    raw_objective: c.rawObjective,
    affianco_objective_candidate: c.affiancoObjectiveCandidate,
    objective_mapping_confidence: c.mappingConfidence,
    status: c.status,
    effective_status: c.effectiveStatus,
    buying_type: c.buyingType,
    daily_budget: c.dailyBudget,
    lifetime_budget: c.lifetimeBudget,
    meta_created_at: c.createdAt,
    meta_start_at: c.startAt,
    meta_stop_at: c.stopAt,
    last_synced_at: now,
  }));

  if (payloads.length > 0) {
    const { error } = await adminClient()
      .from("meta_campaigns")
      .upsert(payloads, { onConflict: "user_id,client_id,meta_campaign_id" });
    if (error) {
      throw new MetaError(
        "META_CAMPAIGN_DISCOVERY_FAILED",
        "Salvataggio campagne Meta non riuscito.",
      );
    }
  }

  let imported = 0;
  let updated = 0;
  for (const c of discovered.campaigns) {
    if (known.has(c.metaCampaignId)) updated += 1;
    else imported += 1;
  }

  const campaigns = await listImportedMetaCampaigns(userId, clientId);
  return {
    imported,
    updated,
    truncated: discovered.truncated,
    campaigns,
  };
}
