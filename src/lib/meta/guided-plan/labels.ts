/**
 * M10B — Italian labels for guided Meta architecture (presentation only).
 */

import type {
  GuidedAudienceStrategy,
  GuidedDestinationKind,
  GuidedMetaObjectiveCode,
  GuidedPlacementsStrategy,
  GuidedProvenance,
} from "@/lib/meta/guided-plan/types";

export function etichettaGuidedProvenance(p: GuidedProvenance): string {
  switch (p) {
    case "EXPLICIT":
      return "Scelta tua";
    case "BRIEF":
      return "Dal brief";
    case "INFERRED":
      return "Proposto da Ally";
    case "EXISTING":
      return "Già in Ally";
    case "MISSING":
      return "Da completare";
    case "META_MANAGED":
      return "Gestita su Meta";
    default:
      return "Da completare";
  }
}

export function etichettaGuidedMetaObjective(
  code: GuidedMetaObjectiveCode | null,
): string {
  switch (code) {
    case "OUTCOME_LEADS":
      return "Contatti";
    case "OUTCOME_SALES":
      return "Vendite";
    case "OUTCOME_AWARENESS":
      return "Notorietà";
    case "OUTCOME_TRAFFIC":
      return "Traffico";
    case "OUTCOME_ENGAGEMENT":
      return "Interazioni";
    default:
      return "Da definire";
  }
}

export function etichettaGuidedDestination(
  kind: GuidedDestinationKind | null,
): string {
  switch (kind) {
    case "META_LEAD_FORM":
      return "Modulo Meta";
    case "WEBSITE":
      return "Sito web";
    case "WHATSAPP":
      return "Messaggi WhatsApp";
    case "PHONE":
      return "Chiamate";
    case "INSTAGRAM_DM":
      return "Messaggi Instagram";
    case "MAPS":
      return "Indicazioni / Maps";
    case "NOT_REQUIRED":
      return "Non richiesta";
    case "UNKNOWN":
    default:
      return "Da scegliere";
  }
}

export function etichettaGuidedAudience(
  strategy: GuidedAudienceStrategy | null,
): string {
  switch (strategy) {
    case "PROSPECTING":
      return "Persone nuove (prospecting)";
    case "LOCAL":
      return "Pubblico locale";
    case "BROAD":
      return "Pubblico ampio";
    case "RETARGETING":
      return "Chi ti conosce già (retargeting)";
    case "UNKNOWN":
    default:
      return "Da definire";
  }
}

export function etichettaGuidedPlacements(
  strategy: GuidedPlacementsStrategy | null,
): string {
  switch (strategy) {
    case "ADVANTAGE_PLUS":
      return "Distribuzione automatica Meta";
    case "MANUAL":
      return "Posizionamenti manuali";
    case "META_DEFAULT":
    default:
      return "Gestita su Meta";
  }
}

/** Business-goal card titles (Ally entry language). */
export function etichettaBusinessGoalFromObjective(
  objective: string | null | undefined,
): string {
  switch ((objective ?? "").toUpperCase()) {
    case "LEADS":
      return "Più richieste di contatto";
    case "BOOKINGS":
      return "Più prenotazioni";
    case "ECOMMERCE":
      return "Più vendite online";
    case "IN_STORE":
      return "Più gente in negozio";
    case "RETARGETING":
      return "Recuperare chi non ha comprato";
    case "AWARENESS":
      return "Far conoscere un'apertura";
    default:
      return "Obiettivo campagna";
  }
}
