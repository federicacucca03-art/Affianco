/**
 * UX.5.1 — Persist InstantFormBuilderDraft into EXISTING campaigns columns
 * + front_end_offer [ALLY_CANON_V1] marker (no schema change).
 * LIVE META WRITES: 0
 */

import { supabase } from "@/lib/supabase";
import {
  emptyInstantFormBuilderDraft,
  type BuilderManualPlacementId,
  type InstantFormBuilderDraft,
  BUILDER_MANUAL_PLACEMENT_OPTIONS,
} from "@/lib/meta/write/instant-form-builder";
import {
  stripCreationModeFromFrontEndOffer,
  userFacingCampaignText,
} from "@/lib/campagne-creation-mode";
import type { Campagna } from "@/types/campagne";

const PATH_LINE_RE = /^\[ALLY_PATH:[^\]]+\]\n?/;

/** Machine block in front_end_offer — no new DB column. */
export const ALLY_CANON_V1_OPEN = "[ALLY_CANON_V1]";
export const ALLY_CANON_V1_CLOSE = "[/ALLY_CANON_V1]";

const CANON_BLOCK_RE =
  /\[ALLY_CANON_V1\]\s*([\s\S]*?)\s*\[\/ALLY_CANON_V1\]\n?/;

export type AllyCanonV1Payload = {
  v: 1;
  objectiveChoice: InstantFormBuilderDraft["objectiveChoice"];
  conversionChoice: InstantFormBuilderDraft["conversionChoice"];
  geoLabel: string | null;
  geoQuery: string;
  metaGeoKey: string | null;
  countryCode: string;
  etaMin: number | null;
  etaMax: number | null;
  allyAudienceMode: InstantFormBuilderDraft["allyAudienceMode"];
  budgetDailyMajor: number | null;
  primaryText: string;
  headline: string;
  description: string;
  primaryTextProvenance: InstantFormBuilderDraft["primaryTextProvenance"];
  headlineProvenance: InstantFormBuilderDraft["headlineProvenance"];
  descriptionProvenance: InstantFormBuilderDraft["descriptionProvenance"];
  specialKind: string;
  placementsMode: InstantFormBuilderDraft["placementsMode"];
  placementsManual: BuilderManualPlacementId[];
  pageId: string;
  pageName: string | null;
  formId: string;
  formName: string | null;
  formRelation: InstantFormBuilderDraft["formRelation"];
  instagramUserId: string;
  preferPageOnly: boolean;
  creativitaCount: number;
};

export function draftToCanonPayload(
  draft: InstantFormBuilderDraft,
): AllyCanonV1Payload {
  return {
    v: 1,
    objectiveChoice: draft.objectiveChoice,
    conversionChoice: draft.conversionChoice,
    geoLabel: draft.geoLabel,
    geoQuery: draft.geoQuery,
    metaGeoKey: draft.metaGeoKey,
    countryCode: draft.countryCode || "IT",
    etaMin: draft.etaMin,
    etaMax: draft.etaMax,
    allyAudienceMode: draft.allyAudienceMode,
    budgetDailyMajor: draft.budgetDailyMajor,
    primaryText: draft.primaryText,
    headline: draft.headline,
    description: draft.description,
    primaryTextProvenance: draft.primaryTextProvenance,
    headlineProvenance: draft.headlineProvenance,
    descriptionProvenance: draft.descriptionProvenance,
    specialKind: draft.specialKind || "UNRESOLVED",
    placementsMode: draft.placementsMode,
    placementsManual: [...draft.placementsManual],
    pageId: draft.pageId,
    pageName: draft.pageName,
    formId: draft.formId,
    formName: draft.formName,
    formRelation: draft.formRelation,
    instagramUserId: draft.instagramUserId,
    preferPageOnly: draft.preferPageOnly,
    creativitaCount: draft.creativitaCount,
  };
}

