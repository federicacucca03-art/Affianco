/**
 * M14 — Creative + Ad payload builders (plan only, no Graph mutation).
 * M14.1 — assetHandling READY when Ally Storage path present (upload path implemented).
 */

import type { CreativitaMeta } from "@/lib/creativita";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import type {
  MetaPublishAdPayload,
  MetaPublishCreativePayload,
} from "@/lib/meta/publish/types";

function asCreativitaList(raw: unknown): CreativitaMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CreativitaMeta =>
      Boolean(x) && typeof x === "object" && typeof (x as CreativitaMeta).id === "string",
  );
}

function pickPrincipalAsset(list: CreativitaMeta[]): CreativitaMeta | null {
  if (list.length === 0) return null;
  return (
    list.find((a) => a.ruolo === "principale") ??
    list[0] ??
    null
  );
}

function ctaForDestination(destination: string | null): string | null {
  switch (destination) {
    case "META_LEAD_FORM":
      return "SIGN_UP";
    case "WEBSITE":
      return "LEARN_MORE";
    case "WHATSAPP":
      return "WHATSAPP_MESSAGE";
    case "PHONE":
      return "CALL_NOW";
    default:
      return null;
  }
}

/**
 * External technical URL for META_LEAD_FORM `link_data.link`.
 * Rejects Facebook/IG/Meta hosts and Ally QA landing. Does not accept clients.website.
 */
