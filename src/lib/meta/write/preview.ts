/**
 * M11A.1 — Dry-run preview builder. No Graph POST. No Marketing API creates.
 */

import { resolveBillingEvent } from "@/lib/meta/write/billing-event";
import { majorCurrencyToMetaMinorUnits } from "@/lib/meta/write/budget";
import {
  buildIdempotencyKey,
  fingerprintPayload,
} from "@/lib/meta/write/fingerprint";
import {
  resolveMetaObjectiveCode,
  resolveOptimizationAndDestination,
} from "@/lib/meta/write/objective";
import { resolveWritePlacements } from "@/lib/meta/write/placements";
import { resolveWriteSchedule } from "@/lib/meta/write/schedule";
import { translateWriteTargeting } from "@/lib/meta/write/targeting";
import type {
  MetaWriteAdSetPayloadPreview,
  MetaWriteCampaignPayloadPreview,
  MetaWritePlanInput,
  MetaWritePreviewResult,
  MetaWriteReadinessCode,
} from "@/lib/meta/write/types";
import { META_WRITE_SAFE_STATUS } from "@/lib/meta/write/types";
import { etichettaMetaObjectiveUtente } from "@/lib/meta/meta-ui-labels";

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
  const map: Record<string, string> = {
    CREDIT: "Credito",
    EMPLOYMENT: "Lavoro",
    HOUSING: "Alloggi",
    ISSUES_ELECTIONS_POLITICS: "Temi sociali / politici",
  };
  return decision.categories.map((c) => map[c] ?? c).join(", ");
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

export function connectionHasAdsManagement(scopes: string[]): boolean {
  return scopes.map((s) => s.trim()).includes("ads_management");
}

function specialCategoriesValue(
  decision: MetaWritePlanInput["specialAdCategories"],
): string[] | null {
  if (decision.kind === "NONE") return [];
  if (decision.kind === "CATEGORIES") return [...decision.categories];
  return null;
}

/**
 * Build dry-run Campaign + Ad Set preview for Ally-native plans only.
 * canWrite is always false in M11A.1.
 */
