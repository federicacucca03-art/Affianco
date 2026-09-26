/**
 * M11A.2 — Operation persistence + state transitions for write execution.
 */

import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  MetaWriteErrorCategory,
  MetaWriteOperationState,
  MetaWritePreviewResult,
} from "@/lib/meta/write/types";

const PROTECTED_WRITE_STATES = new Set([
  "CONFIRMED",
  "IN_PROGRESS",
  "PARTIALLY_CREATED",
  "COMPLETED",
]);

export function isProtectedMetaWriteState(
  state: string | null | undefined,
): boolean {
  return Boolean(state && PROTECTED_WRITE_STATES.has(state));
}

export type MetaWriteOperationRow = {
  id: string;
  user_id: string;
  client_id: string;
  ally_campaign_id: string;
  operation_type: string;
  payload_fingerprint: string;
  idempotency_key: string;
  state: MetaWriteOperationState;
  safe_payload_summary: Record<string, unknown>;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_creative_id: string | null;
  meta_ad_id: string | null;
  error_category: string | null;
  error_safe_message: string | null;
};

/** Any protected execution/recovery row for this Ally campaign (newest first). */
export async function getProtectedMetaWriteOperation(input: {
  userId: string;
  allyCampaignId: string;
}): Promise<MetaWriteOperationRow | null> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("meta_write_operations")
    .select(
      "id,user_id,client_id,ally_campaign_id,operation_type,payload_fingerprint,idempotency_key,state,safe_payload_summary,meta_campaign_id,meta_adset_id,meta_creative_id,meta_ad_id,error_category,error_safe_message",
    )
    .eq("user_id", input.userId)
    .eq("ally_campaign_id", input.allyCampaignId)
    .eq("operation_type", "CAMPAIGN_ADSET_PAUSED")
    .in("state", ["CONFIRMED", "IN_PROGRESS", "PARTIALLY_CREATED", "COMPLETED"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as MetaWriteOperationRow;
}

export async function logMetaWritePreviewOperation(input: {
  userId: string;
  clientId: string;
  allyCampaignId: string;
  preview: MetaWritePreviewResult;
}): Promise<{ id: string } | { error: string }> {
  const admin = createSupabaseAdmin();

  // 1) Protect any recovery/execution row for this Ally campaign (any idempotency key).
  const protectedOp = await getProtectedMetaWriteOperation({
    userId: input.userId,
    allyCampaignId: input.allyCampaignId,
  });
  if (protectedOp) {
    const { error: updErr } = await admin
      .from("meta_write_operations")
      .update({
        // Refresh fingerprint summary only — never state / Meta IDs.
        safe_payload_summary: {
          ...input.preview.safePayloadSummary,
          preservedWriteState: protectedOp.state,
          meta_campaign_id: protectedOp.meta_campaign_id,
          meta_adset_id: protectedOp.meta_adset_id,
          previewFingerprintObserved: input.preview.fingerprint,
        },
      })
      .eq("id", protectedOp.id);
    if (updErr) return { error: updErr.message };
    return { id: protectedOp.id };
  }

  // 2) Same-key PREVIEWED row (safe to upsert).
  const { data: existing } = await admin
    .from("meta_write_operations")
    .select(
      "id, state, meta_campaign_id, meta_adset_id, meta_creative_id, meta_ad_id",
    )
    .eq("user_id", input.userId)
    .eq("ally_campaign_id", input.allyCampaignId)
    .eq("operation_type", input.preview.operationType)
    .eq("idempotency_key", input.preview.idempotencyKey)
    .maybeSingle();

  if (
    existing &&
    typeof existing.state === "string" &&
    isProtectedMetaWriteState(existing.state)
  ) {
    const { error: updErr } = await admin
      .from("meta_write_operations")
      .update({
        safe_payload_summary: {
          ...input.preview.safePayloadSummary,
          preservedWriteState: existing.state,
          meta_campaign_id: existing.meta_campaign_id,
        },
      })
      .eq("id", existing.id as string);
    if (updErr) return { error: updErr.message };
    return { id: existing.id as string };
  }

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

export async function getMetaWriteOperationByIdempotency(input: {
  userId: string;
  allyCampaignId: string;
  idempotencyKey: string;
}): Promise<MetaWriteOperationRow | null> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("meta_write_operations")
    .select(
      "id,user_id,client_id,ally_campaign_id,operation_type,payload_fingerprint,idempotency_key,state,safe_payload_summary,meta_campaign_id,meta_adset_id,meta_creative_id,meta_ad_id,error_category,error_safe_message",
    )
    .eq("user_id", input.userId)
    .eq("ally_campaign_id", input.allyCampaignId)
    .eq("operation_type", "CAMPAIGN_ADSET_PAUSED")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (error || !data) return null;
  return data as MetaWriteOperationRow;
}

export async function updateMetaWriteOperation(input: {
  id: string;
  patch: {
    state?: MetaWriteOperationState;
    meta_campaign_id?: string | null;
    meta_adset_id?: string | null;
    error_category?: MetaWriteErrorCategory | null;
    error_safe_message?: string | null;
    confirmed_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    safe_payload_summary?: Record<string, unknown>;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("meta_write_operations")
    .update(input.patch)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
