/**
 * P0.1 — Canonical objective × destination × tracking resolver.
 * Single source for guided plan, preview, validation, and publish payload.
 * No Graph writes. No silent LINK_CLICKS disguise for website conversion.
 */

import {
  buildTrackingPromotedObjectFields,
  hasUsableWebsiteTracking,
  recommendedEventForObjective,
  type AllyWebsiteConversionEvent,
  type AllyWebsiteTrackingConfig,
} from "@/lib/meta/write/tracking";

export type AllyConversionLocation =
  | "INSTANT_FORM"
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE"
  | "UNRESOLVED";

export type AllyTrackingRequirement =
  | "NOT_REQUIRED"
  | "REQUIRED_WEBSITE_PIXEL"
  | "REQUIRED_INSTANT_FORM";

export type AllyConversionBlockReasonCode =
  | "MISSING_TRACKING_CONFIG"
  | "MISSING_CONVERSION_EVENT"
  | "MISSING_FORM"
  | "MISSING_PAGE"
  | "MISSING_DESTINATION_URL"
  | "UNSUPPORTED_CONFIGURATION"
  | null;

/** Canonical publish plan — powers preview, Launch Guardian, 5-Minute Builder later. */
export type AllyConversionPublishPlan = {
  metaObjective: string | null;
  conversionLocation: AllyConversionLocation;
  optimizationGoal: string | null;
  destinationType: string | null;
  trackingSource: {
    type: AllyWebsiteTrackingConfig["sourceType"];
    id: string | null;
    name: string | null;
    eventType: AllyWebsiteConversionEvent | null;
    customConversionId: string | null;
  } | null;
  conversionEvent: AllyWebsiteConversionEvent | null;
  promotedObject: Record<string, unknown> | null;
  destinationUrlRequired: boolean;
  trackingRequirement: AllyTrackingRequirement;
  valid: boolean;
  blockReasonCode: AllyConversionBlockReasonCode;
  blockReasonIt: string | null;
  /** Technical notes that must not invent Graph behavior. */
  needsMetaVerification: string[];
  needsPage: boolean;
  needsForm: boolean;
  needsUrl: boolean;
  needsTracking: boolean;
};

function locationFromDestination(
  destination: string,
): AllyConversionLocation {
  switch (destination) {
    case "META_LEAD_FORM":
      return "INSTANT_FORM";
    case "WEBSITE":
      return "WEBSITE";
    case "WHATSAPP":
      return "WHATSAPP";
    case "PHONE":
      return "PHONE";
    default:
      return "UNRESOLVED";
  }
}

function emptyPlan(
  partial: Partial<AllyConversionPublishPlan> & {
    metaObjective: string | null;
    conversionLocation: AllyConversionLocation;
  },
): AllyConversionPublishPlan {
  return {
    optimizationGoal: null,
    destinationType: null,
    trackingSource: null,
    conversionEvent: null,
    promotedObject: null,
    destinationUrlRequired: false,
    trackingRequirement: "NOT_REQUIRED",
    valid: false,
    blockReasonCode: "UNSUPPORTED_CONFIGURATION",
    blockReasonIt: "Combinazione obiettivo / destinazione non supportata.",
    needsMetaVerification: [],
    needsPage: false,
    needsForm: false,
    needsUrl: false,
    needsTracking: false,
    ...partial,
  };
}

function trackingSnapshot(
  tracking: AllyWebsiteTrackingConfig | null | undefined,
): AllyConversionPublishPlan["trackingSource"] {
  if (!tracking || tracking.sourceType === "NONE") return null;
  return {
    type: tracking.sourceType,
    id: tracking.sourceId,
    name: tracking.sourceName,
    eventType: tracking.eventType,
    customConversionId: tracking.customConversionId,
  };
}

/**
 * Resolve the full conversion publish plan from Ally inputs.
 * Prefer this over ad-hoc objective/destination branching.
 */
