/**
 * M11A.1 — Persist dry-run preview operations (server-only). No Meta creates.
 */

import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";

export async function logMetaWritePreviewOperation(input: {
  userId: string;
  clientId: string;
  allyCampaignId: string;
  preview: MetaWritePreviewResult;
}): Promise<{ id: string } | { error: string }> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("meta_write_operations")
    .upsert(
      {
        user_id: input.userId,
        client_id: input.clientId,
        ally_campaign_id: input.allyCampaignId,
        operation_type: input.preview.operationType,
        payload_fingerprint: input.preview.fingerprint,
        idempotency_key: input.preview.idempotencyKey,
        state: "PREVIEWED",
        safe_payload_summary: input.preview.safePayloadSummary,
        meta_campaign_id: null,
        meta_adset_id: null,
        meta_creative_id: null,
        meta_ad_id: null,
        error_category: null,
        error_safe_message: null,
      },
      {
        onConflict:
          "user_id,ally_campaign_id,operation_type,idempotency_key",
      },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  const id = (data as { id?: string } | null)?.id;
  if (!id) return { error: "Operazione non salvata." };
  return { id };
}
