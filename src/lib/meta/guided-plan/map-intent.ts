/**
 * M10B — Authoritative BusinessIntent → Meta architecture mapping.
 * Single source of truth. No component-level objective remapping.
 *
 * RETARGETING is never a Meta objective — it is audience strategy.
 */

import type {
  GuidedAudienceStrategy,
  GuidedDestinationKind,
  GuidedMetaObjectiveCode,
  GuidedProvenance,
} from "@/lib/meta/guided-plan/types";

export type AllyBusinessIntentCode =
  | "LEADS"
  | "BOOKINGS"
  | "ECOMMERCE"
  | "IN_STORE"
  | "RETARGETING"
  | "AWARENESS"
  | "UNKNOWN";

export type MappedBusinessIntent = {
  businessIntent: AllyBusinessIntentCode;
  /** Canonical Meta Campaign Objective for planning / export. */
  metaObjective: GuidedMetaObjectiveCode | null;
  /** null = must resolve from destination / booking channel. */
  metaObjectiveResolved: boolean;
  audienceStrategy: GuidedAudienceStrategy;
  /** Suggested destination when not yet explicit; null = do not invent. */
  destinationHint: GuidedDestinationKind | null;
  /** Deterministic Italian why lines (no AI). */
  why: string[];
  /** Soft requirements before Meta execution (not planning blockers). */
  technicalHints: string[];
};

function normalizeIntent(
  objective: string | null | undefined,
): AllyBusinessIntentCode {
  const o = (objective ?? "").toUpperCase();
  if (
    o === "LEADS" ||
    o === "BOOKINGS" ||
    o === "ECOMMERCE" ||
    o === "IN_STORE" ||
    o === "RETARGETING" ||
    o === "AWARENESS"
  ) {
    return o;
  }
  return "UNKNOWN";
}

/**
 * Map Ally business card / objective to Meta architecture intent.
 * Does NOT invent Instant Form / WhatsApp / Purchase when context is missing.
 */
export function mapBusinessIntentToMetaArchitecture(input: {
  objective: string | null | undefined;
  bookingChannel?: string | null | undefined;
  destinationUrl?: string | null | undefined;
  targetType?: string | null | undefined;
}): MappedBusinessIntent {
  const businessIntent = normalizeIntent(input.objective);
  const channel = (input.bookingChannel ?? "").toUpperCase();
  const hasUrl = Boolean((input.destinationUrl ?? "").trim());
  const isB2B = (input.targetType ?? "").toUpperCase() === "B2B";

  switch (businessIntent) {
    case "LEADS":
      return {
        businessIntent,
        metaObjective: "OUTCOME_LEADS",
        metaObjectiveResolved: true,
        audienceStrategy: isB2B ? "PROSPECTING" : "LOCAL",
        destinationHint: null,
        why: [
          "Perché Contatti? Perché l'obiettivo indicato è generare richieste.",
          "La destinazione (modulo, sito, messaggi o chiamata) va ancora scelta se non è stata indicata.",
        ],
        technicalHints: [],
      };

    case "BOOKINGS": {
      let dest: GuidedDestinationKind | null = null;
      if (channel === "WHATSAPP") dest = "WHATSAPP";
      else if (channel === "BOOKING_LINK" || channel === "WEBSITE")
        dest = "WEBSITE";
      else if (
        channel === "PHONE" ||
        channel === "CALL" ||
        channel === "PHONE_CALL"
      )
        dest = "PHONE";
      else if (channel === "IG_DM" || channel === "INSTAGRAM_DM")
        dest = "INSTAGRAM_DM";
      else if (channel === "FORM" || channel === "LEAD_FORM")
        dest = "META_LEAD_FORM";
      else if (hasUrl) dest = "WEBSITE";

      return {
        businessIntent,
        metaObjective: "OUTCOME_LEADS",
        metaObjectiveResolved: true,
        audienceStrategy: "LOCAL",
        destinationHint: dest,
        why: [
          "Prenotazioni resta l'obiettivo di business; su Meta si ottimizza tipicamente per Contatti.",
          dest
            ? "Il canale di prenotazione indica dove ricevere il risultato."
            : "Serve capire come avviene la prenotazione (WhatsApp, sito, chiamata, modulo).",
        ],
        technicalHints: [],
      };
    }

    case "ECOMMERCE":
      return {
        businessIntent,
        metaObjective: "OUTCOME_SALES",
        metaObjectiveResolved: true,
        audienceStrategy: "PROSPECTING",
        destinationHint: "WEBSITE",
        why: [
          "Perché Vendite? Perché l'obiettivo indicato è generare acquisti online.",
        ],
        technicalHints: [
          "Tracking acquisti da verificare su Meta",
        ],
      };

    case "IN_STORE":
      return {
        businessIntent,
        metaObjective: "OUTCOME_TRAFFIC",
        metaObjectiveResolved: true,
        audienceStrategy: "LOCAL",
        destinationHint: hasUrl ? "MAPS" : null,
        why: [
          "Più gente in negozio è un risultato di business locale.",
          "Ally propone Traffico come obiettivo Meta supportato, senza inventare obiettivi legacy non gestiti.",
        ],
        technicalHints: [],
      };

    case "RETARGETING":
      return {
        businessIntent,
        metaObjective: "OUTCOME_SALES",
        metaObjectiveResolved: true,
        audienceStrategy: "RETARGETING",
        destinationHint: hasUrl ? "WEBSITE" : null,
        why: [
          "Recuperare chi non ha comprato è una strategia di pubblico (retargeting), non un obiettivo Meta.",
          "Su Meta si propone Vendite + pubblico di retargeting, salvo diversa destinazione esplicita.",
        ],
        technicalHints: [
          "Serve scegliere o creare il pubblico di retargeting su Meta.",
        ],
      };

    case "AWARENESS":
      return {
        businessIntent,
        metaObjective: "OUTCOME_AWARENESS",
        metaObjectiveResolved: true,
        audienceStrategy: "LOCAL",
        destinationHint: hasUrl ? "WEBSITE" : "NOT_REQUIRED",
        why: [
          "Perché Notorietà? Perché l'intento è far conoscere un'apertura o un lancio locale.",
        ],
        technicalHints: [],
      };

    default:
      return {
        businessIntent: "UNKNOWN",
        metaObjective: null,
        metaObjectiveResolved: false,
        audienceStrategy: "UNKNOWN",
        destinationHint: null,
        why: ["Obiettivo di business non ancora chiaro."],
        technicalHints: [],
      };
  }
}

