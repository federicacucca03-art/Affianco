/**
 * M10E — Destination / promoted_object helpers (ads_read evidence only).
 */

export type DestinationKind =
  | "NATIVE_META"
  | "WEBSITE"
  | "MESSAGING"
  | "UNKNOWN";

const NATIVE = new Set([
  "ON_AD",
  "ON_PAGE",
  "ON_EVENT",
  "ON_VIDEO",
  "ON_POST",
  "LEAD_FORM", // if ever returned
]);

const WEBSITE = new Set(["WEBSITE", "WEBSITE_APP"]);

const MESSAGING = new Set([
  "MESSENGER",
  "INSTAGRAM_DIRECT",
  "WHATSAPP",
  "PHONE_CALL",
]);

export function resolveDestinationKind(
  destinationType: string | null,
): DestinationKind {
  if (!destinationType?.trim()) return "UNKNOWN";
  const key = destinationType.trim().toUpperCase();
  if (NATIVE.has(key)) return "NATIVE_META";
  if (WEBSITE.has(key)) return "WEBSITE";
  if (MESSAGING.has(key)) return "MESSAGING";
  return "UNKNOWN";
}

export function promotedObjectFlags(obj: Record<string, unknown> | null): {
  present: boolean;
  hasPage: boolean;
  hasPixel: boolean;
  hasApp: boolean;
} {
  if (!obj || typeof obj !== "object") {
    return { present: false, hasPage: false, hasPixel: false, hasApp: false };
  }
  const hasPage =
    typeof obj.page_id === "string" && obj.page_id.trim().length > 0;
  const hasPixel =
    typeof obj.pixel_id === "string" && obj.pixel_id.trim().length > 0;
  const hasApp =
    typeof obj.application_id === "string" &&
    obj.application_id.trim().length > 0;
  return {
    present: hasPage || hasPixel || hasApp || Object.keys(obj).length > 0,
    hasPage,
    hasPixel,
    hasApp,
  };
}

export function hasAttributionConfigured(spec: unknown): boolean {
  return Array.isArray(spec) && spec.length > 0;
}

const LEAD_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "omni_lead",
]);

const PURCHASE_ACTIONS = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
]);

const LPV_ACTIONS = new Set(["landing_page_view", "omni_landing_page_view"]);

const LINK_CLICK_ACTIONS = new Set(["link_click", "outbound_click"]);

/** Outcome-relevant action types for Tracking Health evidence (not engagement noise). */
const RELEVANT_RESULT_ACTIONS = new Set([
  ...LEAD_ACTIONS,
  ...PURCHASE_ACTIONS,
  ...LPV_ACTIONS,
]);

export function hasLeadEvent(types: string[]): boolean {
  return types.some((t) => LEAD_ACTIONS.has(t));
}

export function hasPurchaseEvent(types: string[]): boolean {
  return types.some((t) => PURCHASE_ACTIONS.has(t));
}

export function hasLpvEvent(types: string[]): boolean {
  return types.some((t) => LPV_ACTIONS.has(t));
}

export function hasLinkClickOnly(types: string[]): boolean {
  const hasLink = types.some((t) => LINK_CLICK_ACTIONS.has(t));
  return hasLink && !hasLpvEvent(types);
}

export function listLeadActionTypes(types: string[]): string[] {
  return types.filter((t) => LEAD_ACTIONS.has(t));
}

export function partitionObservedActions(types: string[]): {
  relevantResultActions: string[];
  otherObservedActions: string[];
} {
  const relevantResultActions: string[] = [];
  const otherObservedActions: string[] = [];
  for (const t of types) {
    if (RELEVANT_RESULT_ACTIONS.has(t)) relevantResultActions.push(t);
    else otherObservedActions.push(t);
  }
  return { relevantResultActions, otherObservedActions };
}

export function etichettaRelevantResultSummary(actions: string[]): string {
  if (actions.length === 0) return "Nessuno nel periodo";
  const parts: string[] = [];
  if (actions.some((a) => LEAD_ACTIONS.has(a))) parts.push("Lead rilevati");
  if (actions.some((a) => PURCHASE_ACTIONS.has(a))) parts.push("Acquisti rilevati");
  if (actions.some((a) => LPV_ACTIONS.has(a))) {
    parts.push("Visualizzazioni pagina di destinazione");
  }
  return parts.length > 0 ? parts.join(" · ") : actions.join(", ");
}
