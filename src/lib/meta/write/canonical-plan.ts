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
    allyAudienceMode:
      o.allyAudienceMode === "ADVANTAGE_AUDIENCE" ||
      o.allyAudienceMode === "MANUAL_AUDIENCE" ||
      o.allyAudienceMode === "UNRESOLVED"
        ? o.allyAudienceMode
        : null,
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
  allyAudienceMode?:
    | "ADVANTAGE_AUDIENCE"
    | "MANUAL_AUDIENCE"
    | "UNRESOLVED"
    | null;
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
    allyAudienceMode: input.allyAudienceMode ?? null,
  };
}

export function formStateFromCanonical(
  plan: MetaWriteCanonicalPlan | null,
  meta: {
    timezoneName: string | null;
    accountLabel: string | null;
    adAccountId: string | null;
  },
): MetaWriteFormState {
  const sac = plan?.specialAdCategories;
  return {
    specialKind:
      sac?.kind === "NONE"
        ? "NONE"
        : sac?.kind === "CATEGORIES"
          ? "CATEGORIES"
          : "UNRESOLVED",
    destination:
      plan?.destination === "META_LEAD_FORM" ||
      plan?.destination === "WEBSITE" ||
      plan?.destination === "WHATSAPP" ||
      plan?.destination === "PHONE"
        ? plan.destination
        : "",
    countryCode: plan?.countryCode?.trim() || "IT",
    metaGeoKey: plan?.metaGeoKey ?? null,
    geoLabel: plan?.geoLabel ?? null,
    startAtIso: plan?.startAtIso ?? null,
    endAtIso: plan?.endAtIso ?? null,
    pageId: plan?.pageId ?? "",
    formId: plan?.formId ?? "",
    timezoneName: meta.timezoneName,
    accountLabel: meta.accountLabel,
    adAccountId: meta.adAccountId,
  };
}

/** Latest PREVIEWED (or any) canonical plan for this Ally campaign. */
export async function loadPersistedCanonicalPlan(input: {
  userId: string;
  allyCampaignId: string;
}): Promise<MetaWriteCanonicalPlan | null> {
  const admin = createSupabaseAdmin();
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
