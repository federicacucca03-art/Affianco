import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { assertClientOwnedByUser } from "@/lib/meta/client-accounts";
import { MetaError } from "@/lib/meta/errors";
import { isUuid } from "@/lib/meta/ids";

export type MetaMonitoringKpi = "CPL" | "CPA" | "CPM" | "CPC" | "ROAS" | "NONE";

export const ALLOWED_KPI: MetaMonitoringKpi[] = [
  "CPL",
  "CPA",
  "CPM",
  "CPC",
  "ROAS",
  "NONE",
];

export type MetaCampaignTarget = {
  primaryKpi: MetaMonitoringKpi;
  targetValue: number | null;
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

function isAllowedKpi(value: unknown): value is MetaMonitoringKpi {
  return typeof value === "string" && (ALLOWED_KPI as string[]).includes(value);
}

/**
 * Assert that a meta_campaign row exists and belongs to the given user+client.
 * Returns the row id.
 */
async function assertMetaCampaignOwned(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<string> {
  if (!isUuid(metaCampaignId)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "ID campagna Meta non valido.",
    );
  }
  const { data, error } = await adminClient()
    .from("meta_campaigns")
    .select("id, user_id, client_id")
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
  } | null;
  if (!row || row.user_id !== userId || row.client_id !== clientId) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Campagna Meta non trovata per questo cliente.",
    );
  }
  return row.id;
}

/**
 * Read the current monitoring target for a Meta campaign.
 * Returns null if no target is set.
 */
export async function getMetaCampaignTarget(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<MetaCampaignTarget | null> {
  // ownership verified via query filter
  await assertClientOwnedByUser(userId, clientId);
  await assertMetaCampaignOwned(userId, clientId, metaCampaignId);

  const { data, error } = await adminClient()
    .from("meta_campaigns")
    .select("primary_kpi, target_value")
    .eq("id", metaCampaignId)
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura target non riuscita.",
    );
  }
  const row = data as {
    primary_kpi: string | null;
    target_value: number | null;
  } | null;
  if (!row || row.primary_kpi == null) return null;
  if (!isAllowedKpi(row.primary_kpi)) return null;
  return {
    primaryKpi: row.primary_kpi,
    targetValue:
      row.primary_kpi === "NONE" ? null : (row.target_value ?? null),
  };
}

/**
 * Set or update the monitoring target for a Meta campaign.
 * User must own the client and the campaign.
 * NONE → targetValue is ignored and set to null.
 * Otherwise targetValue must be > 0.
 */
export async function setMetaCampaignTarget(
  userId: string,
  clientId: string,
  metaCampaignId: string,
  primaryKpi: MetaMonitoringKpi,
  targetValue: number | null,
): Promise<MetaCampaignTarget> {
  if (!isAllowedKpi(primaryKpi)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      `KPI non valido. Valori consentiti: ${ALLOWED_KPI.join(", ")}`,
    );
  }

  const effectiveTarget = primaryKpi === "NONE" ? null : targetValue;

  if (
    primaryKpi !== "NONE" &&
    (effectiveTarget == null ||
      !Number.isFinite(effectiveTarget) ||
      effectiveTarget <= 0)
  ) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Il target deve essere un valore numerico positivo quando il KPI non è NONE.",
    );
  }

  await assertClientOwnedByUser(userId, clientId);
  await assertMetaCampaignOwned(userId, clientId, metaCampaignId);

  const { error } = await adminClient()
    .from("meta_campaigns")
    .update({
      primary_kpi: primaryKpi,
      target_value: effectiveTarget,
    })
    .eq("id", metaCampaignId)
    .eq("user_id", userId)
    .eq("client_id", clientId);

  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Salvataggio target non riuscito.",
    );
  }
  return { primaryKpi, targetValue: effectiveTarget };
}

/**
 * Clear the monitoring target for a Meta campaign.
 * Sets primary_kpi = null and target_value = null.
 */
export async function clearMetaCampaignTarget(
  userId: string,
  clientId: string,
  metaCampaignId: string,
): Promise<void> {
  await assertClientOwnedByUser(userId, clientId);
  await assertMetaCampaignOwned(userId, clientId, metaCampaignId);

  const { error } = await adminClient()
    .from("meta_campaigns")
    .update({
      primary_kpi: null,
      target_value: null,
    })
    .eq("id", metaCampaignId)
    .eq("user_id", userId)
    .eq("client_id", clientId);

  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Rimozione target non riuscita.",
    );
  }
}
