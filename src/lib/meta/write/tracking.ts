/**
 * P0.1 — Canonical Ally website conversion tracking model.
 * Survives Pixel vs Dataset Graph naming; Easy Mode stays human-readable.
 * No Graph writes.
 */

/** Ally-facing tracking asset kind (Graph may say pixel or dataset). */
export type AllyTrackingSourceType = "PIXEL" | "DATASET" | "NONE";

/**
 * Standard website conversion events for first professional flows.
 * Maps to Meta `custom_event_type` on promoted_object when publishing.
 */
export type AllyWebsiteConversionEvent =
  | "LEAD"
  | "PURCHASE"
  | "COMPLETE_REGISTRATION"
  | "CONTACT"
  | "SUBMIT_APPLICATION"
  | "SCHEDULE"
  | "START_TRIAL"
  | "SUBSCRIBE"
  | "ADD_TO_CART"
  | "INITIATE_CHECKOUT"
  | "VIEW_CONTENT"
  | "SEARCH"
  | "ADD_PAYMENT_INFO"
  | "OTHER";

export type AllyTrackingVerificationStatus =
  | "UNVERIFIED"
  | "DISCOVERED"
  | "SELECTED"
  | "OBSERVED_ON_IMPORT"
  | "UNAVAILABLE";

/** Durable tracking selection used by plan → preview → publish. */
export type AllyWebsiteTrackingConfig = {
  sourceType: AllyTrackingSourceType;
  /** Meta pixel_id or dataset_id (never invent). */
  sourceId: string | null;
  sourceName: string | null;
  /** Selected standard event → Graph custom_event_type. */
  eventType: AllyWebsiteConversionEvent | null;
  /** Optional custom conversion id when Meta requires it. */
  customConversionId: string | null;
  verificationStatus: AllyTrackingVerificationStatus;
  /** Ad account this asset was selected against (act_…). */
  metaAdAccountId: string | null;
};

export const DEFAULT_ALLY_WEBSITE_TRACKING: AllyWebsiteTrackingConfig = {
  sourceType: "NONE",
  sourceId: null,
  sourceName: null,
  eventType: null,
  customConversionId: null,
  verificationStatus: "UNVERIFIED",
  metaAdAccountId: null,
};

const SOURCE_TYPES = new Set<AllyTrackingSourceType>([
  "PIXEL",
  "DATASET",
  "NONE",
]);

const EVENT_TYPES = new Set<AllyWebsiteConversionEvent>([
  "LEAD",
  "PURCHASE",
  "COMPLETE_REGISTRATION",
  "CONTACT",
  "SUBMIT_APPLICATION",
  "SCHEDULE",
  "START_TRIAL",
  "SUBSCRIBE",
  "ADD_TO_CART",
  "INITIATE_CHECKOUT",
  "VIEW_CONTENT",
  "SEARCH",
  "ADD_PAYMENT_INFO",
  "OTHER",
]);

export function parseAllyTrackingSourceType(
  raw: unknown,
): AllyTrackingSourceType | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  return SOURCE_TYPES.has(v as AllyTrackingSourceType)
    ? (v as AllyTrackingSourceType)
    : null;
}

export function parseAllyWebsiteConversionEvent(
  raw: unknown,
): AllyWebsiteConversionEvent | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  return EVENT_TYPES.has(v as AllyWebsiteConversionEvent)
    ? (v as AllyWebsiteConversionEvent)
    : null;
}

export function parseAllyWebsiteTrackingConfig(
  raw: unknown,
): AllyWebsiteTrackingConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sourceType =
    parseAllyTrackingSourceType(o.sourceType) ??
    parseAllyTrackingSourceType(o.trackingSourceType);
  if (!sourceType) return null;
  const eventType =
    parseAllyWebsiteConversionEvent(o.eventType) ??
    parseAllyWebsiteConversionEvent(o.customEventType) ??
    parseAllyWebsiteConversionEvent(o.meta_conversion_event);
  const sourceIdRaw =
    typeof o.sourceId === "string"
      ? o.sourceId
      : typeof o.pixelId === "string"
        ? o.pixelId
        : typeof o.datasetId === "string"
          ? o.datasetId
          : typeof o.meta_tracking_source_id === "string"
            ? o.meta_tracking_source_id
            : null;
  const sourceId = sourceIdRaw?.trim() || null;
  const sourceNameRaw =
    typeof o.sourceName === "string"
      ? o.sourceName
      : typeof o.meta_tracking_source_name === "string"
        ? o.meta_tracking_source_name
        : null;
  const customConversionId =
    typeof o.customConversionId === "string" && o.customConversionId.trim()
      ? o.customConversionId.trim()
      : null;
  const verificationStatus =
    o.verificationStatus === "UNVERIFIED" ||
    o.verificationStatus === "DISCOVERED" ||
    o.verificationStatus === "SELECTED" ||
    o.verificationStatus === "OBSERVED_ON_IMPORT" ||
    o.verificationStatus === "UNAVAILABLE"
      ? o.verificationStatus
      : "UNVERIFIED";
  const metaAdAccountId =
    typeof o.metaAdAccountId === "string" && o.metaAdAccountId.trim()
      ? o.metaAdAccountId.trim()
      : null;

  return {
    sourceType,
    sourceId,
    sourceName: sourceNameRaw?.trim() || null,
    eventType,
    customConversionId,
    verificationStatus,
    metaAdAccountId,
  };
}

