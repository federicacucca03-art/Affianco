/**
 * P0.17 — Build ONE CanonicalCreativePackage from Easy / campaign / Architect.
 * No Graph. No fabricated Meta IDs.
 */

import type { CreativitaMeta } from "@/lib/creativita";
import { analyzeCreativeFormatReadiness } from "@/lib/meta/creative/format-readiness";
import type {
  CanonicalCreativePackage,
  CreativeFormatSupport,
  CreativeFormatV1,
  CreativePackageStatus,
  CreativeProvenance,
} from "@/lib/meta/creative/types";
import {
  allyMetaCtaLabelIt,
  metaCtaTypeForDestination,
} from "@/lib/meta/creative/cta";

function pickPrincipal(assets: CreativitaMeta[]): CreativitaMeta | null {
  if (assets.length === 0) return null;
  return assets.find((a) => a.ruolo === "principale") ?? assets[0] ?? null;
}

function resolveFormat(input: {
  requestedFormat?: CreativeFormatV1 | null;
  principal: CreativitaMeta | null;
  assetCount: number;
}): { format: CreativeFormatV1; support: CreativeFormatSupport } {
  const requested = input.requestedFormat ?? null;
  if (requested === "CAROUSEL" || requested === "FLEXIBLE") {
    return { format: requested, support: "NOT_YET_SUPPORTED" };
  }
  if (requested === "SINGLE_VIDEO" || input.principal?.isVideo) {
    return { format: "SINGLE_VIDEO", support: "NOT_YET_SUPPORTED" };
  }
  if (input.assetCount > 1) {
    return { format: "CAROUSEL", support: "NOT_YET_SUPPORTED" };
  }
  return { format: "SINGLE_IMAGE", support: "SUPPORTED" };
}

export type BuildCanonicalCreativePackageInput = {
  pageId?: string | null;
  pageName?: string | null;
  instagramUserId?: string | null;
  preferPageOnly?: boolean;
  assets?: CreativitaMeta[] | null;
  primaryText?: string | null;
  headline?: string | null;
  description?: string | null;
  destinationType?: string | null;
  destinationUrl?: string | null;
  formId?: string | null;
  formName?: string | null;
  urlParameters?: string | null;
  utmStrategy?: "NONE" | "AUTO_UTM" | "CUSTOM" | "UNRESOLVED";
  objective?: string | null;
  conversionLocation?: string | null;
  campaignGoal?: string | null;
  audienceSummary?: string | null;
  offer?: string | null;
  brandTone?: string | null;
  requestedFormat?: CreativeFormatV1 | null;
  primaryTextProvenance?: CreativeProvenance;
  headlineProvenance?: CreativeProvenance;
  descriptionProvenance?: CreativeProvenance;
};

