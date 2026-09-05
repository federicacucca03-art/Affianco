/**
 * M9.2A — field-level configuration inventory for Ask Ally.
 * Distinguishes complete / missing / unavailable.
 * Reuses calculateLaunchReadiness — does not invent a second readiness engine.
 */

import {
  calculateLaunchReadiness,
  richiedeDestinationUrl,
  richiedeModuloContatti,
  type LaunchReadinessResult,
} from "@/lib/launch-readiness";
import type { BookingChannel, CampagnaObjective } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";

export type AllyCopilotFieldStatus = "complete" | "missing" | "unavailable";

export type AllyCopilotConfigField = {
  id: string;
  label: string;
  status: AllyCopilotFieldStatus;
  /** Short human summary when complete. */
  value: string | null;
};

export type AllyCopilotNativePlanningSnapshot = {
  objective: string | null;
  clientName: string;
  settore: string | null;
  citta: string | null;
  offer: string | null;
  dailyBudget: number | null;
  maxSustainableCpa: number | null;
  targetMargin: number | null;
  etaMin: number | null;
  etaMax: number | null;
  raggioKm: number | null;
  targetType: string | null;
  targetAge: string | null;
  headline: string | null;
  copyVariants: string[];
  hasCreativeAsset: boolean;
  creativeFormatHint: string | null;
  pageId: string | null;
  formId: string | null;
  website: string | null;
  bookingChannel: string | null;
  status: string | null;
  approvedAt: string | null;
};

function field(
  id: string,
  label: string,
  status: AllyCopilotFieldStatus,
  value: string | null = null,
): AllyCopilotConfigField {
  return { id, label, status, value };
}

