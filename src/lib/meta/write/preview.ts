/**
 * M11A.1 — Dry-run preview builder. No Graph POST. No Marketing API creates.
 */

import { resolveBillingEvent } from "@/lib/meta/write/billing-event";
import { majorCurrencyToMetaMinorUnits } from "@/lib/meta/write/budget";
import {
  buildIdempotencyKey,
  fingerprintPayload,
} from "@/lib/meta/write/fingerprint";
import { resolveMetaObjectiveCode } from "@/lib/meta/write/objective";
import {
  resolveConversionPublishPlan,
  conversionPlanToLegacyDestOpts,
} from "@/lib/meta/write/conversion-resolver";
import { validateWriteObjectiveConfiguration } from "@/lib/meta/write/objective-matrix";
import {
  etichettaConversionEvent,
  hasUsableWebsiteTracking,
} from "@/lib/meta/write/tracking";
import {
  buildCanonicalPublishPreview,
  type CreativeIntentSnapshot,
} from "@/lib/meta/write/canonical-publish-preview";
import { assessInstantFormEasyReadiness } from "@/lib/meta/write/instant-form-readiness";
import {
  isValidMetaLeadFormTechnicalUrl,
  normalizeMetaLeadFormTechnicalUrl,
} from "@/lib/meta/publish/payloads";
import {
  evaluateSpecialAdCategoryPublishGates,
  selectionFromWriteDecision,
  specialAdCategoriesGraphValue,
  etichettaSpecialAdCategoryEasy,
} from "@/lib/meta/write/special-ad-categories";
import { resolveDestinationTracking } from "@/lib/meta/write/destination-tracking";
import { resolveAdIdentity } from "@/lib/meta/write/ad-identity";
import { resolveWritePlacements } from "@/lib/meta/write/placements";
import { resolveWriteSchedule } from "@/lib/meta/write/schedule";
import { translateWriteTargeting } from "@/lib/meta/write/targeting";
import { resolveMetaBidStrategy } from "@/lib/meta/write/bid-strategy";
import { resolveMetaAudienceMode } from "@/lib/meta/write/audience-mode";
import {
  applyAgeFieldsToTargeting,
  resolveWriteAgeFields,
} from "@/lib/meta/write/age-model";
import type {
  MetaWriteAdSetPayloadPreview,
  MetaWriteCampaignPayloadPreview,
  MetaWritePlanInput,
  MetaWritePreviewResult,
  MetaWriteReadinessCode,
} from "@/lib/meta/write/types";
import { isMetaCreateWriteEligible } from "@/lib/meta/write/eligibility";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import { etichettaMetaObjectiveUtente } from "@/lib/meta/meta-ui-labels";
import {
  etichettaBillingEvent,
  etichettaOptimizationGoal,
} from "@/lib/meta/configuration/labels";
import { formatScheduleRangeIt } from "@/lib/meta/write/datetime-local";
import type { MetaWriteCanonicalPlan } from "@/lib/meta/write/types";

