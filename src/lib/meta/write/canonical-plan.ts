/**
 * M11A.2F.1 — Canonical write-plan persistence (server).
 * Preview + confirm + human form hydrate from the same stored plan.
 * No Graph writes.
 */

import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  MetaWriteCanonicalPlan,
  MetaWriteDestinationKind,
  MetaWriteFormState,
  MetaWriteSpecialAdCategoriesDecision,
} from "@/lib/meta/write/types";
import {
  parseAllyWebsiteTrackingConfig,
  type AllyWebsiteTrackingConfig,
} from "@/lib/meta/write/tracking";
import type { DestinationTrackingMode } from "@/lib/meta/write/destination-tracking";

export type { MetaWriteCanonicalPlan, MetaWriteFormState };

function asDest(v: unknown): MetaWriteDestinationKind | null {
  if (
    v === "META_LEAD_FORM" ||
    v === "WEBSITE" ||
    v === "WHATSAPP" ||
    v === "PHONE" ||
    v === "UNRESOLVED" ||
    v === "UNKNOWN"
  ) {
    return v;
  }
  return null;
}

function asSac(v: unknown): MetaWriteSpecialAdCategoriesDecision | null {
  if (!v || typeof v !== "object") return null;
  const kind = (v as { kind?: unknown }).kind;
  if (kind === "NONE") return { kind: "NONE" };
  if (kind === "UNRESOLVED") return { kind: "UNRESOLVED" };
  if (kind === "CATEGORIES") {
    const cats = (v as { categories?: unknown }).categories;
    if (Array.isArray(cats) && cats.every((c) => typeof c === "string")) {
      return { kind: "CATEGORIES", categories: cats.map(String) };
    }
  }
  return null;
}

export function parseCanonicalPlan(raw: unknown): MetaWriteCanonicalPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sac = asSac(o.specialAdCategories);
  const destination = asDest(o.destination);
  if (!sac || !destination) return null;
  const websiteTracking = parseAllyWebsiteTrackingConfig(o.websiteTracking);
  return {
    specialAdCategories: sac,
    destination,
    countryCode:
      typeof o.countryCode === "string" && o.countryCode.trim()
        ? o.countryCode.trim()
        : null,
    metaGeoKey:
      typeof o.metaGeoKey === "string" && o.metaGeoKey.trim()
        ? o.metaGeoKey.trim()
        : null,
    geoLabel:
      typeof o.geoLabel === "string" && o.geoLabel.trim()
        ? o.geoLabel.trim()
        : null,
    startAtIso:
      typeof o.startAtIso === "string" && o.startAtIso.trim()
        ? o.startAtIso.trim()
        : null,
    endAtIso:
      typeof o.endAtIso === "string" && o.endAtIso.trim()
        ? o.endAtIso.trim()
        : null,
    pageId:
      typeof o.pageId === "string" && o.pageId.trim() ? o.pageId.trim() : null,
    formId:
      typeof o.formId === "string" && o.formId.trim() ? o.formId.trim() : null,
    formPrivacyPolicyUrl:
      typeof o.formPrivacyPolicyUrl === "string" && o.formPrivacyPolicyUrl.trim()
        ? o.formPrivacyPolicyUrl.trim()
        : null,
    allyAudienceMode:
      o.allyAudienceMode === "ADVANTAGE_AUDIENCE" ||
      o.allyAudienceMode === "MANUAL_AUDIENCE" ||
      o.allyAudienceMode === "UNRESOLVED"
        ? o.allyAudienceMode
        : null,
    // Legacy plans omit tracking — null is valid (not a parse failure).
    websiteTracking: websiteTracking ?? null,
    destinationTrackingMode:
      o.destinationTrackingMode === "NONE" ||
      o.destinationTrackingMode === "AUTO_UTM" ||
      o.destinationTrackingMode === "CUSTOM"
        ? (o.destinationTrackingMode as DestinationTrackingMode)
        : null,
    utmSource:
      typeof o.utmSource === "string" && o.utmSource.trim()
        ? o.utmSource.trim()
        : null,
    utmMedium:
      typeof o.utmMedium === "string" && o.utmMedium.trim()
        ? o.utmMedium.trim()
        : null,
    utmCampaign:
      typeof o.utmCampaign === "string" && o.utmCampaign.trim()
        ? o.utmCampaign.trim()
        : null,
    utmContent:
      typeof o.utmContent === "string" && o.utmContent.trim()
        ? o.utmContent.trim()
        : null,
    utmTerm:
      typeof o.utmTerm === "string" && o.utmTerm.trim()
        ? o.utmTerm.trim()
        : null,
    instagramUserId:
      typeof o.instagramUserId === "string" && o.instagramUserId.trim()
        ? o.instagramUserId.trim()
        : null,
    preferPageOnly:
      typeof o.preferPageOnly === "boolean" ? o.preferPageOnly : null,
  };
}