function parseCanonPayload(raw: unknown): AllyCanonV1Payload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const placementsManual = Array.isArray(o.placementsManual)
    ? (o.placementsManual.filter((p) =>
        BUILDER_MANUAL_PLACEMENT_OPTIONS.some((opt) => opt.id === p),
      ) as BuilderManualPlacementId[])
    : [];
  return {
    v: 1,
    objectiveChoice:
      o.objectiveChoice === "GENERATE_LEADS" ||
      o.objectiveChoice === "TRAFFIC" ||
      o.objectiveChoice === "SELL_ONLINE" ||
      o.objectiveChoice === "ENGAGEMENT" ||
      o.objectiveChoice === "AWARENESS"
        ? o.objectiveChoice
        : null,
    conversionChoice:
      o.conversionChoice === "INSTANT_FORM" ||
      o.conversionChoice === "WEBSITE"
        ? o.conversionChoice
        : null,
    geoLabel: typeof o.geoLabel === "string" ? o.geoLabel : null,
    geoQuery: typeof o.geoQuery === "string" ? o.geoQuery : "",
    metaGeoKey: typeof o.metaGeoKey === "string" ? o.metaGeoKey : null,
    countryCode: typeof o.countryCode === "string" ? o.countryCode : "IT",
    etaMin: typeof o.etaMin === "number" ? o.etaMin : null,
    etaMax: typeof o.etaMax === "number" ? o.etaMax : null,
    allyAudienceMode:
      o.allyAudienceMode === "CUSTOM" ? "CUSTOM" : "ADVANTAGE_AUDIENCE",
    budgetDailyMajor:
      typeof o.budgetDailyMajor === "number" ? o.budgetDailyMajor : null,
    primaryText: typeof o.primaryText === "string" ? o.primaryText : "",
    headline: typeof o.headline === "string" ? o.headline : "",
    description: typeof o.description === "string" ? o.description : "",
    primaryTextProvenance:
      o.primaryTextProvenance === "USER" ||
      o.primaryTextProvenance === "ALLY" ||
      o.primaryTextProvenance === "UNKNOWN"
        ? o.primaryTextProvenance
        : "UNKNOWN",
    headlineProvenance:
      o.headlineProvenance === "USER" ||
      o.headlineProvenance === "ALLY" ||
      o.headlineProvenance === "UNKNOWN"
        ? o.headlineProvenance
        : "UNKNOWN",
    descriptionProvenance:
      o.descriptionProvenance === "USER" ||
      o.descriptionProvenance === "ALLY" ||
      o.descriptionProvenance === "UNKNOWN"
        ? o.descriptionProvenance
        : "UNKNOWN",
    specialKind: typeof o.specialKind === "string" ? o.specialKind : "UNRESOLVED",
    placementsMode: o.placementsMode === "MANUAL" ? "MANUAL" : "ADVANTAGE",
    placementsManual,
    pageId: typeof o.pageId === "string" ? o.pageId : "",
    pageName: typeof o.pageName === "string" ? o.pageName : null,
    formId: typeof o.formId === "string" ? o.formId : "",
    formName: typeof o.formName === "string" ? o.formName : null,
    formRelation:
      o.formRelation === "VERIFIED" ||
      o.formRelation === "MISMATCH" ||
      o.formRelation === "UNCHECKED"
        ? o.formRelation
        : "UNCHECKED",
    instagramUserId:
      typeof o.instagramUserId === "string" ? o.instagramUserId : "",
    preferPageOnly: o.preferPageOnly === true,
    creativitaCount:
      typeof o.creativitaCount === "number" ? o.creativitaCount : 0,
  };
}

export function parseCanonFromFrontEndOffer(
  offer: string | null | undefined,
): AllyCanonV1Payload | null {
  const m = (offer ?? "").match(CANON_BLOCK_RE);
  if (!m?.[1]) return null;
  try {
    return parseCanonPayload(JSON.parse(m[1].trim()));
  } catch {
    return null;
  }
}

export function stripCanonFromFrontEndOffer(
  offer: string | null | undefined,
): string {
  return (offer ?? "").replace(CANON_BLOCK_RE, "").trim();
}

/** Path marker + brief without canon (for re-encode). */
export function stripAllyMachineBlocksFromOffer(
  offer: string | null | undefined,
): string {
  return stripCreationModeFromFrontEndOffer(
    stripCanonFromFrontEndOffer(offer),
  );
}

/**
 * Preserve existing [ALLY_PATH:…] marker; upsert canon block; keep brief text.
 */
