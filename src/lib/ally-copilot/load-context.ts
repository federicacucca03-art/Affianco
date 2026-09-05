/**
 * M9.2A — server loader for Ask Ally context.
 * Ownership via diagnosis loaders. Full native planning + Launch Readiness inventory.
 */

import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isUuid } from "@/lib/meta/ids";
import {
  DiagnosisLoadError,
  loadDiagnosisBundle,
} from "@/lib/campaign-diagnosis/load-context";
import type { DiagnosisSource } from "@/lib/campaign-diagnosis/types";
import { resolveNextAction } from "@/lib/campaign-next-action";
import {
  buildAllyCampaignCopilotContext,
  assertAllyCopilotPayloadSafe,
  type AllyCopilotIdentityInput,
} from "@/lib/ally-copilot/build-context";
import type { AllyCampaignCopilotContext } from "@/lib/ally-copilot/types";
import type { AllyCopilotNativePlanningSnapshot } from "@/lib/ally-copilot/configuration-inventory";

function admin() {
  try {
    return createSupabaseAdmin();
  } catch {
    throw new DiagnosisLoadError(
      "CONFIG",
      "Persistenza server non configurata.",
    );
  }
}

function textList(...vals: (string | null | undefined)[]): string[] {
  return vals
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasCreativeFromJson(raw: unknown): boolean {
  if (!raw) return false;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.some((item) => {
    if (!item || typeof item !== "object") return false;
    const o = item as { storagePath?: unknown; url?: unknown; width?: unknown };
    return Boolean(o.storagePath || o.url || o.width);
  });
}

function formatHintFromJson(raw: unknown): string | null {
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as { width?: unknown; height?: unknown };
    const w = typeof o.width === "number" ? o.width : null;
    const h = typeof o.height === "number" ? o.height : null;
    if (w && h) return `${w}×${h}`;
  }
  return null;
}

type NativeRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  max_sustainable_cpa: number | null;
  target_margin: number | null;
  front_end_offer: string | null;
  settore: string | null;
  citta: string | null;
  raggio_km: number | null;
  awareness_radius_km: number | null;
  eta_min: number | null;
  eta_max: number | null;
  target_type: string | null;
  target_age: string | null;
  titolo_annuncio: string | null;
  variante_a: string | null;
  variante_b: string | null;
  variante_c: string | null;
  page_id: string | null;
  form_id: string | null;
  booking_channel: string | null;
  approved_at: string | null;
  creativita: unknown;
  clients:
    | { name: string; website?: string | null }
    | { name: string; website?: string | null }[]
    | null;
};

function snapshotFromNativeRow(row: NativeRow): {
  clientName: string;
  campaignName: string;
  snapshot: AllyCopilotNativePlanningSnapshot;
} {
  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const clientName = clientJoin?.name?.trim() || "Cliente";
  const copyVariants = textList(row.variante_a, row.variante_b, row.variante_c);
  return {
    clientName,
    campaignName: row.name?.trim() || "Campagna",
    snapshot: {
      objective: row.objective,
      clientName,
      settore: row.settore?.trim() || null,
      citta: row.citta?.trim() || null,
      offer: row.front_end_offer?.trim() || null,
      dailyBudget: numOrNull(row.daily_budget),
      maxSustainableCpa: numOrNull(row.max_sustainable_cpa),
      targetMargin: numOrNull(row.target_margin),
      etaMin: numOrNull(row.eta_min),
      etaMax: numOrNull(row.eta_max),
      raggioKm: numOrNull(row.raggio_km) ?? numOrNull(row.awareness_radius_km),
      targetType: row.target_type?.trim() || null,
      targetAge: row.target_age?.trim() || null,
      headline: row.titolo_annuncio?.trim() || null,
      copyVariants,
      hasCreativeAsset: hasCreativeFromJson(row.creativita),
      creativeFormatHint: formatHintFromJson(row.creativita),
      pageId: row.page_id?.trim() || null,
      formId: row.form_id?.trim() || null,
      website: clientJoin?.website?.trim() || null,
      bookingChannel: row.booking_channel?.trim() || null,
      status: row.status,
      approvedAt: row.approved_at,
    },
  };
}

const NATIVE_SELECT =
  "id, user_id, name, objective, status, daily_budget, max_sustainable_cpa, target_margin, front_end_offer, settore, citta, raggio_km, awareness_radius_km, eta_min, eta_max, target_type, target_age, titolo_annuncio, variante_a, variante_b, variante_c, page_id, form_id, booking_channel, approved_at, creativita, clients(name, website)";

async function loadNativePlanning(
  userId: string,
  campaignId: string,
): Promise<{
  clientName: string;
  campaignName: string;
  snapshot: AllyCopilotNativePlanningSnapshot;
  configurationKind: string | null;
}> {
  const { data, error } = await admin()
    .from("campaigns")
    .select(NATIVE_SELECT)
    .eq("id", campaignId)
    .maybeSingle();
  if (error) {
    throw new DiagnosisLoadError("CONFIG", "Lettura campagna non riuscita.");
  }
  const row = data as NativeRow | null;
  if (!row) throw new DiagnosisLoadError("NOT_FOUND", "Campagna non trovata.");
  if (row.user_id !== userId) {
    throw new DiagnosisLoadError("FORBIDDEN", "Campagna non autorizzata.");
  }
  const mapped = snapshotFromNativeRow(row);
  const status = (row.status ?? "").toUpperCase();
  const configurationKind =
    status === "DRAFT" || !status
      ? "DRAFT"
      : status === "REVISION_REQUESTED"
        ? "REVISION"
        : null;
  return { ...mapped, configurationKind };
}

