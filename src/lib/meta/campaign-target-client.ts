/**
 * Client-side helpers for the Meta campaign target API.
 * No Meta tokens. No user_id in body. Auth via Bearer header.
 */

import { supabase } from "@/lib/supabase";
import type { MetaMonitoringKpi } from "@/lib/meta/campaign-target";

export type { MetaMonitoringKpi };

export type MetaCampaignTargetResult = {
  primaryKpi: MetaMonitoringKpi;
  targetValue: number | null;
} | null;

async function getBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchMetaCampaignTarget(
  clientId: string,
  campaignId: string,
): Promise<MetaCampaignTargetResult> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch(
    `/api/meta/campaign-target?clientId=${encodeURIComponent(clientId)}&campaignId=${encodeURIComponent(campaignId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = (await res.json()) as { target?: MetaCampaignTargetResult; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Lettura target non riuscita.");
  return body.target ?? null;
}

export async function saveMetaCampaignTarget(
  clientId: string,
  campaignId: string,
  primaryKpi: MetaMonitoringKpi,
  targetValue: number | null,
): Promise<MetaCampaignTargetResult> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch("/api/meta/campaign-target", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId, campaignId, primaryKpi, targetValue }),
  });
  const body = (await res.json()) as { target?: MetaCampaignTargetResult; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Salvataggio target non riuscito.");
  return body.target ?? null;
}

export async function deleteMetaCampaignTarget(
  clientId: string,
  campaignId: string,
): Promise<void> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch("/api/meta/campaign-target", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId, campaignId }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Rimozione target non riuscita.");
  }
}
