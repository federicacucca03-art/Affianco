/**
 * ADV.2.1 — Canonical V2 objective → Meta OUTCOME_* (no silent remaps).
 * LIVE META WRITES: 0
 */

import type { MetaObjectiveFamilyV2 } from "@/lib/campagne-canonical-v2/types";
import type { MetaObjectiveCode } from "@/lib/meta/execution-plan/types";

const MAP: Record<MetaObjectiveFamilyV2, MetaObjectiveCode> = {
  AWARENESS: "OUTCOME_AWARENESS",
  TRAFFIC: "OUTCOME_TRAFFIC",
  ENGAGEMENT: "OUTCOME_ENGAGEMENT",
  LEADS: "OUTCOME_LEADS",
  APP_PROMOTION: "OUTCOME_APP_PROMOTION",
  SALES: "OUTCOME_SALES",
  UNKNOWN: "UNRESOLVED",
};

export function mapV2ObjectiveToMeta(
  objective: MetaObjectiveFamilyV2,
): MetaObjectiveCode {
  return MAP[objective] ?? "UNRESOLVED";
}

/** Human Facile label — never invents a different Meta objective. */
export function metaObjectiveLabelIt(code: MetaObjectiveCode): string {
  switch (code) {
    case "OUTCOME_AWARENESS":
      return "Notorietà";
    case "OUTCOME_TRAFFIC":
      return "Traffico";
    case "OUTCOME_ENGAGEMENT":
      return "Interazione";
    case "OUTCOME_LEADS":
      return "Contatti";
    case "OUTCOME_APP_PROMOTION":
      return "Promozione app";
    case "OUTCOME_SALES":
      return "Vendite";
    default:
      return "Obiettivo da definire";
  }
}
