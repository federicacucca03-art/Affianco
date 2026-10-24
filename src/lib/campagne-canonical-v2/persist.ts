/**
 * ADV.1.5.1 — Durable CanonicalCampaignState V2 persistence contract.
 * Writes target campaigns.canonical_state ONLY (never front_end_offer / meta_write_operations).
 * LIVE META WRITES: 0
 *
 * Live QA row writes are gated until separately authorized
 * (isCanonicalV2LiveWriteEnabled → false by default).
 */

import { supabase } from "@/lib/supabase";
import {
  parseCanonicalCampaignStateV2,
  serializeCanonicalCampaignStateV2,
  validateCanonicalCampaignStateV2,
} from "@/lib/campagne-canonical-v2/serialize";
import { legacyProjectionUpdatePayload } from "@/lib/campagne-canonical-v2/legacy-projection";
import type { CanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/types";

export type CanonicalV2PersistResult =
  | { ok: true; updatedAtIso: string }
  | { ok: false; error: string; code?: "GATE_OFF" | "VALIDATION" | "DB" | "ID" };

export type CanonicalV2ReadResult =
  | { ok: true; state: CanonicalCampaignStateV2 | null; source: "canonical_state" | "absent" }
  | { ok: false; error: string };

/** Injected for unit tests — never invents rows. */
export type CanonicalV2DbClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: { canonical_state?: unknown } | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Live durable V2 writes stay OFF until QA data roundtrip is authorized.
 * Preview may read canonical_state; it must not auto-backfill or mutate rows.
 */
export function isCanonicalV2LiveWriteEnabled(
  env?: { ADV_CANONICAL_V2_LIVE_WRITES?: string | undefined },
): boolean {
  const source =
    env ??
    (typeof process !== "undefined"
      ? (process.env as { ADV_CANONICAL_V2_LIVE_WRITES?: string | undefined })
      : {});
  return (source.ADV_CANONICAL_V2_LIVE_WRITES ?? "").trim() === "1";
}

export async function readCanonicalCampaignStateV2(
  campaignId: string,
  client: CanonicalV2DbClient = supabase as unknown as CanonicalV2DbClient,
): Promise<CanonicalV2ReadResult> {
  const id = campaignId?.trim();
  if (!id) return { ok: false, error: "campaignId mancante" };

  const { data, error } = await client
    .from("campaigns")
    .select("canonical_state")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // Column missing on older DBs — treat as absent, not fatal for V1 path.
    if (/canonical_state/i.test(error.message)) {
      return { ok: true, state: null, source: "absent" };
    }
    return { ok: false, error: error.message };
  }

  if (!data || data.canonical_state == null) {
    return { ok: true, state: null, source: "absent" };
  }

  const state =
    typeof data.canonical_state === "string"
      ? parseCanonicalCampaignStateV2(data.canonical_state)
      : validateCanonicalCampaignStateV2(data.canonical_state);

  if (!state) {
    return { ok: false, error: "canonical_state presente ma non valido (schemaVersion≠2)" };
  }
  if (state.campaignId !== id) {
    return {
      ok: false,
      error: "canonical_state.campaignId non corrisponde alla campagna",
    };
  }
  return { ok: true, state, source: "canonical_state" };
}

/**
 * Persist V2 design document. Does NOT touch front_end_offer or meta_write_operations.
 * Optionally mirrors legacy column projections when includeLegacyProjections=true.
 * Gated by isCanonicalV2LiveWriteEnabled unless forceForTest is set (mocked client tests).
 */
export async function persistCanonicalCampaignStateV2(
  input: {
    campaignId: string;
    state: CanonicalCampaignStateV2;
    includeLegacyProjections?: boolean;
    /** Test-only: bypass live-write gate when using a mock client. */
    forceForTest?: boolean;
  },
  client: CanonicalV2DbClient = supabase as unknown as CanonicalV2DbClient,
): Promise<CanonicalV2PersistResult> {
  const id = input.campaignId?.trim();
  if (!id) return { ok: false, error: "campaignId mancante", code: "ID" };
  if (input.state.campaignId !== id) {
    return {
      ok: false,
      error: "state.campaignId deve coincidere con campaignId",
      code: "VALIDATION",
    };
  }
  if (input.state.schemaVersion !== 2) {
    return { ok: false, error: "schemaVersion deve essere 2", code: "VALIDATION" };
  }
  if (!validateCanonicalCampaignStateV2(input.state)) {
    return { ok: false, error: "stato V2 non valido", code: "VALIDATION" };
  }

  if (!input.forceForTest && !isCanonicalV2LiveWriteEnabled()) {
    return {
      ok: false,
      error:
        "Scrittura durable V2 disabilitata (ADV_CANONICAL_V2_LIVE_WRITES≠1). Nessuna riga modificata.",
      code: "GATE_OFF",
    };
  }

  const updatedAtIso = new Date().toISOString();
  const document: CanonicalCampaignStateV2 = {
    ...input.state,
    campaignId: id,
    updatedAtIso,
  };

  // Ensure JSON-serializable document (no functions).
  const canonical_state = JSON.parse(
    serializeCanonicalCampaignStateV2(document),
  ) as CanonicalCampaignStateV2;

  const payload: Record<string, unknown> = {
    canonical_state,
    canonical_state_updated_at: updatedAtIso,
  };

  if (input.includeLegacyProjections) {
    Object.assign(payload, legacyProjectionUpdatePayload(document));
  }

  const { error } = await client.from("campaigns").update(payload).eq("id", id);
  if (error) {
    return { ok: false, error: error.message, code: "DB" };
  }
  return { ok: true, updatedAtIso };
}
