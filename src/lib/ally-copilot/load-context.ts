/**
 * M9.2 — server loader for Ask Ally context.
 * Ownership via diagnosis loaders. Enriches identity/planning safely.
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

async function loadNativeIdentity(
  userId: string,
  campaignId: string,
): Promise<Omit<AllyCopilotIdentityInput, "nextActionType" | "nextActionTitle" | "nextActionHref" | "configurationKind"> & {
  configurationKind: string | null;
  status: string | null;
  attentionHints: {
    attentionState: string;
    urgencyLevel: string;
    health: string | null;
    trend: string;
    resultsCount: number | null;
  };
}> {
  const { data, error } = await admin()
    .from("campaigns")
    .select(
      "id, user_id, name, status, citta, titolo_annuncio, variante_a, variante_b, variante_c, clients(name)",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) {
    throw new DiagnosisLoadError("CONFIG", "Lettura campagna non riuscita.");
  }
  const row = data as {
    id: string;
    user_id: string | null;
    name: string | null;
    status: string | null;
    citta: string | null;
    titolo_annuncio: string | null;
    variante_a: string | null;
    variante_b: string | null;
    variante_c: string | null;
    clients: { name: string } | { name: string }[] | null;
  } | null;
  if (!row) throw new DiagnosisLoadError("NOT_FOUND", "Campagna non trovata.");
  if (row.user_id !== userId) {
    throw new DiagnosisLoadError("FORBIDDEN", "Campagna non autorizzata.");
  }
  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const status = (row.status ?? "").toUpperCase();
  const configurationKind =
    status === "DRAFT" || !status
      ? "DRAFT"
      : status === "REVISION_REQUESTED"
        ? "REVISION"
        : null;

  return {
    campaignId: row.id,
    source: "NATIVE",
    clientName: clientJoin?.name?.trim() || "Cliente",
    campaignName: row.name?.trim() || "Campagna",
    href: `/campagne/${row.id}`,
    linkedNativeId: null,
    citta: row.citta?.trim() || null,
    copyVariants: textList(row.variante_a, row.variante_b, row.variante_c),
    headline: row.titolo_annuncio?.trim() || null,
    configurationKind,
    status: row.status,
    attentionHints: {
      attentionState: "CONFIGURATION_REQUIRED",
      urgencyLevel: "NONE",
      health: null,
      trend: "INSUFFICIENT",
      resultsCount: null,
    },
  };
}

async function loadMetaIdentity(
  userId: string,
  metaCampaignUuid: string,
): Promise<{
  clientName: string;
  campaignName: string;
  linkedNativeId: string | null;
  citta: string | null;
  copyVariants: string[];
  headline: string | null;
}> {
  const { data, error } = await admin()
    .from("meta_campaigns")
    .select("id, user_id, name, affianco_campaign_id, clients(name)")
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
    clients: { name: string } | { name: string }[] | null;
  } | null;
  if (!row) throw new DiagnosisLoadError("NOT_FOUND", "Campagna Meta non trovata.");
  if (row.user_id !== userId) {
    throw new DiagnosisLoadError("FORBIDDEN", "Campagna Meta non autorizzata.");
  }
  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  let citta: string | null = null;
  let copyVariants: string[] = [];
  let headline: string | null = null;
  if (row.affianco_campaign_id && isUuid(row.affianco_campaign_id)) {
    const { data: native } = await admin()
      .from("campaigns")
      .select("user_id, citta, titolo_annuncio, variante_a, variante_b, variante_c")
      .eq("id", row.affianco_campaign_id)
      .maybeSingle();
    const n = native as {
      user_id: string | null;
      citta: string | null;
      titolo_annuncio: string | null;
      variante_a: string | null;
      variante_b: string | null;
      variante_c: string | null;
    } | null;
    if (n && n.user_id === userId) {
      citta = n.citta?.trim() || null;
      copyVariants = textList(n.variante_a, n.variante_b, n.variante_c);
      headline = n.titolo_annuncio?.trim() || null;
    }
  }
  return {
    clientName: clientJoin?.name?.trim() || "Cliente",
    campaignName: row.name?.trim() || "Campagna Meta",
    linkedNativeId: row.affianco_campaign_id,
    citta,
    copyVariants,
    headline,
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
    const native = await loadNativeIdentity(userId, campaignId);
    const next = resolveNextAction({
      campaignId,
      source: "NATIVE",
      campaignStatus: payload.status,
      attentionState: payload.attentionState,
      health: payload.health,
      trend: payload.trend,
      healthAvailability: bundle.healthAvailability,
      configurationKind:
        (native.configurationKind === "DRAFT" ? "DRAFT" : null) ??
        (payload.attentionState === "CONFIGURATION_REQUIRED" ? "OTHER" : null),
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
      citta: native.citta,
      copyVariants: native.copyVariants,
      headline: native.headline,
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
    const meta = await loadMetaIdentity(userId, campaignId);
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
      citta: meta.citta,
      copyVariants: meta.copyVariants,
      headline: meta.headline,
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