export function resolveConversionPublishPlan(input: {
  metaObjective: string | null;
  destination: string;
  pageId?: string | null;
  formId?: string | null;
  destinationUrl?: string | null;
  websiteTracking?: AllyWebsiteTrackingConfig | null;
}): AllyConversionPublishPlan {
  const dest = input.destination;
  const obj = input.metaObjective;
  const location = locationFromDestination(dest);
  const tracking = input.websiteTracking ?? null;
  const pageId = (input.pageId ?? "").trim() || null;
  const formId = (input.formId ?? "").trim() || null;
  const url = (input.destinationUrl ?? "").trim() || null;

  if (dest === "UNRESOLVED" || dest === "UNKNOWN") {
    return emptyPlan({
      metaObjective: obj,
      conversionLocation: "UNRESOLVED",
      blockReasonCode: null,
      blockReasonIt: null,
      valid: false,
    });
  }

  // —— Instant Form leads ——
  // Ad Set promoted_object: page_id only. Meta rejects form_id on Ad Set
  // (Graph v26+). Instant Form binds later on Creative CTA as lead_gen_form_id.
  if (dest === "META_LEAD_FORM") {
    const promoted: Record<string, unknown> | null = pageId
      ? { page_id: pageId }
      : null;
    const missingPage = !pageId;
    const missingForm = !formId;
    const valid = !missingPage && !missingForm;
    return {
      metaObjective: obj,
      conversionLocation: "INSTANT_FORM",
      optimizationGoal: "LEAD_GENERATION",
      destinationType: "ON_AD",
      trackingSource: null,
      conversionEvent: null,
      promotedObject: promoted,
      destinationUrlRequired: false,
      trackingRequirement: "REQUIRED_INSTANT_FORM",
      valid,
      blockReasonCode: missingPage
        ? "MISSING_PAGE"
        : missingForm
          ? "MISSING_FORM"
          : null,
      blockReasonIt: missingPage
        ? "Indica la Pagina Facebook."
        : missingForm
          ? "Indica il modulo contatti Meta."
          : null,
      needsMetaVerification: [],
      needsPage: true,
      needsForm: true,
      needsUrl: false,
      needsTracking: false,
    };
  }

  // —— WhatsApp / Phone (unchanged professional paths) ——
  if (dest === "WHATSAPP") {
    return {
      metaObjective: obj,
      conversionLocation: "WHATSAPP",
      optimizationGoal: "CONVERSATIONS",
      destinationType: "WHATSAPP",
      trackingSource: null,
      conversionEvent: null,
      promotedObject: pageId ? { page_id: pageId } : null,
      destinationUrlRequired: false,
      trackingRequirement: "NOT_REQUIRED",
      valid: Boolean(pageId),
      blockReasonCode: pageId ? null : "MISSING_PAGE",
      blockReasonIt: pageId ? null : "Indica la Pagina Facebook.",
      needsMetaVerification: [],
      needsPage: true,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  if (dest === "PHONE") {
    return {
      metaObjective: obj,
      conversionLocation: "PHONE",
      optimizationGoal: "QUALITY_CALL",
      destinationType: "PHONE",
      trackingSource: null,
      conversionEvent: null,
      promotedObject: null,
      destinationUrlRequired: false,
      trackingRequirement: "NOT_REQUIRED",
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
      needsMetaVerification: [],
      needsPage: false,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  // —— WEBSITE ——
  if (dest === "WEBSITE") {
    if (obj === "OUTCOME_AWARENESS") {
      return {
        metaObjective: obj,
        conversionLocation: "WEBSITE",
        optimizationGoal: "REACH",
        destinationType: "WEBSITE",
        trackingSource: trackingSnapshot(tracking),
        conversionEvent: tracking?.eventType ?? null,
        promotedObject: pageId ? { page_id: pageId } : null,
        destinationUrlRequired: true,
        trackingRequirement: "NOT_REQUIRED",
        valid: Boolean(pageId && url),
        blockReasonCode: !pageId
          ? "MISSING_PAGE"
          : !url
            ? "MISSING_DESTINATION_URL"
            : null,
        blockReasonIt: !pageId
          ? "Indica la Pagina Facebook."
          : !url
            ? "Indica l'URL di destinazione."
            : null,
        needsMetaVerification: [],
        needsPage: true,
        needsForm: false,
        needsUrl: true,
        needsTracking: false,
      };
    }

    // Explicit traffic / link-click path — valid without Pixel.
    if (obj === "OUTCOME_TRAFFIC") {
      return {
        metaObjective: obj,
        conversionLocation: "WEBSITE",
        optimizationGoal: "LINK_CLICKS",
        // Meta TRAFFIC matrix does not allow destination_type=WEBSITE.
        destinationType: null,
        trackingSource: trackingSnapshot(tracking),
        conversionEvent: tracking?.eventType ?? null,
        promotedObject: pageId ? { page_id: pageId } : null,
        destinationUrlRequired: true,
        trackingRequirement: "NOT_REQUIRED",
        valid: Boolean(pageId && url),
        blockReasonCode: !pageId
          ? "MISSING_PAGE"
          : !url
            ? "MISSING_DESTINATION_URL"
            : null,
        blockReasonIt: !pageId
          ? "Indica la Pagina Facebook."
          : !url
            ? "Indica l'URL di destinazione."
            : null,
        needsMetaVerification: [],
        needsPage: true,
        needsForm: false,
        needsUrl: true,
        needsTracking: false,
      };
    }

    // Professional website conversion: LEADS or SALES.
    if (obj === "OUTCOME_LEADS" || obj === "OUTCOME_SALES") {
      const recommended = recommendedEventForObjective(obj);
      const usable = hasUsableWebsiteTracking(tracking);
      // Any selected standard event is structurally valid; Easy Mode recommends
      // LEAD / PURCHASE. Pro Mode may expose the wider set later.
      const eventOk =
        usable &&
        tracking!.eventType != null &&
        tracking!.eventType !== "OTHER";

      const needsMetaVerification: string[] = [];
      if (tracking?.sourceType === "DATASET") {
        needsMetaVerification.push(
          "DATASET_ID_ON_PROMOTED_OBJECT: confirm Graph accepts dataset_id vs pixel_id for Ad Set promoted_object (NEEDS_META_VERIFICATION).",
        );
      }

      const trackingFields =
        usable && eventOk
          ? buildTrackingPromotedObjectFields(tracking!)
          : null;

      const promoted: Record<string, unknown> | null =
        pageId || trackingFields
          ? {
              ...(pageId ? { page_id: pageId } : {}),
              ...(trackingFields ?? {}),
            }
          : null;

      if (!usable || !eventOk) {
        const isLeads = obj === "OUTCOME_LEADS";
        return {
          metaObjective: obj,
          conversionLocation: "WEBSITE",
          // Intended professional goal — never silently fall back to LINK_CLICKS.
          optimizationGoal: "OFFSITE_CONVERSIONS",
          destinationType: "WEBSITE",
          trackingSource: trackingSnapshot(tracking),
          conversionEvent: tracking?.eventType ?? recommended,
          promotedObject: pageId ? { page_id: pageId } : null,
          destinationUrlRequired: true,
          trackingRequirement: "REQUIRED_WEBSITE_PIXEL",
          valid: false,
          blockReasonCode: "MISSING_TRACKING_CONFIG",
          blockReasonIt: isLeads
            ? "Per ottimizzare questa campagna per lead dal sito devi collegare un Pixel/Dataset e scegliere l’evento Lead."
            : "Per ottimizzare questa campagna per acquisti dal sito devi collegare un Pixel/Dataset e scegliere l’evento Purchase.",
          needsMetaVerification,
          needsPage: true,
          needsForm: false,
          needsUrl: true,
          needsTracking: true,
        };
      }

      const missingPage = !pageId;
      const missingUrl = !url;
      const valid = !missingPage && !missingUrl;
      return {
        metaObjective: obj,
        conversionLocation: "WEBSITE",
        optimizationGoal: "OFFSITE_CONVERSIONS",
        destinationType: "WEBSITE",
        trackingSource: trackingSnapshot(tracking),
        conversionEvent: tracking!.eventType,
        promotedObject: promoted,
        destinationUrlRequired: true,
        trackingRequirement: "REQUIRED_WEBSITE_PIXEL",
        valid,
        blockReasonCode: missingPage
          ? "MISSING_PAGE"
          : missingUrl
            ? "MISSING_DESTINATION_URL"
            : null,
        blockReasonIt: missingPage
          ? "Indica la Pagina Facebook."
          : missingUrl
            ? "Indica l'URL di destinazione."
            : null,
        needsMetaVerification,
        needsPage: true,
        needsForm: false,
        needsUrl: true,
        needsTracking: false,
      };
    }

    // Other objectives + WEBSITE: conservative link-click path (not lead opt).
    return {
      metaObjective: obj,
      conversionLocation: "WEBSITE",
      optimizationGoal: "LINK_CLICKS",
      destinationType: "WEBSITE",
      trackingSource: trackingSnapshot(tracking),
      conversionEvent: tracking?.eventType ?? null,
      promotedObject: pageId ? { page_id: pageId } : null,
      destinationUrlRequired: true,
      trackingRequirement: "NOT_REQUIRED",
      valid: Boolean(pageId && url),
      blockReasonCode: !pageId
        ? "MISSING_PAGE"
        : !url
          ? "MISSING_DESTINATION_URL"
          : null,
      blockReasonIt: !pageId
        ? "Indica la Pagina Facebook."
        : !url
          ? "Indica l'URL di destinazione."
          : null,
      needsMetaVerification: [],
      needsPage: true,
      needsForm: false,
      needsUrl: true,
      needsTracking: false,
    };
  }

  if (obj === "OUTCOME_AWARENESS") {
    return {
      metaObjective: obj,
      conversionLocation: "UNRESOLVED",
      optimizationGoal: "REACH",
      destinationType: null,
      trackingSource: null,
      conversionEvent: null,
      promotedObject: null,
      destinationUrlRequired: false,
      trackingRequirement: "NOT_REQUIRED",
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
      needsMetaVerification: [],
      needsPage: false,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  if (obj === "OUTCOME_TRAFFIC") {
    return {
      metaObjective: obj,
      conversionLocation: "UNRESOLVED",
      optimizationGoal: "LINK_CLICKS",
      destinationType: null,
      trackingSource: null,
      conversionEvent: null,
      promotedObject: null,
      destinationUrlRequired: false,
      trackingRequirement: "NOT_REQUIRED",
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
      needsMetaVerification: [],
      needsPage: false,
      needsForm: false,
      needsUrl: false,
      needsTracking: false,
    };
  }

  return emptyPlan({
    metaObjective: obj,
    conversionLocation: location,
  });
}

/** Map legacy resolver shape used by preview.ts today. */
export function conversionPlanToLegacyDestOpts(
  plan: AllyConversionPublishPlan,
): {
  optimizationGoal: string | null;
  destinationType: string | null;
  promotedObject: Record<string, unknown> | null;
  needsPage: boolean;
  needsForm: boolean;
  needsUrl: boolean;
  needsTracking: boolean;
} {
  return {
    optimizationGoal: plan.optimizationGoal,
    destinationType: plan.destinationType,
    promotedObject: plan.promotedObject,
    needsPage: plan.needsPage,
    needsForm: plan.needsForm,
    needsUrl: plan.needsUrl,
    needsTracking: plan.needsTracking,
  };
}
