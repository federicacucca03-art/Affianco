/**
 * Client-side helpers for the Meta ↔ Affianco campaign link API.
 * No Meta tokens. No user_id in body. Auth via Bearer header.
 */

import { supabase } from "@/lib/supabase";
import type {
  MetaCampaignLinkResult,
  NativeCampaignLinkOption,
} from "@/lib/meta/campaign-link-compatibility";

export type { MetaCampaignLinkResult, NativeCampaignLinkOption };

async function getBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchMetaCampaignLink(
  clientId: string,
  metaCampaignId: string,
): Promise<MetaCampaignLinkResult> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch(
    `/api/meta/campaign-link?clientId=${encodeURIComponent(clientId)}&metaCampaignId=${encodeURIComponent(metaCampaignId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = (await res.json()) as {
    link?: MetaCampaignLinkResult;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Lettura collegamento non riuscita.");
  if (!body.link) throw new Error("Lettura collegamento non riuscita.");
  return body.link;
}

export async function saveMetaCampaignLink(
  clientId: string,
  metaCampaignId: string,
  affiancoCampaignId: string,
): Promise<MetaCampaignLinkResult> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch("/api/meta/campaign-link", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId, metaCampaignId, affiancoCampaignId }),
  });
  const body = (await res.json()) as {
    link?: MetaCampaignLinkResult;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? "Collegamento campagna non riuscito.");
  if (!body.link) throw new Error("Collegamento campagna non riuscito.");
  return body.link;
}

export async function deleteMetaCampaignLink(
  clientId: string,
  metaCampaignId: string,
): Promise<void> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch("/api/meta/campaign-link", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId, metaCampaignId }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Scollegamento campagna non riuscito.");
  }
}
