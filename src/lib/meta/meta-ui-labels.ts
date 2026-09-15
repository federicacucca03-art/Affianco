/**
 * Client-safe Meta presentation labels (Italian).
 * No Graph. No secrets. Presentation only — never changes stored Meta values.
 */

import { mapMetaObjectiveToAffianco } from "@/lib/meta/campaign-objective";

/**
 * User-facing Meta objective label. Never returns raw OUTCOME_* codes.
 * Unknown → null (caller shows neutral fallback).
 */
export function etichettaMetaObjectiveUtente(
  raw: string | null | undefined,
): string | null {
  const mapped = mapMetaObjectiveToAffianco(raw);
  switch (mapped.affiancoObjectiveCandidate) {
    case "LEADS":
      return "Contatti";
    case "ECOMMERCE":
      return "Vendite";
    case "AWARENESS":
      return "Notorietà";
    default:
      break;
  }
  const rawUp = (raw ?? "").toUpperCase();
  if (
    rawUp === "OUTCOME_TRAFFIC" ||
    rawUp === "TRAFFIC" ||
    rawUp === "LINK_CLICKS"
  ) {
    return "Traffico";
  }
  if (
    rawUp === "OUTCOME_ENGAGEMENT" ||
    rawUp === "ENGAGEMENT" ||
    rawUp === "POST_ENGAGEMENT"
  ) {
    return "Interazioni";
  }
  return null;
}
