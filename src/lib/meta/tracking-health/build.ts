/**
 * M10E — Deterministic tracking health builder.
 * No Meta writes. No invented Pixel/Dataset status.
 */

import {
  etichettaDestinationType,
  etichettaOptimizationGoal,
  formatAttributionSpecIt,
} from "@/lib/meta/configuration/labels";
import { resolvePerformanceFamily } from "@/lib/meta/objective-performance";
import {
  etichettaRelevantResultSummary,
  hasAttributionConfigured,
  hasLeadEvent,
  hasLinkClickOnly,
  hasLpvEvent,
  hasPurchaseEvent,
  listLeadActionTypes,
  partitionObservedActions,
  promotedObjectFlags,
  resolveDestinationKind,
} from "@/lib/meta/tracking-health/evidence";
import type {
  TrackingHealth,
  TrackingHealthInput,
  TrackingIssue,
  TrackingPerformanceConfidence,
  TrackingReliability,
  TrackingSignal,
  TrackingHealthStatus,
} from "@/lib/meta/tracking-health/types";

function signal(
  code: TrackingSignal["code"],
  evidence: string[],
): TrackingSignal {
  return { code, evidence };
}

function issue(
  severity: TrackingIssue["severity"],
  code: string,
  title: string,
  explanation: string,
  evidence: string[],
): TrackingIssue {
  return { severity, code, title, explanation, evidence };
}

export function reliabilityFromStatus(
  status: TrackingHealthStatus,
): TrackingReliability {
  switch (status) {
    case "HEALTHY":
      return "AFFIDABILE";
    case "PARTIAL":
    case "AMBIGUOUS":
      return "PARZIALE";
    case "CONFIGURATION_REQUIRED":
    case "UNKNOWN":
    default:
      return "NON_VERIFICABILE";
  }
}

export function etichettaTrackingReliability(
  reliability: TrackingReliability,
): string {
  switch (reliability) {
    case "AFFIDABILE":
      return "Affidabile";
    case "PARZIALE":
      return "Parziale";
    default:
      return "Da verificare";
  }
}

