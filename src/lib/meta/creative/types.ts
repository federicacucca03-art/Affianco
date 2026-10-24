/**
 * P0.17 — Canonical Creative Package (one package → review → future launch).
 * Reuses CreativitaMeta / Easy draft / destination — does not invent Meta IDs.
 * META MUTATIONS: 0
 */

import type { CreativitaMeta } from "@/lib/creativita";

export type CreativeFormatV1 =
  | "SINGLE_IMAGE"
  | "SINGLE_VIDEO"
  | "CAROUSEL"
  | "FLEXIBLE";

export type CreativeFormatSupport =
  | "SUPPORTED"
  | "NOT_YET_SUPPORTED"
  | "UNSUPPORTED";

export type CreativeProvenance =
  | "USER"
  | "ALLY"
  | "BRAND_BRAIN"
  | "IMPORTED"
  | "DERIVED"
  | "UNKNOWN";

export type CreativePackageStatus =
  | "INCOMPLETE"
  | "READY_FOR_REVIEW"
  | "BLOCKED"
  | "UNSUPPORTED";

export type CreativeSurfaceReadiness =
  | "AVAILABLE"
  | "SUBOPTIMAL"
  | "MISSING_FORMAT"
  | "UNKNOWN";

export type CreativeFormatReadiness = {
  ratio: number | null;
  feed1x1: CreativeSurfaceReadiness;
  feed4x5: CreativeSurfaceReadiness;
  stories9x16: CreativeSurfaceReadiness;
  summaryIt: string;
};

export type CanonicalCreativePackage = {
  format: CreativeFormatV1;
  formatSupport: CreativeFormatSupport;

  identity: {
    facebookPageId: string | null;
    facebookPageName: string | null;
    instagramActorId: string | null;
    preferPageOnly: boolean;
  };

  media: {
    primaryAsset: CreativitaMeta | null;
    assetCount: number;
    mimeHint: "IMAGE" | "VIDEO" | "UNKNOWN" | null;
    formatReadiness: CreativeFormatReadiness;
    mediaStatus: "PRESENT" | "MISSING" | "PARTIAL";
  };

  copy: {
    primaryText: string;
    headline: string;
    description: string | null;
    callToActionType: string | null;
    callToActionLabelIt: string;
    primaryTextProvenance: CreativeProvenance;
    headlineProvenance: CreativeProvenance;
    descriptionProvenance: CreativeProvenance;
  };

  destination: {
    type: string | null;
    url: string | null;
    instantFormId: string | null;
    instantFormName: string | null;
  };

  tracking: {
    urlParameters: string | null;
    utmStrategy: "NONE" | "AUTO_UTM" | "CUSTOM" | "UNRESOLVED";
  };

  context: {
    objective: string | null;
    conversionLocation: string | null;
    campaignGoal: string | null;
    audienceSummary: string | null;
    offer: string | null;
    brandTone: string | null;
  };

  status: CreativePackageStatus;
  blockers: Array<{
    code: string;
    messageIt: string;
    editTarget: "annuncio" | "identita" | "modulo" | "obiettivo" | "review";
  }>;
};

/** Future P0.18 write input — validated fields only, no Graph execution. */
export type CreativeLaunchPackage = {
  phase: "PRE_WRITE_CREATIVE";
  format: "SINGLE_IMAGE";
  pageId: string;
  instagramActorId: string | null;
  primaryText: string;
  headline: string;
  description: string | null;
  callToActionType: string;
  destinationType: string;
  destinationUrl: string | null;
  instantFormId: string | null;
  allyStoragePath: string;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mutationsPerformed: 0;
  valid: boolean;
  invalidReasons: string[];
};

export type AllyCreativeCopySuggestion = {
  primaryText: string;
  headline: string;
  description: string | null;
  callToActionLabelIt: string;
  provenance: "ALLY";
  angleIt: string | null;
};