export function isValidMetaLeadFormTechnicalUrl(
  raw: string | null | undefined,
): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  // Require explicit http(s) — never invent a scheme (avoids ftp→https coercion).
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!host) return false;
    if (
      /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)instagram\.com$|(^|\.)meta\.com$/i.test(
        host,
      )
    ) {
      return false;
    }
    if (/ally-qa-landing\.vercel\.app/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeMetaLeadFormTechnicalUrl(
  raw: string | null | undefined,
): string | null {
  const t = (raw ?? "").trim();
  if (!isValidMetaLeadFormTechnicalUrl(t)) return null;
  try {
    return new URL(t).toString();
  } catch {
    return null;
  }
}

export function buildMetaCreativePayload(input: {
  campaignName: string;
  pageId: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  destinationUrl: string | null;
  destination: string | null;
  creativitaRaw: unknown;
  formId?: string | null;
  /** Instant Form privacy_policy_url — required technical link for META_LEAD_FORM. */
  formPrivacyPolicyUrl?: string | null;
}): MetaPublishCreativePayload {
  const assets = asCreativitaList(input.creativitaRaw);
  const principal = pickPrincipalAsset(assets);
  const cta = ctaForDestination(input.destination);
  const hasText = Boolean((input.primaryText ?? "").trim());
  const hasHeadline = Boolean((input.headline ?? "").trim());
  const hasPage = Boolean((input.pageId ?? "").trim());
  const hasAsset = Boolean(principal?.storagePath || principal?.id);
  const formId = (input.formId ?? "").trim() || null;
  const needsForm = input.destination === "META_LEAD_FORM";
  const leadTechnicalUrl = normalizeMetaLeadFormTechnicalUrl(
    input.formPrivacyPolicyUrl,
  );
  const needsUrl =
    input.destination === "WEBSITE" || input.destination === "META_LEAD_FORM";
  const websiteOrNull = (input.destinationUrl ?? "").trim() || null;
  // Instant Form: never inherit clients.website or Page URL into link_data.link.
  const hasUrl =
    input.destination === "META_LEAD_FORM"
      ? Boolean(leadTechnicalUrl)
      : Boolean(websiteOrNull);

  let assetHandling: MetaPublishCreativePayload["assetHandling"] = "BLOCKED";
  let assetNoteIt: string | null =
    "Serve almeno una creatività (immagine o video) in Ally.";
  if (principal?.storagePath) {
    assetHandling = "READY";
    assetNoteIt = principal.isVideo
      ? "Video Ally in Storage: upload → Meta video id al momento della pubblicazione live."
      : "Immagine Ally in Storage: upload → Meta image hash al momento della pubblicazione live.";
  } else if (principal) {
    assetHandling = "PARTIAL";
    assetNoteIt =
      "Creatività Ally senza storagePath. Completa l'upload asset prima della pubblicazione live.";
  }

  const fieldStatus: MetaPublishCreativePayload["fieldStatus"] = {
    page_id: hasPage ? "AVAILABLE" : "MISSING",
    message: hasText ? "AVAILABLE" : "MISSING",
    name: hasHeadline ? "AVAILABLE" : "MISSING",
    link: needsUrl ? (hasUrl ? "AVAILABLE" : "MISSING") : "DERIVABLE",
    call_to_action: cta ? "DERIVABLE" : "MISSING",
    image_or_video: "MISSING",
    form_id: needsForm ? (formId ? "AVAILABLE" : "MISSING") : "DERIVABLE",
  };
  fieldStatus.image_or_video = hasAsset
    ? principal?.storagePath
      ? "DERIVABLE"
      : "UNRESOLVED"
    : "MISSING";

  const pageIdTrim = (input.pageId ?? "").trim() || null;
  const creativeLink =
    input.destination === "META_LEAD_FORM" ? leadTechnicalUrl : websiteOrNull;

  const ctaValue: { link?: string; lead_gen_form_id?: string } | undefined =
    cta
      ? needsForm && formId
        ? { lead_gen_form_id: formId }
        : creativeLink && input.destination !== "META_LEAD_FORM"
          ? { link: creativeLink }
          : undefined
      : undefined;

  return {
    name: `${input.campaignName.trim() || "Campagna"} — Creatività`,
    object_story_spec: {
      page_id: pageIdTrim,
      link_data: {
        message: (input.primaryText ?? "").trim() || null,
        name: (input.headline ?? "").trim() || null,
        description: (input.description ?? "").trim() || null,
        link: creativeLink,
        call_to_action: cta
          ? {
              type: cta,
              value: ctaValue,
            }
          : undefined,
        image_hash: null,
        video_id: null,
        ally_storage_path: principal?.storagePath ?? null,
      },
    },
    status: META_WRITE_SAFE_STATUS,
    fieldStatus,
    assetHandling,
    assetNoteIt,
  };
}

export function buildMetaAdPayload(input: {
  campaignName: string;
}): MetaPublishAdPayload {
  return {
    name: `${input.campaignName.trim() || "Campagna"} — Annuncio`,
    adset_id: "{pending_adset_id}",
    creative: { creative_id: "{pending_creative_id}" },
    status: META_WRITE_SAFE_STATUS,
    fieldStatus: {
      name: "DERIVABLE",
      adset_id: "DERIVABLE",
      creative_id: "DERIVABLE",
      status: "DERIVABLE",
    },
  };
}

export function creativeBlockingIssues(creative: MetaPublishCreativePayload): Array<{
  code:
    | "MISSING_PAGE"
    | "MISSING_PRIMARY_TEXT"
    | "MISSING_HEADLINE"
    | "MISSING_CREATIVE_ASSET"
    | "MISSING_DESTINATION_URL"
    | "MISSING_FORM_TECHNICAL_URL"
    | "MISSING_CTA"
    | "MISSING_FORM"
    | "ASSET_UPLOAD_NOT_READY";
  messageIt: string;
}> {
  const out: Array<{
    code:
      | "MISSING_PAGE"
      | "MISSING_PRIMARY_TEXT"
      | "MISSING_HEADLINE"
      | "MISSING_CREATIVE_ASSET"
      | "MISSING_DESTINATION_URL"
      | "MISSING_FORM_TECHNICAL_URL"
      | "MISSING_CTA"
      | "MISSING_FORM"
      | "ASSET_UPLOAD_NOT_READY";
    messageIt: string;
  }> = [];
  if (creative.fieldStatus.page_id === "MISSING") {
    out.push({
      code: "MISSING_PAGE",
      messageIt: "Manca la Pagina Meta (identità) per la creatività.",
    });
  }
  if (creative.fieldStatus.message === "MISSING") {
    out.push({
      code: "MISSING_PRIMARY_TEXT",
      messageIt: "Manca il testo principale dell'annuncio.",
    });
  }
  if (creative.fieldStatus.name === "MISSING") {
    out.push({
      code: "MISSING_HEADLINE",
      messageIt: "Manca il titolo (headline) dell'annuncio.",
    });
  }
  if (creative.fieldStatus.image_or_video === "MISSING") {
    out.push({
      code: "MISSING_CREATIVE_ASSET",
      messageIt: "Manca la creatività (immagine o video).",
    });
  }
  if (creative.fieldStatus.link === "MISSING") {
    const isLeadForm = creative.fieldStatus.form_id !== "DERIVABLE";
    out.push(
      isLeadForm
        ? {
            code: "MISSING_FORM_TECHNICAL_URL",
            messageIt:
              "Il modulo Instant Form selezionato non ha un URL esterno valido (informativa privacy) richiesto da Meta per la creatività.",
          }
        : {
            code: "MISSING_DESTINATION_URL",
            messageIt: "Manca l'URL di destinazione.",
          },
    );
  }
  if (creative.fieldStatus.call_to_action === "MISSING") {
    out.push({
      code: "MISSING_CTA",
      messageIt: "Manca la call to action.",
    });
  }
  if (creative.fieldStatus.form_id === "MISSING") {
    out.push({
      code: "MISSING_FORM",
      messageIt: "Manca il modulo lead Meta (form_id).",
    });
  }
  if (creative.assetHandling === "BLOCKED") {
    out.push({
      code: "ASSET_UPLOAD_NOT_READY",
      messageIt: "Gestione asset Meta non pronta: carica una creatività in Ally.",
    });
  }
  if (creative.assetHandling === "PARTIAL") {
    out.push({
      code: "ASSET_UPLOAD_NOT_READY",
      messageIt:
        "Creatività senza path Storage: completa l'upload asset in Ally.",
    });
  }
  return out;
}

/**
 * Build object_story_spec for supported Ally formats (single image link or video).
 * Lead forms: CTA value includes lead_gen_form_id when provided.
 * Pure — safe for unit tests (no server-only).
 */
export function buildObjectStorySpecForPublish(input: {
  pageId: string;
  primaryText: string;
  headline: string;
  description: string | null;
  destinationUrl: string | null;
  destination: string | null;
  ctaType: string | null;
  formId: string | null;
  imageHash: string | null;
  videoId: string | null;
  /** Meta object_story_spec.instagram_user_id (not deprecated actor_id). */
  instagramUserId?: string | null;
  /** Instant Form privacy_policy_url — required for META_LEAD_FORM link_data.link. */
  formPrivacyPolicyUrl?: string | null;
}):
  | {
      ok: true;
      spec: {
        page_id: string;
        instagram_user_id?: string;
        link_data?: Record<string, unknown>;
        video_data?: Record<string, unknown>;
      };
    }
  | { ok: false; reason: string } {
  const pageId = input.pageId.trim();
  if (!pageId) return { ok: false, reason: "MISSING_PAGE" };

  const ctaType = (input.ctaType ?? "").trim() || null;
  const formId = (input.formId ?? "").trim() || null;
  const websiteLink = (input.destinationUrl ?? "").trim() || null;
  const igUserId = (input.instagramUserId ?? "").trim() || null;
  const leadTechnicalUrl = normalizeMetaLeadFormTechnicalUrl(
    input.formPrivacyPolicyUrl,
  );
  // Instant Form: never inherit clients.website or Facebook Page URL.
  if (input.destination === "META_LEAD_FORM" && !leadTechnicalUrl) {
    return { ok: false, reason: "MISSING_FORM_TECHNICAL_URL" };
  }

  if (input.videoId) {
    const videoData: Record<string, unknown> = {
      video_id: input.videoId,
      message: input.primaryText,
      title: input.headline,
    };
    if (ctaType) {
      const value: Record<string, string> = {};
      if (formId && input.destination === "META_LEAD_FORM") {
        value.lead_gen_form_id = formId;
      } else if (websiteLink) {
        value.link = websiteLink;
      }
      videoData.call_to_action = {
        type: ctaType,
        ...(Object.keys(value).length > 0 ? { value } : {}),
      };
    }
    return {
      ok: true,
      spec: {
        page_id: pageId,
        ...(igUserId ? { instagram_user_id: igUserId } : {}),
        video_data: videoData,
      },
    };
  }

  if (!input.imageHash) {
    return { ok: false, reason: "MISSING_MEDIA" };
  }

  const linkData: Record<string, unknown> = {
    message: input.primaryText,
    name: input.headline,
    image_hash: input.imageHash,
  };
  if (input.description?.trim()) {
    linkData.description = input.description.trim();
  }
  if (input.destination === "META_LEAD_FORM") {
    linkData.link = leadTechnicalUrl;
    if (ctaType) {
      linkData.call_to_action = {
        type: ctaType,
        value: formId ? { lead_gen_form_id: formId } : undefined,
      };
    }
  } else {
    if (!websiteLink) return { ok: false, reason: "MISSING_DESTINATION_URL" };
    linkData.link = websiteLink;
    if (ctaType) {
      linkData.call_to_action = {
        type: ctaType,
        value: { link: websiteLink },
      };
    }
  }

  return {
    ok: true,
    spec: {
      page_id: pageId,
      ...(igUserId ? { instagram_user_id: igUserId } : {}),
      link_data: linkData,
    },
  };
}
