/**
 * P0.17 — Future CreativeLaunchPackage (validated fields only).
 * Does NOT execute Graph writes. P0.18 will consume this.
 */

import type { CanonicalCreativePackage } from "@/lib/meta/creative/types";
import type { CreativeLaunchPackage } from "@/lib/meta/creative/types";

export function buildCreativeLaunchPackage(
  pkg: CanonicalCreativePackage,
): CreativeLaunchPackage {
  const invalidReasons: string[] = [];
  const pageId = pkg.identity.facebookPageId?.trim() || "";
  const primaryText = pkg.copy.primaryText.trim();
  const headline = pkg.copy.headline.trim();
  const storagePath = pkg.media.primaryAsset?.storagePath?.trim() || "";
  const cta = pkg.copy.callToActionType?.trim() || "";
  const destinationType = pkg.destination.type?.trim() || "";

  if (pkg.formatSupport !== "SUPPORTED" || pkg.format !== "SINGLE_IMAGE") {
    invalidReasons.push("format_not_supported_for_launch");
  }
  if (!pageId) invalidReasons.push("page_missing");
  if (!primaryText) invalidReasons.push("primary_text_missing");
  if (!headline) invalidReasons.push("headline_missing");
  if (!storagePath) invalidReasons.push("media_storage_path_missing");
  if (!cta) invalidReasons.push("cta_missing");
  if (!destinationType) invalidReasons.push("destination_missing");
  if (destinationType === "META_LEAD_FORM" && !pkg.destination.instantFormId) {
    invalidReasons.push("instant_form_missing");
  }
  if (destinationType === "WEBSITE" && !pkg.destination.url) {
    invalidReasons.push("destination_url_missing");
  }

  return {
    phase: "PRE_WRITE_CREATIVE",
    format: "SINGLE_IMAGE",
    pageId,
    instagramActorId: pkg.identity.preferPageOnly
      ? null
      : pkg.identity.instagramActorId,
    primaryText,
    headline,
    description: pkg.copy.description,
    callToActionType: cta || "SIGN_UP",
    destinationType,
    destinationUrl:
      destinationType === "META_LEAD_FORM" ? null : pkg.destination.url,
    instantFormId: pkg.destination.instantFormId,
    allyStoragePath: storagePath,
    mediaWidth: pkg.media.primaryAsset?.width ?? null,
    mediaHeight: pkg.media.primaryAsset?.height ?? null,
    mutationsPerformed: 0,
    valid: invalidReasons.length === 0,
    invalidReasons,
  };
}