export function buildTrackingHealth(
  input: TrackingHealthInput,
): TrackingHealth {
  const family = resolvePerformanceFamily(input.objective);
  const destKind = resolveDestinationKind(input.destinationType);
  const promoted = promotedObjectFlags(input.promotedObject);
  const actions = input.observedActionTypes.map((t) => t.trim()).filter(Boolean);
  const signals: TrackingSignal[] = [];
  const issues: TrackingIssue[] = [];
  const unknowns: string[] = [];

  // Destination
  if (destKind === "NATIVE_META") {
    signals.push(
      signal("DESTINATION_NATIVE_META", [
        `destination_type=${input.destinationType}`,
      ]),
    );
  } else if (destKind === "WEBSITE") {
    signals.push(
      signal("DESTINATION_WEBSITE", [
        `destination_type=${input.destinationType}`,
      ]),
    );
  } else if (destKind === "MESSAGING") {
    signals.push(
      signal("DESTINATION_MESSAGING", [
        `destination_type=${input.destinationType}`,
      ]),
    );
  } else {
    signals.push(signal("DESTINATION_UNKNOWN", ["destination_type missing"]));
    unknowns.push("destination_type");
  }

  // Optimization
  const opt = (input.optimizationGoal ?? "").toUpperCase();
  if (opt === "LEAD_GENERATION" || opt === "QUALITY_LEAD") {
    signals.push(
      signal("OPTIMIZATION_LEAD_GENERATION", [
        `optimization_goal=${input.optimizationGoal}`,
      ]),
    );
  } else if (
    opt === "OFFSITE_CONVERSIONS" ||
    opt === "VALUE" ||
    opt.includes("CONVERSION")
  ) {
    signals.push(
      signal("OPTIMIZATION_CONVERSIONS", [
        `optimization_goal=${input.optimizationGoal}`,
      ]),
    );
  } else if (
    opt === "LANDING_PAGE_VIEWS" ||
    opt === "LINK_CLICKS" ||
    opt === "REACH"
  ) {
    if (opt === "LANDING_PAGE_VIEWS" || opt === "LINK_CLICKS") {
      signals.push(
        signal("OPTIMIZATION_TRAFFIC", [
          `optimization_goal=${input.optimizationGoal}`,
        ]),
      );
    } else {
      signals.push(
        signal("OPTIMIZATION_AWARENESS", [
          `optimization_goal=${input.optimizationGoal}`,
        ]),
      );
    }
  } else if (
    opt === "POST_ENGAGEMENT" ||
    opt === "PAGE_LIKES" ||
    opt === "THRUPLAY"
  ) {
    signals.push(
      signal("OPTIMIZATION_ENGAGEMENT", [
        `optimization_goal=${input.optimizationGoal}`,
      ]),
    );
  }

  // Promoted object
  if (promoted.hasPage) {
    signals.push(signal("PROMOTED_OBJECT_PAGE", ["page_id present"]));
  }
  if (promoted.hasPixel) {
    signals.push(signal("PROMOTED_OBJECT_PIXEL", ["pixel_id present"]));
  } else if (destKind === "WEBSITE" || family === "SALES") {
    signals.push(signal("PIXEL_UNKNOWN", ["pixel_id not in promoted_object"]));
    unknowns.push("pixel_id");
  }
  if (promoted.present) {
    signals.push(signal("PROMOTED_OBJECT_PRESENT", ["promoted_object returned"]));
  }

  // Attribution
  if (hasAttributionConfigured(input.attributionSpec)) {
    signals.push(signal("ATTRIBUTION_CONFIGURED", ["attribution_spec present"]));
  }

  // Observed events
  const leadTypes = listLeadActionTypes(actions);
  if (leadTypes.length > 0) {
    signals.push(signal("LEAD_EVENT_PRESENT", leadTypes));
  }
  if (hasPurchaseEvent(actions)) {
    signals.push(
      signal("PURCHASE_EVENT_PRESENT", [
        `actions=${actions.filter((a) => a.includes("purchase")).join(",")}`,
      ]),
    );
  }
  if (input.hasPurchaseValue) {
    signals.push(signal("PURCHASE_VALUE_PRESENT", ["action_values purchase"]));
  }
  if (hasLpvEvent(actions) || (input.landingPageViews != null && input.landingPageViews > 0)) {
    signals.push(signal("LPV_SIGNAL_PRESENT", ["landing_page_view"]));
  } else if (hasLinkClickOnly(actions) || (input.linkClicks != null && input.linkClicks > 0 && !(input.landingPageViews != null && input.landingPageViews > 0))) {
    if (family === "TRAFFIC" || destKind === "WEBSITE") {
      signals.push(signal("LINK_CLICK_ONLY", ["link_click without LPV"]));
    }
  }

  // Result mapping — separate from tracking broken
  if (input.resultMappingConfidence === "CONFIDENT") {
    signals.push(
      signal("RESULT_MAPPING_CONFIDENT", [
        `primary_result_type=${input.primaryResultType ?? "null"}`,
      ]),
    );
  } else if (input.resultMappingConfidence === "AMBIGUOUS") {
    signals.push(
      signal("RESULT_MAPPING_AMBIGUOUS", [
        "multiple compatible result types or ambiguous mapping",
      ]),
    );
  } else {
    signals.push(signal("RESULT_MAPPING_UNKNOWN", ["no confident primary result"]));
  }

  const delivery =
    (input.spend != null && input.spend > 0) ||
    (input.impressions != null && input.impressions > 0);
  if (delivery) {
    signals.push(
      signal("DELIVERY_PRESENT", [
        `spend=${input.spend ?? "null"}`,
        `impressions=${input.impressions ?? "null"}`,
      ]),
    );
  }

  // Pixel visibility with ads_read only
  let pixelVisibility: TrackingHealth["pixelVisibility"] = "UNAVAILABLE";
  if (promoted.hasPixel) pixelVisibility = "PARTIAL";
  else if (destKind === "NATIVE_META") pixelVisibility = "UNAVAILABLE";
  else pixelVisibility = "UNAVAILABLE";

  if (!promoted.hasPixel) {
    unknowns.push("dataset_id");
    unknowns.push("custom_event_type");
    signals.push(signal("EVENT_SOURCE_UNKNOWN", ["Events Manager not queried"]));
  }

  // --- Status resolution (objective + destination aware) ---
  let status: TrackingHealthStatus = "UNKNOWN";
  let beginnerSummary =
    "Ally non può ancora verificare in modo completo l'affidabilità della misurazione.";

  const leadNative =
    family === "LEADS" &&
    destKind === "NATIVE_META" &&
    (opt === "LEAD_GENERATION" || opt === "QUALITY_LEAD" || opt === "");

  if (family === "AWARENESS") {
    if (delivery) {
      status = "HEALTHY";
      beginnerSummary =
        "Per Notorietà bastano i dati di delivery (impression, copertura, CPM). Non serve un tracciamento conversioni.";
    } else {
      status = "UNKNOWN";
      beginnerSummary =
        "Ancora pochi dati di delivery per valutare la misurazione.";
    }
  } else if (family === "ENGAGEMENT") {
    if (delivery) {
      status = hasLeadEvent(actions) || actions.some((a) => a.includes("engagement") || a.includes("video"))
        ? "HEALTHY"
        : "PARTIAL";
      beginnerSummary =
        status === "HEALTHY"
          ? "Ci sono segnali di interazione compatibili con l'obiettivo."
          : "La campagna eroga, ma i segnali di engagement osservati sono limitati.";
    } else {
      status = "UNKNOWN";
    }
  } else if (leadNative) {
    // Native Instant Form / on-ad leads — do NOT require Pixel
    if (input.resultMappingConfidence === "AMBIGUOUS" && hasLeadEvent(actions)) {
      status = "AMBIGUOUS";
      beginnerSummary =
        "Meta sta raccogliendo segnali di lead, ma Ally non può identificare con certezza un unico risultato canonico.";
      issues.push(
        issue(
          "INFO",
          "LEAD_RESULT_MAPPING_AMBIGUOUS",
          "Risultato lead non univoco",
          "Sono presenti più tipi di azione lead compatibili. Non è la stessa cosa di un tracciamento assente.",
          ["result_mapping=AMBIGUOUS", "LEAD_EVENT_PRESENT"],
        ),
      );
    } else if (
      input.resultMappingConfidence === "CONFIDENT" &&
      hasLeadEvent(actions)
    ) {
      status = "HEALTHY";
      beginnerSummary =
        "Il percorso lead è nativo Meta (sull'inserzione). I segnali di contatto risultano misurabili.";
    } else if (promoted.hasPage || destKind === "NATIVE_META") {
      status = "PARTIAL";
      beginnerSummary =
        "Destinazione e ottimizzazione indicano un percorso lead Meta, ma Ally ha evidenza limitata sui risultati canonici.";
      issues.push(
        issue(
          "CHECK",
          "NATIVE_LEAD_RESULT_LIMITED",
          "Risultati lead limitati",
          "La configurazione suggerisce raccolta contatti su Meta, ma il risultato primario non è ancora chiaro.",
          [
            `destination=${input.destinationType ?? "null"}`,
            `mapping=${input.resultMappingConfidence}`,
          ],
        ),
      );
    } else {
      status = "PARTIAL";
      beginnerSummary =
        "Obiettivo Contatti, ma la destinazione non è pienamente verificabile.";
    }
    // Explicit: never ISSUE for missing pixel on native leads
  } else if (family === "LEADS" && destKind === "WEBSITE") {
    if (hasLeadEvent(actions) && input.resultMappingConfidence === "CONFIDENT") {
      status = "HEALTHY";
      beginnerSummary =
        "Ci sono segnali di lead dal sito sufficienti per interpretare i risultati con cautela.";
    } else if (hasLeadEvent(actions) && input.resultMappingConfidence === "AMBIGUOUS") {
      status = "AMBIGUOUS";
      beginnerSummary =
        "Ci sono segnali di lead dal sito, ma Ally non può fissare un unico conteggio canonico.";
    } else if (promoted.hasPixel) {
      status = "PARTIAL";
      beginnerSummary =
        "È collegato un Pixel, ma Ally non vede ancora un evento lead affidabile nel periodo.";
      issues.push(
        issue(
          "CHECK",
          "WEBSITE_LEAD_EVENT_NOT_OBSERVED",
          "Evento lead non osservato",
          "Assenza nel periodo ≠ prova che l'evento non sia configurato.",
          ["DESTINATION_WEBSITE", "PROMOTED_OBJECT_PIXEL"],
        ),
      );
    } else {
      status = "CONFIGURATION_REQUIRED";
      beginnerSummary =
        "La campagna punta al sito, ma Ally non può verificare il tracciamento dei lead con i dati disponibili.";
      issues.push(
        issue(
          "CHECK",
          "WEBSITE_LEAD_TRACKING_UNVERIFIED",
          "Tracciamento lead sito non verificabile",
          "Con i permessi attuali Ally non legge la configurazione Events Manager. Non inventa uno stato Pixel.",
          ["DESTINATION_WEBSITE", "PIXEL_UNKNOWN"],
        ),
      );
    }
  } else if (family === "SALES") {
    if (
      hasPurchaseEvent(actions) &&
      (input.hasPurchaseValue || input.resultMappingConfidence === "CONFIDENT")
    ) {
      status = "HEALTHY";
      beginnerSummary =
        "Ci sono segnali di acquisto sufficienti per interpretare valore e ROAS con i dati Meta disponibili.";
    } else if (hasPurchaseEvent(actions)) {
      status = "PARTIAL";
      beginnerSummary =
        "Ci sono segnali di acquisto, ma valore o mapping non sono pienamente affidabili.";
    } else if (destKind === "WEBSITE" && !promoted.hasPixel && !hasPurchaseEvent(actions)) {
      status = "CONFIGURATION_REQUIRED";
      beginnerSummary =
        "Obiettivo Vendite sul sito, ma Ally non può verificare l'evento di conversione con i dati disponibili.";
      issues.push(
        issue(
          "CHECK",
          "SALES_CONVERSION_UNVERIFIED",
          "Conversione acquisto non verificabile",
          "Senza evidenza di purchase e senza Pixel nel promoted_object, Ally non giudica la performance economica.",
          ["family=SALES", `destination=${input.destinationType ?? "null"}`],
        ),
      );
    } else if (delivery && !hasPurchaseEvent(actions)) {
      status = "PARTIAL";
      beginnerSummary =
        "La campagna eroga, ma non risultano acquisti osservati nel periodo. Non è prova che il tracking sia rotto.";
      issues.push(
        issue(
          "CHECK",
          "PURCHASE_EVENT_NOT_OBSERVED",
          "Acquisti non osservati",
          "Evento non osservato ≠ evento non configurato.",
          ["family=SALES", "DELIVERY_PRESENT"],
        ),
      );
    } else {
      status = "UNKNOWN";
    }
  } else if (family === "TRAFFIC") {
    if (hasLpvEvent(actions) || (input.landingPageViews != null && input.landingPageViews > 0)) {
      status = "HEALTHY";
      beginnerSummary =
        "Ci sono visualizzazioni della pagina di destinazione: misura più solida dei soli click sul link.";
    } else if (
      hasLinkClickOnly(actions) ||
      (input.linkClicks != null && input.linkClicks > 0)
    ) {
      status = "PARTIAL";
      beginnerSummary =
        "Ci sono click sul link, ma non visualizzazioni pagina. Non trattare i click come LPV.";
      issues.push(
        issue(
          "INFO",
          "TRAFFIC_LINK_CLICK_NOT_LPV",
          "Click ≠ visualizzazione pagina",
          "I link click non equivalgono a landing page view.",
          ["LINK_CLICK_ONLY"],
        ),
      );
    } else if (delivery) {
      status = "PARTIAL";
      beginnerSummary =
        "Ci sono dati di delivery, ma i segnali di traffico verso destinazione sono limitati.";
    } else {
      status = "UNKNOWN";
    }
  } else {
    // UNKNOWN family
    status = "UNKNOWN";
    beginnerSummary =
      "Obiettivo o destinazione non chiari: Ally non impone requisiti di tracking inventati.";
    issues.push(
      issue(
        "INFO",
        "TRACKING_EXPECTATIONS_UNKNOWN",
        "Aspettative di misurazione non determinate",
        "Senza profilo obiettivo affidabile non si richiedono Pixel, lead o purchase.",
        [`objective=${input.objective ?? "null"}`],
      ),
    );
  }

  // Delivery alone never upgrades to HEALTHY for conversion families
  if (
    delivery &&
    status === "UNKNOWN" &&
    (family === "SALES" || family === "LEADS")
  ) {
    status = "PARTIAL";
    beginnerSummary =
      "Meta sta erogando, ma questo non basta a certificare che i risultati siano misurati in modo affidabile.";
    issues.push(
      issue(
        "INFO",
        "DELIVERY_NOT_TRACKING",
        "Delivery ≠ misurazione",
        "Spend o impression non certificano la qualità del tracking.",
        ["DELIVERY_PRESENT"],
      ),
    );
  }

  const reliability = reliabilityFromStatus(status);
  const performanceConfidence = resolveTrackingPerformanceConfidence({
    status,
    family,
    hasPurchase: hasPurchaseEvent(actions),
    hasLead: hasLeadEvent(actions),
    resultMapping: input.resultMappingConfidence,
  });

  const { relevantResultActions, otherObservedActions } =
    partitionObservedActions(actions);

  const professionalLines = buildProfessionalLines(input, {
    promoted,
    pixelVisibility,
    status,
    reliability,
    relevantResultActions,
    otherObservedActions,
  });

  return {
    status,
    reliability,
    performanceConfidence,
    beginnerLabel: etichettaTrackingReliability(reliability),
    beginnerSummary,
    signals,
    issues,
    unknowns: [...new Set(unknowns)],
    pixelVisibility,
    relevantResultActions,
    otherObservedActions,
    professionalLines,
  };
}

