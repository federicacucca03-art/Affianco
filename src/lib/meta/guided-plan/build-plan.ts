/**
 * M10B — Build GuidedMetaPlan from wizard state (deterministic, no AI).
 * Provenance contract: EXPLICIT only for real user choices — never defaults.
 */

import { etichettaBusinessGoalFromObjective } from "@/lib/meta/guided-plan/labels";
import {
  mapBusinessIntentToMetaArchitecture,
  resolveGuidedDestination,
} from "@/lib/meta/guided-plan/map-intent";
import type {
  BuildGuidedMetaPlanInput,
  GuidedAdPlan,
  GuidedAdSetPlan,
  GuidedBudgetLevel,
  GuidedMetaPlan,
  GuidedMissingRequirement,
  GuidedPlacementsStrategy,
  GuidedProvenance,
} from "@/lib/meta/guided-plan/types";

function trimOrNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

function positiveOrNull(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

function briefOr(
  fromBrief: boolean | undefined,
  fallback: GuidedProvenance,
): GuidedProvenance {
  return fromBrief ? "BRIEF" : fallback;
}

/** Italian primary label for optimization codes. */
export function etichettaOptimizationGoal(
  code: string | null | undefined,
): string {
  switch ((code ?? "").toUpperCase()) {
    case "LEAD_GENERATION":
      return "Generazione contatti";
    case "CONVERSATIONS":
      return "Messaggi / conversazioni";
    case "OFFSITE_CONVERSIONS":
      return "Conversioni sul sito";
    case "REACH":
      return "Copertura";
    case "LINK_CLICKS":
      return "Click sul link";
    default:
      return code ? code : "Da confermare";
  }
}

function optimizationFromArchitecture(input: {
  metaObjective: string | null;
  destination: string;
  destinationProvenance: GuidedProvenance;
}): { value: string | null; provenance: GuidedProvenance; note: string | null } {
  const obj = input.metaObjective;
  const dest = input.destination;

  // Never derive destination-dependent optimization when destination is MISSING.
  if (
    input.destinationProvenance === "MISSING" ||
    dest === "UNKNOWN"
  ) {
    return {
      value: null,
      provenance: "MISSING",
      note: "Da confermare in base alla destinazione",
    };
  }

  if (obj === "OUTCOME_LEADS") {
    if (dest === "META_LEAD_FORM") {
      return {
        value: "LEAD_GENERATION",
        provenance: "INFERRED",
        note: "Derivato da Contatti + modulo Meta",
      };
    }
    if (dest === "WHATSAPP" || dest === "INSTAGRAM_DM") {
      return {
        value: "CONVERSATIONS",
        provenance: "INFERRED",
        note: "Derivato da Contatti + messaggi",
      };
    }
    if (dest === "NOT_REQUIRED") {
      return {
        value: null,
        provenance: "MISSING",
        note: "Da confermare",
      };
    }
    if (dest === "WEBSITE" || dest === "PHONE" || dest === "MAPS") {
      return {
        value: "OFFSITE_CONVERSIONS",
        provenance: "INFERRED",
        note: "Da confermare — dipende dal tracking sul sito",
      };
    }
    return {
      value: null,
      provenance: "MISSING",
      note: "Da confermare in base alla destinazione",
    };
  }

  if (obj === "OUTCOME_SALES") {
    return {
      value: "OFFSITE_CONVERSIONS",
      provenance: "INFERRED",
      note: "Acquisti: verificare evento Purchase su Meta",
    };
  }

  if (obj === "OUTCOME_AWARENESS") {
    return {
      value: "REACH",
      provenance: "INFERRED",
      note: "Copertura locale / notorietà",
    };
  }

  if (obj === "OUTCOME_TRAFFIC") {
    return {
      value: "LINK_CLICKS",
      provenance: "INFERRED",
      note: "Traffico verso destinazione locale o sito",
    };
  }

  return {
    value: null,
    provenance: "MISSING",
    note: "Da confermare",
  };
}

function buildAds(
  adSetId: string,
  input: BuildGuidedMetaPlanInput,
): GuidedAdPlan[] {
  const variants: Array<{ slot: "A" | "B" | "C"; text: string | null }> = [
    { slot: "A", text: trimOrNull(input.varianteA) },
    { slot: "B", text: trimOrNull(input.varianteB) },
    { slot: "C", text: trimOrNull(input.varianteC) },
  ];
  const withCopy = variants.filter((v) => v.text);
  const list = withCopy.length > 0 ? withCopy : [{ slot: "A" as const, text: null }];
  const hasCreative = (input.creativitaCount ?? 0) > 0;

  return list.map((v) => ({
    id: `ad-${v.slot.toLowerCase()}`,
    name:
      withCopy.length > 0
        ? hasCreative
          ? `Bozza inserzione ${v.slot}`
          : `Variante messaggio ${v.slot}`
        : "Messaggio da completare",
    adSetId,
    messagePreview: v.text
      ? v.text.length > 120
        ? `${v.text.slice(0, 117)}…`
        : v.text
      : trimOrNull(input.titoloAnnuncio),
    creativeSlot: v.slot,
  })).slice(0, 3);
}

/**
 * Prefer a single Ad Set unless there is an explicit strategic split reason.
 * M10B default: never fragment by age/interest without evidence.
 */
export function buildGuidedMetaPlan(
  input: BuildGuidedMetaPlanInput,
): GuidedMetaPlan {
  const fromBrief = input.fromBrief ?? {};
  const mapped = mapBusinessIntentToMetaArchitecture({
    objective: input.objective,
    bookingChannel: input.bookingChannel,
    destinationUrl: input.destinationUrl,
    targetType: input.targetType,
  });

  const destination = resolveGuidedDestination({
    businessIntent: mapped.businessIntent,
    bookingChannel: input.bookingChannel,
    destinationUrl: input.destinationUrl,
    formId: input.formId,
    whatsappNumber: input.whatsappNumber,
    hint: mapped.destinationHint,
    explicitDestination: input.explicitDestination ?? null,
    bookingChannelUserChosen: input.bookingChannelUserChosen,
  });

  const budget = positiveOrNull(input.budgetGiornaliero);
  const citta = trimOrNull(input.citta);
  const raggio = positiveOrNull(input.raggioKm);
  const etaMin = positiveOrNull(input.etaMin);
  const etaMax = positiveOrNull(input.etaMax);

  // Audience STRATEGY is an Ally interpretation — never EXPLICIT from geo facts.
  let audienceStrategy = mapped.audienceStrategy;
  let audienceProv: GuidedProvenance = "INFERRED";
  let audienceNote: string | null = null;

  if (mapped.businessIntent === "RETARGETING") {
    audienceStrategy = "RETARGETING";
    // Business card selection implies retargeting intent, but the strategy
    // label remains Ally's technical framing of that card → INFERRED / BRIEF.
    audienceProv = fromBrief.objective ? "BRIEF" : "INFERRED";
    const src = trimOrNull(input.retargetingAudienceSource);
    audienceNote = src
      ? `Origine pubblico: ${src}`
      : "Serve scegliere o creare il pubblico di retargeting su Meta.";
  } else if ((input.targetType ?? "").toUpperCase() === "B2B") {
    audienceStrategy = "PROSPECTING";
    audienceProv = "INFERRED";
    audienceNote = "Contesto B2B — niente assunzioni consumer-local forzate.";
  } else if (citta || raggio) {
    audienceStrategy = "LOCAL";
    audienceProv = "INFERRED";
    audienceNote = "Derivato da città / raggio — non è una scelta tecnica separata.";
  }

  // Wizard defaults for CBO / placements are Ally proposals, never SCELTA TUA.
  const budgetLevelValue: GuidedBudgetLevel =
    input.cboAttivo === false ? "AD_SET" : "CAMPAIGN";
  const budgetLevelProv: GuidedProvenance = input.budgetLevelUserChosen
    ? "EXPLICIT"
    : "INFERRED";

  const placementsValue: GuidedPlacementsStrategy =
    input.posizionamentiAdvantage === false ? "MANUAL" : "ADVANTAGE_PLUS";
  const placementsProv: GuidedProvenance = input.placementsUserChosen
    ? "EXPLICIT"
    : "INFERRED";

  const opt = optimizationFromArchitecture({
    metaObjective: mapped.metaObjective,
    destination: destination.kind,
    destinationProvenance: destination.provenance,
  });

  const geoParts: string[] = [];
  if (citta) geoParts.push(citta);
  if (raggio) geoParts.push(`${raggio} km`);
  const geographySummary = geoParts.length ? geoParts.join(" · ") : null;

  const ageSummary =
    etaMin != null && etaMax != null
      ? `${etaMin}–${etaMax} anni`
      : etaMin != null
        ? `da ${etaMin} anni`
        : null;

  const geoProv: GuidedProvenance =
    geographySummary == null
      ? "MISSING"
      : briefOr(
          Boolean(fromBrief.citta || fromBrief.raggioKm),
          "EXPLICIT",
        );
  const ageProv: GuidedProvenance =
    ageSummary == null
      ? "MISSING"
      : briefOr(Boolean(fromBrief.etaMin || fromBrief.etaMax), "EXPLICIT");

  const budgetProv: GuidedProvenance =
    budget == null
      ? "MISSING"
      : briefOr(Boolean(fromBrief.budgetGiornaliero), "EXPLICIT");

  const adSetId = "adset-1";
  const whySingle =
    "Per evitare di frammentare il budget senza una ragione strategica.";

  const nameBeginner =
    audienceStrategy === "RETARGETING"
      ? "Chi ti conosce già"
      : citta
        ? `Nuovi potenziali clienti — ${citta}`
        : "Nuovi potenziali clienti";
  const strategyLabel =
    audienceStrategy === "RETARGETING"
      ? "Strategia: Retargeting"
      : audienceStrategy === "LOCAL" || audienceStrategy === "PROSPECTING"
        ? "Strategia: Prospecting"
        : null;

  const adSet: GuidedAdSetPlan = {
    id: adSetId,
    name: nameBeginner,
    nameBeginner,
    strategyLabel,
    audienceStrategy,
    geographySummary,
    ageSummary,
    destination: destination.kind,
    budgetNote:
      budget != null
        ? `Budget giornaliero: €${budget}${
            budgetLevelValue === "CAMPAIGN"
              ? " (proposta: livello campagna)"
              : " (proposta: livello gruppo)"
          }`
        : null,
    whySingleOrSplit: whySingle,
  };

  const ads = buildAds(adSetId, input);
  const missing: GuidedMissingRequirement[] = [];
  const destResolved =
    destination.provenance !== "MISSING" && destination.kind !== "UNKNOWN";

  if (destination.provenance === "MISSING") {
    missing.push({
      id: "destination",
      label: "Come vuoi ricevere il risultato? (modulo, sito, messaggi, chiamata)",
      severity: "WARNING",
      scope: "PLANNING",
    });
  }

  if (budget == null) {
    missing.push({
      id: "budget",
      label: "Quanto vuoi investire? (budget giornaliero)",
      severity: "WARNING",
      scope: "PLANNING",
    });
  }

  if (!trimOrNull(input.varianteA) && !trimOrNull(input.varianteB)) {
    missing.push({
      id: "copy",
      label: "Almeno un messaggio / copy per le inserzioni",
      severity: "WARNING",
      scope: "PLANNING",
    });
  }

  if (audienceStrategy === "RETARGETING") {
    const src = trimOrNull(input.retargetingAudienceSource);
    if (!src) {
      missing.push({
        id: "retargeting-audience",
        label: "Serve scegliere o creare il pubblico di retargeting su Meta.",
        severity: "WARNING",
        scope: "META_TECHNICAL",
      });
    }
  }

  // Destination-conditional Meta requirements — never before destination is known.
  if (destResolved && destination.kind === "META_LEAD_FORM") {
    if (!trimOrNull(input.pageId)) {
      missing.push({
        id: "page",
        label: "Pagina Facebook da collegare",
        severity: "INFO",
        scope: "META_TECHNICAL",
      });
    }
    if (!trimOrNull(input.formId)) {
      missing.push({
        id: "lead-form",
        label: "Modulo contatti da scegliere",
        severity: "INFO",
        scope: "META_TECHNICAL",
      });
    }
  }

  if (destResolved && destination.kind === "WEBSITE") {
    if (!trimOrNull(input.destinationUrl)) {
      missing.push({
        id: "website-url",
        label: "URL di destinazione da indicare",
        severity: "WARNING",
        scope: "META_TECHNICAL",
      });
    }
    if (mapped.businessIntent === "ECOMMERCE") {
      missing.push({
        id: "purchase-tracking",
        label: "Tracking acquisti da verificare su Meta",
        severity: "INFO",
        scope: "META_TECHNICAL",
      });
    }
  }

  if (destResolved && destination.kind === "WHATSAPP") {
    if (!trimOrNull(input.whatsappNumber)) {
      missing.push({
        id: "whatsapp",
        label: "Numero WhatsApp Business da indicare (o completare su Meta)",
        severity: "INFO",
        scope: "META_TECHNICAL",
      });
    }
  }

  if (destResolved && destination.kind === "PHONE") {
    missing.push({
      id: "phone",
      label: "Numero di chiamata da verificare su Meta",
      severity: "INFO",
      scope: "META_TECHNICAL",
    });
  }

  for (const hint of mapped.technicalHints) {
    if (!missing.some((m) => m.label === hint)) {
      // Skip purchase-tracking duplicate when already destination-gated above.
      if (
        hint.includes("Tracking acquisti") &&
        missing.some((m) => m.id === "purchase-tracking")
      ) {
        continue;
      }
      // Don't surface destination-confirmation as Meta tech when already in planning.
      if (hint.toLowerCase().includes("destinazione")) continue;
      missing.push({
        id: `hint-${missing.length}`,
        label: hint,
        severity: "INFO",
        scope: "META_TECHNICAL",
      });
    }
  }

  const confidence: GuidedMetaPlan["confidence"] =
    mapped.metaObjectiveResolved &&
    destination.provenance !== "MISSING" &&
    budget != null
      ? "HIGH"
      : mapped.metaObjectiveResolved
        ? "MEDIUM"
        : "LOW";

  const whySummary = [
    ...mapped.why,
    `Perché un solo gruppo di inserzioni? ${whySingle}`,
  ];

  const optLabel = etichettaOptimizationGoal(opt.value);

  return {
    businessGoal: {
      value: etichettaBusinessGoalFromObjective(input.objective),
      provenance: input.objective
        ? briefOr(Boolean(fromBrief.objective), "EXPLICIT")
        : "MISSING",
      note: null,
    },
    businessGoalCode: mapped.businessIntent,
    metaObjective: {
      value: mapped.metaObjective,
      provenance: mapped.metaObjectiveResolved ? "INFERRED" : "MISSING",
      note: mapped.metaObjective
        ? "Traduzione tecnica dell'obiettivo di business — non è ancora creato su Meta"
        : "Obiettivo Meta da definire",
    },
    destination: {
      value: destination.kind,
      provenance: destination.provenance,
      note: destination.note,
    },
    audienceStrategy: {
      value: audienceStrategy,
      provenance: audienceProv,
      note: audienceNote,
    },
    geographyFacts: {
      value: geographySummary,
      provenance: geoProv,
      note: null,
    },
    ageFacts: {
      value: ageSummary,
      provenance: ageProv,
      note: null,
    },
    budgetDaily: {
      value: budget,
      provenance: budgetProv,
      note: null,
    },
    budgetLevel: {
      value: budgetLevelValue,
      provenance: budgetLevelProv,
      note: input.budgetLevelUserChosen
        ? null
        : "Proposta Ally — il budget giornaliero non implica automaticamente il livello campagna",
    },
    optimizationGoal: opt,
    optimizationGoalLabel: {
      value: opt.value ? optLabel : null,
      provenance: opt.provenance,
      note: opt.note,
    },
    placementsStrategy: {
      value: placementsValue,
      provenance: placementsProv,
      note:
        placementsProv === "INFERRED"
          ? "Proposta guidata: distribuzione automatica Meta"
          : placementsValue === "ADVANTAGE_PLUS"
            ? "Distribuzione automatica Meta"
            : "Posizionamenti manuali — da verificare su Meta",
    },
    bidStrategy: {
      value: "META_DEFAULT",
      provenance: "META_MANAGED",
      note: "Gestita su Meta — Ally non configura bid cap in questo milestone",
    },
    attribution: {
      value: "CONFIGURE_IN_META",
      provenance: "META_MANAGED",
      note: "Attribuzione: da configurare su Meta",
    },
    adSets: [adSet],
    ads,
    missingRequirements: missing,
    confidence,
    lifecycle: "ALLY_PLANNING",
    whySummary,
  };
}

/** Planning completeness ≠ Meta technical readiness. */
export function isGuidedPlanningReady(plan: GuidedMetaPlan): boolean {
  const blockers = plan.missingRequirements.filter(
    (m) => m.scope === "PLANNING" && m.severity === "BLOCKER",
  );
  return (
    blockers.length === 0 &&
    plan.businessGoal.provenance !== "MISSING" &&
    plan.metaObjective.value != null
  );
}

export function hasMetaTechnicalGaps(plan: GuidedMetaPlan): boolean {
  return plan.missingRequirements.some((m) => m.scope === "META_TECHNICAL");
}

/** True when destination is an explicit Modulo Meta choice. */
export function destinationRequiresLeadForm(plan: GuidedMetaPlan): boolean {
  return (
    plan.destination.value === "META_LEAD_FORM" &&
    plan.destination.provenance !== "MISSING"
  );
}
