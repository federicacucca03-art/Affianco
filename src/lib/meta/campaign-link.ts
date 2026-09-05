import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";
import {
  etichettaObjectiveBreve,
  isValidCampaignLinkOwnership,
  type MetaCampaignLinkResult,
  type NativeCampaignLinkOption,
} from "@/lib/meta/campaign-link-compatibility";
import { etichettaStatusCampagna } from "@/types/campagne";

export type { MetaCampaignLinkResult, NativeCampaignLinkOption };

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

async function assertMetaCampaignOwned(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<{ id: string; affianco_campaign_id: string | null }> {
  if (!isUuid(metaCampaignId)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "ID campagna Meta non valido.",
    );
  }
  const { data, error } = await adminClient()
    .from("meta_campaigns")
    .select("id, user_id, client_id, affianco_campaign_id")
    .eq("id", metaCampaignId)
    .maybeSingle();
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura campagna Meta non riuscita.",
    );
  }
  const row = data as {
    id: string;
    user_id: string;
    client_id: string;
    affianco_campaign_id: string | null;
  } | null;
  if (!row || row.user_id !== userId || row.client_id !== clientId) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Campagna Meta non trovata per questo cliente.",
    );
  }
  return { id: row.id, affianco_campaign_id: row.affianco_campaign_id };
}

async function assertNativeCampaignOwned(
  userId: string,
  clientId: string,
  affiancoCampaignId: string,
): Promise<{ id: string; name: string }> {
  if (!isUuid(affiancoCampaignId)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "ID campagna Ally non valido.",
    );
  }
  const { data, error } = await adminClient()
    .from("campaigns")
    .select("id, name, user_id, client_id")
    .eq("id", affiancoCampaignId)
    .maybeSingle();
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura campagna Ally non riuscita.",
    );
  }
  const row = data as {
    id: string;
    name: string;
    user_id: string | null;
    client_id: string | null;
  } | null;
  if (
    !row ||
    !isValidCampaignLinkOwnership({
      authUserId: userId,
      requestedClientId: clientId,
      metaUserId: userId,
      metaClientId: clientId,
      nativeUserId: row.user_id,
      nativeClientId: row.client_id,
    })
  ) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Campagna Ally non trovata per questo cliente.",
    );
  }
  return { id: row.id, name: row.name };
}

async function listNativeCampaignOptions(
  userId: string,
  clientId: string,
): Promise<NativeCampaignLinkOption[]> {
  const { data, error } = await adminClient()
    .from("campaigns")
    .select("id, name, objective, status")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura campagne Ally non riuscita.",
    );
  }
  return ((data ?? []) as {
    id: string;
    name: string;
    objective: string | null;
    status: string | null;
  }[]).map((row) => ({
    id: row.id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    objectiveLabel: etichettaObjectiveBreve(row.objective),
    statusLabel: etichettaStatusCampagna(row.status),
  }));
}

export async function getMetaCampaignLink(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<MetaCampaignLinkResult> {
  await assertClientOwnedByUser(userId, clientId);
  const meta = await assertMetaCampaignOwned(userId, clientId, metaCampaignId);
  const options = await listNativeCampaignOptions(userId, clientId);

  let linkedCampaignName: string | null = null;
  if (meta.affianco_campaign_id) {
    const match = options.find((o) => o.id === meta.affianco_campaign_id);
    linkedCampaignName = match?.name ?? null;
  }

  return {
    metaCampaignId: meta.id,
    affiancoCampaignId: meta.affianco_campaign_id,
    linkedCampaignName,
    options,
  };
}

export async function setMetaCampaignLink(
  userId: string,
  clientId: string,
  metaCampaignId: string,
  affiancoCampaignId: string,
): Promise<MetaCampaignLinkResult> {
  await assertClientOwnedByUser(userId, clientId);
  await assertMetaCampaignOwned(userId, clientId, metaCampaignId);
  await assertNativeCampaignOwned(userId, clientId, affiancoCampaignId);

  const { error } = await adminClient()
    .from("meta_campaigns")
    .update({ affianco_campaign_id: affiancoCampaignId })
    .eq("id", metaCampaignId)
    .eq("user_id", userId)
    .eq("client_id", clientId);

  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Collegamento campagna non riuscito.",
    );
  }

  return getMetaCampaignLink(userId, clientId, metaCampaignId);
}

/**
 * Unlink is idempotent: already-null is success.
 */
export async function clearMetaCampaignLink(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<MetaCampaignLinkResult> {
  await assertClientOwnedByUser(userId, clientId);
  await assertMetaCampaignOwned(userId, clientId, metaCampaignId);

  const { error } = await adminClient()
    .from("meta_campaigns")
    .update({ affianco_campaign_id: null })
    .eq("id", metaCampaignId)
    .eq("user_id", userId)
    .eq("client_id", clientId);

  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Scollegamento campagna non riuscito.",
    );
  }

  return getMetaCampaignLink(userId, clientId, metaCampaignId);
}