/** True when config can drive OFFSITE_CONVERSIONS promoted_object. */
export function hasUsableWebsiteTracking(
  tracking: AllyWebsiteTrackingConfig | null | undefined,
): boolean {
  if (!tracking) return false;
  if (tracking.sourceType === "NONE") return false;
  if (!(tracking.sourceId ?? "").trim()) return false;
  if (!tracking.eventType || tracking.eventType === "OTHER") return false;
  return tracking.sourceType === "PIXEL" || tracking.sourceType === "DATASET";
}

/**
 * Build Meta Ad Set promoted_object tracking fields.
 * PIXEL → pixel_id; DATASET → dataset_id (NEEDS_META_VERIFICATION if Graph rejects).
 */
export function buildTrackingPromotedObjectFields(
  tracking: AllyWebsiteTrackingConfig,
): Record<string, string> | null {
  if (!hasUsableWebsiteTracking(tracking)) return null;
  const id = tracking.sourceId!.trim();
  const event = tracking.eventType!;
  const out: Record<string, string> = {
    custom_event_type: event,
  };
  if (tracking.sourceType === "PIXEL") {
    out.pixel_id = id;
  } else if (tracking.sourceType === "DATASET") {
    // Meta Conversions API / Dataset identity — verify live before relying on write.
    out.dataset_id = id;
  }
  if (tracking.customConversionId) {
    out.custom_conversion_id = tracking.customConversionId;
  }
  return out;
}

/** Normalize imported Meta promoted_object → Ally tracking (partial OK). */
export function trackingFromImportedPromotedObject(
  promoted: Record<string, unknown> | null | undefined,
  metaAdAccountId: string | null,
): AllyWebsiteTrackingConfig | null {
  if (!promoted || typeof promoted !== "object") return null;
  const pixelId =
    typeof promoted.pixel_id === "string" && promoted.pixel_id.trim()
      ? promoted.pixel_id.trim()
      : null;
  const datasetId =
    typeof promoted.dataset_id === "string" && promoted.dataset_id.trim()
      ? promoted.dataset_id.trim()
      : null;
  if (!pixelId && !datasetId) return null;
  const eventType = parseAllyWebsiteConversionEvent(promoted.custom_event_type);
  const customConversionId =
    typeof promoted.custom_conversion_id === "string" &&
    promoted.custom_conversion_id.trim()
      ? promoted.custom_conversion_id.trim()
      : null;
  return {
    sourceType: pixelId ? "PIXEL" : "DATASET",
    sourceId: pixelId ?? datasetId,
    sourceName: null,
    eventType,
    customConversionId,
    verificationStatus: "OBSERVED_ON_IMPORT",
    metaAdAccountId,
  };
}

export function etichettaConversionEvent(
  event: AllyWebsiteConversionEvent | null,
): string {
  switch (event) {
    case "LEAD":
      return "Lead";
    case "PURCHASE":
      return "Acquisto (Purchase)";
    case "COMPLETE_REGISTRATION":
      return "Registrazione completata";
    case "CONTACT":
      return "Contatto";
    case "SUBMIT_APPLICATION":
      return "Invio candidatura";
    case "SCHEDULE":
      return "Prenotazione";
    case "START_TRIAL":
      return "Inizio prova";
    case "SUBSCRIBE":
      return "Iscrizione";
    case "ADD_TO_CART":
      return "Aggiungi al carrello";
    case "INITIATE_CHECKOUT":
      return "Inizio checkout";
    case "VIEW_CONTENT":
      return "Visualizzazione contenuto";
    case "SEARCH":
      return "Ricerca";
    case "ADD_PAYMENT_INFO":
      return "Info pagamento";
    default:
      return "Evento non selezionato";
  }
}

export function recommendedEventForObjective(
  metaObjective: string | null,
): AllyWebsiteConversionEvent | null {
  if (metaObjective === "OUTCOME_LEADS") return "LEAD";
  if (metaObjective === "OUTCOME_SALES") return "PURCHASE";
  return null;
}

/** Safe for logs — never print full Meta tracking IDs. */
export function maskTrackingSourceId(id: string | null | undefined): string {
  const s = (id ?? "").trim();
  if (!s) return "(none)";
  if (s.length <= 6) return "***";
  return `${s.slice(0, 3)}…${s.slice(-3)}`;
}
