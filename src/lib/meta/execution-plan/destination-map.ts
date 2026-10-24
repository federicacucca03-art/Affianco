/**
 * ADV.2.1 — Canonical conversion location → Meta destination kind.
 * LIVE META WRITES: 0
 */

import type { ConversionLocationV2 } from "@/lib/campagne-canonical-v2/types";
import type { MetaDestinationCode } from "@/lib/meta/execution-plan/types";

export function mapV2LocationToMetaDestination(
  location: ConversionLocationV2,
): MetaDestinationCode {
  switch (location) {
    case "INSTANT_FORM":
      return "META_LEAD_FORM";
    case "WEBSITE":
      return "WEBSITE";
    case "WHATSAPP":
      return "WHATSAPP";
    case "PHONE":
      return "PHONE";
    case "APP":
      return "APP";
    case "MESSAGING":
      // Messaging without WhatsApp channel stays unresolved for Graph dest.
      return "UNRESOLVED";
    case "STORE":
    case "UNKNOWN":
    default:
      return "UNRESOLVED";
  }
}

export function destinationLabelIt(code: MetaDestinationCode): string {
  switch (code) {
    case "META_LEAD_FORM":
      return "Modulo Instant Form";
    case "WEBSITE":
      return "Sito web";
    case "WHATSAPP":
      return "WhatsApp";
    case "PHONE":
      return "Telefono";
    case "APP":
      return "App";
    default:
      return "Destinazione da definire";
  }
}
