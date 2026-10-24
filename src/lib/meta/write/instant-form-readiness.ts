/**
 * P0.3 — Instant Form Easy Mode field contract + readiness assessment.
 * Deterministic. No AI. No Graph writes.
 */

import type { MetaWritePlanInput } from "@/lib/meta/write/types";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";
import type { CanonicalFieldReason } from "@/lib/meta/write/canonical-publish-preview";

export type EasyModeFieldRole =
  | "USER_REQUIRED"
  | "ALLY_DERIVED"
  | "META_MANAGED"
  | "PRO_MODE_ONLY";

export type InstantFormEasyFieldId =
  | "objective_leads"
  | "conversion_instant_form"
  | "facebook_page"
  | "instant_form"
  | "budget"
  | "audience"
  | "creative"
  | "special_ad_category"
  | "geo"
  | "schedule"
  | "placements"
  | "bid_strategy"
  | "pixel_tracking"
  | "website_url"
  | "cta";

export type InstantFormEasyFieldContract = {
  id: InstantFormEasyFieldId;
  labelIt: string;
  role: EasyModeFieldRole;
  completed: boolean;
  blockingIfMissing: boolean;
};

export type InstantFormRelationStatus =
  | "VERIFIED"
  | "MISMATCH"
  | "UNCHECKED";

export type InstantFormEasyReadiness = {
  flow: "INSTANT_FORM_LEADS";
  requiredInputsCount: number;
  completedInputsCount: number;
  blockingIssues: string[];
  automaticDecisionsCount: number;
  advancedFieldsHiddenCount: number;
  estimatedUserSteps: number;
  builderProgressPercent: number;
  fields: InstantFormEasyFieldContract[];
  automaticDecisions: CanonicalFieldReason[];
  readiness: "READY" | "PARTIAL" | "NOT_READY";
  formRelation: InstantFormRelationStatus;
};

/**
 * Easy Mode required user inputs (approximate 5-minute contract).
 * Everything else is derived / Meta-managed / Pro-only.
 */
export function buildInstantFormEasyFieldContract(input: {
  planInput: MetaWritePlanInput;
  preview: MetaWritePreviewResult;
  formRelation: InstantFormRelationStatus;
  formName?: string | null;
}): InstantFormEasyFieldContract[] {
  const p = input.planInput;
  const hasPage = Boolean((p.pageId ?? "").trim());
  const hasForm = Boolean((p.formId ?? "").trim());
  const hasBudget = p.budgetDailyMajor != null && p.budgetDailyMajor > 0;
  const hasGeo = Boolean((p.metaGeoKey ?? "").trim());
  const hasCreative = p.creativitaCount > 0;
  const hasAudience =
    p.allyAudienceMode === "ADVANTAGE_AUDIENCE" ||
    p.allyAudienceMode === "MANUAL_AUDIENCE";
  const sacOk = p.specialAdCategories.kind !== "UNRESOLVED";

  return [
    {
      id: "objective_leads",
      labelIt: "Cosa vuoi ottenere? → Contatti (Lead)",
      role: "USER_REQUIRED",
      completed: true, // Instant Form flow implies leads intent
      blockingIfMissing: true,
    },
    {
      id: "conversion_instant_form",
      labelIt: "Dove lasciano i dati? → Modulo Instant Form",
      role: "USER_REQUIRED",
      completed: p.destination === "META_LEAD_FORM",
      blockingIfMissing: true,
    },
    {
      id: "facebook_page",
      labelIt: "Quale Pagina Facebook?",
      role: "USER_REQUIRED",
      completed: hasPage,
      blockingIfMissing: true,
    },
    {
      id: "instant_form",
      labelIt: "Quale modulo Instant Form?",
      role: "USER_REQUIRED",
      completed: hasForm && input.formRelation !== "MISMATCH",
      blockingIfMissing: true,
    },
    {
      id: "budget",
      labelIt: "Quanto vuoi spendere al giorno?",
      role: "USER_REQUIRED",
      completed: hasBudget,
      blockingIfMissing: true,
    },
    {
      id: "audience",
      labelIt: "Chi vuoi raggiungere?",
      role: "USER_REQUIRED",
      completed: hasAudience && hasGeo,
      blockingIfMissing: true,
    },
    {
      id: "creative",
      labelIt: "Cosa devono vedere le persone?",
      role: "USER_REQUIRED",
      completed: hasCreative,
      blockingIfMissing: true,
    },
    {
      id: "special_ad_category",
      labelIt: "Questa campagna rientra in una categoria speciale?",
      role: "USER_REQUIRED",
      completed: sacOk,
      blockingIfMissing: true,
    },
    {
      id: "geo",
      labelIt: "Zona",
      role: "USER_REQUIRED",
      completed: hasGeo,
      blockingIfMissing: true,
    },
    {
      id: "schedule",
      labelIt: "Date campagna",
      role: "ALLY_DERIVED",
      completed: true, // optional for PAUSED create
      blockingIfMissing: false,
    },
    {
      id: "placements",
      labelIt: "Posizionamenti Advantage+",
      role: "ALLY_DERIVED",
      completed: p.placementsAdvantage === true,
      blockingIfMissing: false,
    },
    {
      id: "bid_strategy",
      labelIt: "Strategia di offerta",
      role: "ALLY_DERIVED",
      completed: true,
      blockingIfMissing: false,
    },
    {
      id: "cta",
      labelIt: "Call to action",
      role: "ALLY_DERIVED",
      completed: true,
      blockingIfMissing: false,
    },
    {
      id: "pixel_tracking",
      labelIt: "Pixel / Dataset",
      role: "META_MANAGED",
      completed: true, // not required
      blockingIfMissing: false,
    },
    {
      id: "website_url",
      labelIt: "URL sito",
      role: "META_MANAGED",
      completed: true, // not required for Instant Form conversion
      blockingIfMissing: false,
    },
  ];
}

