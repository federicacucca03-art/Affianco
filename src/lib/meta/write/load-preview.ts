/**
 * M11A.1 — Load canonical Ally campaign into Meta write plan input (server).
 * Client may only send campaignId. Never trusts a client Meta payload.
 */

import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getMetaConnectionForClient } from "@/lib/meta/connections";
import { getClientMetaAccount } from "@/lib/meta/client-accounts";
import { isUuid } from "@/lib/meta/ids";
import { MetaError } from "@/lib/meta/errors";
import { buildMetaWritePreview } from "@/lib/meta/write/preview";
import { logMetaWritePreviewOperation } from "@/lib/meta/write/operations";
import type {
  MetaWriteDestinationKind,
  MetaWritePlanInput,
  MetaWritePreviewResult,
} from "@/lib/meta/write/types";
import {
  mapBusinessIntentToMetaArchitecture,
  resolveGuidedDestination,
} from "@/lib/meta/guided-plan/map-intent";

type CampaignRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string | null;
  objective: string | null;
  status: string | null;
  daily_budget: number | string | null;
  page_id: string | null;
  form_id: string | null;
  citta: string | null;
  raggio_km: number | null;
  eta_min: number | null;
  eta_max: number | null;
  booking_channel: string | null;
  target_type: string | null;
  creativita: unknown;
  clients:
    | { id: string; website: string | null }
    | { id: string; website: string | null }[]
    | null;
};

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function creativitaCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.length;
}

function destinationFromCampaign(row: CampaignRow): MetaWriteDestinationKind {
  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const website = clientJoin?.website?.trim() || null;
  const mapped = mapBusinessIntentToMetaArchitecture({
    objective: row.objective,
    bookingChannel: row.booking_channel,
    destinationUrl: website,
    targetType: row.target_type,
  });
  const resolved = resolveGuidedDestination({
    businessIntent: mapped.businessIntent,
    bookingChannel: row.booking_channel,
    destinationUrl: website,
    formId: row.form_id,
    whatsappNumber: null,
    hint: mapped.destinationHint,
    explicitDestination: null,
    bookingChannelUserChosen: false,
  });
  if (resolved.provenance === "MISSING" || resolved.kind === "UNKNOWN") {
    return "UNRESOLVED";
  }
  if (
    resolved.kind === "META_LEAD_FORM" ||
    resolved.kind === "WEBSITE" ||
    resolved.kind === "WHATSAPP" ||
    resolved.kind === "PHONE"
  ) {
    return resolved.kind;
  }
  return "UNRESOLVED";
}

export async function buildWritePreviewForAllyCampaign(input: {
  userId: string;
  allyCampaignId: string;
  specialAdCategories?: MetaWritePlanInput["specialAdCategories"];
  previousFingerprint?: string | null;
  countryCode?: string | null;
  metaGeoKey?: string | null;
  startAtIso?: string | null;
  endAtIso?: string | null;
  persist?: boolean;
}): Promise<MetaWritePreviewResult> {
  if (!isUuid(input.allyCampaignId)) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna non valida.");
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("campaigns")
    .select(
      "id, user_id, client_id, name, objective, status, daily_budget, page_id, form_id, citta, raggio_km, eta_min, eta_max, booking_channel, target_type, creativita, clients(id, website)",
    )
    .eq("id", input.allyCampaignId)
    .maybeSingle();

  if (error) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Lettura campagna non riuscita.",
    );
  }
  const row = data as CampaignRow | null;
  if (!row || row.user_id !== input.userId) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna non trovata.");
  }
  const clientId = row.client_id?.trim() ?? "";
  if (!isUuid(clientId)) {
    throw new MetaError(
      "META_CONNECTION_INVALID",
      "Cliente campagna mancante.",
    );
  }

  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const website = clientJoin?.website?.trim() || null;

  let connection = null;
  let account = null;
  try {
    connection = await getMetaConnectionForClient(input.userId, clientId);
  } catch {
    connection = null;
  }
  try {
    account = await getClientMetaAccount(input.userId, clientId);
  } catch {
    account = null;
  }

  const plan: MetaWritePlanInput = {
    allyCampaignId: row.id,
    clientId,
    campaignName: row.name?.trim() || "Campagna Ally",
    objectiveRaw: row.objective,
    destination: destinationFromCampaign(row),
    destinationUrl: website,
    pageId: row.page_id,
    formId: row.form_id,
    whatsappNumber: null,
    budgetDailyMajor: asNum(row.daily_budget),
    budgetLevel: "AD_SET",
    specialAdCategories: input.specialAdCategories ?? { kind: "UNRESOLVED" },
    citta: row.citta,
    raggioKm: asNum(row.raggio_km),
    countryCode: input.countryCode ?? null,
    metaGeoKey: input.metaGeoKey ?? null,
    etaMin: asNum(row.eta_min),
    etaMax: asNum(row.eta_max),
    placementsAdvantage: true,
    startAtIso: input.startAtIso ?? null,
    endAtIso: input.endAtIso ?? null,
    creativitaCount: creativitaCount(row.creativita),
    targetType: row.target_type,
    isImportedMetaOnly: false,
    grantedScopes: connection?.scopes ?? [],
    hasMetaConnection: Boolean(connection),
    hasAdAccount: Boolean(account?.metaAdAccountId),
    adAccountCurrency: account?.currency ?? "EUR",
    adAccountTimezone: account?.timezoneName ?? null,
    buyingType: "AUCTION",
  };

  const preview = buildMetaWritePreview(plan, {
    userId: input.userId,
    previousFingerprint: input.previousFingerprint ?? null,
  });

  if (input.persist && preview.canPreview) {
    try {
      await logMetaWritePreviewOperation({
        userId: input.userId,
        clientId,
        allyCampaignId: row.id,
        preview,
      });
    } catch {
      // Migration may not be applied yet — preview still returns.
    }
  }

  return preview;
}
