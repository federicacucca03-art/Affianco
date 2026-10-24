/**
 * ADV.1.5.1 — How V2 will refresh legacy campaign columns (compatibility projections).
 * Implemented as pure mappers — no live DB writes in this phase.
 * LIVE META WRITES: 0
 */

import type { CanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/types";
import type { CampagnaObjective } from "@/types/campagne";

/**
 * LEGACY_PROJECTION_STRATEGY:
 * - canonical_state is source of truth for design when present
 * - selected columns stay denormalized for inventory / approval / Easy screens
 * - projections are a subset; they never invent Ad Sets or Meta IDs
 * - front_end_offer is NOT used for V2 JSON
 */
export type LegacyCampaignColumnProjection = {
  name: string | null;
  objective: CampagnaObjective | null;
  daily_budget: number | null;
  citta: string | null;
  eta_min: number | null;
  eta_max: number | null;
  page_id: string | null;
  page_name: string | null;
  form_id: string | null;
  variante_a: string | null;
  titolo_annuncio: string | null;
};

function mapObjective(
  o: CanonicalCampaignStateV2["objective"],
): CampagnaObjective | null {
  if (o === "LEADS") return "LEADS";
  if (o === "AWARENESS") return "AWARENESS";
  if (o === "SALES") return "ECOMMERCE";
  if (o === "TRAFFIC" || o === "ENGAGEMENT" || o === "APP_PROMOTION") {
    // No dedicated legacy enum — leave unchanged at write time (null = skip column).
    return null;
  }
  return null;
}

export function legacyColumnProjectionFromV2(
  state: CanonicalCampaignStateV2,
): LegacyCampaignColumnProjection {
  const primary =
    state.adSets.find((a) => a.role === "PROSPECTING") ?? state.adSets[0];
  const creative = state.creatives[0];
  return {
    name: state.name,
    objective: mapObjective(state.objective),
    daily_budget:
      state.budget.period === "DAILY" ? state.budget.campaignAmountMajor : null,
    citta: primary?.geography.labelIt ?? null,
    eta_min: primary?.age.min ?? null,
    eta_max: primary?.age.max ?? null,
    page_id: state.conversion.pageId,
    page_name: state.conversion.pageName,
    form_id: state.conversion.formId,
    variante_a: creative?.primaryText ?? null,
    titolo_annuncio: creative?.headline ?? null,
  };
}

/**
 * Build a Supabase update payload for compatibility columns.
 * Omits null objective when V2 objective has no legacy mapping (caller merges).
 */
export function legacyProjectionUpdatePayload(
  state: CanonicalCampaignStateV2,
): Record<string, unknown> {
  const p = legacyColumnProjectionFromV2(state);
  const out: Record<string, unknown> = {
    daily_budget: p.daily_budget,
    citta: p.citta,
    eta_min: p.eta_min,
    eta_max: p.eta_max,
    page_id: p.page_id,
    page_name: p.page_name,
    form_id: p.form_id,
    variante_a: p.variante_a,
    titolo_annuncio: p.titolo_annuncio,
  };
  if (p.name != null) out.name = p.name;
  if (p.objective != null) out.objective = p.objective;
  return out;
}
