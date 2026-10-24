/**
 * P0.2 — Canonical pre-publish preview.
 * One presentation model over existing resolvers / write preview.
 * No new decision engine. No Graph mutations.
 */

import {
  etichettaBillingEvent,
  etichettaOptimizationGoal,
} from "@/lib/meta/configuration/labels";
import { etichettaMetaObjectiveUtente } from "@/lib/meta/meta-ui-labels";
import type { AllyConversionPublishPlan } from "@/lib/meta/write/conversion-resolver";
import {
  etichettaConversionEvent,
  hasUsableWebsiteTracking,
  maskTrackingSourceId,
  type AllyWebsiteTrackingConfig,
} from "@/lib/meta/write/tracking";
import type {
  MetaWritePlanInput,
  MetaWritePreviewResult,
  MetaWriteReadinessCode,
} from "@/lib/meta/write/types";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import {
  etichettaSpecialAdCategoryEasy,
  evaluateSpecialAdCategoryPublishGates,
  selectionFromWriteDecision,
} from "@/lib/meta/write/special-ad-categories";
import {
  etichettaDestinationTrackingMode,
} from "@/lib/meta/write/destination-tracking";
import { etichettaInstagramIdentity } from "@/lib/meta/write/ad-identity";

/** Stable keys for Launch Guardian EXPECTED vs ACTUAL_META later. */
export type CanonicalPreviewFieldKey =
  | "campaign.name"
  | "campaign.objective"
  | "campaign.special_ad_categories"
  | "campaign.status"
  | "campaign.budget_mode"
  | "adset.conversion_location"
  | "adset.optimization_goal"
  | "adset.destination_type"
  | "adset.budget"
  | "adset.schedule"
  | "adset.audience_mode"
  | "adset.age"
  | "adset.location"
  | "adset.placements"
  | "adset.bid_strategy"
  | "adset.tracking_source"
  | "adset.conversion_event"
  | "adset.promoted_object"
  | "adset.attribution"
  | "creative.page"
  | "creative.instagram"
  | "creative.instant_form"
  | "creative.type"
  | "creative.media"
  | "creative.primary_text"
  | "creative.headline"
  | "creative.description"
  | "creative.cta"
  | "creative.destination_url"
  | "creative.utm"
  | "creative.multi_copy"
  | "creative.carousel"
  | "ad.name"
  | "ad.status";

export type FieldEditability =
  | "USER_EDITABLE"
  | "ALLY_DERIVED"
  | "META_MANAGED"
  | "UNSUPPORTED";

export type FieldSupportStatus =
  | "SUPPORTED"
  | "PREVIEW_ONLY"
  | "NOT_YET_PUBLISHABLE"
  | "BLOCKED";

export type ReasonSource = "ALLY_RULE" | "USER" | "META_MANAGED";

export type CanonicalFieldReason = {
  reasonCode: string;
  reasonTitle: string;
  reasonText: string;
  editable: boolean;
  source: ReasonSource;
};

export type CanonicalPreviewField = {
  key: CanonicalPreviewFieldKey;
  labelIt: string;
  valueIt: string;
  technicalValue: string | null;
  reason: CanonicalFieldReason | null;
  editability: FieldEditability;
  supportStatus: FieldSupportStatus;
  /** True when this field is part of the Graph payload that will be sent. */
  includedInPublishPayload: boolean;
};

export type CanonicalPreviewIssueSeverity = "BLOCKER" | "WARNING";

export type CanonicalPreviewIssue = {
  code: string;
  severity: CanonicalPreviewIssueSeverity;
  messageIt: string;
  /** Related stable field key when applicable. */
  fieldKey: CanonicalPreviewFieldKey | null;
};

export type CanonicalPreviewSectionId =
  | "CAMPAIGN"
  | "AD_SET"
  | "CREATIVE"
  | "AD";

export type CanonicalPreviewSection = {
  id: CanonicalPreviewSectionId;
  titleIt: string;
  fields: CanonicalPreviewField[];
};

export type CanonicalPublishPreview = {
  headlineIt: string;
  sections: CanonicalPreviewSection[];
  blockers: CanonicalPreviewIssue[];
  warnings: CanonicalPreviewIssue[];
  recommendations: CanonicalFieldReason[];
  /** Same gate as canWrite when structural readiness passes. */
  publishAllowed: boolean;
  /** Sanitized technical dump for Pro / Dettagli avanzati. */
  technicalDetails: {
    metaObjective: string | null;
    optimizationGoal: string | null;
    destinationType: string | null;
    conversionLocation: string | null;
    promotedObjectSanitized: Record<string, unknown> | null;
    advantageAudience: number | null;
    placementsMode: "ADVANTAGE_PLUS" | "MANUAL_UNSUPPORTED" | "UNRESOLVED" | null;
    billingEvent: string | null;
    bidStrategy: string | null;
    status: typeof META_WRITE_SAFE_STATUS;
    readinessCodes: MetaWriteReadinessCode[];
    unsupportedRequested: string[];
    metaManagedFields: string[];
    allyManagedFields: string[];
    fingerprint: string;
  };
  /** Stable map for future EXPECTED vs ACTUAL comparison. */
  expectedByKey: Partial<Record<CanonicalPreviewFieldKey, string | null>>;
};

export type CreativeIntentSnapshot = {
  varianteA?: string | null;
  varianteB?: string | null;
  varianteC?: string | null;
  titoloAnnuncio?: string | null;
  description?: string | null;
  creativitaRaw?: unknown;
  /** Explicit user request for carousel (if known). */
  requestedCarousel?: boolean | null;
  pageName?: string | null;
  /** Instant Form display name from discovery. */
  formName?: string | null;
};

function field(
  partial: CanonicalPreviewField,
): CanonicalPreviewField {
  return partial;
}

function reason(
  partial: CanonicalFieldReason,
): CanonicalFieldReason {
  return partial;
}

