/**
 * M9.2B — field inventory + launch vs monitoring interpretation for Ask Ally.
 * Reuses calculateLaunchReadiness — does not invent a second readiness engine.
 * Sustainable CPA/CPL is monitoring, not a Meta launch blocker.
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

/** Where the field matters for question-specific answers. */
export type AllyCopilotFieldCategory =
  | "launch"
  | "monitoring"
  | "planning"
  | "unavailable";

export type AllyCopilotConfigField = {
  id: string;
  label: string;
  status: AllyCopilotFieldStatus;
  category: AllyCopilotFieldCategory;
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

/** Question-specific split — Italian keys to avoid model echoing camelCase. */
export type AllyCopilotReadinessInterpretation = {
  preparazioneAlLancio: {
    percentuale: number;
    pronta: boolean;
    blocchi: string[];
    presenti: string[];
  } | null;
  monitoraggioAlly: {
    lacune: string[];
    note: string[];
  };
  /** Hints for the model — not user-facing copy. */
  regoleDomanda: {
    sogliaSostenibileNonBloccaLancio: true;
    preLancioPrioritaSoloBlocchi: true;
    unavailableSoloSeNecessario: true;
  };
};

function field(
  id: string,
  label: string,
  status: AllyCopilotFieldStatus,
  category: AllyCopilotFieldCategory,
  value: string | null = null,
): AllyCopilotConfigField {
  return { id, label, status, category, value };
}

function present(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function numOk(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && v > 0;
}

function isApproved(snap: AllyCopilotNativePlanningSnapshot): boolean {
  return (
    (snap.status ?? "").toUpperCase() === "APPROVED" ||
    present(snap.approvedAt)
  );
}

/**
 * Build inventory from fields we actually loaded for Copilot.
 * Strategic Score / CTA Meta remain unavailable (not recomputed).
 */
export function buildAllyCopilotConfigurationInventory(
  snap: AllyCopilotNativePlanningSnapshot,
): {
  fields: AllyCopilotConfigField[];
  launchReadiness: LaunchReadinessResult;
  interpretazione: AllyCopilotReadinessInterpretation;
} {
  const objective = snap.objective
    ? normalizzaObjective(snap.objective)
    : undefined;
  const bookingChannel = (snap.bookingChannel ?? undefined) as
    | BookingChannel
    | undefined;
  const approved = isApproved(snap);

  const fields: AllyCopilotConfigField[] = [
    field(
      "objective",
      "Obiettivo",
      present(snap.objective) ? "complete" : "missing",
      "planning",
      snap.objective,
    ),
    field(
      "client",
      "Cliente",
      present(snap.clientName) ? "complete" : "missing",
      "planning",
      snap.clientName,
    ),
    field(
      "settore",
      "Settore",
      present(snap.settore) ? "complete" : "missing",
      "planning",
      snap.settore,
    ),
    field(
      "citta",
      "Località",
      present(snap.citta) ? "complete" : "missing",
      "planning",
      snap.citta,
    ),
    field(
      "offer",
      "Offerta",
      present(snap.offer) ? "complete" : "missing",
      "planning",
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
      "planning",
      snap.etaMin != null && snap.etaMax != null
        ? `${snap.etaMin}–${snap.etaMax}`
        : snap.targetAge,
    ),
    field(
      "geography",
      "Geografia / raggio",
      present(snap.citta) || numOk(snap.raggioKm) ? "complete" : "missing",
      "planning",
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
      "planning",
      snap.targetType,
    ),
    field(
      "budget",
      "Budget giornaliero",
      numOk(snap.dailyBudget) ? "complete" : "missing",
      "planning",
      numOk(snap.dailyBudget) ? `${snap.dailyBudget}€/giorno` : null,
    ),
    // Monitoring only — NOT a Meta launch blocker.
    field(
      "sustainableTarget",
      "Soglia sostenibile (per monitoraggio Ally)",
      numOk(snap.maxSustainableCpa) ? "complete" : "missing",
      "monitoring",
      numOk(snap.maxSustainableCpa) ? `${snap.maxSustainableCpa}€` : null,
    ),
    field(
      "copy",
      "Testi / copy",
      snap.copyVariants.length > 0 ? "complete" : "missing",
      "launch",
      snap.copyVariants.length > 0
        ? `${snap.copyVariants.length} variant${snap.copyVariants.length === 1 ? "e" : "i"}`
        : null,
    ),
    field(
      "headline",
      "Titolo annuncio",
      present(snap.headline) ? "complete" : "missing",
      "launch",
      snap.headline ? snap.headline.slice(0, 100) : null,
    ),
    field(
      "creative",
      "Creatività",
      snap.hasCreativeAsset ? "complete" : "missing",
      "launch",
      snap.hasCreativeAsset
        ? approved
          ? snap.creativeFormatHint || "Asset presente e campagna approvata"
          : "Asset presente"
        : null,
    ),
    field(
      "pageId",
      "Pagina Facebook",
      present(snap.pageId) ? "complete" : "missing",
      "launch",
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
      "launch",
      present(snap.website)
        ? "URL presente"
        : present(snap.formId)
          ? "Modulo presente"
          : null,
    ),
    field(
      "approval",
      "Approvazione cliente",
      approved ? "complete" : "missing",
      "launch",
      approved
        ? "Approvata"
        : (snap.status ?? "").toUpperCase() === "REVISION_REQUESTED"
          ? "Revisione richiesta"
          : "Non ancora approvata",
    ),
    field("strategicScore", "Strategic Score", "unavailable", "unavailable", null),
    field("ctaMeta", "CTA Meta Ads", "unavailable", "unavailable", null),
  ];

  const launchReadiness = calculateLaunchReadiness({
    fotoCaricata: snap.hasCreativeAsset,
    clienteHaApprovato: approved,
    paginaFacebookId: snap.pageId ?? "",
    moduloContattiId: snap.formId ?? "",
    destinationUrl: snap.website ?? undefined,
    objective: objective as CampagnaObjective | undefined,
    bookingChannel,
    haCopySelezionato: snap.copyVariants.length > 0,
    haTitoloAnnuncio: present(snap.headline),
  });

  const interpretazione = buildReadinessInterpretation({
    launchReadiness,
    fields,
    approved,
    hasCreativeAsset: snap.hasCreativeAsset,
  });

  return { fields, launchReadiness, interpretazione };
}

export function buildReadinessInterpretation(input: {
  launchReadiness: LaunchReadinessResult;
  fields: AllyCopilotConfigField[];
  approved: boolean;
  hasCreativeAsset: boolean;
}): AllyCopilotReadinessInterpretation {
  const { launchReadiness: lr, fields, approved, hasCreativeAsset } = input;

  const presenti = lr.items
    .filter((i) => i.ok)
    .map((i) => {
      if (i.id === "creativita" && hasCreativeAsset && !approved) {
        return "Creatività presente";
      }
      if (i.id === "creativita") return "Creatività presente";
      return i.label;
    });

  const blocchi = lr.items
    .filter((i) => !i.ok)
    .map((i) => i.mancante || i.label);

  const monitoringMissing = fields.filter(
    (f) => f.category === "monitoring" && f.status === "missing",
  );
  const lacune = monitoringMissing.map((f) => f.label);
  const note: string[] = [];
  if (monitoringMissing.some((f) => f.id === "sustainableTarget")) {
    note.push(
      "La soglia sostenibile non blocca il lancio su Meta, ma Ally ne ha bisogno per valutare le performance dopo la pubblicazione.",
    );
  }

  return {
    preparazioneAlLancio: {
      percentuale: lr.percentuale,
      pronta: lr.isReady,
      blocchi,
      presenti,
    },
    monitoraggioAlly: {
      lacune,
      note,
    },
    regoleDomanda: {
      sogliaSostenibileNonBloccaLancio: true,
      preLancioPrioritaSoloBlocchi: true,
      unavailableSoloSeNecessario: true,
    },
  };
}

/** @deprecated prefer interpretazione.preparazioneAlLancio — kept for tests. */
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