export function assessInstantFormEasyReadiness(input: {
  planInput: MetaWritePlanInput;
  preview: MetaWritePreviewResult;
  formRelation?: InstantFormRelationStatus;
  formName?: string | null;
}): InstantFormEasyReadiness | null {
  if (input.planInput.destination !== "META_LEAD_FORM") return null;

  const formRelation = input.formRelation ?? "UNCHECKED";
  const fields = buildInstantFormEasyFieldContract({
    ...input,
    formRelation,
  });

  const required = fields.filter((f) => f.role === "USER_REQUIRED");
  const completedRequired = required.filter((f) => f.completed);
  const advancedHidden = fields.filter(
    (f) => f.role === "ALLY_DERIVED" || f.role === "META_MANAGED" || f.role === "PRO_MODE_ONLY",
  ).length;

  const automaticDecisions: CanonicalFieldReason[] = [
    {
      reasonCode: "IF_OPT_LEAD_GENERATION",
      reasonTitle: "Ottimizzazione Lead",
      reasonText:
        "Con Instant Form Ally ottimizza per generazione contatti (LEAD_GENERATION), senza Pixel.",
      editable: false,
      source: "ALLY_RULE",
    },
    {
      reasonCode: "IF_PIXEL_NOT_REQUIRED",
      reasonTitle: "Pixel non richiesto",
      reasonText:
        "I lead arrivano dal modulo Meta sull’inserzione: Pixel/Dataset non serve per questa conversione.",
      editable: false,
      source: "ALLY_RULE",
    },
    {
      reasonCode: "IF_STATUS_PAUSED",
      reasonTitle: "Stato Non attiva",
      reasonText: "Ally crea sempre campagna e gruppo in pausa. Nessuna attivazione automatica.",
      editable: false,
      source: "ALLY_RULE",
    },
  ];

  if (input.planInput.placementsAdvantage === true) {
    automaticDecisions.push({
      reasonCode: "IF_PLACEMENTS_ADVANTAGE",
      reasonTitle: "Posizionamenti Advantage+",
      reasonText:
        "Meta distribuirà automaticamente gli annunci tra i posizionamenti disponibili.",
      editable: false,
      source: "META_MANAGED",
    });
  }

  if (input.planInput.allyAudienceMode === "ADVANTAGE_AUDIENCE") {
    automaticDecisions.push({
      reasonCode: "IF_AUDIENCE_ADVANTAGE",
      reasonTitle: "Advantage+ Audience",
      reasonText:
        "Meta può espandere il pubblico oltre i vincoli suggeriti per migliorare i risultati.",
      editable: true,
      source: "ALLY_RULE",
    });
  }

  if ((input.planInput.allyBidMode ?? "AUTOMATIC_NO_CAP") === "AUTOMATIC_NO_CAP") {
    automaticDecisions.push({
      reasonCode: "IF_BID_LOWEST_COST",
      reasonTitle: "Offerta automatica",
      reasonText:
        "Ally usa il costo più basso senza limite di offerta (strategia supportata nel percorso attuale).",
      editable: false,
      source: "ALLY_RULE",
    });
  }

  if (!input.planInput.startAtIso && !input.planInput.endAtIso) {
    automaticDecisions.push({
      reasonCode: "IF_SCHEDULE_OPEN",
      reasonTitle: "Programmazione continua",
      reasonText:
        "Nessuna data inizio/fine inviata: la campagna resta programmabile dopo la creazione in pausa.",
      editable: true,
      source: "ALLY_RULE",
    });
  }

  automaticDecisions.push({
    reasonCode: "IF_CTA_SIGN_UP",
    reasonTitle: "CTA derivata",
    reasonText: "Ally deriva la call to action dal percorso Instant Form (es. Iscriviti / Contatta).",
    editable: false,
    source: "ALLY_RULE",
  });

  const blockingIssues: string[] = [];
  for (const f of required) {
    if (f.blockingIfMissing && !f.completed) {
      if (f.id === "special_ad_category") {
        blockingIssues.push(
          "Prima di pubblicare devi confermare se questa campagna rientra in una categoria speciale.",
        );
      } else {
        blockingIssues.push(f.labelIt);
      }
    }
  }
  if (formRelation === "MISMATCH") {
    blockingIssues.push(
      "Il modulo Instant Form non appartiene alla Pagina selezionata.",
    );
  }
  for (const b of input.preview.canonicalPublishPreview?.blockers ?? []) {
    if (!blockingIssues.includes(b.messageIt)) blockingIssues.push(b.messageIt);
  }

  // Easy Mode: objective+conversion implied; geo folded into audience; SAC = 1 confirm.
  // Count distinct questions the user still answers in the happy path.
  const estimatedUserSteps = 8;

  let readiness: InstantFormEasyReadiness["readiness"] = "NOT_READY";
  if (
    input.preview.publishAllowed === true &&
    formRelation !== "MISMATCH" &&
    completedRequired.length === required.length
  ) {
    readiness = "READY";
  } else if (completedRequired.length >= 3) {
    readiness = "PARTIAL";
  }

  const builderProgressPercent =
    required.length <= 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((completedRequired.length / required.length) * 100),
          ),
        );

  return {
    flow: "INSTANT_FORM_LEADS",
    requiredInputsCount: required.length,
    completedInputsCount: completedRequired.length,
    blockingIssues,
    automaticDecisionsCount: automaticDecisions.length,
    advancedFieldsHiddenCount: advancedHidden,
    estimatedUserSteps,
    builderProgressPercent,
    fields,
    automaticDecisions,
    readiness,
    formRelation,
  };
}