function sanitizePromotedObject(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && /(_id|pixel|dataset|form|page)/i.test(k)) {
      out[k] = maskTrackingSourceId(v);
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v == null) {
      out[k] = null;
    } else {
      out[k] = "[object]";
    }
  }
  return out;
}

function countCreativita(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.filter(
    (x) => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string",
  ).length;
}

function destinationLabelIt(kind: string): string {
  switch (kind) {
    case "META_LEAD_FORM":
      return "Modulo istantaneo";
    case "WEBSITE":
      return "Sito web";
    case "WHATSAPP":
      return "WhatsApp";
    case "PHONE":
      return "Telefono";
    default:
      return "Da scegliere";
  }
}

function optimizationReason(
  plan: AllyConversionPublishPlan | null | undefined,
  goal: string | null,
): CanonicalFieldReason | null {
  if (!goal) return null;
  if (goal === "OFFSITE_CONVERSIONS") {
    const event = plan?.conversionEvent
      ? etichettaConversionEvent(plan.conversionEvent)
      : "evento selezionato";
    return reason({
      reasonCode: "OPT_OFFSITE_CONVERSIONS",
      reasonTitle: "Conversioni sul sito",
      reasonText: `Ally userà l’evento ${event} del Pixel/Dataset selezionato per ottimizzare la campagna.`,
      editable: true,
      source: "ALLY_RULE",
    });
  }
  if (goal === "LEAD_GENERATION") {
    return reason({
      reasonCode: "OPT_LEAD_GENERATION",
      reasonTitle: "Lead dal modulo Meta",
      reasonText:
        "Ally ottimizza per contatti raccolti tramite Instant Form sulla Pagina selezionata.",
      editable: true,
      source: "ALLY_RULE",
    });
  }
  if (goal === "LINK_CLICKS") {
    return reason({
      reasonCode: "OPT_LINK_CLICKS",
      reasonTitle: "Click sul link",
      reasonText:
        "Obiettivo Traffico: Ally ottimizza per click sul link, non per conversioni o lead sul sito.",
      editable: true,
      source: "ALLY_RULE",
    });
  }
  if (goal === "REACH") {
    return reason({
      reasonCode: "OPT_REACH",
      reasonTitle: "Copertura",
      reasonText: "Obiettivo Notorietà: Ally ottimizza per raggiungere più persone.",
      editable: true,
      source: "ALLY_RULE",
    });
  }
  return reason({
    reasonCode: "OPT_DERIVED",
    reasonTitle: "Ottimizzazione derivata",
    reasonText: "Valore derivato dalle regole Ally in base a obiettivo e destinazione.",
    editable: true,
    source: "ALLY_RULE",
  });
}

/**
 * Build the canonical publish preview from the existing write preview + plan input.
 * Does not re-resolve objective/tracking — uses conversionPublishPlan already on result.
 */
