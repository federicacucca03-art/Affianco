import type { CampagnaObjective } from "@/types/campagne";

export type ObjectiveMappingConfidence = "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";

export type MetaObjectiveMapping = {
  rawObjective: string | null;
  affiancoObjectiveCandidate: CampagnaObjective | null;
  mappingConfidence: ObjectiveMappingConfidence;
};

const CONFIDENT_LEADS = new Set(["LEADS", "OUTCOME_LEADS"]);
const AMBIGUOUS_ECOMMERCE = new Set([
  "OUTCOME_SALES",
  "CONVERSIONS",
  "PRODUCT_CATALOG_SALES",
  "CATALOG_SALES",
]);
const AMBIGUOUS_AWARENESS = new Set([
  "BRAND_AWARENESS",
  "REACH",
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "AWARENESS",
]);

export function mapMetaObjectiveToAffianco(
  raw: string | null | undefined,
): MetaObjectiveMapping {
  const rawObjective =
    typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : null;
  if (!rawObjective) {
    return {
      rawObjective: null,
      affiancoObjectiveCandidate: null,
      mappingConfidence: "UNKNOWN",
    };
  }
  if (CONFIDENT_LEADS.has(rawObjective)) {
    return {
      rawObjective,
      affiancoObjectiveCandidate: "LEADS",
      mappingConfidence: "CONFIDENT",
    };
  }
  if (AMBIGUOUS_ECOMMERCE.has(rawObjective)) {
    return {
      rawObjective,
      affiancoObjectiveCandidate: "ECOMMERCE",
      mappingConfidence: "AMBIGUOUS",
    };
  }
  if (AMBIGUOUS_AWARENESS.has(rawObjective)) {
    return {
      rawObjective,
      affiancoObjectiveCandidate: "AWARENESS",
      mappingConfidence: "AMBIGUOUS",
    };
  }
  return {
    rawObjective,
    affiancoObjectiveCandidate: null,
    mappingConfidence: "UNKNOWN",
  };
}