export function resolveTrackingPerformanceConfidence(input: {
  status: TrackingHealthStatus;
  family: ReturnType<typeof resolvePerformanceFamily>;
  hasPurchase: boolean;
  hasLead: boolean;
  resultMapping: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
}): TrackingPerformanceConfidence {
  const { status, family, hasPurchase, hasLead, resultMapping } = input;

  if (family === "AWARENESS" || family === "ENGAGEMENT") {
    return status === "UNKNOWN" ? "LIMITED" : "FULL";
  }

  if (family === "SALES") {
    if (status === "CONFIGURATION_REQUIRED" || (!hasPurchase && status !== "HEALTHY")) {
      return "BLOCKED";
    }
    if (status === "PARTIAL" || resultMapping !== "CONFIDENT") return "LIMITED";
    return "FULL";
  }

  if (family === "LEADS") {
    if (status === "CONFIGURATION_REQUIRED") return "BLOCKED";
    if (status === "AMBIGUOUS" || resultMapping === "AMBIGUOUS") return "LIMITED";
    if (status === "HEALTHY" && hasLead && resultMapping === "CONFIDENT") {
      return "FULL";
    }
    if (status === "PARTIAL" || status === "UNKNOWN") return "LIMITED";
    return "LIMITED";
  }

  if (family === "TRAFFIC") {
    if (status === "HEALTHY") return "FULL";
    if (status === "PARTIAL") return "LIMITED";
    return "LIMITED";
  }

  return "BLOCKED";
}