export function buildCanonicalPublishPreview(input: {
  planInput: MetaWritePlanInput;
  preview: MetaWritePreviewResult;
  creativeIntent?: CreativeIntentSnapshot | null;
}): CanonicalPublishPreview {
  const { planInput, preview } = input;
  const intent = input.creativeIntent ?? null;
  const conv = preview.conversionPublishPlan ?? null;
  const objective = preview.campaign?.objective ?? null;
  const optGoal = preview.adSet?.optimization_goal ?? null;
  const destType = preview.adSet?.destination_type ?? null;
  const tracking = planInput.websiteTracking ?? null;

  const blockers: CanonicalPreviewIssue[] = [];
  const warnings: CanonicalPreviewIssue[] = [];
  const recommendations: CanonicalFieldReason[] = [];
  const unsupportedRequested: string[] = [];

  // Map readiness → blockers (single validation source).
  const readiness = preview.readinessCodes;
  const hardCodes = new Set(
    readiness.filter(
      (c) =>
        c !== "READY_TO_PREVIEW" &&
        c !== "READY_TO_WRITE" &&
        c !== "MISSING_CREATIVE_ASSET" &&
        c !== "STALE_PREVIEW" &&
        c !== "LIVE_WRITES_GATED" &&
        c !== "PARTIAL_HIERARCHY",
    ),
  );

  for (const code of hardCodes) {
    const msg =
      preview.blockersIt.find((m) =>
        code === "MISSING_TRACKING_CONFIG"
          ? /pixel|dataset|tracking|lead|acquist/i.test(m)
          : true,
      ) ??
      preview.blockersIt[0] ??
      code;
    // Prefer Italian message matching this code when available.
    const matched =
      code === "MISSING_TRACKING_CONFIG"
        ? preview.blockersIt.find((m) => /Pixel|Dataset|tracking|lead|acquist/i.test(m))
        : code === "MISSING_PAGE"
          ? preview.blockersIt.find((m) => /Pagina/i.test(m))
          : code === "MISSING_FORM"
            ? preview.blockersIt.find((m) => /modulo/i.test(m))
            : code === "MISSING_SPECIAL_AD_CATEGORY_DECISION" ||
                code === "SPECIAL_AD_CATEGORY_REQUIRED"
              ? preview.blockersIt.find((m) => /categoria speciale/i.test(m))
              : code === "SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION"
                ? preview.blockersIt.find((m) =>
                    /verifica Meta|categoria speciale selezionata|età incompatibile/i.test(
                      m,
                    ),
                  )
                : code === "SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED"
                  ? preview.blockersIt.find((m) => /paese della categoria/i.test(m))
                  : undefined;
    blockers.push({
      code,
      severity: "BLOCKER",
      messageIt: matched ?? (typeof msg === "string" ? msg : code),
      fieldKey:
        code === "MISSING_TRACKING_CONFIG"
          ? "adset.tracking_source"
          : code === "MISSING_FORM"
            ? "adset.conversion_location"
            : code === "MISSING_PAGE"
              ? "creative.page"
              : null,
    });
  }

  // Deduplicate blockers by code
  const blockerByCode = new Map<string, CanonicalPreviewIssue>();
  for (const b of blockers) {
    if (!blockerByCode.has(b.code)) blockerByCode.set(b.code, b);
  }
  const blockersDeduped = [...blockerByCode.values()];

  // Placements honesty
  const placementsAdv = planInput.placementsAdvantage;
  let placementsMode: CanonicalPublishPreview["technicalDetails"]["placementsMode"] =
    null;
  if (placementsAdv === true) {
    placementsMode = "ADVANTAGE_PLUS";
  } else if (placementsAdv === false) {
    placementsMode = "MANUAL_UNSUPPORTED";
    unsupportedRequested.push("manual_placements");
  } else {
    placementsMode = "UNRESOLVED";
  }

  // Multi-copy / carousel honesty
  const copyB = (intent?.varianteB ?? "").trim();
  const copyC = (intent?.varianteC ?? "").trim();
  const extraCopies = Boolean(copyB || copyC);
  const assetCount = countCreativita(intent?.creativitaRaw);
  const requestedCarousel = intent?.requestedCarousel === true || assetCount > 1;
  let multiCopyStatus: FieldSupportStatus = "SUPPORTED";
  let carouselStatus: FieldSupportStatus = "SUPPORTED";
  if (extraCopies) {
    multiCopyStatus = "NOT_YET_PUBLISHABLE";
    unsupportedRequested.push("multi_copy_variante_b_c");
    warnings.push({
      code: "MULTI_COPY_NOT_YET_PUBLISHABLE",
      severity: "WARNING",
      messageIt:
        "Hai più testi (variante B/C). Ally pubblicherà solo la variante A su Meta in questo slice — le altre restano in Ally.",
      fieldKey: "creative.multi_copy",
    });
  }
  if (requestedCarousel) {
    carouselStatus = "NOT_YET_PUBLISHABLE";
    unsupportedRequested.push("carousel_or_multi_asset");
    warnings.push({
      code: "CAROUSEL_NOT_YET_PUBLISHABLE",
      severity: "WARNING",
      messageIt:
        "Carousel / più creatività: non ancora supportato nel percorso Graph. Verrà usato solo l’asset principale.",
      fieldKey: "creative.carousel",
    });
  }
  if (assetCount === 1 && !extraCopies) {
    warnings.push({
      code: "SINGLE_CREATIVE",
      severity: "WARNING",
      messageIt: "Una sola creatività: Meta non potrà confrontare più annunci in questo lancio.",
      fieldKey: "creative.media",
    });
  }

  // Instant Form: never warn about missing Pixel / website tracking.
  if (planInput.destination === "META_LEAD_FORM") {
    for (let i = warnings.length - 1; i >= 0; i -= 1) {
      if (
        /pixel|dataset|tracking|utm/i.test(warnings[i]!.messageIt) &&
        warnings[i]!.code !== "CAROUSEL_NOT_YET_PUBLISHABLE" &&
        warnings[i]!.code !== "MULTI_COPY_NOT_YET_PUBLISHABLE" &&
        warnings[i]!.code !== "SINGLE_CREATIVE" &&
        warnings[i]!.code !== "SMALL_GEO_RADIUS"
      ) {
        warnings.splice(i, 1);
      }
    }
  }

  // Small geo warning (real rule: radius present and ≤ 20 km city)
  const raggio = planInput.raggioKm;
  if (raggio != null && raggio > 0 && raggio <= 20 && planInput.metaGeoKey) {
    warnings.push({
      code: "SMALL_GEO_RADIUS",
      severity: "WARNING",
      messageIt: `Raggio geografico di ${raggio} km: pubblico potenzialmente ristretto.`,
      fieldKey: "adset.location",
    });
  }

  // Website leads transparency check
  if (
    planInput.destination === "WEBSITE" &&
    (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES")
  ) {
    if (optGoal === "LINK_CLICKS") {
      blockersDeduped.push({
        code: "DISGUISED_LEAD_OPTIMIZATION",
        severity: "BLOCKER",
        messageIt:
          "Configurazione inconsistente: campagna lead/vendite non può ottimizzare per click sul link.",
        fieldKey: "adset.optimization_goal",
      });
    }
  }

  const optReason = optimizationReason(conv, optGoal);
  if (optReason) recommendations.push(optReason);

  if (planInput.destination === "META_LEAD_FORM") {
    recommendations.push(
      reason({
        reasonCode: "IF_PIXEL_NOT_REQUIRED",
        reasonTitle: "Pixel non richiesto",
        reasonText:
          "I lead arrivano dal modulo Instant Form sull’inserzione: Pixel/Dataset non serve.",
        editable: false,
        source: "ALLY_RULE",
      }),
    );
    if (placementsMode === "ADVANTAGE_PLUS") {
      recommendations.push(
        reason({
          reasonCode: "IF_PLACEMENTS_ADVANTAGE",
          reasonTitle: "Posizionamenti Advantage+",
          reasonText:
            "Meta distribuirà automaticamente gli annunci tra i posizionamenti disponibili.",
          editable: false,
          source: "META_MANAGED",
        }),
      );
    }
  }

  const audienceMode =
    planInput.allyAudienceMode === "MANUAL_AUDIENCE"
      ? "MANUAL_AUDIENCE"
      : planInput.allyAudienceMode === "UNRESOLVED"
        ? "UNRESOLVED"
        : "ADVANTAGE_AUDIENCE";

  const targeting = preview.adSet?.targeting as
    | {
        targeting_automation?: { advantage_audience?: number };
      }
    | null
    | undefined;
  const advantageAudience =
    targeting?.targeting_automation?.advantage_audience ?? null;

  const budgetMinor =
    preview.adSet?.daily_budget ?? preview.campaign?.daily_budget ?? null;
  const budgetIt =
    budgetMinor != null
      ? `${(budgetMinor / 100).toLocaleString("it-IT", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} €/giorno`
      : "Da completare";

  const trackingUsable = hasUsableWebsiteTracking(tracking);
  const trackingValueIt = trackingUsable
    ? `${tracking!.sourceName?.trim() || tracking!.sourceType} (${maskTrackingSourceId(tracking!.sourceId)})`
    : planInput.destination === "WEBSITE" &&
        (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES")
      ? "Non configurato — richiesto"
      : "Non richiesto";

  const eventValueIt =
    tracking?.eventType != null
      ? etichettaConversionEvent(tracking.eventType)
      : conv?.conversionEvent
        ? `${etichettaConversionEvent(conv.conversionEvent)} (consigliato)`
        : "—";

  const campaignFields: CanonicalPreviewField[] = [
    field({
      key: "campaign.name",
      labelIt: "Nome campagna",
      valueIt: preview.campaign?.name ?? planInput.campaignName,
      technicalValue: preview.campaign?.name ?? planInput.campaignName,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "campaign.objective",
      labelIt: "Obiettivo",
      valueIt: objective
        ? etichettaMetaObjectiveUtente(objective) || objective
        : "Da completare",
      technicalValue: objective,
      reason: reason({
        reasonCode: "OBJ_FROM_ALLY",
        reasonTitle: "Obiettivo campagna",
        reasonText:
          "Derivato dall’obiettivo Ally e dalla destinazione scelta (Instant Form / sito / traffico).",
        editable: true,
        source: "ALLY_RULE",
      }),
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    (() => {
      const sacSel = selectionFromWriteDecision({
        decision: planInput.specialAdCategories,
        source: "USER",
        countryCode: planInput.countryCode,
      });
      const sacGates = evaluateSpecialAdCategoryPublishGates({
        selection: sacSel,
        allyAudienceMode: planInput.allyAudienceMode ?? null,
        etaMin: planInput.etaMin,
        etaMax: planInput.etaMax,
      });
      for (const w of sacGates.warnings) {
        warnings.push({
          code: w.code,
          severity: "WARNING",
          messageIt: w.messageIt,
          fieldKey: "campaign.special_ad_categories",
        });
      }
      const valueIt =
        sacSel.status === "UNRESOLVED"
          ? "Da confermare"
          : sacSel.status === "CONFIRMED_NONE"
            ? "Nessuna"
            : sacSel.categories
                .map((c) => etichettaSpecialAdCategoryEasy(c))
                .join(", ");
      const sourceIt =
        sacSel.source === "META_IMPORT"
          ? "Importata da Meta"
          : sacSel.status === "UNRESOLVED"
            ? "Da confermare"
            : "Confermata dall’utente";
      return field({
        key: "campaign.special_ad_categories",
        labelIt: "Categoria speciale",
        valueIt: `${valueIt} · ${sourceIt}`,
        technicalValue:
          sacSel.status === "UNRESOLVED"
            ? "UNRESOLVED"
            : JSON.stringify(sacSel.categories),
        reason: reason({
          reasonCode:
            sacSel.status === "UNRESOLVED"
              ? "SAC_REQUIRED"
              : "SAC_USER_OR_IMPORT",
          reasonTitle:
            sacSel.status === "UNRESOLVED"
              ? "Categoria speciale da confermare"
              : "Categoria speciale",
          reasonText:
            sacSel.status === "UNRESOLVED"
              ? "Meta richiede un trattamento specifico per alcune categorie di campagna (casa, lavoro, prodotti finanziari, temi sociali/politici). Conferma esplicitamente prima della pubblicazione."
              : "Meta applica regole specifiche ad alcune campagne. La scelta è memorizzata nel payload special_ad_categories.",
          editable: true,
          source: sacSel.source === "META_IMPORT" ? "META_MANAGED" : "USER",
        }),
        editability: "USER_EDITABLE",
        supportStatus:
          sacSel.status === "NEEDS_META_VERIFICATION"
            ? "BLOCKED"
            : sacSel.status === "UNRESOLVED"
              ? "BLOCKED"
              : "SUPPORTED",
        includedInPublishPayload: sacSel.status !== "UNRESOLVED",
      });
    })(),
    field({
      key: "campaign.status",
      labelIt: "Stato iniziale",
      valueIt: "Non attiva (PAUSED)",
      technicalValue: META_WRITE_SAFE_STATUS,
      reason: reason({
        reasonCode: "STATUS_PAUSED_SAFE",
        reasonTitle: "Sicurezza Ally",
        reasonText:
          "Ally crea sempre campagne e gruppi in pausa. Nessuna attivazione automatica.",
        editable: false,
        source: "ALLY_RULE",
      }),
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "campaign.budget_mode",
      labelIt: "Livello budget",
      valueIt:
        planInput.budgetLevel === "CAMPAIGN"
          ? "Budget a livello campagna"
          : "Budget a livello gruppo di inserzioni",
      technicalValue: planInput.budgetLevel,
      reason: null,
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
  ];

  const adSetFields: CanonicalPreviewField[] = [
    field({
      key: "adset.conversion_location",
      labelIt: "Dove avviene la conversione",
      valueIt: destinationLabelIt(planInput.destination),
      technicalValue: conv?.conversionLocation ?? planInput.destination,
      reason: reason({
        reasonCode: "DEST_USER_OR_GUIDED",
        reasonTitle: "Posizione conversione",
        reasonText:
          planInput.destination === "META_LEAD_FORM"
            ? "I lead arrivano dal modulo Instant Form sull’inserzione."
            : planInput.destination === "WEBSITE"
              ? "Le conversioni avvengono sul sito (Pixel/Dataset)."
              : "Destinazione scelta per questa campagna.",
        editable: true,
        source: planInput.destination === "UNRESOLVED" ? "ALLY_RULE" : "USER",
      }),
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "adset.optimization_goal",
      labelIt: "Ottimizzazione",
      valueIt: optGoal
        ? optGoal === "LEAD_GENERATION"
          ? "Lead (generazione contatti)"
          : `Massimizza: ${etichettaOptimizationGoal(optGoal).toLowerCase()}`
        : "Da completare",
      technicalValue: optGoal,
      reason: optReason,
      editability: "ALLY_DERIVED",
      supportStatus:
        optGoal === "LINK_CLICKS" &&
        (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES")
          ? "BLOCKED"
          : "SUPPORTED",
      includedInPublishPayload: Boolean(optGoal),
    }),
    field({
      key: "adset.destination_type",
      labelIt: "Tipo destinazione (Ad Set)",
      valueIt: destType ?? "Non inviato",
      technicalValue: destType,
      reason: null,
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: Boolean(destType),
    }),
    field({
      key: "adset.budget",
      labelIt: "Budget",
      valueIt: budgetIt,
      technicalValue: budgetMinor != null ? String(budgetMinor) : null,
      reason: reason({
        reasonCode: "BUDGET_DAILY",
        reasonTitle: "Budget giornaliero",
        reasonText: "Budget giornaliero Ally convertito in unità minori Meta.",
        editable: true,
        source: "USER",
      }),
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: budgetMinor != null,
    }),
    field({
      key: "adset.schedule",
      labelIt: "Programmazione",
      valueIt: preview.summaryIt.adSetLines
        .find((l) => l.startsWith("Programmazione:"))
        ?.replace("Programmazione: ", "") ?? "Opzionale",
      technicalValue: preview.adSet?.start_time ?? null,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "adset.audience_mode",
      labelIt: "Pubblico",
      valueIt:
        audienceMode === "ADVANTAGE_AUDIENCE"
          ? "Advantage+ Audience"
          : audienceMode === "MANUAL_AUDIENCE"
            ? "Pubblico manuale"
            : "Da scegliere",
      technicalValue:
        advantageAudience != null ? `advantage_audience=${advantageAudience}` : audienceMode,
      reason: reason({
        reasonCode: "AUDIENCE_ADVANTAGE_DEFAULT",
        reasonTitle: "Pubblico",
        reasonText:
          audienceMode === "ADVANTAGE_AUDIENCE"
            ? "Meta può espandere il pubblico oltre i vincoli suggeriti (Advantage+ Audience)."
            : "Pubblico secondo la selezione Ally.",
        editable: true,
        source: "ALLY_RULE",
      }),
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "adset.age",
      labelIt: "Età",
      valueIt: [
        preview.summaryIt.adSetLines.find((l) => l.startsWith("Età minima:")),
        preview.summaryIt.adSetLines.find((l) =>
          l.startsWith("Fascia d'età suggerita:"),
        ),
      ]
        .filter(Boolean)
        .join(" · ") || "—",
      technicalValue: null,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "adset.location",
      labelIt: "Località",
      valueIt: planInput.geoLabel?.trim() || planInput.citta || "Da risolvere",
      technicalValue: planInput.metaGeoKey,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: planInput.metaGeoKey ? "SUPPORTED" : "BLOCKED",
      includedInPublishPayload: Boolean(planInput.metaGeoKey),
    }),
    field({
      key: "adset.placements",
      labelIt: "Posizionamenti",
      valueIt:
        placementsMode === "ADVANTAGE_PLUS"
          ? "Posizionamenti Advantage+"
          : placementsMode === "MANUAL_UNSUPPORTED"
            ? "Posizionamenti manuali — non supportati"
            : "Da confermare",
      technicalValue: placementsMode,
      reason: reason({
        reasonCode:
          placementsMode === "ADVANTAGE_PLUS"
            ? "PLACEMENTS_ADVANTAGE"
            : "PLACEMENTS_MANUAL_UNSUPPORTED",
        reasonTitle: "Posizionamenti",
        reasonText:
          placementsMode === "ADVANTAGE_PLUS"
            ? "Meta distribuirà automaticamente gli annunci tra i posizionamenti disponibili."
            : placementsMode === "MANUAL_UNSUPPORTED"
              ? "Non ancora supportato da Ally — la pubblicazione con placement manuali è bloccata. Nessuna sostituzione silenziosa con Advantage+."
              : "Conferma la strategia di distribuzione.",
        editable: placementsMode !== "ADVANTAGE_PLUS",
        source: placementsMode === "ADVANTAGE_PLUS" ? "META_MANAGED" : "ALLY_RULE",
      }),
      editability:
        placementsMode === "MANUAL_UNSUPPORTED" ? "UNSUPPORTED" : "ALLY_DERIVED",
      supportStatus:
        placementsMode === "ADVANTAGE_PLUS"
          ? "SUPPORTED"
          : placementsMode === "MANUAL_UNSUPPORTED"
            ? "NOT_YET_PUBLISHABLE"
            : "BLOCKED",
      includedInPublishPayload: placementsMode === "ADVANTAGE_PLUS",
    }),
    field({
      key: "adset.bid_strategy",
      labelIt: "Strategia di offerta",
      valueIt: preview.adSet?.bid_strategy
        ? preview.summaryIt.adSetLines
            .find((l) => l.startsWith("Strategia di offerta:"))
            ?.replace("Strategia di offerta: ", "") ??
          preview.adSet.bid_strategy
        : "—",
      technicalValue: preview.adSet?.bid_strategy ?? null,
      reason: null,
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: Boolean(preview.adSet?.bid_strategy),
    }),
    field({
      key: "adset.tracking_source",
      labelIt: "Pixel",
      valueIt:
        planInput.destination === "META_LEAD_FORM"
          ? "Non richiesto"
          : trackingValueIt,
      technicalValue: trackingUsable
        ? `${tracking!.sourceType}:${maskTrackingSourceId(tracking!.sourceId)}`
        : null,
      reason:
        planInput.destination === "WEBSITE" &&
        (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES")
          ? reason({
              reasonCode: "TRACKING_REQUIRED",
              reasonTitle: "Pixel / Dataset",
              reasonText: trackingUsable
                ? "Asset di tracking selezionato per ottimizzare le conversioni sul sito."
                : "Per lead/vendite dal sito serve un Pixel/Dataset collegato all’account.",
              editable: true,
              source: "ALLY_RULE",
            })
          : reason({
              reasonCode: "TRACKING_NOT_REQUIRED",
              reasonTitle: "Tracking",
              reasonText:
                planInput.destination === "META_LEAD_FORM"
                  ? "Instant Form non richiede Pixel/Dataset."
                  : "Questa configurazione non richiede tracking di conversione.",
              editable: false,
              source: "ALLY_RULE",
            }),
      editability:
        planInput.destination === "WEBSITE" ? "USER_EDITABLE" : "ALLY_DERIVED",
      supportStatus: trackingUsable
        ? "SUPPORTED"
        : planInput.destination === "WEBSITE" &&
            (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES")
          ? "BLOCKED"
          : "SUPPORTED",
      includedInPublishPayload: trackingUsable,
    }),
    field({
      key: "adset.conversion_event",
      labelIt: "Evento di conversione",
      valueIt: eventValueIt,
      technicalValue: tracking?.eventType ?? conv?.conversionEvent ?? null,
      reason:
        trackingUsable && tracking?.eventType
          ? reason({
              reasonCode: "EVENT_SELECTED",
              reasonTitle: "Evento",
              reasonText: `Meta ottimizzerà per l’evento ${etichettaConversionEvent(tracking.eventType)}.`,
              editable: true,
              source: "USER",
            })
          : null,
      editability: "USER_EDITABLE",
      supportStatus:
        planInput.destination === "WEBSITE" &&
        (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES") &&
        !trackingUsable
          ? "BLOCKED"
          : "SUPPORTED",
      includedInPublishPayload: trackingUsable,
    }),
    field({
      key: "adset.promoted_object",
      labelIt: "Oggetto promosso",
      valueIt: preview.adSet?.promoted_object
        ? "Configurato (vedi dettagli avanzati)"
        : "—",
      technicalValue: preview.adSet?.promoted_object
        ? JSON.stringify(sanitizePromotedObject(preview.adSet.promoted_object))
        : null,
      reason: null,
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: Boolean(preview.adSet?.promoted_object),
    }),
    field({
      key: "adset.attribution",
      labelIt: "Attribuzione",
      valueIt: "Gestita da Meta (default account)",
      technicalValue: null,
      reason: reason({
        reasonCode: "ATTRIBUTION_META_DEFAULT",
        reasonTitle: "Finestra di attribuzione",
        reasonText:
          "Ally non invia ancora una attribution_spec personalizzata: vale il default Meta dell’account.",
        editable: false,
        source: "META_MANAGED",
      }),
      editability: "META_MANAGED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: false,
    }),
  ];

  const primaryText = (intent?.varianteA ?? "").trim();
  const headline = (intent?.titoloAnnuncio ?? "").trim();
  const creativeFields: CanonicalPreviewField[] = [
    field({
      key: "creative.page",
      labelIt: "Identità Facebook",
      valueIt: intent?.pageName?.trim() || planInput.pageName?.trim() || planInput.pageId || "Da indicare",
      technicalValue: planInput.pageId
        ? maskTrackingSourceId(planInput.pageId)
        : null,
      reason:
        planInput.destination === "META_LEAD_FORM"
          ? reason({
              reasonCode: "IF_PAGE_HOSTS_FORM",
              reasonTitle: "Pagina",
              reasonText:
                "La Pagina ospita il modulo Instant Form e l’identità dell’inserzione.",
              editable: true,
              source: "USER",
            })
          : null,
      editability: "USER_EDITABLE",
      supportStatus: planInput.pageId ? "SUPPORTED" : "BLOCKED",
      includedInPublishPayload: Boolean(planInput.pageId),
    }),
    ...(planInput.destination === "META_LEAD_FORM"
      ? [
          field({
            key: "creative.instant_form",
            labelIt: "Modulo Instant Form",
            valueIt:
              intent?.formName?.trim() ||
              planInput.instantFormName?.trim() ||
              (planInput.formId
                ? `Modulo selezionato (${maskTrackingSourceId(planInput.formId)})`
                : "Da selezionare"),
            technicalValue: planInput.formId
              ? maskTrackingSourceId(planInput.formId)
              : null,
            reason: reason({
              reasonCode: "IF_FORM_ON_PAGE",
              reasonTitle: "Modulo",
              reasonText:
                planInput.instantFormRelation === "VERIFIED"
                  ? "Il modulo appartiene alla Pagina selezionata (verificato in lettura Meta)."
                  : planInput.instantFormRelation === "MISMATCH"
                    ? "Il modulo non corrisponde alla Pagina — pubblicazione bloccata."
                    : "Seleziona un modulo dalla lista della Pagina per verificare l’associazione.",
              editable: true,
              source: "USER",
            }),
            editability: "USER_EDITABLE",
            supportStatus:
              planInput.instantFormRelation === "MISMATCH"
                ? "BLOCKED"
                : planInput.formId
                  ? "SUPPORTED"
                  : "BLOCKED",
            includedInPublishPayload: Boolean(planInput.formId),
          }),
        ]
      : []),
    field({
      key: "creative.type",
      labelIt: "Tipo creatività",
      valueIt: requestedCarousel
        ? "Carousel richiesto (non ancora pubblicabile)"
        : planInput.destination === "META_LEAD_FORM"
          ? "Immagine / video singolo (Instant Form)"
          : "Immagine / video singolo (link ad)",
      technicalValue: requestedCarousel
        ? "CAROUSEL_REQUESTED"
        : planInput.destination === "META_LEAD_FORM"
          ? "INSTANT_FORM_AD"
          : "LINK_AD",
      reason: null,
      editability: "ALLY_DERIVED",
      supportStatus: carouselStatus,
      includedInPublishPayload: !requestedCarousel,
    }),
    field({
      key: "creative.media",
      labelIt: "Media",
      valueIt:
        assetCount > 0
          ? `${assetCount} asset in Ally — pubblicazione usa il principale`
          : "Nessun asset — da completare",
      technicalValue: assetCount > 0 ? `count=${assetCount}` : null,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: assetCount > 0 ? "SUPPORTED" : "BLOCKED",
      includedInPublishPayload: assetCount > 0,
    }),
    field({
      key: "creative.primary_text",
      labelIt: "Testo principale",
      valueIt: primaryText
        ? primaryText.length > 80
          ? `${primaryText.slice(0, 77)}…`
          : primaryText
        : "Da completare (variante A)",
      technicalValue: primaryText ? `len=${primaryText.length}` : null,
      reason: reason({
        reasonCode: "COPY_VARIANTE_A",
        reasonTitle: "Testo pubblicato",
        reasonText:
          "Nel percorso Graph attuale Ally invia solo la variante A come messaggio principale.",
        editable: true,
        source: "ALLY_RULE",
      }),
      editability: "USER_EDITABLE",
      supportStatus: primaryText ? "SUPPORTED" : "BLOCKED",
      includedInPublishPayload: Boolean(primaryText),
    }),
    field({
      key: "creative.multi_copy",
      labelIt: "Testi aggiuntivi (B/C)",
      valueIt: extraCopies
        ? "Presenti in Ally — non ancora pubblicati su Meta"
        : "Nessuno",
      technicalValue: extraCopies ? "VARIANTE_B_C" : "NONE",
      reason: null,
      editability: extraCopies ? "UNSUPPORTED" : "ALLY_DERIVED",
      supportStatus: multiCopyStatus,
      includedInPublishPayload: false,
    }),
    field({
      key: "creative.carousel",
      labelIt: "Carousel",
      valueIt:
        carouselStatus === "NOT_YET_PUBLISHABLE"
          ? "Richiesto / multi-asset — non ancora pubblicabile"
          : "Non richiesto",
      technicalValue: carouselStatus,
      reason: null,
      editability: "UNSUPPORTED",
      supportStatus: carouselStatus,
      includedInPublishPayload: false,
    }),
    field({
      key: "creative.headline",
      labelIt: "Titolo",
      valueIt: headline || "Derivabile / da completare",
      technicalValue: headline || null,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: Boolean(headline),
    }),
    field({
      key: "creative.description",
      labelIt: "Descrizione",
      valueIt: (intent?.description ?? "").trim() || "Opzionale",
      technicalValue: null,
      reason: null,
      editability: "USER_EDITABLE",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: Boolean((intent?.description ?? "").trim()),
    }),
    field({
      key: "creative.cta",
      labelIt: "Call to action",
      valueIt:
        planInput.destination === "META_LEAD_FORM"
          ? "Iscriviti / Contatta (derivata)"
          : planInput.destination === "WEBSITE"
            ? "Scopri di più (derivata)"
            : "Derivata dalla destinazione",
      technicalValue:
        planInput.destination === "META_LEAD_FORM"
          ? "SIGN_UP"
          : planInput.destination === "WEBSITE"
            ? "LEARN_MORE"
            : null,
      reason: reason({
        reasonCode: "CTA_FROM_DESTINATION",
        reasonTitle: "CTA",
        reasonText: "Ally deriva la CTA dalla destinazione della campagna.",
        editable: false,
        source: "ALLY_RULE",
      }),
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
    field({
      key: "creative.destination_url",
      labelIt: "Destinazione",
      valueIt:
        planInput.destination === "META_LEAD_FORM"
          ? planInput.instantFormName?.trim()
            ? `Modulo Instant Form · ${planInput.instantFormName.trim()}`
            : "Modulo Instant Form (nessun URL sito)"
          : preview.destinationTracking?.finalDestinationUrl?.trim() ||
            planInput.destinationUrl?.trim() ||
            "Da definire",
      // Instant Form: never surface clients.website as technical destination.
      technicalValue:
        planInput.destination === "META_LEAD_FORM"
          ? planInput.formId
            ? `form_id=${planInput.formId}`
            : null
          : (preview.destinationTracking?.finalDestinationUrl ??
            planInput.destinationUrl),
      reason:
        planInput.destination === "WEBSITE"
          ? reason({
              reasonCode: "DEST_URL_USER",
              reasonTitle: "URL destinazione",
              reasonText:
                "Link del sito usato nella creatività Meta (con eventuali parametri di tracciamento).",
              editable: true,
              source: "USER",
            })
          : planInput.destination === "META_LEAD_FORM"
            ? reason({
                reasonCode: "DEST_INSTANT_FORM",
                reasonTitle: "Destinazione Instant Form",
                reasonText:
                  "La destinazione è il modulo Meta sulla Pagina. Il sito del cliente non viene usato come link dell’annuncio.",
                editable: false,
                source: "ALLY_RULE",
              })
            : null,
      editability:
        planInput.destination === "META_LEAD_FORM"
          ? "ALLY_DERIVED"
          : "USER_EDITABLE",
      supportStatus:
        planInput.destination === "META_LEAD_FORM"
          ? planInput.formId
            ? "SUPPORTED"
            : "BLOCKED"
          : planInput.destination === "WEBSITE" &&
              !planInput.destinationUrl?.trim()
            ? "BLOCKED"
            : preview.destinationTracking?.blockReasonCode ===
                "MALFORMED_DESTINATION_URL"
              ? "BLOCKED"
              : "SUPPORTED",
      includedInPublishPayload:
        planInput.destination === "WEBSITE"
          ? Boolean(
              preview.destinationTracking?.finalDestinationUrl?.trim() ||
                planInput.destinationUrl?.trim(),
            )
          : false,
    }),
    field({
      key: "creative.utm",
      labelIt: "Tracciamento",
      valueIt:
        planInput.destination !== "WEBSITE"
          ? "Nessuno (destinazione senza sito)"
          : etichettaDestinationTrackingMode(
              preview.destinationTracking?.mode ?? "NONE",
            ),
      technicalValue:
        preview.destinationTracking?.metaUrlTags ??
        preview.destinationTracking?.finalDestinationUrl ??
        null,
      reason: reason({
        reasonCode: "UTM_ALLY",
        reasonTitle: "Tracciamento URL",
        reasonText:
          planInput.destination !== "WEBSITE"
            ? "Le campagne Instant Form non usano parametri UTM sul sito."
            : "Ally aggiunge parametri UTM per distinguere campagne e annunci negli strumenti di analytics. I parametri già presenti nell’URL non vengono sovrascritti.",
        editable: true,
        source: "ALLY_RULE",
      }),
      editability:
        planInput.destination === "WEBSITE" ? "USER_EDITABLE" : "ALLY_DERIVED",
      supportStatus:
        planInput.destination === "WEBSITE" ? "SUPPORTED" : "SUPPORTED",
      includedInPublishPayload:
        planInput.destination === "WEBSITE" &&
        (preview.destinationTracking?.mode === "AUTO_UTM" ||
          preview.destinationTracking?.mode === "CUSTOM"),
    }),
    field({
      key: "creative.instagram",
      labelIt: "Identità Instagram",
      valueIt: preview.adIdentity
        ? etichettaInstagramIdentity(preview.adIdentity)
        : "Non collegata",
      technicalValue: preview.adIdentity?.instagramUserId
        ? maskTrackingSourceId(preview.adIdentity.instagramUserId)
        : null,
      reason: reason({
        reasonCode: "IG_IDENTITY",
        reasonTitle: "Identità Instagram",
        reasonText:
          "Ally userà questo profilo Instagram per mostrare l’annuncio nei posizionamenti Instagram.",
        editable: true,
        source: "USER",
      }),
      editability: "USER_EDITABLE",
      supportStatus:
        preview.adIdentity?.blockReasonCode === "IG_PAGE_MISMATCH" ||
        preview.adIdentity?.blockReasonCode === "MISSING_INSTAGRAM_SELECTION"
          ? "BLOCKED"
          : "SUPPORTED",
      includedInPublishPayload: Boolean(preview.adIdentity?.instagramUserId),
    }),
  ];

  const adFields: CanonicalPreviewField[] = [
    field({
      key: "ad.name",
      labelIt: "Nome inserzione",
      valueIt: "Derivato alla creazione (dopo creatività)",
      technicalValue: null,
      reason: null,
      editability: "ALLY_DERIVED",
      supportStatus: preview.creative.enabled === false ? "PREVIEW_ONLY" : "SUPPORTED",
      includedInPublishPayload: false,
    }),
    field({
      key: "ad.status",
      labelIt: "Stato inserzione",
      valueIt: "Non attiva (PAUSED)",
      technicalValue: META_WRITE_SAFE_STATUS,
      reason: reason({
        reasonCode: "AD_PAUSED_SAFE",
        reasonTitle: "Sicurezza",
        reasonText: "Anche l’inserzione nasce in pausa.",
        editable: false,
        source: "ALLY_RULE",
      }),
      editability: "ALLY_DERIVED",
      supportStatus: "SUPPORTED",
      includedInPublishPayload: true,
    }),
  ];

  const sections: CanonicalPreviewSection[] = [
    { id: "CAMPAIGN", titleIt: "Campagna", fields: campaignFields },
    { id: "AD_SET", titleIt: "Gruppo di inserzioni", fields: adSetFields },
    { id: "CREATIVE", titleIt: "Creatività", fields: creativeFields },
    { id: "AD", titleIt: "Inserzione", fields: adFields },
  ];

  const expectedByKey: CanonicalPublishPreview["expectedByKey"] = {};
  for (const s of sections) {
    for (const f of s.fields) {
      expectedByKey[f.key] = f.technicalValue ?? f.valueIt;
    }
  }

  // publishAllowed = same as canWrite (single validation source).
  const publishAllowed = preview.canWrite === true;

  return {
    headlineIt: "Ecco cosa Ally creerà su Meta",
    sections,
    blockers: blockersDeduped,
    warnings,
    recommendations,
    publishAllowed,
    technicalDetails: {
      metaObjective: objective,
      optimizationGoal: optGoal,
      destinationType: destType,
      conversionLocation: conv?.conversionLocation ?? null,
      promotedObjectSanitized: sanitizePromotedObject(
        preview.adSet?.promoted_object ?? null,
      ),
      advantageAudience,
      placementsMode,
      billingEvent: preview.adSet?.billing_event ?? null,
      bidStrategy: preview.adSet?.bid_strategy ?? null,
      status: META_WRITE_SAFE_STATUS,
      readinessCodes: preview.readinessCodes,
      unsupportedRequested,
      metaManagedFields: [
        "adset.attribution",
        "adset.placements (Advantage+ distribution)",
      ],
      allyManagedFields: [
        "campaign.status",
        "adset.optimization_goal",
        "creative.cta",
      ],
      fingerprint: preview.fingerprint,
    },
    expectedByKey,
  };
}

/** Assert preview optimization matches conversion plan (plan ↔ publish). */
export function assertPreviewMatchesConversionPlan(
  preview: MetaWritePreviewResult,
): { ok: true } | { ok: false; reason: string } {
  const plan = preview.conversionPublishPlan;
  if (!plan) return { ok: true };
  if (
    preview.adSet?.optimization_goal &&
    plan.optimizationGoal &&
    preview.adSet.optimization_goal !== plan.optimizationGoal
  ) {
    return {
      ok: false,
      reason: "optimization_goal mismatch between plan and ad set payload",
    };
  }
  return { ok: true };
}