function present(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function numOk(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && v > 0;
}

/**
 * Build inventory from fields we actually loaded for Copilot.
 * Every field listed here was supplied to the context builder:
 * - empty → missing
 * - filled → complete
 * Strategic Score is intentionally unavailable (not recomputed server-side).
 */
export function buildAllyCopilotConfigurationInventory(
  snap: AllyCopilotNativePlanningSnapshot,
): {
  fields: AllyCopilotConfigField[];
  launchReadiness: LaunchReadinessResult;
} {
  const objective = snap.objective
    ? normalizzaObjective(snap.objective)
    : undefined;
  const bookingChannel = (snap.bookingChannel ?? undefined) as
    | BookingChannel
    | undefined;

  const fields: AllyCopilotConfigField[] = [
    field(
      "objective",
      "Obiettivo",
      present(snap.objective) ? "complete" : "missing",
      snap.objective,
    ),
    field(
      "client",
      "Cliente",
      present(snap.clientName) ? "complete" : "missing",
      snap.clientName,
    ),
    field(
      "settore",
      "Settore",
      present(snap.settore) ? "complete" : "missing",
      snap.settore,
    ),
    field(
      "citta",
      "Località",
      present(snap.citta) ? "complete" : "missing",
      snap.citta,
    ),
    field(
      "offer",
      "Offerta",
      present(snap.offer) ? "complete" : "missing",
      snap.offer ? snap.offer.slice(0, 120) : null,
    ),
    field(
      "audienceAge",
      "Fascia d'età",
      snap.etaMin != null && snap.etaMax != null
        ? "complete"
        : present(snap.targetAge)
          ? "complete"
          : "missing",
      snap.etaMin != null && snap.etaMax != null
        ? `${snap.etaMin}–${snap.etaMax}`
        : snap.targetAge,
    ),
    field(
      "geography",
      "Geografia / raggio",
      present(snap.citta) || numOk(snap.raggioKm) ? "complete" : "missing",
      [
        snap.citta,
        numOk(snap.raggioKm) ? `raggio ${snap.raggioKm} km` : null,
      ]
        .filter(Boolean)
        .join(", ") || null,
    ),
    field(
      "targetType",
      "Tipo target",
      present(snap.targetType) ? "complete" : "missing",
      snap.targetType,
    ),
    field(
      "budget",
      "Budget giornaliero",
      numOk(snap.dailyBudget) ? "complete" : "missing",
      numOk(snap.dailyBudget) ? `${snap.dailyBudget}€/giorno` : null,
    ),
    field(
      "sustainableTarget",
      "Soglia sostenibile",
      numOk(snap.maxSustainableCpa) ? "complete" : "missing",
      numOk(snap.maxSustainableCpa)
        ? `${snap.maxSustainableCpa}€`
        : null,
    ),
    field(
      "copy",
      "Testi / copy",
      snap.copyVariants.length > 0 ? "complete" : "missing",
      snap.copyVariants.length > 0
        ? `${snap.copyVariants.length} variant${snap.copyVariants.length === 1 ? "e" : "i"}`
        : null,
    ),
    field(
      "headline",
      "Titolo annuncio",
      present(snap.headline) ? "complete" : "missing",
      snap.headline ? snap.headline.slice(0, 100) : null,
    ),
    field(
      "creative",
      "Creatività",
      snap.hasCreativeAsset ? "complete" : "missing",
      snap.hasCreativeAsset
        ? snap.creativeFormatHint || "Asset presente"
        : null,
    ),
    field(
      "pageId",
      "Pagina Facebook",
      present(snap.pageId) ? "complete" : "missing",
      present(snap.pageId) ? "ID presente" : null,
    ),
    field(
      "destination",
      richiedeDestinationUrl(objective as CampagnaObjective | undefined)
        ? "URL di destinazione"
        : richiedeModuloContatti(
              objective as CampagnaObjective | undefined,
              bookingChannel,
            )
          ? "Modulo contatti"
          : "Destinazione",
      richiedeDestinationUrl(objective as CampagnaObjective | undefined)
        ? present(snap.website)
          ? "complete"
          : "missing"
        : richiedeModuloContatti(
              objective as CampagnaObjective | undefined,
              bookingChannel,
            )
          ? present(snap.formId)
            ? "complete"
            : "missing"
          : present(snap.website) || present(snap.formId)
            ? "complete"
            : "missing",
      present(snap.website)
        ? "URL presente"
        : present(snap.formId)
          ? "Modulo presente"
          : null,
    ),
    field(
      "approval",
      "Approvazione cliente",
      (snap.status ?? "").toUpperCase() === "APPROVED" ||
        present(snap.approvedAt)
        ? "complete"
        : "missing",
      (snap.status ?? "").toUpperCase() === "APPROVED"
        ? "Approvata"
        : (snap.status ?? "").toUpperCase() === "REVISION_REQUESTED"
          ? "Revisione richiesta"
          : "Non ancora approvata",
    ),
    // Not computed in Copilot — must not be reported as "missing from campaign".
    field(
      "strategicScore",
      "Strategic Score",
      "unavailable",
      null,
    ),
    field(
      "ctaMeta",
      "CTA Meta Ads",
      "unavailable",
      null,
    ),
  ];

  const launchReadiness = calculateLaunchReadiness({
    fotoCaricata: snap.hasCreativeAsset,
    clienteHaApprovato:
      (snap.status ?? "").toUpperCase() === "APPROVED" ||
      present(snap.approvedAt),
    paginaFacebookId: snap.pageId ?? "",
    moduloContattiId: snap.formId ?? "",
    destinationUrl: snap.website ?? undefined,
    objective: objective as CampagnaObjective | undefined,
    bookingChannel,
    haCopySelezionato: snap.copyVariants.length > 0,
    haTitoloAnnuncio: present(snap.headline),
  });

  return { fields, launchReadiness };
}

export function summarizeLaunchReadinessForCopilot(
  result: LaunchReadinessResult,
): {
  isReady: boolean;
  percentuale: number;
  completeLabels: string[];
  missingLabels: string[];
} {
  return {
    isReady: result.isReady,
    percentuale: result.percentuale,
    completeLabels: result.items.filter((i) => i.ok).map((i) => i.label),
    missingLabels: result.items
      .filter((i) => !i.ok)
      .map((i) => i.mancante || i.label),
  };
}