export function encodeFrontEndOfferWithCanon(
  draft: InstantFormBuilderDraft,
  existingOffer: string | null | undefined,
): string {
  const raw = existingOffer ?? "";
  const pathLineMatch = raw.match(PATH_LINE_RE);
  const pathPrefix = pathLineMatch?.[0]?.trim() ?? "";
  const brief = stripAllyMachineBlocksFromOffer(raw);
  const json = JSON.stringify(draftToCanonPayload(draft));
  const canonBlock = `${ALLY_CANON_V1_OPEN}\n${json}\n${ALLY_CANON_V1_CLOSE}`;
  const parts = [pathPrefix, canonBlock, brief].filter(Boolean);
  return parts.join("\n");
}

/** Map draft → existing campaigns columns (no new schema). */
export function campaignColumnsFromDraft(
  draft: InstantFormBuilderDraft,
): Record<string, unknown> {
  const citta =
    draft.geoLabel?.trim() ||
    draft.geoQuery?.trim().split(",")[0]?.trim() ||
    null;
  const objective =
    draft.objectiveChoice === "GENERATE_LEADS"
      ? "LEADS"
      : draft.objectiveChoice
        ? null
        : undefined;
  const payload: Record<string, unknown> = {
    daily_budget: draft.budgetDailyMajor,
    citta,
    variante_a: userFacingCampaignText(draft.primaryText) || null,
    titolo_annuncio: userFacingCampaignText(draft.headline) || null,
    page_id: draft.pageId.trim() || null,
    page_name: draft.pageName?.trim() || null,
    form_id: draft.formId.trim() || null,
    eta_min: draft.etaMin,
    eta_max: draft.etaMax,
  };
  if (objective === "LEADS") {
    payload.objective = "LEADS";
  }
  return payload;
}

/**
 * Seed draft from DB columns + ALY_CANON_V1.
 * Precedence: canon JSON (when present) overrides column defaults for overlapping fields;
 * columns fill gaps when canon absent (legacy campaigns).
 */
export function seedDraftFromPersistedCampagna(
  campagna: Campagna,
): InstantFormBuilderDraft {
  const canon = parseCanonFromFrontEndOffer(campagna.frontEndOffer ?? null);
  const fromColumns = emptyInstantFormBuilderDraft({
    pageId: campagna.pageId?.trim() || "",
    pageName: campagna.pageName ?? null,
    formId: campagna.formId?.trim() || "",
    geoQuery: campagna.citta?.trim() || "",
    geoLabel: campagna.citta?.trim() || null,
    etaMin: campagna.etaMin ?? null,
    etaMax: campagna.etaMax ?? null,
    budgetDailyMajor:
      typeof campagna.budgetGiornaliero === "number"
        ? campagna.budgetGiornaliero
        : null,
    primaryText: userFacingCampaignText(campagna.varianteA) || "",
    headline: userFacingCampaignText(campagna.titoloAnnuncio) || "",
    creativitaCount: Array.isArray(campagna.creativitaMeta)
      ? campagna.creativitaMeta.length
      : 0,
    objectiveChoice:
      campagna.objective === "LEADS" ? "GENERATE_LEADS" : null,
    // Legacy Instant Form path: LEADS + form_id often implies Instant Form
    conversionChoice:
      campagna.objective === "LEADS" && (campagna.formId ?? "").trim()
        ? "INSTANT_FORM"
        : null,
  });

  if (!canon) return fromColumns;

  return emptyInstantFormBuilderDraft({
    ...fromColumns,
    ...canon,
    // Prefer non-empty column media count if canon count is 0 but assets exist
    creativitaCount:
      canon.creativitaCount > 0
        ? canon.creativitaCount
        : fromColumns.creativitaCount,
  });
}

export type PersistCanonResult =
  | { ok: true }
  | { ok: false; error: string };

/** Debounced caller should invoke this after localStorage write. */
export async function persistCanonicalDraftToCampaignRow(input: {
  campaignId: string;
  draft: InstantFormBuilderDraft;
  existingFrontEndOffer: string | null | undefined;
}): Promise<PersistCanonResult> {
  const front_end_offer = encodeFrontEndOfferWithCanon(
    input.draft,
    input.existingFrontEndOffer,
  );
  const columns = campaignColumnsFromDraft(input.draft);
  const { error } = await supabase
    .from("campaigns")
    .update({
      ...columns,
      front_end_offer,
    })
    .eq("id", input.campaignId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
