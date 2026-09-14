import "server-only";
import { discoverClientCampaignAdSets } from "@/lib/meta/adsets";
import { discoverClientCampaignAds } from "@/lib/meta/ads";
import { getOwnedImportedMetaCampaign } from "@/lib/meta/campaign-import";
import { MetaError } from "@/lib/meta/errors";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { MetaAdSetSummary } from "@/lib/meta/adsets";
import type { MetaAdSummary } from "@/lib/meta/ads";

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

export async function persistAdSets(input: {
  userId: string;
  clientId: string;
  metaConnectionId: string;
  metaAdAccountId: string;
  metaCampaignId: string;
  adSets: MetaAdSetSummary[];
}): Promise<{ upserted: number }> {
  if (input.adSets.length === 0) return { upserted: 0 };
  const now = new Date().toISOString();
  const payloads = input.adSets.map((a) => ({
    user_id: input.userId,
    client_id: input.clientId,
    meta_connection_id: input.metaConnectionId,
    meta_ad_account_id: input.metaAdAccountId,
    meta_campaign_id: input.metaCampaignId,
    meta_ad_set_id: a.metaAdSetId,
    name: a.name,
    status: a.status,
    effective_status: a.effectiveStatus,
    daily_budget: a.dailyBudget,
    lifetime_budget: a.lifetimeBudget,
    optimization_goal: a.optimizationGoal,
    last_synced_at: now,
  }));
  const { error } = await adminClient()
    .from("meta_ad_sets")
    .upsert(payloads, {
      onConflict: "user_id,client_id,meta_ad_set_id",
    });
  if (error) {
    const code = typeof error.code === "string" ? error.code.slice(0, 32) : "DB";
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      `Salvataggio gruppi di inserzioni non riuscito (${code}).`,
    );
  }
  return { upserted: payloads.length };
}

export async function persistAds(input: {
  userId: string;
  clientId: string;
  metaConnectionId: string;
  metaAdAccountId: string;
  metaCampaignId: string;
  ads: MetaAdSummary[];
}): Promise<{ upserted: number }> {
  if (input.ads.length === 0) return { upserted: 0 };
  const now = new Date().toISOString();
  const payloads = input.ads.map((a) => ({
    user_id: input.userId,
    client_id: input.clientId,
    meta_connection_id: input.metaConnectionId,
    meta_ad_account_id: input.metaAdAccountId,
    meta_campaign_id: input.metaCampaignId,
    meta_ad_set_id: a.metaAdSetId,
    meta_ad_id: a.metaAdId,
    name: a.name,
    status: a.status,
    effective_status: a.effectiveStatus,
    creative_id: a.creative.creativeId,
    creative_body: a.creative.body,
    creative_title: a.creative.title,
    creative_description: null as string | null,
    creative_cta: a.creative.cta,
    creative_thumbnail_url: a.creative.thumbnailUrl,
    creative_link_url: a.creative.linkUrl,
    last_synced_at: now,
  }));
  const { error } = await adminClient()
    .from("meta_ads")
    .upsert(payloads, {
      onConflict: "user_id,client_id,meta_ad_id",
    });
  if (error) {
    const code = typeof error.code === "string" ? error.code.slice(0, 32) : "DB";
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      `Salvataggio inserzioni non riuscito (${code}).`,
    );
  }
  return { upserted: payloads.length };
}

/**
 * Fetch + upsert ad sets and ads. Orphan-safe: never hard-deletes missing entities.
 * Ad sets persist even when ads discovery fails (partial hierarchy still useful).
 */
export async function importClientCampaignHierarchy(
  userId: string,
  clientId: string,
  campaignUuid: string,
  options?: {
    fetchImpl?: (
      input: string,
      init?: { method?: string; headers?: Record<string, string> },
    ) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
  },
): Promise<{
  adSetsUpserted: number;
  adsUpserted: number;
  metaCampaignId: string;
}> {
  await getOwnedImportedMetaCampaign(userId, clientId, campaignUuid);
  const adSetsResult = await discoverClientCampaignAdSets(
    userId,
    clientId,
    campaignUuid,
    options,
  );
  const adSetsPersist = await persistAdSets({
    userId,
    clientId,
    metaConnectionId: adSetsResult.metaConnectionId,
    metaAdAccountId: adSetsResult.metaAdAccountId,
    metaCampaignId: adSetsResult.metaCampaignId,
    adSets: adSetsResult.adSets,
  });

  let adsUpserted = 0;
  try {
    const adsResult = await discoverClientCampaignAds(
      userId,
      clientId,
      campaignUuid,
      options,
    );
    const adsPersist = await persistAds({
      userId,
      clientId,
      metaConnectionId: adsResult.metaConnectionId,
      metaAdAccountId: adsResult.metaAdAccountId,
      metaCampaignId: adsResult.metaCampaignId,
      ads: adsResult.ads,
    });
    adsUpserted = adsPersist.upserted;
  } catch {
    // Ads discovery/persist failed — keep ad sets already saved.
  }

  return {
    adSetsUpserted: adSetsPersist.upserted,
    adsUpserted,
    metaCampaignId: adSetsResult.metaCampaignId,
  };
}
