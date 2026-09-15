/**
 * M10C — Italian labels for objective-aware performance metrics.
 */

import type {
  PerformanceMetricId,
  PerformanceObjectiveFamily,
} from "@/lib/meta/objective-performance/types";

export function etichettaPerformanceFamily(
  family: PerformanceObjectiveFamily,
): string {
  switch (family) {
    case "LEADS":
      return "Contatti";
    case "SALES":
      return "Vendite";
    case "TRAFFIC":
      return "Traffico";
    case "AWARENESS":
      return "Notorietà";
    case "ENGAGEMENT":
      return "Interazioni";
    default:
      return "Obiettivo non supportato";
  }
}

export function etichettaPerformanceMetric(id: PerformanceMetricId): string {
  switch (id) {
    case "results":
      return "Risultati";
    case "cost_per_result":
      return "Costo per risultato";
    case "spend":
      return "Spesa";
    case "ctr":
      return "CTR";
    case "cpc":
      return "CPC";
    case "purchases":
      return "Acquisti";
    case "cost_per_purchase":
      return "Costo per acquisto";
    case "roas":
      return "ROAS";
    case "landing_page_views":
      return "Visite landing";
    case "cost_per_lpv":
      return "Costo per visita";
    case "link_clicks":
      return "Click sul link";
    case "reach":
      return "Copertura";
    case "impressions":
      return "Impression";
    case "frequency":
      return "Frequenza";
    case "cpm":
      return "CPM";
    case "engagement":
      return "Interazioni";
    case "cost_per_engagement":
      return "Costo per interazione";
    default:
      return id;
  }
}

/** Hierarchy compact labels for results / cost columns. */
export function etichetteHierarchyOutcome(family: PerformanceObjectiveFamily): {
  results: string;
  costPerResult: string;
} {
  switch (family) {
    case "SALES":
      return { results: "Acquisti", costPerResult: "Costo per acquisto" };
    case "TRAFFIC":
      return { results: "Visite / click", costPerResult: "Costo per visita" };
    case "AWARENESS":
      return { results: "Copertura", costPerResult: "CPM" };
    case "ENGAGEMENT":
      return { results: "Interazioni", costPerResult: "Costo per interazione" };
    case "LEADS":
      return { results: "Risultati", costPerResult: "Costo per risultato" };
    default:
      return { results: "Risultati", costPerResult: "Costo / risultato" };
  }
}
