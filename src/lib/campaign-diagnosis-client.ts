/**
 * Client helper for M6C diagnosis. Auth via Bearer. Identity only in body.
 */

import { supabase } from "@/lib/supabase";
import type { CampaignDiagnosisResponse } from "@/lib/campaign-diagnosis/types";
import type { DiagnosisSource } from "@/lib/campaign-diagnosis/types";

async function getBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchCampaignDiagnosis(
  campaignId: string,
  source: DiagnosisSource,
): Promise<CampaignDiagnosisResponse> {
  const token = await getBearerToken();
  if (!token) throw new Error("Non autenticato.");
  const res = await fetch("/api/diagnosi/campagna", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ campaignId, source }),
  });
  const body = (await res.json()) as CampaignDiagnosisResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? "Analisi non disponibile al momento.");
  }
  return body;
}