async function loadMetaShell(
  userId: string,
  metaCampaignUuid: string,
): Promise<{
  clientName: string;
  campaignName: string;
  linkedNativeId: string | null;
  snapshot: AllyCopilotNativePlanningSnapshot | null;
}> {
  const { data, error } = await admin()
    .from("meta_campaigns")
    .select("id, user_id, name, affianco_campaign_id, clients(name, website)")
    .eq("id", metaCampaignUuid)
    .maybeSingle();
  if (error) {
    throw new DiagnosisLoadError("CONFIG", "Lettura Meta non riuscita.");
  }
  const row = data as {
    id: string;
    user_id: string | null;
    name: string | null;
    affianco_campaign_id: string | null;
    clients:
      | { name: string; website?: string | null }
      | { name: string; website?: string | null }[]
      | null;
  } | null;
  if (!row) throw new DiagnosisLoadError("NOT_FOUND", "Campagna Meta non trovata.");
  if (row.user_id !== userId) {
    throw new DiagnosisLoadError("FORBIDDEN", "Campagna Meta non autorizzata.");
  }
  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  let snapshot: AllyCopilotNativePlanningSnapshot | null = null;
  if (row.affianco_campaign_id && isUuid(row.affianco_campaign_id)) {
    try {
      const native = await loadNativePlanning(userId, row.affianco_campaign_id);
      snapshot = native.snapshot;
    } catch {
      snapshot = null;
    }
  }
  return {
    clientName: clientJoin?.name?.trim() || "Cliente",
    campaignName: row.name?.trim() || "Campagna Meta",
    linkedNativeId: row.affianco_campaign_id,
    snapshot,
  };
}

export async function loadAllyCampaignCopilotContext(
  userId: string,
  source: DiagnosisSource,
  campaignId: string,
): Promise<AllyCampaignCopilotContext> {
  if (!isUuid(campaignId)) {
    throw new DiagnosisLoadError("BAD_REQUEST", "campaignId non valido.");
  }

  const bundle = await loadDiagnosisBundle(userId, source, campaignId);
  const payload = bundle.aiPayload;

  let identityBase: AllyCopilotIdentityInput;
  if (source === "NATIVE") {
    const native = await loadNativePlanning(userId, campaignId);
    const next = resolveNextAction({
      campaignId,
      source: "NATIVE",
      campaignStatus: payload.status,
      attentionState: payload.attentionState,
      health: payload.health,
      trend: payload.trend,
      healthAvailability: bundle.healthAvailability,
      configurationKind:
        native.configurationKind === "DRAFT"
          ? "DRAFT"
          : payload.attentionState === "CONFIGURATION_REQUIRED"
            ? "OTHER"
            : null,
      resultsCount: payload.metrics.results,
      rowHref: `/campagne/${campaignId}`,
      diagnosis: null,
    });
    identityBase = {
      campaignId,
      source: "NATIVE",
      clientName: native.clientName,
      campaignName: native.campaignName,
      href: `/campagne/${campaignId}`,
      linkedNativeId: null,
      planningSnapshot: native.snapshot,
      configurationKind:
        native.configurationKind === "DRAFT"
          ? "DRAFT"
          : native.configurationKind === "REVISION"
            ? "REVISION_REQUESTED"
            : payload.attentionState === "CONFIGURATION_REQUIRED"
              ? "OTHER"
              : null,
      nextActionType: next.actionType,
      nextActionTitle: next.title,
      nextActionHref: next.ctaHref,
    };
  } else {
    const meta = await loadMetaShell(userId, campaignId);
    const linked = Boolean(meta.linkedNativeId);
    const next = resolveNextAction({
      campaignId,
      source: "META",
      campaignStatus: payload.status,
      attentionState: payload.attentionState,
      health: payload.health,
      trend: payload.trend,
      healthAvailability: bundle.healthAvailability,
      configurationKind:
        payload.attentionState === "CONFIGURATION_REQUIRED"
          ? payload.targetValue == null
            ? "ACTIVE_MISSING_TARGET"
            : "OTHER"
          : null,
      resultsCount: payload.metrics.results,
      rowHref: "/risultati",
      diagnosis: null,
    });
    identityBase = {
      campaignId,
      source: linked ? "LINKED" : "META",
      clientName: meta.clientName,
      campaignName: meta.campaignName,
      href: "/risultati",
      linkedNativeId: meta.linkedNativeId,
      planningSnapshot: meta.snapshot,
      configurationKind:
        payload.attentionState === "CONFIGURATION_REQUIRED"
          ? payload.targetValue == null
            ? "ACTIVE_MISSING_TARGET"
            : "OTHER"
          : null,
      nextActionType: next.actionType,
      nextActionTitle: next.title,
      nextActionHref: next.ctaHref,
    };
  }

  const context = buildAllyCampaignCopilotContext({
    identity: identityBase,
    payload,
  });
  assertAllyCopilotPayloadSafe(context);
  return context;
}

export { DiagnosisLoadError };
