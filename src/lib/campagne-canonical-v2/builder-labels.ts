/**
 * ADV.2.2 — Facile / Pro labels for Canonical V2 (not raw enums alone).
 * LIVE META WRITES: 0
 */

import type {
  AudienceRoleV2,
  AudienceStrategyKindV2,
  ConversionLocationV2,
  MetaObjectiveFamilyV2,
  OptimizationEventIntentV2,
} from "@/lib/campagne-canonical-v2/types";

export const OBJECTIVE_OPTIONS_V2: {
  value: MetaObjectiveFamilyV2;
  labelIt: string;
  metaCode: string;
  hintIt: string;
}[] = [
  {
    value: "AWARENESS",
    labelIt: "Notorietà",
    metaCode: "OUTCOME_AWARENESS",
    hintIt: "Far conoscere il brand o un lancio.",
  },
  {
    value: "TRAFFIC",
    labelIt: "Traffico",
    metaCode: "OUTCOME_TRAFFIC",
    hintIt: "Portare persone sul sito o sulla destinazione.",
  },
  {
    value: "ENGAGEMENT",
    labelIt: "Interazione",
    metaCode: "OUTCOME_ENGAGEMENT",
    hintIt: "Messaggi, commenti o altre interazioni.",
  },
  {
    value: "LEADS",
    labelIt: "Contatti",
    metaCode: "OUTCOME_LEADS",
    hintIt: "Raccogliere richieste e lead.",
  },
  {
    value: "APP_PROMOTION",
    labelIt: "Promozione app",
    metaCode: "OUTCOME_APP_PROMOTION",
    hintIt: "Installazioni o eventi in-app.",
  },
  {
    value: "SALES",
    labelIt: "Vendite",
    metaCode: "OUTCOME_SALES",
    hintIt: "Acquisti e conversioni di vendita.",
  },
];

export function objectiveLabelIt(o: MetaObjectiveFamilyV2): string {
  return OBJECTIVE_OPTIONS_V2.find((x) => x.value === o)?.labelIt ?? "Da definire";
}

export function objectiveMetaCode(o: MetaObjectiveFamilyV2): string | null {
  if (o === "UNKNOWN") return null;
  return OBJECTIVE_OPTIONS_V2.find((x) => x.value === o)?.metaCode ?? null;
}

export const DESTINATION_OPTIONS_V2: {
  value: ConversionLocationV2;
  labelIt: string;
  labelPro: string;
}[] = [
  { value: "WEBSITE", labelIt: "Sito web", labelPro: "Website" },
  { value: "INSTANT_FORM", labelIt: "Modulo Instant Form", labelPro: "Instant Form" },
  { value: "MESSAGING", labelIt: "Messaggi", labelPro: "Messaging" },
  { value: "WHATSAPP", labelIt: "WhatsApp", labelPro: "WhatsApp" },
  { value: "PHONE", labelIt: "Telefono", labelPro: "Phone call" },
  { value: "APP", labelIt: "App", labelPro: "App" },
];

export function destinationLabelIt(loc: ConversionLocationV2): string {
  return (
    DESTINATION_OPTIONS_V2.find((x) => x.value === loc)?.labelIt ?? "Da definire"
  );
}

/** Destinations sensible for an objective — progressive disclosure. */
export function destinationsForObjective(
  objective: MetaObjectiveFamilyV2,
): ConversionLocationV2[] {
  switch (objective) {
    case "LEADS":
      return ["INSTANT_FORM", "WEBSITE", "WHATSAPP", "PHONE", "MESSAGING"];
    case "SALES":
      return ["WEBSITE", "APP"];
    case "TRAFFIC":
      return ["WEBSITE"];
    case "AWARENESS":
      return ["WEBSITE"];
    case "ENGAGEMENT":
      return ["WHATSAPP", "MESSAGING", "WEBSITE"];
    case "APP_PROMOTION":
      return ["APP"];
    default:
      return ["WEBSITE", "INSTANT_FORM", "WHATSAPP", "PHONE", "APP", "MESSAGING"];
  }
}

export const OPTIMIZATION_OPTIONS_V2: {
  value: OptimizationEventIntentV2;
  labelIt: string;
  objectives: MetaObjectiveFamilyV2[];
  destinations?: ConversionLocationV2[];
}[] = [
  {
    value: "PURCHASE",
    labelIt: "Acquisto",
    objectives: ["SALES"],
    destinations: ["WEBSITE"],
  },
  {
    value: "LEAD",
    labelIt: "Lead",
    objectives: ["LEADS"],
  },
  {
    value: "LANDING_PAGE_VIEW",
    labelIt: "Visualizzazione pagina di destinazione",
    objectives: ["TRAFFIC"],
    destinations: ["WEBSITE"],
  },
  {
    value: "LINK_CLICK",
    labelIt: "Clic sul link",
    objectives: ["TRAFFIC"],
    destinations: ["WEBSITE"],
  },
  {
    value: "MESSAGE",
    labelIt: "Messaggi",
    objectives: ["ENGAGEMENT", "LEADS"],
    destinations: ["WHATSAPP", "MESSAGING"],
  },
  {
    value: "APP_INSTALL",
    labelIt: "Installazione",
    objectives: ["APP_PROMOTION"],
    destinations: ["APP"],
  },
  {
    value: "APP_EVENT",
    labelIt: "Evento app",
    objectives: ["APP_PROMOTION"],
    destinations: ["APP"],
  },
];

export function optimizationsFor(
  objective: MetaObjectiveFamilyV2,
  location: ConversionLocationV2,
): OptimizationEventIntentV2[] {
  return OPTIMIZATION_OPTIONS_V2.filter((o) => {
    if (!o.objectives.includes(objective)) return false;
    if (o.destinations && !o.destinations.includes(location)) return false;
    return true;
  }).map((o) => o.value);
}

export function roleLabelIt(role: AudienceRoleV2): string {
  switch (role) {
    case "PROSPECTING":
      return "Persone nuove";
    case "RETARGETING":
      return "Persone che hanno già interagito";
    case "LOOKALIKE":
      return "Pubblico simile";
    case "MIXED":
      return "Misto";
    default:
      return "Da definire";
  }
}

export function strategyLabelIt(kind: AudienceStrategyKindV2): string {
  switch (kind) {
    case "BROAD":
      return "Pubblico ampio";
    case "ADVANTAGE_PLUS":
      return "Advantage+";
    case "MANUAL":
      return "Manuale";
    case "CUSTOM_AUDIENCE_INTENT":
      return "Custom Audience (intento)";
    case "LOOKALIKE_INTENT":
      return "Lookalike (intento)";
    default:
      return "Da definire";
  }
}