export function buildCanonicalCreativePackage(
  input: BuildCanonicalCreativePackageInput,
): CanonicalCreativePackage {
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const principal = pickPrincipal(assets);
  const { format, support } = resolveFormat({
    requestedFormat: input.requestedFormat,
    principal,
    assetCount: assets.length,
  });

  const primaryText = (input.primaryText ?? "").trim();
  const headline = (input.headline ?? "").trim();
  const description = (input.description ?? "").trim() || null;
  const destinationType = (input.destinationType ?? "").trim() || null;
  const pageId = (input.pageId ?? "").trim() || null;
  const formId = (input.formId ?? "").trim() || null;
  const destinationUrl = (input.destinationUrl ?? "").trim() || null;
  const ctaType = metaCtaTypeForDestination(destinationType);
  const formatReadiness = analyzeCreativeFormatReadiness({
    width: principal?.width,
    height: principal?.height,
  });

  const mediaStatus: CanonicalCreativePackage["media"]["mediaStatus"] = !principal
    ? "MISSING"
    : principal.storagePath || principal.id
      ? "PRESENT"
      : "PARTIAL";

  const blockers: CanonicalCreativePackage["blockers"] = [];

  if (support === "NOT_YET_SUPPORTED") {
    blockers.push({
      code: "CREATIVE_FORMAT_UNSUPPORTED",
      messageIt:
        format === "CAROUSEL"
          ? "Carousel non è ancora pubblicabile da Ally. Nessuna conversione silenziosa a singola immagine."
          : format === "SINGLE_VIDEO"
            ? "Video non è ancora supportato nel percorso Easy V1."
            : "Questo formato creativo non è ancora supportato.",
      editTarget: "annuncio",
    });
  }
  if (mediaStatus === "MISSING") {
    blockers.push({
      code: "CREATIVE_MEDIA_MISSING",
      messageIt: "Aggiungi almeno un'immagine all'annuncio.",
      editTarget: "annuncio",
    });
  }
  if (!primaryText) {
    blockers.push({
      code: "CREATIVE_PRIMARY_TEXT_MISSING",
      messageIt: "Inserisci il testo principale dell'annuncio.",
      editTarget: "annuncio",
    });
  }
  if (!headline) {
    blockers.push({
      code: "CREATIVE_HEADLINE_MISSING",
      messageIt: "Inserisci il titolo dell'annuncio.",
      editTarget: "annuncio",
    });
  }
  if (!pageId) {
    blockers.push({
      code: "CREATIVE_PAGE_MISSING",
      messageIt: "Seleziona una Pagina Facebook.",
      editTarget: "identita",
    });
  }
  if (destinationType === "META_LEAD_FORM" && !formId) {
    blockers.push({
      code: "CREATIVE_FORM_MISSING",
      messageIt: "Seleziona un modulo Instant Form.",
      editTarget: "modulo",
    });
  }
  if (destinationType === "WEBSITE" && !destinationUrl) {
    blockers.push({
      code: "CREATIVE_DESTINATION_URL_MISSING",
      messageIt: "Indica un URL di destinazione valido.",
      editTarget: "obiettivo",
    });
  }
  // Instant Form must not invent a website URL.
  if (destinationType === "META_LEAD_FORM" && destinationUrl) {
    // URL ignored for Instant Form — not a blocker; honesty in destination.url = null below.
  }

  let status: CreativePackageStatus = "READY_FOR_REVIEW";
  if (support === "NOT_YET_SUPPORTED") status = "UNSUPPORTED";
  else if (blockers.length > 0) status = "BLOCKED";
  else if (!primaryText || !headline || mediaStatus !== "PRESENT") {
    status = "INCOMPLETE";
  }

  return {
    format,
    formatSupport: support,
    identity: {
      facebookPageId: pageId,
      facebookPageName: (input.pageName ?? "").trim() || null,
      instagramActorId: (input.instagramUserId ?? "").trim() || null,
      preferPageOnly: input.preferPageOnly === true,
    },
    media: {
      primaryAsset: principal,
      assetCount: assets.length,
      mimeHint: principal
        ? principal.isVideo
          ? "VIDEO"
          : "IMAGE"
        : null,
      formatReadiness,
      mediaStatus,
    },
    copy: {
      primaryText,
      headline,
      description,
      callToActionType: ctaType,
      // Label derived from the SAME type that launch/publish will send.
      callToActionLabelIt: allyMetaCtaLabelIt(ctaType) || "Iscriviti",
      primaryTextProvenance: input.primaryTextProvenance ?? "UNKNOWN",
      headlineProvenance: input.headlineProvenance ?? "UNKNOWN",
      descriptionProvenance: input.descriptionProvenance ?? "UNKNOWN",
    },
    destination: {
      type: destinationType,
      url: destinationType === "META_LEAD_FORM" ? null : destinationUrl,
      instantFormId: formId,
      instantFormName: (input.formName ?? "").trim() || null,
    },
    tracking: {
      urlParameters: (input.urlParameters ?? "").trim() || null,
      utmStrategy: input.utmStrategy ?? "NONE",
    },
    context: {
      objective: (input.objective ?? "").trim() || null,
      conversionLocation: (input.conversionLocation ?? "").trim() || null,
      campaignGoal: (input.campaignGoal ?? "").trim() || null,
      audienceSummary: (input.audienceSummary ?? "").trim() || null,
      offer: (input.offer ?? "").trim() || null,
      brandTone: (input.brandTone ?? "").trim() || null,
    },
    status,
    blockers,
  };
}

/** Map Easy Instant Form draft (+ asset) into the canonical package. */
export function buildCreativePackageFromEasyDraft(input: {
  pageId?: string | null;
  pageName?: string | null;
  formId?: string | null;
  formName?: string | null;
  instagramUserId?: string | null;
  preferPageOnly?: boolean;
  primaryText?: string | null;
  headline?: string | null;
  description?: string | null;
  asset?: CreativitaMeta | null;
  creativitaCount?: number | null;
  objectiveChoice?: string | null;
  conversionChoice?: string | null;
  geoLabel?: string | null;
  primaryTextProvenance?: CreativeProvenance;
  headlineProvenance?: CreativeProvenance;
  descriptionProvenance?: CreativeProvenance;
  requestedFormat?: CreativeFormatV1 | null;
  brandTone?: string | null;
  offer?: string | null;
}): CanonicalCreativePackage {
  const assets: CreativitaMeta[] = input.asset ? [input.asset] : [];
  const conversion =
    input.conversionChoice === "INSTANT_FORM"
      ? "INSTANT_FORM"
      : input.conversionChoice === "WEBSITE"
        ? "WEBSITE"
        : null;
  return buildCanonicalCreativePackage({
    pageId: input.pageId,
    pageName: input.pageName,
    formId: input.formId,
    formName: input.formName,
    instagramUserId: input.instagramUserId,
    preferPageOnly: input.preferPageOnly,
    assets,
    primaryText: input.primaryText,
    headline: input.headline,
    description: input.description,
    destinationType:
      conversion === "INSTANT_FORM"
        ? "META_LEAD_FORM"
        : conversion === "WEBSITE"
          ? "WEBSITE"
          : null,
    destinationUrl: null,
    objective: input.objectiveChoice === "GENERATE_LEADS" ? "OUTCOME_LEADS" : null,
    conversionLocation: conversion,
    campaignGoal:
      input.objectiveChoice === "GENERATE_LEADS" ? "Generare contatti" : null,
    audienceSummary: input.geoLabel ?? null,
    offer: input.offer ?? null,
    brandTone: input.brandTone ?? null,
    primaryTextProvenance: input.primaryTextProvenance,
    headlineProvenance: input.headlineProvenance,
    descriptionProvenance: input.descriptionProvenance,
    requestedFormat: input.requestedFormat,
    utmStrategy: "NONE",
  });
}