function etichettaTrackingStatus(status: TrackingHealthStatus): string {
  switch (status) {
    case "HEALTHY":
      return "Affidabile";
    case "PARTIAL":
      return "Parziale";
    case "AMBIGUOUS":
      return "Ambiguo";
    case "CONFIGURATION_REQUIRED":
      return "Da verificare";
    default:
      return "Non verificabile";
  }
}

function etichettaResultMapping(
  mapping: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN",
): string {
  switch (mapping) {
    case "CONFIDENT":
      return "Confidente";
    case "AMBIGUOUS":
      return "Ambiguo";
    default:
      return "Non determinato";
  }
}

function buildProfessionalLines(
  input: TrackingHealthInput,
  ctx: {
    promoted: ReturnType<typeof promotedObjectFlags>;
    pixelVisibility: TrackingHealth["pixelVisibility"];
    status: TrackingHealthStatus;
    reliability: TrackingReliability;
    relevantResultActions: string[];
    otherObservedActions: string[];
  },
): TrackingHealth["professionalLines"] {
  const lines: TrackingHealth["professionalLines"] = [
    {
      key: "status",
      label: "Stato misurazione",
      value: etichettaTrackingStatus(ctx.status),
    },
    {
      key: "reliability",
      label: "Affidabilità",
      value: etichettaTrackingReliability(ctx.reliability),
    },
    {
      key: "destination",
      label: "Destinazione",
      value: etichettaDestinationType(input.destinationType),
    },
    {
      key: "optimization",
      label: "Ottimizzazione",
      value: etichettaOptimizationGoal(input.optimizationGoal),
    },
    {
      key: "resultMapping",
      label: "Mapping risultato",
      value: etichettaResultMapping(input.resultMappingConfidence),
    },
    {
      key: "pixelVisibility",
      label: "Pixel / Dataset",
      value:
        ctx.pixelVisibility === "PARTIAL"
          ? "Pixel presente nel promoted_object (dettaglio Events Manager non verificabile)"
          : "Non verificabile con i dati disponibili",
    },
  ];

  if (ctx.promoted.hasPage) {
    lines.push({
      key: "promotedPage",
      label: "Oggetto promosso",
      value: "Pagina Meta collegata",
    });
  } else if (ctx.promoted.hasPixel) {
    lines.push({
      key: "promotedPixel",
      label: "Oggetto promosso",
      value: "Pixel Meta collegato",
    });
  }

  if (hasAttributionConfigured(input.attributionSpec)) {
    const attr = formatAttributionSpecIt(input.attributionSpec);
    lines.push({
      key: "attribution",
      label: "Attribuzione",
      value: attr.primary,
    });
  }

  lines.push({
    key: "relevantResults",
    label: "Segnali risultato rilevanti",
    value: etichettaRelevantResultSummary(ctx.relevantResultActions),
  });
  if (ctx.relevantResultActions.length > 0) {
    lines.push({
      key: "relevantResultsRaw",
      label: "Evidenza tecnica risultati",
      value: ctx.relevantResultActions.join(", "),
    });
  }

  if (ctx.otherObservedActions.length > 0) {
    lines.push({
      key: "otherActions",
      label: "Altri eventi osservati",
      value: ctx.otherObservedActions.slice(0, 12).join(", "),
    });
  } else {
    lines.push({
      key: "otherActions",
      label: "Altri eventi osservati",
      value: "Nessuno",
    });
  }

  // Compact Meta enums for operators who need API codes.
  lines.push({
    key: "metaCodes",
    label: "Codici Meta",
    value: [
      ctx.status,
      input.destinationType ?? "—",
      input.optimizationGoal ?? "—",
      `mapping=${input.resultMappingConfidence}`,
    ].join(" · "),
  });

  return lines;
}
