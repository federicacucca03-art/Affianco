/**
 * UX.4.5.2 — Canonical Meta CTA type ↔ Italian label (execution parity).
 * Only enums actually used by Ally write/publish paths.
 * LIVE META WRITES: 0
 */

/** CTA types currently emitted by Ally publish / creative packages. */
export type AllySupportedMetaCtaType =
  | "SIGN_UP"
  | "LEARN_MORE"
  | "WHATSAPP_MESSAGE"
  | "CALL_NOW";

/**
 * Instant Form / META_LEAD_FORM execution CTA.
 * CONTACT_US / GET_QUOTE are NOT in the current write path.
 */
export const INSTANT_FORM_META_CTA_TYPE: AllySupportedMetaCtaType = "SIGN_UP";

/** Faithful Italian labels for supported Meta enums only. */
export const ALLY_META_CTA_LABEL_IT: Record<AllySupportedMetaCtaType, string> = {
  SIGN_UP: "Iscriviti",
  LEARN_MORE: "Scopri di più",
  WHATSAPP_MESSAGE: "WhatsApp",
  CALL_NOW: "Chiama ora",
};

export function isAllySupportedMetaCtaType(
  v: string | null | undefined,
): v is AllySupportedMetaCtaType {
  return (
    v === "SIGN_UP" ||
    v === "LEARN_MORE" ||
    v === "WHATSAPP_MESSAGE" ||
    v === "CALL_NOW"
  );
}

/** Label for a Meta CTA type — never invents a friendlier meaning. */
export function allyMetaCtaLabelIt(
  type: string | null | undefined,
): string {
  if (!type) return "";
  if (isAllySupportedMetaCtaType(type)) return ALLY_META_CTA_LABEL_IT[type];
  return type;
}

export function metaCtaTypeForDestination(
  destination: string | null | undefined,
): AllySupportedMetaCtaType | null {
  switch (destination) {
    case "META_LEAD_FORM":
    case "INSTANT_FORM":
      return INSTANT_FORM_META_CTA_TYPE;
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

/** Pair used by Facile / Pro / Preview / Review / launch package. */
export function resolveAllyMetaCta(destination: string | null | undefined): {
  type: AllySupportedMetaCtaType | null;
  labelIt: string;
} {
  const type = metaCtaTypeForDestination(destination);
  return { type, labelIt: allyMetaCtaLabelIt(type) };
}
