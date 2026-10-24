/**
 * M11A.1/M11A.2F.1 — Load canonical Ally campaign into Meta write plan (server).
 * Client may send campaignId + optional field overrides.
 * Persisted canonical plan is the single source when overrides are omitted.
 * Never trusts a client Meta create payload.
 */

import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getMetaConnectionForClient } from "@/lib/meta/connections";
import { getClientMetaAccount } from "@/lib/meta/client-accounts";
import { isUuid } from "@/lib/meta/ids";
import { MetaError } from "@/lib/meta/errors";
import { isMetaWritesLiveEnabled } from "@/lib/meta/config";
import { isLegacyMetaMutationAllowed } from "@/lib/meta/legacy-write-gate";
import { buildMetaWritePreview } from "@/lib/meta/write/preview";
import { logMetaWritePreviewOperation } from "@/lib/meta/write/operations";
import {
  buildCanonicalPlanFromParts,
  formStateFromCanonical,
  loadPersistedCanonicalPlan,
} from "@/lib/meta/write/canonical-plan";
import { stripImplicitStaleSchedule } from "@/lib/meta/write/schedule";
import type {
  MetaWriteCanonicalPlan,
  MetaWriteDestinationKind,
  MetaWriteFormState,
  MetaWritePlanInput,
  MetaWritePreviewResult,
  MetaWriteSpecialAdCategoriesDecision,
} from "@/lib/meta/write/types";
import {
  mapBusinessIntentToMetaArchitecture,
  resolveGuidedDestination,
} from "@/lib/meta/guided-plan/map-intent";
import { userFacingCampaignText } from "@/lib/campagne-creation-mode";
import type { AllyWebsiteTrackingConfig } from "@/lib/meta/write/tracking";
import { resolvePlanDestinationUrl } from "@/lib/meta/write/destination-tracking";
import { mergeSpecialAdCategoriesDecision } from "@/lib/meta/write/special-ad-categories";

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
  variante_a: string | null;
  variante_b: string | null;
  variante_c: string | null;
  titolo_annuncio: string | null;
  page_name: string | null;
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

export type BuildWritePreviewResult = {
  preview: MetaWritePreviewResult;
  formState: MetaWriteFormState;
  liveWritesEnabled: boolean;
  canonicalPlan: MetaWriteCanonicalPlan;
};

export async function buildWritePreviewForAllyCampaign(input: {
  userId: string;
  allyCampaignId: string;
  specialAdCategories?: MetaWriteSpecialAdCategoriesDecision;
  previousFingerprint?: string | null;
  countryCode?: string | null;
  metaGeoKey?: string | null;
  geoLabel?: string | null;
  startAtIso?: string | null;
  endAtIso?: string | null;
  destinationOverride?: MetaWriteDestinationKind | null;
  /** Easy Builder confirmed objective (e.g. OUTCOME_LEADS) — must not be lost before DB persist. */
  objectiveRawOverride?: string | null;
  pageIdOverride?: string | null;
  formIdOverride?: string | null;
  formPrivacyPolicyUrlOverride?: string | null;
  websiteTrackingOverride?: AllyWebsiteTrackingConfig | null;
  instantFormRelationOverride?: "VERIFIED" | "MISMATCH" | "UNCHECKED" | null;
  instantFormNameOverride?: string | null;
  pageNameOverride?: string | null;
  destinationTrackingModeOverride?: "NONE" | "AUTO_UTM" | "CUSTOM" | null;
  instagramUserIdOverride?: string | null;
  preferPageOnlyOverride?: boolean | null;
  instagramDiscoveryOverride?: MetaWritePlanInput["instagramDiscovery"];
  /** When true, omit client field soup — load persisted canonical plan. */
  hydrateFromCanonical?: boolean;
  persist?: boolean;
}): Promise<MetaWritePreviewResult> {
  const full = await buildWritePreviewBundle(input);
  return full.preview;
}