export type ResolvedGuidedDestination = {
  kind: GuidedDestinationKind;
  provenance: GuidedProvenance;
  note: string | null;
};

/**
 * Resolve destination from explicit wizard signals without inventing Instant Form.
 *
 * Critical: formId / pageId alone MUST NOT invent META_LEAD_FORM.
 * Only explicit destination choice or an explicit booking channel may.
 */
export function resolveGuidedDestination(input: {
  businessIntent: AllyBusinessIntentCode;
  bookingChannel?: string | null;
  destinationUrl?: string | null;
  formId?: string | null;
  whatsappNumber?: string | null;
  hint: GuidedDestinationKind | null;
  explicitDestination?: GuidedDestinationKind | null;
  bookingChannelUserChosen?: boolean | null;
}): ResolvedGuidedDestination {
  const explicit = input.explicitDestination;
  if (
    explicit &&
    explicit !== "UNKNOWN" &&
    explicit !== "NOT_REQUIRED"
  ) {
    const formId = (input.formId ?? "").trim();
    return {
      kind: explicit,
      provenance: "EXPLICIT",
      note:
        explicit === "META_LEAD_FORM" && !formId
          ? "Se scegli Modulo Meta, dovrai indicare quale modulo utilizzare."
          : null,
    };
  }

  const channel = (input.bookingChannel ?? "").toUpperCase();
  const url = (input.destinationUrl ?? "").trim();
  const channelChosen = Boolean(input.bookingChannelUserChosen);
  const channelProv: GuidedProvenance = channelChosen
    ? "EXPLICIT"
    : "INFERRED";

  if (channel === "WHATSAPP") {
    return {
      kind: "WHATSAPP",
      provenance: channelProv,
      note: channelChosen
        ? null
        : "Canale predefinito per prenotazioni — conferma o cambia",
    };
  }
  if (
    channel === "PHONE" ||
    channel === "CALL" ||
    channel === "PHONE_CALL"
  ) {
    return { kind: "PHONE", provenance: channelProv, note: null };
  }
  if (channel === "IG_DM" || channel === "INSTAGRAM_DM") {
    return { kind: "INSTAGRAM_DM", provenance: channelProv, note: null };
  }
  if (channel === "FORM" || channel === "LEAD_FORM") {
    return {
      kind: "META_LEAD_FORM",
      provenance: channelProv,
      note: "Se scegli Modulo Meta, dovrai indicare quale modulo utilizzare.",
    };
  }
  if (channel === "BOOKING_LINK" || channel === "WEBSITE") {
    return {
      kind: "WEBSITE",
      provenance: channelProv,
      note: url ? null : "URL di destinazione da indicare",
    };
  }

  // WhatsApp number alone does NOT invent destination for LEADS without choice.
  if (url) {
    const lower = url.toLowerCase();
    if (lower.includes("maps.google") || lower.includes("goo.gl/maps")) {
      return { kind: "MAPS", provenance: "EXPLICIT", note: null };
    }
    return { kind: "WEBSITE", provenance: "EXPLICIT", note: null };
  }

  if (input.hint === "NOT_REQUIRED") {
    return {
      kind: "NOT_REQUIRED",
      provenance: "INFERRED",
      note: "Per Notorietà la destinazione può non essere necessaria",
    };
  }

  // Do not apply destination hints that invent Instant Form for LEADS.
  if (
    input.hint != null &&
    input.hint !== "UNKNOWN" &&
    !(
      input.businessIntent === "LEADS" &&
      input.hint === "META_LEAD_FORM"
    )
  ) {
    return {
      kind: input.hint,
      provenance: "INFERRED",
      note: "Suggerimento Ally — conferma o cambia",
    };
  }

  if (
    input.businessIntent === "LEADS" ||
    input.businessIntent === "BOOKINGS" ||
    input.businessIntent === "ECOMMERCE" ||
    input.businessIntent === "IN_STORE" ||
    input.businessIntent === "RETARGETING"
  ) {
    return {
      kind: "UNKNOWN",
      provenance: "MISSING",
      note: "Come vuoi ricevere il risultato?",
    };
  }

  return { kind: "UNKNOWN", provenance: "MISSING", note: null };
}