export function buildCanonicalPlanFromParts(input: {
  specialAdCategories: MetaWriteSpecialAdCategoriesDecision;
  destination: MetaWriteDestinationKind;
  countryCode: string | null;
  metaGeoKey: string | null;
  geoLabel: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  pageId: string | null;
  formId: string | null;
  formPrivacyPolicyUrl?: string | null;
  allyAudienceMode?:
    | "ADVANTAGE_AUDIENCE"
    | "MANUAL_AUDIENCE"
    | "UNRESOLVED"
    | null;
  websiteTracking?: AllyWebsiteTrackingConfig | null;
  destinationTrackingMode?: DestinationTrackingMode | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  instagramUserId?: string | null;
  preferPageOnly?: boolean | null;
}): MetaWriteCanonicalPlan {
  return {
    specialAdCategories: input.specialAdCategories,
    destination: input.destination,
    countryCode: input.countryCode,
    metaGeoKey: input.metaGeoKey,
    geoLabel: input.geoLabel,
    startAtIso: input.startAtIso,
    endAtIso: input.endAtIso,
    pageId: input.pageId,
    formId: input.formId,
    formPrivacyPolicyUrl: input.formPrivacyPolicyUrl ?? null,
    allyAudienceMode: input.allyAudienceMode ?? null,
    websiteTracking: input.websiteTracking ?? null,
    destinationTrackingMode: input.destinationTrackingMode ?? null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    utmContent: input.utmContent ?? null,
    utmTerm: input.utmTerm ?? null,
    instagramUserId: input.instagramUserId ?? null,
    preferPageOnly: input.preferPageOnly ?? null,
  };
}

export function formStateFromCanonical(
  plan: MetaWriteCanonicalPlan | null,
  meta: {
    timezoneName: string | null;
    accountLabel: string | null;
    adAccountId: string | null;
    destinationUrl?: string | null;
    /** campaigns.page_id when canonical pageId is absent. */
    campaignPageId?: string | null;
    clientId?: string | null;
  },
): MetaWriteFormState {
  const sac = plan?.specialAdCategories;
  const pageFromPlan = plan?.pageId?.trim() || "";
  const pageFromCampaign = meta.campaignPageId?.trim() || "";
  const specialCategories =
    sac?.kind === "CATEGORIES" ? [...sac.categories] : [];
  return {
    specialKind:
      sac?.kind === "NONE"
        ? "NONE"
        : sac?.kind === "CATEGORIES"
          ? specialCategories.length === 1
            ? specialCategories[0]!
            : specialCategories.length > 1
              ? "CATEGORIES"
              : "NONE"
          : "UNRESOLVED",
    specialCategories,
    destination:
      plan?.destination === "META_LEAD_FORM" ||
      plan?.destination === "WEBSITE" ||
      plan?.destination === "WHATSAPP" ||
      plan?.destination === "PHONE"
        ? plan.destination
        : "",
    destinationUrl: (meta.destinationUrl ?? "").trim(),
    countryCode: plan?.countryCode?.trim() || "IT",
    metaGeoKey: plan?.metaGeoKey ?? null,
    geoLabel: plan?.geoLabel ?? null,
    startAtIso: plan?.startAtIso ?? null,
    endAtIso: plan?.endAtIso ?? null,
    pageId: pageFromPlan || pageFromCampaign,
    formId: plan?.formId ?? "",
    formPrivacyPolicyUrl: plan?.formPrivacyPolicyUrl?.trim() || "",
    timezoneName: meta.timezoneName,
    accountLabel: meta.accountLabel,
    adAccountId: meta.adAccountId,
    clientId: meta.clientId ?? null,
    websiteTracking: plan?.websiteTracking ?? null,
    destinationTrackingMode: plan?.destinationTrackingMode ?? null,
    instagramUserId: plan?.instagramUserId ?? null,
    preferPageOnly: plan?.preferPageOnly ?? null,
  };
}

/** Latest canonical plan for this Ally campaign (recovery row first, then previews). */
export async function loadPersistedCanonicalPlan(input: {
  userId: string;
  allyCampaignId: string;
}): Promise<MetaWriteCanonicalPlan | null> {
  const admin = createSupabaseAdmin();

  const { data: protectedRow } = await admin
    .from("meta_write_operations")
    .select("safe_payload_summary")
    .eq("user_id", input.userId)
    .eq("ally_campaign_id", input.allyCampaignId)
    .eq("operation_type", "CAMPAIGN_ADSET_PAUSED")
    .in("state", [
      "CONFIRMED",
      "IN_PROGRESS",
      "PARTIALLY_CREATED",
      "COMPLETED",
    ])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const protectedPlan = parseCanonicalPlan(
    (protectedRow?.safe_payload_summary as Record<string, unknown> | null)
      ?.canonicalPlan,
  );
  if (protectedPlan) return protectedPlan;

  const { data } = await admin
    .from("meta_write_operations")
    .select("safe_payload_summary, state, updated_at")
    .eq("user_id", input.userId)
    .eq("ally_campaign_id", input.allyCampaignId)
    .eq("operation_type", "CAMPAIGN_ADSET_PAUSED")
    .order("updated_at", { ascending: false })
    .limit(5);

  for (const row of data ?? []) {
    const summary = row.safe_payload_summary as Record<string, unknown> | null;
    const plan = parseCanonicalPlan(summary?.canonicalPlan);
    if (plan) return plan;
  }
  return null;
}
