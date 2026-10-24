/**
 * M14.1 — Persist Meta hierarchy after successful full publish + Ally link + M13 baseline.
 */

import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { MetaError } from "@/lib/meta/errors";
import { mapMetaObjectiveToAffianco } from "@/lib/meta/campaign-objective";
import { establishSyncBaselineOnLink } from "@/lib/meta/sync-state-persist";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";

export type PersistFullPublishHierarchyInput = {
  userId: string;
  clientId: string;
  allyCampaignId: string;
  metaConnectionId: string;
  metaAdAccountId: string;
  metaCampaignId: string;
  metaAdSetId: string;
  metaCreativeId: string;
  metaAdId: string;
  campaignName: string;
  metaObjective: string | null;
  adSetName: string;
  adName: string;
  dailyBudgetMinor: number | null;
  optimizationGoal: string | null;
};

/**
 * Upsert campaign + ad set + ad rows, link Ally campaign, establish SYNCED baseline.
 * Only call after all four Meta objects are verified.
 */
export async function persistFullPublishHierarchyAndLink(
  input: PersistFullPublishHierarchyInput,
): Promise<{ metaCampaignRowId: string }> {
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  const mapped = mapMetaObjectiveToAffianco(input.metaObjective);

  const { data: campRow, error: campErr } = await admin
    .from("meta_campaigns")
    .upsert(
      {
        user_id: input.userId,
        client_id: input.clientId,
        meta_connection_id: input.metaConnectionId,
        meta_ad_account_id: input.metaAdAccountId,
        meta_campaign_id: input.metaCampaignId,
        name: input.campaignName,
        raw_objective: input.metaObjective,
        affianco_objective_candidate: mapped.affiancoObjectiveCandidate,
        objective_mapping_confidence: mapped.mappingConfidence,
        status: META_WRITE_SAFE_STATUS,
        effective_status: META_WRITE_SAFE_STATUS,
        buying_type: "AUCTION",
        daily_budget:
          input.dailyBudgetMinor != null
            ? input.dailyBudgetMinor / 100
            : null,
        lifetime_budget: null,
        last_synced_at: now,
        affianco_campaign_id: input.allyCampaignId,
        // Do NOT set SYNCED here — establishSyncBaselineOnLink owns verified baseline.
        sync_status: "UNLINKED",
      },
      { onConflict: "user_id,client_id,meta_campaign_id" },
    )
    .select("id")
    .maybeSingle();

  if (campErr || !campRow?.id) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Persistenza gerarchia campagna Meta non riuscita.",
    );
  }

  const metaCampaignRowId = campRow.id as string;

  const { error: adSetErr } = await admin.from("meta_ad_sets").upsert(
    {
      user_id: input.userId,
      client_id: input.clientId,
      meta_connection_id: input.metaConnectionId,
      meta_ad_account_id: input.metaAdAccountId,
      meta_campaign_id: input.metaCampaignId,
      meta_ad_set_id: input.metaAdSetId,
      name: input.adSetName,
      status: META_WRITE_SAFE_STATUS,
      effective_status: META_WRITE_SAFE_STATUS,
      daily_budget: null,
      lifetime_budget: null,
      optimization_goal: input.optimizationGoal,
      last_synced_at: now,
    },
    { onConflict: "user_id,client_id,meta_ad_set_id" },
  );
  if (adSetErr) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Persistenza gruppo inserzioni Meta non riuscita.",
    );
  }

  const { error: adErr } = await admin.from("meta_ads").upsert(
    {
      user_id: input.userId,
      client_id: input.clientId,
      meta_connection_id: input.metaConnectionId,
      meta_ad_account_id: input.metaAdAccountId,
      meta_campaign_id: input.metaCampaignId,
      meta_ad_set_id: input.metaAdSetId,
      meta_ad_id: input.metaAdId,
      name: input.adName,
      status: META_WRITE_SAFE_STATUS,
      effective_status: META_WRITE_SAFE_STATUS,
      creative_id: input.metaCreativeId,
      last_synced_at: now,
    },
    { onConflict: "user_id,client_id,meta_ad_id" },
  );
  if (adErr) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Persistenza annuncio Meta non riuscita.",
    );
  }

  // Link + M13 verified baseline (SYNCED only here).
  await establishSyncBaselineOnLink(
    input.userId,
    metaCampaignRowId,
    input.allyCampaignId,
  );

  return { metaCampaignRowId };
}