export async function buildWritePreviewBundle(input: {
  userId: string;
  allyCampaignId: string;
  specialAdCategories?: MetaWriteSpecialAdCategoriesDecision;
  previousFingerprint?: string | null;
  countryCode?: string | null;
  metaGeoKey?: string | null;
  geoLabel?: string | null;
  startAtIso?: string | null;
  endAtIso?: string | null;
  destinationOverride?: MetaWriteDestinationKind | null;
  /** Easy Builder confirmed objective (e.g. OUTCOME_LEADS) — must not be lost before DB persist. */
  objectiveRawOverride?: string | null;
  pageIdOverride?: string | null;
  formIdOverride?: string | null;
  formPrivacyPolicyUrlOverride?: string | null;
  websiteTrackingOverride?: AllyWebsiteTrackingConfig | null;
  instantFormRelationOverride?: "VERIFIED" | "MISMATCH" | "UNCHECKED" | null;
  instantFormNameOverride?: string | null;
  pageNameOverride?: string | null;
  destinationTrackingModeOverride?: "NONE" | "AUTO_UTM" | "CUSTOM" | null;
  instagramUserIdOverride?: string | null;
  preferPageOnlyOverride?: boolean | null;
  instagramDiscoveryOverride?: MetaWritePlanInput["instagramDiscovery"];
  hydrateFromCanonical?: boolean;
  persist?: boolean;
}): Promise<BuildWritePreviewResult> {
  if (!isUuid(input.allyCampaignId)) {
    throw new MetaError("META_CONNECTION_INVALID", "Campagna non valida.");
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("campaigns")
    .select(
      "id, user_id, client_id, name, objective, status, daily_budget, page_id, form_id, citta, raggio_km, eta_min, eta_max, booking_channel, target_type, creativita, variante_a, variante_b, variante_c, titolo_annuncio, page_name, clients(id, website)",
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

  const { data: linkedRow } = await admin
    .from("meta_campaigns")
    .select("meta_campaign_id")
    .eq("user_id", input.userId)
    .eq("affianco_campaign_id", row.id)
    .limit(1)
    .maybeSingle();
  const existingMetaCampaignId =
    typeof linkedRow?.meta_campaign_id === "string"
      ? linkedRow.meta_campaign_id.trim()
      : null;

  // Recovery / completed write rows for this Ally campaign.
  const { data: writeOp } = await admin
    .from("meta_write_operations")
    .select("id, state, meta_campaign_id, meta_adset_id")
    .eq("user_id", input.userId)
    .eq("ally_campaign_id", row.id)
    .in("state", ["PARTIALLY_CREATED", "COMPLETED"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const writeHierarchyCompleted = Boolean(
    writeOp?.state === "COMPLETED" &&
      writeOp.meta_campaign_id &&
      writeOp.meta_adset_id,
  );
  const partialHierarchyBlock =
    !writeHierarchyCompleted &&
    Boolean(
      writeOp?.state === "PARTIALLY_CREATED" &&
        writeOp.meta_campaign_id &&
        !writeOp.meta_adset_id,
    );
  // Prefer inventory link; fall back to completed/partial write op campaign id.
  const existingMetaCampaignIdResolved =
    existingMetaCampaignId ||
    (typeof writeOp?.meta_campaign_id === "string"
      ? writeOp.meta_campaign_id.trim()
      : null);

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

  let persisted = await loadPersistedCanonicalPlan({
    userId: input.userId,
    allyCampaignId: row.id,
  });
  if (persisted) {
    const stripped = stripImplicitStaleSchedule({
      startAtIso: persisted.startAtIso,
      endAtIso: persisted.endAtIso,
    });
    if (stripped.clearedStale) {
      persisted = {
        ...persisted,
        startAtIso: stripped.startAtIso,
        endAtIso: stripped.endAtIso,
      };
    }
  }

  const hydrate = input.hydrateFromCanonical === true;

  // UNRESOLVED incoming = not provided — never wipe persisted NONE/CATEGORIES.
  const specialAdCategories: MetaWriteSpecialAdCategoriesDecision =
    mergeSpecialAdCategoriesDecision({
      hydrate,
      incoming: input.specialAdCategories ?? null,
      persisted: persisted?.specialAdCategories ?? null,
    });

  const destinationOverride =
    !hydrate &&
    input.destinationOverride &&
    input.destinationOverride !== "UNRESOLVED" &&
    input.destinationOverride !== "UNKNOWN"
      ? input.destinationOverride
      : null;

  const destination: MetaWriteDestinationKind = hydrate
    ? (persisted?.destination &&
      persisted.destination !== "UNRESOLVED" &&
      persisted.destination !== "UNKNOWN"
        ? persisted.destination
        : destinationFromCampaign(row))
    : destinationOverride
      ? destinationOverride
      : persisted?.destination &&
          persisted.destination !== "UNRESOLVED" &&
          persisted.destination !== "UNKNOWN"
        ? persisted.destination
        : destinationFromCampaign(row);

  const countryCode = hydrate
    ? (persisted?.countryCode ?? input.countryCode ?? null)
    : (input.countryCode ?? persisted?.countryCode ?? null);

  const metaGeoKey = hydrate
    ? (persisted?.metaGeoKey ?? input.metaGeoKey ?? null)
    : (input.metaGeoKey ?? persisted?.metaGeoKey ?? null);

  const geoLabel = hydrate
    ? (persisted?.geoLabel ?? input.geoLabel ?? null)
    : (input.geoLabel ?? persisted?.geoLabel ?? null);

  const startAtIso = hydrate
    ? (persisted?.startAtIso ?? input.startAtIso ?? null)
    : input.startAtIso !== undefined
      ? input.startAtIso
      : (persisted?.startAtIso ?? null);

  const endAtIso = hydrate
    ? (persisted?.endAtIso ?? input.endAtIso ?? null)
    : input.endAtIso !== undefined
      ? input.endAtIso
      : (persisted?.endAtIso ?? null);

  // Empty-string overrides mean "not provided" — never wipe persisted page/form.
  const pageOverride = input.pageIdOverride?.trim() || null;
  const formOverride = input.formIdOverride?.trim() || null;

  const pageId = hydrate
    ? (persisted?.pageId ?? pageOverride ?? row.page_id)
    : (pageOverride || persisted?.pageId || row.page_id);

  const formId = hydrate
    ? (persisted?.formId ?? formOverride ?? row.form_id)
    : (formOverride || persisted?.formId || row.form_id);

  const formPrivacyOverride =
    input.formPrivacyPolicyUrlOverride?.trim() || null;
  const formPrivacyPolicyUrl = hydrate
    ? (formPrivacyOverride ?? persisted?.formPrivacyPolicyUrl ?? null)
    : (formPrivacyOverride || persisted?.formPrivacyPolicyUrl || null);

  const trackingOverride =
    !hydrate && input.websiteTrackingOverride !== undefined
      ? input.websiteTrackingOverride
      : undefined;
  const websiteTracking: AllyWebsiteTrackingConfig | null = hydrate
    ? (persisted?.websiteTracking ?? null)
    : trackingOverride !== undefined
      ? trackingOverride
      : (persisted?.websiteTracking ?? null);

  const objectiveOverride =
    !hydrate && typeof input.objectiveRawOverride === "string"
      ? input.objectiveRawOverride.trim()
      : "";
  const planDestinationUrl = resolvePlanDestinationUrl({
    destination,
    clientWebsite: website,
  });
  const plan: MetaWritePlanInput = {
    allyCampaignId: row.id,
    clientId,
    campaignName: row.name?.trim() || "Campagna Ally",
    // Easy draft selection wins over stale/empty DB objective so review stays consistent.
    objectiveRaw: objectiveOverride || row.objective,
    destination,
    // Instant Form: never inherit clients.website as creative destination URL.
    destinationUrl: planDestinationUrl,
    pageId,
    formId,
    formPrivacyPolicyUrl,
    whatsappNumber: null,
    budgetDailyMajor: asNum(row.daily_budget),
    budgetLevel: "AD_SET",
    specialAdCategories,
    citta: row.citta,
    raggioKm: asNum(row.raggio_km),
    countryCode,
    metaGeoKey,
    geoLabel,
    placementsAdvantage: true,
    startAtIso,
    endAtIso,
    creativitaCount: creativitaCount(row.creativita),
    targetType: row.target_type,
    isImportedMetaOnly: false,
    existingMetaCampaignId: existingMetaCampaignIdResolved,
    partialHierarchyPending: partialHierarchyBlock,
    writeHierarchyCompleted,
    grantedScopes: connection?.scopes ?? [],
    hasMetaConnection: Boolean(connection),
    hasAdAccount: Boolean(account?.metaAdAccountId),
    metaAdAccountId: account?.metaAdAccountId ?? null,
    adAccountCurrency: account?.currency ?? "EUR",
    adAccountTimezone: account?.timezoneName ?? null,
    buyingType: "AUCTION",
    // Explicit audience decision in canonical write config (not a hidden QA override).
    allyAudienceMode:
      persisted?.allyAudienceMode === "MANUAL_AUDIENCE" ||
      persisted?.allyAudienceMode === "UNRESOLVED" ||
      persisted?.allyAudienceMode === "ADVANTAGE_AUDIENCE"
        ? persisted.allyAudienceMode
        : "ADVANTAGE_AUDIENCE",
    // Always pass Ally persisted ages. Advantage+ mapping (hard min / suggestion /
    // omit hard max) happens in resolveWriteAgeFields — never silently widen here.
    etaMin: asNum(row.eta_min),
    etaMax: asNum(row.eta_max),
    websiteTracking,
    instantFormRelation: hydrate
      ? "UNCHECKED"
      : (input.instantFormRelationOverride ?? "UNCHECKED"),
    instantFormName: hydrate
      ? null
      : (input.instantFormNameOverride ?? null),
    pageName:
      (!hydrate && input.pageNameOverride?.trim()) ||
      row.page_name?.trim() ||
      null,
    destinationTrackingMode: hydrate
      ? (persisted?.destinationTrackingMode ?? null)
      : input.destinationTrackingModeOverride !== undefined
        ? input.destinationTrackingModeOverride
        : (persisted?.destinationTrackingMode ?? null),
    utmSource: persisted?.utmSource ?? null,
    utmMedium: persisted?.utmMedium ?? null,
    utmCampaign: persisted?.utmCampaign ?? null,
    utmContent: persisted?.utmContent ?? null,
    utmTerm: persisted?.utmTerm ?? null,
    instagramUserId: hydrate
      ? (persisted?.instagramUserId ?? null)
      : input.instagramUserIdOverride !== undefined
        ? input.instagramUserIdOverride
        : (persisted?.instagramUserId ?? null),
    preferPageOnly: hydrate
      ? (persisted?.preferPageOnly ?? null)
      : input.preferPageOnlyOverride !== undefined
        ? input.preferPageOnlyOverride
        : (persisted?.preferPageOnly ?? null),
    instagramDiscovery: hydrate
      ? null
      : (input.instagramDiscoveryOverride ?? null),
  };

  const canonicalPlan = buildCanonicalPlanFromParts({
    specialAdCategories,
    destination,
    countryCode,
    metaGeoKey,
    geoLabel,
    startAtIso,
    endAtIso,
    pageId,
    formId,
    formPrivacyPolicyUrl,
    allyAudienceMode: plan.allyAudienceMode ?? "ADVANTAGE_AUDIENCE",
    websiteTracking,
    destinationTrackingMode: plan.destinationTrackingMode ?? null,
    utmSource: plan.utmSource ?? null,
    utmMedium: plan.utmMedium ?? null,
    utmCampaign: plan.utmCampaign ?? null,
    utmContent: plan.utmContent ?? null,
    utmTerm: plan.utmTerm ?? null,
    instagramUserId: plan.instagramUserId ?? null,
    preferPageOnly: plan.preferPageOnly ?? null,
  });

  // Never map Ally machine markers / canon JSON into Meta creative copy.
  const preview = buildMetaWritePreview(plan, {
    userId: input.userId,
    previousFingerprint: input.previousFingerprint ?? null,
    canonicalPlan,
    creativeIntent: {
      varianteA: userFacingCampaignText(row.variante_a),
      varianteB: userFacingCampaignText(row.variante_b),
      varianteC: userFacingCampaignText(row.variante_c),
      titoloAnnuncio: userFacingCampaignText(row.titolo_annuncio),
      creativitaRaw: row.creativita,
      pageName: plan.pageName,
      formName: plan.instantFormName,
    },
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

  const formState = formStateFromCanonical(canonicalPlan, {
    timezoneName: account?.timezoneName ?? null,
    accountLabel: account?.metaAdAccountName ?? null,
    adAccountId: account?.metaAdAccountId ?? null,
    destinationUrl: planDestinationUrl,
    campaignPageId: row.page_id,
    clientId,
  });

  return {
    preview,
    formState,
    // ADV.2.4.0.3 — UI must not imply live writes when Preview secondary gate is off.
    liveWritesEnabled:
      isMetaWritesLiveEnabled() && isLegacyMetaMutationAllowed(),
    canonicalPlan,
  };
}