function formatBudgetMajorIt(
  major: number | null,
  currency: string | null,
): string | null {
  if (major == null || !Number.isFinite(major)) return null;
  const cur = (currency ?? "EUR").toUpperCase();
  const amount = major.toLocaleString("it-IT", {
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (cur === "EUR") return `${amount} €/giorno`;
  return `${amount} ${cur}/giorno`;
}

function labelSpecialAdCategories(
  decision: MetaWritePlanInput["specialAdCategories"],
): string {
  if (decision.kind === "UNRESOLVED") return "Da confermare";
  if (decision.kind === "NONE") return "Nessuna categoria speciale";
  return decision.categories
    .map((c) => etichettaSpecialAdCategoryEasy(c))
    .join(", ");
}

function labelDestination(kind: MetaWritePlanInput["destination"]): string {
  switch (kind) {
    case "META_LEAD_FORM":
      return "Modulo Meta";
    case "WEBSITE":
      return "Sito web";
    case "WHATSAPP":
      return "WhatsApp";
    case "PHONE":
      return "Telefono";
    case "UNKNOWN":
    case "UNRESOLVED":
      return "Da scegliere";
    default:
      return "Da scegliere";
  }
}

function labelWithTechnical(human: string, technical: string | null): string {
  const t = (technical ?? "").trim();
  if (!t) return human;
  if (human === t) return human;
  return `${human} / ${t}`;
}

export function connectionHasAdsManagement(scopes: string[]): boolean {
  return scopes.map((s) => s.trim()).includes("ads_management");
}

function specialCategoriesValue(
  decision: MetaWritePlanInput["specialAdCategories"],
  countryCode?: string | null,
): string[] | null {
  const selection = selectionFromWriteDecision({
    decision,
    source: "USER",
    countryCode,
  });
  return specialAdCategoriesGraphValue(selection);
}

/**
 * Build dry-run Campaign + Ad Set preview for Ally-native plans only.
 * canWrite is always false in M11A.1.
 */
export function buildMetaWritePreview(
  input: MetaWritePlanInput,
  opts?: {
    userId?: string;
    previousFingerprint?: string | null;
    canonicalPlan?: MetaWriteCanonicalPlan | null;
    creativeIntent?: CreativeIntentSnapshot | null;
  },
): MetaWritePreviewResult {
  const readiness: MetaWriteReadinessCode[] = [];
  const blockersIt: string[] = [];

  const resumeMode: "RESUME_ADSET" | null =
    input.writeHierarchyCompleted
      ? null
      : input.partialHierarchyPending
        ? "RESUME_ADSET"
        : null;
  const writeAlreadyCompleted = input.writeHierarchyCompleted === true;

  if (input.isImportedMetaOnly) {
    readiness.push("IMPORTED_META_NOT_ELIGIBLE");
    blockersIt.push(
      "Le campagne importate da Meta non possono usare «Crea su Meta».",
    );
  } else if (writeAlreadyCompleted) {
    readiness.push("WRITE_ALREADY_COMPLETED");
    blockersIt.push(
      "Configurazione Meta già creata (PAUSED). Nessuna nuova creazione.",
    );
  } else if (!resumeMode) {
    // Resume Ad Set may reuse a persisted Meta campaign id — not a new create.
    const elig = isMetaCreateWriteEligible({
      isImportedMetaOnly: false,
      existingMetaCampaignId: input.existingMetaCampaignId,
    });
    if (!elig.ok && elig.reason === "ALREADY_LINKED_META") {
      readiness.push("ALREADY_LINKED_META");
      blockersIt.push(
        "Questa campagna Ally è già collegata a una campagna Meta. Creazione nuova non consentita.",
      );
    }
  }

  if (resumeMode === "RESUME_ADSET") {
    readiness.push("PARTIAL_HIERARCHY");
    // Informational — not a hard write blocker when Ad Set config is valid.
    blockersIt.push(
      "Campagna Meta già creata (PAUSED). Alla conferma verrà creato solo il gruppo di inserzioni mancante — nessuna nuova campagna.",
    );
  }

  if (!input.hasMetaConnection) {
    readiness.push("MISSING_META_CONNECTION");
    blockersIt.push("Collega Meta per questo cliente.");
  }
  if (!input.hasAdAccount) {
    readiness.push("MISSING_AD_ACCOUNT");
    blockersIt.push("Seleziona un account pubblicitario Meta.");
  }

  const adsManagementPresent = connectionHasAdsManagement(
    input.grantedScopes,
  );
  if (!adsManagementPresent) {
    readiness.push("MISSING_META_PERMISSION");
    blockersIt.push(
      "Permesso Meta: non autorizzato per la creazione. Manca il permesso per creare campagne su Meta (ads_management).",
    );
  }

  const sacSelection = selectionFromWriteDecision({
    decision: input.specialAdCategories,
    source: "USER",
    countryCode: input.countryCode,
  });
  const sacGates = evaluateSpecialAdCategoryPublishGates({
    selection: sacSelection,
    allyAudienceMode: input.allyAudienceMode ?? null,
    etaMin: input.etaMin,
    etaMax: input.etaMax,
  });
  const sacWarningMessages: string[] = sacGates.warnings.map((w) => w.messageIt);
  if (input.specialAdCategories.kind === "UNRESOLVED") {
    readiness.push("MISSING_SPECIAL_AD_CATEGORY_DECISION");
    readiness.push("SPECIAL_AD_CATEGORY_REQUIRED");
    blockersIt.push(
      "Prima di pubblicare devi confermare se questa campagna rientra in una categoria speciale.",
    );
  } else {
    for (const b of sacGates.blockers) {
      if (b.code === "SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION") {
        readiness.push("SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION");
      } else if (b.code === "SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED") {
        readiness.push("SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED");
      } else if (b.code === "SPECIAL_AD_CATEGORY_REQUIRED") {
        readiness.push("SPECIAL_AD_CATEGORY_REQUIRED");
      } else {
        readiness.push("UNSUPPORTED_CONFIGURATION");
      }
      blockersIt.push(b.messageIt);
    }
  }

  const objective = resolveMetaObjectiveCode(input.objectiveRaw);
  if (!objective) {
    readiness.push("MISSING_OBJECTIVE");
    blockersIt.push("Obiettivo Meta non determinato.");
  }

  if (input.destination === "UNRESOLVED" || input.destination === "UNKNOWN") {
    readiness.push("MISSING_DESTINATION");
    blockersIt.push("Destinazione: da scegliere.");
  }

  const conversionPlan = resolveConversionPublishPlan({
    metaObjective: objective,
    destination: input.destination,
    websiteTracking: input.websiteTracking,
    pageId: input.pageId,
    formId: input.formId,
    destinationUrl: input.destinationUrl,
  });
  const destOpts = conversionPlanToLegacyDestOpts(conversionPlan);

  const crossLevel = validateWriteObjectiveConfiguration({
    metaObjective: objective,
    destination: input.destination,
    optimizationGoal: destOpts.optimizationGoal,
  });
  // Incomplete inputs → MISSING_* only. UNSUPPORTED_CONFIGURATION is reserved
  // for designs Ally cannot execute (not "objective not filled yet").
  if ((!crossLevel.ok || !destOpts.optimizationGoal) && objective) {
    const destMissing =
      input.destination === "UNRESOLVED" || input.destination === "UNKNOWN";
    if (!destMissing) {
      readiness.push("UNSUPPORTED_CONFIGURATION");
      blockersIt.push(
        "Combinazione obiettivo / ottimizzazione Meta non supportata.",
      );
    }
  }

  if (destOpts.needsPage && !(input.pageId ?? "").trim()) {
    readiness.push("MISSING_PAGE");
    blockersIt.push("Indica la Pagina Facebook.");
  }
  if (destOpts.needsForm && !(input.formId ?? "").trim()) {
    readiness.push("MISSING_FORM");
    blockersIt.push("Indica il modulo Instant Form.");
  }
  // P0.3 — Page ↔ Form ownership (fail closed on verified mismatch).
  if (
    input.destination === "META_LEAD_FORM" &&
    input.instantFormRelation === "MISMATCH"
  ) {
    readiness.push("FORM_PAGE_MISMATCH");
    blockersIt.push(
      "Il modulo Instant Form non appartiene alla Pagina Facebook selezionata.",
    );
  }
  // Instant Form technical link: privacy_policy_url only (no Page / website fallback).
  const leadTechnicalUrl = normalizeMetaLeadFormTechnicalUrl(
    input.formPrivacyPolicyUrl,
  );
  if (
    input.destination === "META_LEAD_FORM" &&
    (input.formId ?? "").trim() &&
    !isValidMetaLeadFormTechnicalUrl(leadTechnicalUrl)
  ) {
    readiness.push("MISSING_FORM_TECHNICAL_URL");
    blockersIt.push(
      "Il modulo Instant Form selezionato non fornisce un URL esterno valido (informativa privacy) richiesto da Meta per la creatività.",
    );
  }
  if (destOpts.needsUrl && !(input.destinationUrl ?? "").trim()) {
    readiness.push("MISSING_DESTINATION");
    blockersIt.push("Indica l'URL di destinazione.");
  }

  const destinationTracking = resolveDestinationTracking({
    destination: input.destination,
    destinationUrl: input.destinationUrl,
    mode: input.destinationTrackingMode,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmContent: input.utmContent,
    utmTerm: input.utmTerm,
    campaignName: input.campaignName,
    creativeLabel: input.campaignName,
    source: "USER",
  });
  if (
    input.destination === "WEBSITE" &&
    destinationTracking.blockReasonCode === "MALFORMED_DESTINATION_URL"
  ) {
    readiness.push("MALFORMED_DESTINATION_URL");
    blockersIt.push(
      destinationTracking.blockReasonIt ??
        "L’URL di destinazione non è valido.",
    );
  }

  const igDiscovery = input.instagramDiscovery ?? null;
  const adIdentity = resolveAdIdentity({
    facebookPageId: input.pageId,
    facebookPageName: input.pageName,
    selectedInstagramUserId: input.instagramUserId,
    preferPageOnly: input.preferPageOnly === true,
    discovered: igDiscovery?.accounts ?? null,
    discoveryEmptyReason: igDiscovery?.emptyReason ?? "UNCHECKED",
    source: "USER",
  });
  if (adIdentity.blockReasonCode === "IG_PAGE_MISMATCH") {
    readiness.push("IG_PAGE_MISMATCH");
    blockersIt.push(
      adIdentity.blockReasonIt ??
        "Account Instagram non valido per la Pagina selezionata.",
    );
  } else if (adIdentity.blockReasonCode === "MISSING_INSTAGRAM_SELECTION") {
    readiness.push("MISSING_INSTAGRAM_SELECTION");
    blockersIt.push(
      adIdentity.blockReasonIt ??
        "Seleziona l’account Instagram oppure conferma solo Facebook.",
    );
  }
  // Professional Website Leads/Sales: block — never silently use LINK_CLICKS.
  if (
    conversionPlan.blockReasonCode === "MISSING_TRACKING_CONFIG" ||
    (destOpts.needsTracking && !hasUsableWebsiteTracking(input.websiteTracking))
  ) {
    readiness.push("MISSING_TRACKING_CONFIG");
    blockersIt.push(
      conversionPlan.blockReasonIt ??
        "Per ottimizzare le conversioni dal sito collega un Pixel/Dataset e scegli l’evento.",
    );
  }

  if (input.creativitaCount <= 0) {
    readiness.push("MISSING_CREATIVE_ASSET");
    blockersIt.push(
      "Asset creativo non pronto — Inserzione Meta resta esclusa da questo slice.",
    );
  }

  const budgetConv = majorCurrencyToMetaMinorUnits(
    input.budgetDailyMajor,
    input.adAccountCurrency,
  );
  if (input.budgetDailyMajor == null) {
    readiness.push("MISSING_BUDGET");
    blockersIt.push("Indica il budget giornaliero.");
  } else if (!budgetConv.ok) {
    readiness.push("MISSING_BUDGET");
    blockersIt.push("Budget o valuta account non validi per Meta.");
  }

  const targeting = translateWriteTargeting({
    countryCode: input.countryCode,
    citta: input.citta,
    raggioKm: input.raggioKm,
    metaGeoKey: input.metaGeoKey,
    etaMin: input.etaMin,
    etaMax: input.etaMax,
    targetType: input.targetType,
  });
  if (!targeting.ok) {
    if (targeting.reason === "MISSING_GEO_RESOLUTION") {
      readiness.push("MISSING_GEO_RESOLUTION");
      blockersIt.push(
        "Zona Meta: chiave geografica da risolvere (la zona pianificata resta visibile).",
      );
    } else if (targeting.reason === "INVALID_AGE") {
      readiness.push("MISSING_GEO");
      blockersIt.push("Età: fascia non valida.");
    } else if (targeting.reason === "INVALID_RADIUS") {
      readiness.push("UNSUPPORTED_CONFIGURATION");
      blockersIt.push(
        targeting.messageIt ??
          "Raggio geografico non supportato da Meta per targeting città.",
      );
    } else {
      readiness.push("MISSING_GEO");
      blockersIt.push("Zona: incompleta.");
    }
  }

  const placements = resolveWritePlacements({
    placementsAdvantage: input.placementsAdvantage,
  });
  if (!placements.ok) {
    // Honesty: do not silently publish Advantage+ when user requested manual.
    readiness.push("UNSUPPORTED_CONFIGURATION");
    blockersIt.push(
      placements.reason === "MANUAL_UNSUPPORTED"
        ? "Posizionamenti manuali non ancora supportati da Ally — pubblicazione bloccata (nessuna sostituzione silenziosa con Advantage+)."
        : "Strategia di distribuzione non confermata.",
    );
  }

  const schedule = resolveWriteSchedule({
    startAtIso: input.startAtIso,
    endAtIso: input.endAtIso,
    timezoneName: input.adAccountTimezone,
  });
  if (!schedule.ok) {
    readiness.push("MISSING_SCHEDULE");
    blockersIt.push(
      schedule.reason === "MISSING_TIMEZONE"
        ? "Programmazione: timezone account Meta mancante."
        : schedule.reason === "PAST_SCHEDULE"
          ? "Programmazione: data inizio già passata — aggiornala esplicitamente (nessuno spostamento automatico)."
          : schedule.reason === "MISSING_SCHEDULE"
            ? "Programmazione: data fine senza data inizio."
            : "Programmazione: intervallo non valido.",
    );
  }

  const billing = resolveBillingEvent({
    optimizationGoal: destOpts.optimizationGoal,
  });
  if (destOpts.optimizationGoal && !billing.ok) {
    readiness.push("UNSUPPORTED_BILLING_EVENT");
    blockersIt.push("Fatturazione: combinazione non supportata.");
  }

  const bid = resolveMetaBidStrategy({
    allyBidMode: input.allyBidMode ?? "AUTOMATIC_NO_CAP",
    bidAmountMinor: input.bidAmountMinor ?? null,
    minRoas: input.minRoas ?? null,
  });
  if (!bid.ok) {
    readiness.push("MISSING_BID_STRATEGY");
    blockersIt.push(
      bid.reason === "MISSING_BID_AMOUNT"
        ? "Strategia di offerta: importo offerta mancante."
        : bid.reason === "MISSING_MIN_ROAS"
          ? "Strategia di offerta: ROAS minimo mancante."
          : "Strategia di offerta: configurazione non supportata.",
    );
  }

  const audience = resolveMetaAudienceMode({
    // Product default for Ally write slice: Advantage+ Audience (explicit Meta 0|1).
    // Pass UNRESOLVED explicitly to block readiness.
    allyAudienceMode: input.allyAudienceMode ?? "ADVANTAGE_AUDIENCE",
  });
  if (!audience.ok) {
    readiness.push("MISSING_AUDIENCE_MODE");
    blockersIt.push(
      "Pubblico: scegli Advantage+ Audience o pubblico manuale (Meta richiede un valore esplicito).",
    );
  }

  const ageMode = audience.ok ? audience.allyAudienceMode : "UNRESOLVED";
  // Advantage Audience: hard age_max must not be sent. Ally eta_max becomes a
  // suggestion (age_range) — never silently drop/widen Ally eta_min.
  const ageSuggestion =
    ageMode === "ADVANTAGE_AUDIENCE" &&
    input.etaMin != null &&
    input.etaMax != null
      ? { min: Math.round(input.etaMin), max: Math.round(input.etaMax) }
      : null;
  const age = resolveWriteAgeFields({
    allyAudienceMode: ageMode,
    etaMin: input.etaMin,
    etaMax: ageMode === "ADVANTAGE_AUDIENCE" ? null : input.etaMax,
    ageSuggestion,
  });
  if (!age.ok) {
    readiness.push("UNSUPPORTED_CONFIGURATION");
    blockersIt.push(
      age.reason === "INVALID_HARD_AGE_MAX_ADVANTAGE"
        ? "Età: con Advantage+ Audience non puoi impostare un'età massima hard."
        : age.reason === "INVALID_HARD_AGE_MIN_ADVANTAGE"
          ? "Età: con Advantage+ Audience l'età minima hard deve essere tra 18 e 25."
          : "Età: fascia non valida.",
    );
  } else if (
    ageMode === "ADVANTAGE_AUDIENCE" &&
    input.etaMax != null
  ) {
    // Plan still lists a hard max in Ally data — note it is not sent as hard constraint.
    // Readiness remains ok when wire model omits it (proven Meta contract).
  }

  let campaign: MetaWriteCampaignPayloadPreview | null = null;
  let adSet: MetaWriteAdSetPayloadPreview | null = null;

  const campaignBudget =
    input.budgetLevel === "CAMPAIGN" && budgetConv.ok ? budgetConv.minor : null;
  const adSetBudget =
    input.budgetLevel === "AD_SET" && budgetConv.ok ? budgetConv.minor : null;

  // Double budget impossible by construction.
  if (campaignBudget != null && adSetBudget != null) {
    throw new Error("DOUBLE_BUDGET_INVARIANT");
  }

  /**
   * BLOCKED FOR WRITE ≠ EMPTY PREVIEW
   * Always build partial Campaign + Ad Set for Ally-native plans,
   * even when special category / geo / schedule / permission block writes.
   */
  if (!input.isImportedMetaOnly) {
    const cats = specialCategoriesValue(
      input.specialAdCategories,
      input.countryCode,
    );
    const sacCountry =
      cats != null && cats.length > 0
        ? sacSelection.categoryCountryCodes.length > 0
          ? sacSelection.categoryCountryCodes
          : null
        : null;
    campaign = {
      name: input.campaignName.trim() || "Campagna Ally",
      objective,
      status: META_WRITE_SAFE_STATUS,
      special_ad_categories: cats,
      special_ad_category_country: sacCountry,
      buying_type: "AUCTION",
      daily_budget: campaignBudget,
      lifetime_budget: null,
      is_adset_budget_sharing_enabled:
        input.budgetLevel === "CAMPAIGN" ? true : false,
      fieldStatus: {
        name: "AVAILABLE",
        objective: objective ? "DERIVABLE" : "MISSING",
        status: "DERIVABLE",
        special_ad_categories:
          cats != null ? "AVAILABLE" : "MISSING",
        buying_type: "DERIVABLE",
        daily_budget:
          input.budgetLevel === "CAMPAIGN"
            ? campaignBudget != null
              ? "AVAILABLE"
              : "MISSING"
            : "DERIVABLE",
      },
    };

    // Canonical resolver owns promoted_object (page/tracking/event).
    // Instant Form form_id is NOT on Ad Set — Creative CTA uses lead_gen_form_id.
    let promoted: Record<string, unknown> | null =
      conversionPlan.promotedObject
        ? { ...conversionPlan.promotedObject }
        : null;
    if (
      !promoted &&
      destOpts.needsPage &&
      (input.pageId ?? "").trim()
    ) {
      promoted = { page_id: input.pageId!.trim() };
    }

    let adSetTargeting: Record<string, unknown> | null = targeting.ok
      ? { ...targeting.targeting }
      : null;
    if (adSetTargeting && audience.ok && audience.targetingAutomation) {
      adSetTargeting = {
        ...adSetTargeting,
        targeting_automation: audience.targetingAutomation,
      };
    }
    if (adSetTargeting && age.ok) {
      adSetTargeting = applyAgeFieldsToTargeting(adSetTargeting, age);
    }

    adSet = {
      name: "Gruppo principale",
      campaign_id: "{pending_campaign_id}",
      optimization_goal: destOpts.optimizationGoal,
      billing_event: billing.ok ? billing.billingEvent : null,
      daily_budget: adSetBudget,
      lifetime_budget: null,
      start_time: schedule.ok ? schedule.startTime : null,
      end_time: schedule.ok ? schedule.endTime : null,
      targeting: adSetTargeting,
      destination_type: destOpts.destinationType,
      promoted_object: promoted,
      bid_strategy: bid.ok ? bid.bidStrategy : null,
      bid_amount: bid.ok ? bid.bidAmount : null,
      status: META_WRITE_SAFE_STATUS,
      placementsNote: placements.ok ? placements.note : null,
      fieldStatus: {
        optimization_goal: destOpts.optimizationGoal ? "DERIVABLE" : "MISSING",
        billing_event: billing.ok ? "DERIVABLE" : "MISSING",
        daily_budget:
          input.budgetLevel === "AD_SET"
            ? adSetBudget != null
              ? "AVAILABLE"
              : "MISSING"
            : "DERIVABLE",
        targeting: targeting.ok ? "AVAILABLE" : "MISSING",
        schedule: schedule.ok
          ? schedule.startTime || schedule.endTime
            ? "AVAILABLE"
            : "DERIVABLE"
          : "MISSING",
        placements: placements.ok ? "DERIVABLE" : "UNRESOLVED",
        bid_strategy: bid.ok ? "DERIVABLE" : "MISSING",
        audience_mode: audience.ok ? "DERIVABLE" : "MISSING",
        status: "DERIVABLE",
      },
    };
  }

  const fingerprintBody = {
    operationType: "CAMPAIGN_ADSET_PAUSED" as const,
    allyCampaignId: input.allyCampaignId,
    clientId: input.clientId,
    campaign,
    adSet,
    destination: input.destination,
    specialAdCategories: input.specialAdCategories,
    budgetLevel: input.budgetLevel,
    budgetDailyMajor: input.budgetDailyMajor,
    currency: input.adAccountCurrency,
    destinationTracking: {
      mode: destinationTracking.mode,
      finalDestinationUrl: destinationTracking.finalDestinationUrl,
      metaUrlTags: destinationTracking.metaUrlTags,
    },
    adIdentity: {
      facebookPageId: adIdentity.facebookPageId,
      instagramUserId: adIdentity.instagramUserId,
      instagramIdentityStatus: adIdentity.instagramIdentityStatus,
      preferPageOnly: input.preferPageOnly === true,
    },
  };
  const fingerprint = fingerprintPayload(fingerprintBody);
  const idempotencyKey = buildIdempotencyKey({
    userId: opts?.userId ?? "preview",
    allyCampaignId: input.allyCampaignId,
    operationType: "CAMPAIGN_ADSET_PAUSED",
    fingerprint,
  });

  if (
    opts?.previousFingerprint &&
    opts.previousFingerprint !== fingerprint
  ) {
    readiness.push("STALE_PREVIEW");
    blockersIt.push(
      "La configurazione è cambiata rispetto all'anteprima precedente.",
    );
  }

  const hardBlockers = readiness.filter(
    (c) =>
      c !== "MISSING_CREATIVE_ASSET" &&
      c !== "STALE_PREVIEW" &&
      c !== "READY_TO_PREVIEW" &&
      c !== "READY_TO_WRITE" &&
      c !== "LIVE_WRITES_GATED" &&
      // Recovery signal: Ad Set resume when config is otherwise READY.
      c !== "PARTIAL_HIERARCHY",
  );

  // Partial preview remains available with blockers (permission, category, geo…).
  const canPreview =
    !input.isImportedMetaOnly &&
    !readiness.includes("ALREADY_LINKED_META") &&
    campaign != null &&
    adSet != null;

  const writeBlockers = hardBlockers.filter(
    (c) => c !== "MISSING_META_PERMISSION",
  );
  // READY_TO_PREVIEW: structural plan is complete except permission / creative.
  if (
    canPreview &&
    writeBlockers.length === 0 &&
    !readiness.includes("READY_TO_PREVIEW")
  ) {
    readiness.unshift("READY_TO_PREVIEW");
  }

  const canWrite =
    canPreview &&
    adsManagementPresent &&
    writeBlockers.length === 0 &&
    !readiness.includes("MISSING_META_PERMISSION") &&
    !readiness.includes("ALREADY_LINKED_META") &&
    !readiness.includes("WRITE_ALREADY_COMPLETED") &&
    !readiness.includes("IMPORTED_META_NOT_ELIGIBLE");

  if (canWrite && !readiness.includes("READY_TO_WRITE")) {
    readiness.unshift("READY_TO_WRITE");
  }

  const budgetHuman = formatBudgetMajorIt(
    input.budgetDailyMajor,
    input.adAccountCurrency,
  );
  const objectiveHuman = objective
    ? labelWithTechnical(
        etichettaMetaObjectiveUtente(objective) || objective,
        objective,
      )
    : "Da completare";
  const categoryHuman = labelSpecialAdCategories(input.specialAdCategories);
  const cittaPiano = (input.citta ?? "").trim();
  const optHuman = labelWithTechnical(
    etichettaOptimizationGoal(adSet?.optimization_goal ?? null),
    adSet?.optimization_goal ?? null,
  );
  const billHuman = labelWithTechnical(
    etichettaBillingEvent(adSet?.billing_event ?? null),
    adSet?.billing_event ?? null,
  );
  const scheduleHuman = schedule.ok
    ? formatScheduleRangeIt(
        schedule.startTime,
        schedule.endTime,
        input.adAccountTimezone,
      )
    : "Da aggiornare";

  const campaignLines: string[] = [];
  const adSetLines: string[] = [];
  if (campaign) {
    if (resumeMode === "RESUME_ADSET") {
      campaignLines.push(`Nome: ${campaign.name}`);
      campaignLines.push(
        `Stato: Già creata — Non attiva (${campaign.status})`,
      );
      campaignLines.push("Azione: NON verrà creata di nuovo");
      campaignLines.push(`Obiettivo: ${objectiveHuman}`);
      campaignLines.push(`Categoria speciale: ${categoryHuman}`);
    } else {
      campaignLines.push(`Nome: ${campaign.name}`);
      campaignLines.push(`Obiettivo: ${objectiveHuman}`);
      campaignLines.push(`Categoria speciale: ${categoryHuman}`);
      campaignLines.push(
        `Stato campagna: Non attiva (${campaign.status})`,
      );
      campaignLines.push(
        `Livello budget: ${
          input.budgetLevel === "CAMPAIGN" ? "Campagna" : "Gruppo di inserzioni"
        }`,
      );
      if (budgetHuman && input.budgetLevel === "CAMPAIGN") {
        campaignLines.push(`Budget: ${budgetHuman}`);
      } else if (input.budgetLevel === "CAMPAIGN") {
        campaignLines.push("Budget: da completare");
      } else {
        campaignLines.push("Budget: gestito a livello gruppo");
      }
    }
    campaignLines.push("Creatività: Non creata");
    campaignLines.push("Inserzione: Non creata");
    campaignLines.push("Spesa automatica: No");
  }
  if (adSet) {
    adSetLines.push(`Nome: ${adSet.name}`);
    if (resumeMode === "RESUME_ADSET") {
      adSetLines.push(`Stato: Da creare — Non attivo (${adSet.status})`);
    }
    const geoHuman = (input.geoLabel ?? "").trim();
    if (geoHuman && (input.metaGeoKey ?? "").trim()) {
      adSetLines.push(
        resumeMode === "RESUME_ADSET"
          ? `Località: ${geoHuman}`
          : `Località: ${geoHuman} — risolta da Meta`,
      );
    } else if (cittaPiano) {
      const country = (input.countryCode ?? "").trim();
      adSetLines.push(
        `Località: ${cittaPiano}${
          country ? `, ${country === "IT" ? "Italia" : country}` : ""
        }${
          resumeMode === "RESUME_ADSET"
            ? ""
            : (input.metaGeoKey ?? "").trim()
              ? " — risolta da Meta"
              : ""
        }`,
      );
    } else if (!targeting.ok && targeting.reason === "MISSING_GEO_RESOLUTION") {
      adSetLines.push("Località: chiave geografica da risolvere");
    } else if (!targeting.ok) {
      adSetLines.push("Località: da completare");
    } else if ((input.countryCode ?? "").trim()) {
      adSetLines.push(`Località: paese ${(input.countryCode ?? "").trim()}`);
    }
    if (input.etaMin != null || input.etaMax != null || age.ok) {
      if (resumeMode === "RESUME_ADSET") {
        const min =
          age.ok && age.age_min != null
            ? age.age_min
            : input.etaMin != null
              ? input.etaMin
              : null;
        if (min != null) adSetLines.push(`Età minima: ${min}`);
        adSetLines.push("Età massima: Nessun limite rigido");
        adSetLines.push(
          `Fascia suggerita: ${age.ok ? age.suggestionHuman : "Nessuna"}`,
        );
      } else {
        if (age.ok && age.hardMinimumHuman) {
          adSetLines.push(`Età minima: ${age.hardMinimumHuman}`);
        } else if (input.etaMin != null) {
          adSetLines.push(`Età minima: ${input.etaMin} — vincolo`);
        }
        if (ageMode === "ADVANTAGE_AUDIENCE") {
          adSetLines.push("Età massima: Nessun limite rigido (Advantage+)");
        } else if (age.ok && age.age_max != null) {
          adSetLines.push(`Età massima: ${age.age_max} — vincolo`);
        }
        adSetLines.push(
          `Fascia d'età suggerita: ${age.ok ? age.suggestionHuman : "Nessuna"}`,
        );
      }
    }
    if (budgetHuman && input.budgetLevel === "AD_SET") {
      adSetLines.push(`Budget: ${budgetHuman}`);
    } else if (input.budgetLevel === "AD_SET") {
      adSetLines.push("Budget: da completare");
    }
    adSetLines.push(`Programmazione: ${scheduleHuman}`);
    adSetLines.push(`Ottimizzazione: ${optHuman}`);
    adSetLines.push(`Fatturazione: ${billHuman}`);
    if (
      input.destination === "WEBSITE" &&
      (objective === "OUTCOME_LEADS" || objective === "OUTCOME_SALES")
    ) {
      if (hasUsableWebsiteTracking(input.websiteTracking)) {
        const t = input.websiteTracking!;
        adSetLines.push(
          `Tracking: ${t.sourceName?.trim() || t.sourceType} (${t.sourceType})`,
        );
        adSetLines.push(
          `Evento conversione: ${etichettaConversionEvent(t.eventType)}`,
        );
      } else {
        adSetLines.push("Tracking: Pixel/Dataset richiesto — non configurato");
        adSetLines.push(
          `Evento conversione: ${etichettaConversionEvent(
            conversionPlan.conversionEvent,
          )} (da confermare)`,
        );
      }
    }
    adSetLines.push(
      `Destinazione finale: ${labelDestination(input.destination)}${
        input.destination === "WEBSITE" && !adSet.destination_type
          ? " — URL da definire nella creatività"
          : ""
      }`,
    );
    if (adSet.destination_type) {
      adSetLines.push(`Ad Set destination_type: ${adSet.destination_type}`);
    } else if (input.destination === "WEBSITE") {
      adSetLines.push("Ad Set destination_type: Non inviato");
    }
    if (bid.ok && bid.humanLabelIt) {
      adSetLines.push(`Strategia di offerta: ${bid.humanLabelIt}`);
      if (resumeMode !== "RESUME_ADSET") {
        adSetLines.push(`bid_strategy: ${bid.bidStrategy}`);
      }
    } else {
      adSetLines.push("Strategia di offerta: da completare");
    }
    if (audience.ok && audience.humanLabelIt) {
      adSetLines.push(`Pubblico: ${audience.humanLabelIt}`);
      if (resumeMode !== "RESUME_ADSET") {
        adSetLines.push(
          `targeting_automation.advantage_audience = ${audience.advantageAudience}`,
        );
      }
    } else {
      adSetLines.push("Pubblico: da scegliere (Advantage+ Audience o manuale)");
    }
    if (resumeMode === "RESUME_ADSET") {
      adSetLines.push("Distribuzione: Advantage+ / automatica");
    } else if (adSet.placementsNote) {
      adSetLines.push(`Distribuzione: ${adSet.placementsNote}`);
    } else {
      adSetLines.push("Distribuzione: Advantage+/automatic");
    }
    if (resumeMode !== "RESUME_ADSET") {
      adSetLines.push(`Stato gruppo: Non attivo (${adSet.status})`);
    }
    if (targeting.ok) {
      for (const n of targeting.notes) adSetLines.push(n);
    }
  }

  const footnoteParts =
    writeAlreadyCompleted
      ? [
          "Configurazione Meta già creata: campagna e gruppo di inserzioni esistono in stato non attivo (PAUSED). Nessuna nuova creazione, nessuna creatività, nessuna inserzione, nessuna attivazione automatica.",
        ]
      : resumeMode === "RESUME_ADSET"
      ? [
          "Ripresa gerarchia parziale: la campagna Meta esiste già (PAUSED). Alla conferma verrà creato solo il gruppo di inserzioni mancante in stato non attivo. Nessuna nuova campagna, nessuna creatività, nessuna inserzione, nessuna attivazione automatica.",
        ]
      : [
          "Quando confermata, la creazione su Meta produce 1 campagna e 1 gruppo di inserzioni in stato non attivo (PAUSED). Nessuna pubblicazione automatica. Creatività e inserzione non create in questo slice.",
        ];
  if (!adsManagementPresent && !writeAlreadyCompleted) {
    footnoteParts.push(
      "Puoi verificare la configurazione. Per creare su Meta servirà autorizzare il permesso di gestione inserzioni.",
    );
  }
  if (canWrite) {
    footnoteParts.push(
      resumeMode === "RESUME_ADSET"
        ? "Configurazione pronta. Premi «Completa creazione del gruppo su Meta» solo dopo verifica esplicita — nessun write automatico."
        : "Configurazione pronta. Premi «Conferma creazione su Meta» solo dopo verifica esplicita — nessun write automatico.",
    );
  }
  for (const w of sacWarningMessages) {
    if (!footnoteParts.includes(w)) footnoteParts.push(w);
  }
  for (const w of destinationTracking.warningsIt) {
    if (!footnoteParts.includes(w)) footnoteParts.push(w);
  }
  for (const w of adIdentity.warningsIt) {
    if (!footnoteParts.includes(w)) footnoteParts.push(w);
  }

  const result: MetaWritePreviewResult = {
    operationType: "CAMPAIGN_ADSET_PAUSED",
    readinessCodes: [...new Set(readiness)],
    canPreview,
    canWrite,
    resumeMode,
    writeAlreadyCompleted,
    adsManagementPresent,
    fingerprint,
    idempotencyKey,
    campaign,
    adSet,
    creative: {
      enabled: false,
      reason:
        input.creativitaCount <= 0 ? "MISSING_CREATIVE_ASSET" : "DEFERRED_SLICE",
    },
    ad: { enabled: false, reason: "DEFERRED_SLICE" },
    blockersIt: [...new Set(blockersIt)],
    summaryIt: {
      campaignLines,
      adSetLines,
      missingLines: [...new Set(blockersIt)].filter(
        (l) =>
          !(
            resumeMode === "RESUME_ADSET" &&
            canWrite &&
            l.includes("Campagna Meta già creata")
          ),
      ),
      footnote: footnoteParts.join(" "),
    },
    conversionPublishPlan: conversionPlan,
    destinationTracking,
    adIdentity,
    safePayloadSummary: {
      operationType: "CAMPAIGN_ADSET_PAUSED",
      fingerprint,
      objective,
      status: META_WRITE_SAFE_STATUS,
      budgetLevel: input.budgetLevel,
      budgetDailyMajor: input.budgetDailyMajor,
      budgetMinorUnits: budgetConv.ok ? budgetConv.minor : null,
      destination: input.destination,
      clientId: input.clientId,
      allyCampaignId: input.allyCampaignId,
      formId: input.formId,
      formPrivacyPolicyUrl: leadTechnicalUrl,
      adAccountId: input.metaAdAccountId ?? null,
      timezoneName: input.adAccountTimezone ?? null,
      adsManagementPresent,
      canPreview,
      canWrite,
      resumeMode,
      writeAlreadyCompleted,
      readinessCodes: [...new Set(readiness)],
      conversionPublishPlan: {
        metaObjective: conversionPlan.metaObjective,
        conversionLocation: conversionPlan.conversionLocation,
        optimizationGoal: conversionPlan.optimizationGoal,
        destinationType: conversionPlan.destinationType,
        trackingSource: conversionPlan.trackingSource,
        conversionEvent: conversionPlan.conversionEvent,
        promotedObject: conversionPlan.promotedObject,
        trackingRequirement: conversionPlan.trackingRequirement,
        valid: conversionPlan.valid,
        blockReasonCode: conversionPlan.blockReasonCode,
        needsMetaVerification: conversionPlan.needsMetaVerification,
      },
      canonicalPlan:
        opts?.canonicalPlan ??
        ({
          specialAdCategories: input.specialAdCategories,
          destination: input.destination,
          countryCode: input.countryCode,
          metaGeoKey: input.metaGeoKey,
          geoLabel: input.geoLabel,
          startAtIso: input.startAtIso,
          endAtIso: input.endAtIso,
          pageId: input.pageId,
          formId: input.formId,
          formPrivacyPolicyUrl: leadTechnicalUrl,
          allyAudienceMode: input.allyAudienceMode ?? "ADVANTAGE_AUDIENCE",
          websiteTracking: input.websiteTracking ?? null,
          destinationTrackingMode: input.destinationTrackingMode ?? null,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmContent: input.utmContent ?? null,
          utmTerm: input.utmTerm ?? null,
          instagramUserId: input.instagramUserId ?? null,
          preferPageOnly: input.preferPageOnly ?? null,
        } satisfies MetaWriteCanonicalPlan),
    },
    metaValidation: null,
  };

  const canonicalPublishPreview = buildCanonicalPublishPreview({
    planInput: input,
    preview: result,
    creativeIntent: {
      ...(opts?.creativeIntent ?? {}),
      pageName: input.pageName ?? opts?.creativeIntent?.pageName ?? null,
      formName: input.instantFormName ?? null,
    },
  });
  result.canonicalPublishPreview = canonicalPublishPreview;
  result.publishAllowed = canonicalPublishPreview.publishAllowed;

  const instantFormEasyReadiness = assessInstantFormEasyReadiness({
    planInput: input,
    preview: result,
    formRelation: input.instantFormRelation ?? "UNCHECKED",
    formName: input.instantFormName ?? null,
  });
  result.instantFormEasyReadiness = instantFormEasyReadiness;

  (result.safePayloadSummary as Record<string, unknown>).publishAllowed =
    canonicalPublishPreview.publishAllowed;
  (result.safePayloadSummary as Record<string, unknown>).canonicalPreviewKeys =
    Object.keys(canonicalPublishPreview.expectedByKey);
  if (instantFormEasyReadiness) {
    (result.safePayloadSummary as Record<string, unknown>).instantFormEasyReadiness =
      {
        readiness: instantFormEasyReadiness.readiness,
        requiredInputsCount: instantFormEasyReadiness.requiredInputsCount,
        completedInputsCount: instantFormEasyReadiness.completedInputsCount,
        estimatedUserSteps: instantFormEasyReadiness.estimatedUserSteps,
        automaticDecisionsCount: instantFormEasyReadiness.automaticDecisionsCount,
        formRelation: instantFormEasyReadiness.formRelation,
      };
  }
  // Never leak tokens — assert none present in technical dump.
  // Require a token-like shape (avoid false positives on hex fingerprints).
  const techJson = JSON.stringify(canonicalPublishPreview.technicalDetails);
  if (
    /access_token/i.test(techJson) ||
    /\bEAA[A-Za-z0-9]{20,}\b/.test(techJson)
  ) {
    throw new Error("CANONICAL_PREVIEW_SECRET_LEAK");
  }

  return result;
}

/** Confirm fingerprint must match current preview — fail closed. */
export function assertPreviewFingerprintMatch(
  current: string,
  confirmed: string,
): { ok: true } | { ok: false; code: "STALE_PREVIEW" } {
  if (current !== confirmed) return { ok: false, code: "STALE_PREVIEW" };
  return { ok: true };
}