export function buildMetaWritePreview(
  input: MetaWritePlanInput,
  opts?: { userId?: string; previousFingerprint?: string | null },
): MetaWritePreviewResult {
  const readiness: MetaWriteReadinessCode[] = [];
  const blockersIt: string[] = [];

  if (input.isImportedMetaOnly) {
    readiness.push("IMPORTED_META_NOT_ELIGIBLE");
    blockersIt.push(
      "Le campagne importate da Meta non possono usare «Crea su Meta».",
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

  if (input.specialAdCategories.kind === "UNRESOLVED") {
    readiness.push("MISSING_SPECIAL_AD_CATEGORY_DECISION");
    blockersIt.push("Categoria speciale Meta: da confermare.");
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

  const destOpts = resolveOptimizationAndDestination({
    metaObjective: objective,
    destination: input.destination,
  });

  if (destOpts.needsPage && !(input.pageId ?? "").trim()) {
    readiness.push("MISSING_PAGE");
    blockersIt.push("Indica la Pagina Facebook.");
  }
  if (destOpts.needsForm && !(input.formId ?? "").trim()) {
    readiness.push("MISSING_FORM");
    blockersIt.push("Indica il modulo contatti Meta.");
  }
  if (destOpts.needsUrl && !(input.destinationUrl ?? "").trim()) {
    readiness.push("MISSING_DESTINATION");
    blockersIt.push("Indica l'URL di destinazione.");
  }
  if (destOpts.needsTracking) {
    readiness.push("MISSING_TRACKING_CONFIG");
    blockersIt.push(
      "Manca la configurazione tracking (pixel/dataset) necessaria per questa ottimizzazione.",
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
    } else {
      readiness.push("MISSING_GEO");
      blockersIt.push("Zona: incompleta.");
    }
  }

  const placements = resolveWritePlacements({
    placementsAdvantage: input.placementsAdvantage,
  });
  if (!placements.ok) {
    blockersIt.push(
      placements.reason === "MANUAL_UNSUPPORTED"
        ? "Placement manuali non supportati in questo slice."
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
        : "Programmazione: da aggiornare.",
    );
  }

  const billing = resolveBillingEvent({
    optimizationGoal: destOpts.optimizationGoal,
  });
  if (destOpts.optimizationGoal && !billing.ok) {
    readiness.push("UNSUPPORTED_BILLING_EVENT");
    blockersIt.push("Fatturazione: combinazione non supportata.");
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
    const cats = specialCategoriesValue(input.specialAdCategories);
    campaign = {
      name: input.campaignName.trim() || "Campagna Ally",
      objective,
      status: META_WRITE_SAFE_STATUS,
      special_ad_categories: cats,
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

    let promoted: Record<string, unknown> | null = null;
    if (destOpts.needsPage && (input.pageId ?? "").trim()) {
      promoted = { page_id: input.pageId!.trim() };
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
      targeting: targeting.ok ? targeting.targeting : null,
      destination_type: destOpts.destinationType,
      promoted_object: promoted,
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
        schedule: schedule.ok ? "AVAILABLE" : "MISSING",
        placements: placements.ok ? "DERIVABLE" : "UNRESOLVED",
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
      c !== "MISSING_META_PERMISSION" &&
      c !== "MISSING_CREATIVE_ASSET" &&
      c !== "STALE_PREVIEW",
  );

  // Partial preview remains available with blockers (permission, category, geo…).
  const canPreview =
    !input.isImportedMetaOnly && campaign != null && adSet != null;

  if (
    canPreview &&
    hardBlockers.length === 0 &&
    adsManagementPresent &&
    !readiness.includes("READY_TO_PREVIEW")
  ) {
    readiness.unshift("READY_TO_PREVIEW");
  }

  const budgetHuman = formatBudgetMajorIt(
    input.budgetDailyMajor,
    input.adAccountCurrency,
  );
  const objectiveHuman = objective
    ? etichettaMetaObjectiveUtente(objective) || objective
    : "Da completare";
  const categoryHuman = labelSpecialAdCategories(input.specialAdCategories);
  const cittaPiano = (input.citta ?? "").trim();

  const campaignLines: string[] = [];
  const adSetLines: string[] = [];
  if (campaign) {
    campaignLines.push(`Nome: ${campaign.name}`);
    campaignLines.push(`Obiettivo: ${objectiveHuman}`);
    campaignLines.push(`Stato su Meta: Non attiva`);
    campaignLines.push(`Stato tecnico: ${campaign.status}`);
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
    campaignLines.push(`Buying type: ${campaign.buying_type}`);
    campaignLines.push(`Categoria speciale Meta: ${categoryHuman}`);
  }
  if (adSet) {
    adSetLines.push(`Nome: ${adSet.name}`);
    if (cittaPiano) {
      adSetLines.push(`Zona pianificata: ${cittaPiano}`);
    }
    if (!targeting.ok && targeting.reason === "MISSING_GEO_RESOLUTION") {
      adSetLines.push("Zona Meta: chiave geografica da risolvere");
    } else if (!targeting.ok) {
      adSetLines.push("Zona Meta: da completare");
    } else if (cittaPiano && (input.metaGeoKey ?? "").trim()) {
      adSetLines.push(`Zona Meta: chiave ${input.metaGeoKey!.trim()}`);
    } else if ((input.countryCode ?? "").trim()) {
      adSetLines.push(`Zona Meta: paese ${(input.countryCode ?? "").trim()}`);
    }
    if (input.etaMin != null || input.etaMax != null) {
      const min = input.etaMin ?? "—";
      const max = input.etaMax ?? "—";
      adSetLines.push(`Età: ${min}–${max}`);
    }
    if (budgetHuman && input.budgetLevel === "AD_SET") {
      adSetLines.push(`Budget: ${budgetHuman}`);
    } else if (input.budgetLevel === "AD_SET") {
      adSetLines.push("Budget: da completare");
    }
    adSetLines.push(
      `Programmazione: ${schedule.ok ? "Impostata" : "Da aggiornare"}`,
    );
    adSetLines.push(
      `Ottimizzazione: ${adSet.optimization_goal ?? "Non determinabile"}`,
    );
    adSetLines.push(
      `Fatturazione: ${adSet.billing_event ?? "Non determinabile"}`,
    );
    adSetLines.push(`Destinazione: ${labelDestination(input.destination)}`);
    if (adSet.placementsNote) {
      adSetLines.push(`Distribuzione: ${adSet.placementsNote}`);
    } else {
      adSetLines.push("Distribuzione: da confermare");
    }
    adSetLines.push(`Stato su Meta: Non attiva`);
    adSetLines.push(`Stato tecnico: ${adSet.status}`);
    if (targeting.ok) {
      for (const n of targeting.notes) adSetLines.push(n);
    }
  }

  const footnoteParts = [
    "Quando la creazione sarà abilitata, campagna e gruppo verranno creati su Meta in stato non attivo (PAUSED). Nessuna pubblicazione automatica.",
  ];
  if (!adsManagementPresent) {
    footnoteParts.push(
      "Puoi verificare la configurazione. Per creare su Meta servirà autorizzare il permesso di gestione inserzioni.",
    );
  }

  return {
    operationType: "CAMPAIGN_ADSET_PAUSED",
    readinessCodes: [...new Set(readiness)],
    canPreview,
    canWrite: false,
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
      missingLines: [...new Set(blockersIt)],
      footnote: footnoteParts.join(" "),
    },
    safePayloadSummary: {
      operationType: "CAMPAIGN_ADSET_PAUSED",
      fingerprint,
      objective,
      status: META_WRITE_SAFE_STATUS,
      budgetLevel: input.budgetLevel,
      budgetDailyMajor: input.budgetDailyMajor,
      budgetMinorUnits: budgetConv.ok ? budgetConv.minor : null,
      destination: input.destination,
      adsManagementPresent,
      canPreview,
      canWrite: false,
      readinessCodes: [...new Set(readiness)],
    },
  };
}

/** Confirm fingerprint must match current preview — fail closed. */
export function assertPreviewFingerprintMatch(
  current: string,
  confirmed: string,
): { ok: true } | { ok: false; code: "STALE_PREVIEW" } {
  if (current !== confirmed) return { ok: false, code: "STALE_PREVIEW" };
  return { ok: true };
}
