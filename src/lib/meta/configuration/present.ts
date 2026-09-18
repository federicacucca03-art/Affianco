/**
 * M10D — Beginner + professional presentation (progressive disclosure).
 * Campaign vs Ad Set vs Ad scopes stay separate — no cross-level duplication.
 */

import {
  etichettaBidStrategy,
  etichettaBillingEvent,
  etichettaBudgetLevel,
  etichettaBuyingType,
  etichettaDestinationType,
  etichettaOptimizationGoal,
  etichettaPlacementMode,
  formatMetaBudgetAmountIt,
  formatMetaBudgetIt,
  formatMetaConfigDateTimeIt,
  formatAttributionSpecIt,
  etichettaAdsetBudgetSharing,
  etichettaSpecialAdCategories,
} from "@/lib/meta/configuration/labels";
import { audienceBeginnerLabel } from "@/lib/meta/configuration/normalize-targeting";
import type {
  ConfigPresentation,
  ConfigSummaryLine,
  MetaAdConfiguration,
  MetaAdSetConfiguration,
  MetaBudgetLevel,
  MetaCampaignConfiguration,
  PlannedVsActualField,
  ConfigurationObservation,
} from "@/lib/meta/configuration/types";
import { etichettaMetaObjectiveUtente } from "@/lib/meta/meta-ui-labels";
import { etichettaMetaDeliveryStatus } from "@/lib/meta/hierarchy-evaluate";

function line(key: string, label: string, value: string): ConfigSummaryLine {
  return { key, label, value };
}

function campaignBudgetAmountLine(
  campaign: MetaCampaignConfiguration,
): ConfigSummaryLine | null {
  if (
    campaign.lifetimeBudgetMinor.value != null &&
    campaign.lifetimeBudgetMinor.value > 0
  ) {
    return line(
      "budgetTotal",
      "Budget totale",
      formatMetaBudgetAmountIt(campaign.lifetimeBudgetMinor.value),
    );
  }
  if (
    campaign.dailyBudgetMinor.value != null &&
    campaign.dailyBudgetMinor.value > 0
  ) {
    return line(
      "budgetDaily",
      "Budget giornaliero",
      formatMetaBudgetIt(campaign.dailyBudgetMinor.value, "DAILY"),
    );
  }
  return null;
}

/** Campaign-level only — never Ad Set audience/placements/optimization. */
export function presentCampaignConfig(
  campaign: MetaCampaignConfiguration,
  _primaryAdSet?: MetaAdSetConfiguration | null,
): { beginner: ConfigSummaryLine[]; professional: ConfigSummaryLine[] } {
  const beginner: ConfigSummaryLine[] = [];
  const professional: ConfigSummaryLine[] = [];

  const objLabel =
    etichettaMetaObjectiveUtente(campaign.objective.value) ||
    campaign.objective.value ||
    "Non disponibile";
  beginner.push(line("objective", "Obiettivo", objLabel));

  const status =
    etichettaMetaDeliveryStatus(campaign.effectiveStatus.value) ||
    campaign.effectiveStatus.value ||
    "Non disponibile";
  beginner.push(line("status", "Stato su Meta", status));

  beginner.push(
    line("budgetLevel", "Budget", etichettaBudgetLevel(campaign.budgetLevel)),
  );

  const amount = campaignBudgetAmountLine(campaign);
  if (amount) beginner.push(amount);

  professional.push(
    line(
      "objectiveRaw",
      "Objective Meta",
      campaign.objective.value ?? "Non disponibile",
    ),
  );
  professional.push(
    line(
      "buyingType",
      "Tipo di acquisto",
      etichettaBuyingType(campaign.buyingType.value),
    ),
  );
  professional.push(
    line(
      "campaignDaily",
      "Budget giornaliero campagna",
      formatMetaBudgetIt(campaign.dailyBudgetMinor.value, "DAILY"),
    ),
  );
  professional.push(
    line(
      "campaignLifetime",
      "Budget totale campagna",
      campaign.lifetimeBudgetMinor.value != null &&
        campaign.lifetimeBudgetMinor.value > 0
        ? formatMetaBudgetAmountIt(campaign.lifetimeBudgetMinor.value)
        : "Non disponibile",
    ),
  );
  professional.push(
    line(
      "adsetBudgetSharing",
      "Condivisione budget tra gruppi",
      etichettaAdsetBudgetSharing(campaign.adsetBudgetSharingEnabled.value),
    ),
  );
  professional.push(
    line(
      "specialCats",
      "Categorie speciali",
      etichettaSpecialAdCategories(
        campaign.specialAdCategories.raw,
        campaign.specialAdCategories.value,
      ),
    ),
  );

  return { beginner, professional };
}

/** Ad Set — audience, distribution, optimization, schedule, bidding, attribution. */
export function presentAdSetConfig(
  adSet: MetaAdSetConfiguration,
  options?: { campaignBudgetLevel?: MetaBudgetLevel },
): { beginner: ConfigSummaryLine[]; professional: ConfigSummaryLine[] } {
  const beginner: ConfigSummaryLine[] = [];
  const professional: ConfigSummaryLine[] = [];
  const campaignLevel = options?.campaignBudgetLevel ?? "UNKNOWN";

  beginner.push(
    line(
      "audience",
      "Pubblico",
      adSet.audience.value
        ? audienceBeginnerLabel(adSet.audience.value)
        : "Dettaglio pubblico non disponibile",
    ),
  );
  beginner.push(
    line(
      "placements",
      "Distribuzione",
      etichettaPlacementMode(adSet.placements.value?.mode ?? "UNAVAILABLE"),
    ),
  );
  beginner.push(
    line(
      "optimization",
      "Ottimizzazione",
      etichettaOptimizationGoal(adSet.optimizationGoal.value),
    ),
  );

  if (campaignLevel === "CAMPAIGN" && adSet.budgetKind !== "DAILY" && adSet.budgetKind !== "LIFETIME") {
    beginner.push(
      line("budget", "Budget", "Gestito a livello campagna"),
    );
  } else if (adSet.budgetKind === "DAILY" || adSet.budgetKind === "LIFETIME") {
    beginner.push(
      line(
        "budget",
        "Budget",
        formatMetaBudgetIt(
          adSet.dailyBudgetMinor.value ?? adSet.lifetimeBudgetMinor.value,
          adSet.budgetKind,
        ),
      ),
    );
  } else {
    beginner.push(
      line("budget", "Budget", etichettaBudgetLevel(campaignLevel)),
    );
  }

  if (campaignLevel === "CAMPAIGN" && adSet.budgetKind !== "DAILY" && adSet.budgetKind !== "LIFETIME") {
    professional.push(
      line(
        "adSetBudget",
        "Budget gruppo",
        "Non impostato — gestito a livello campagna",
      ),
    );
  } else {
    professional.push(
      line(
        "adSetBudget",
        "Budget gruppo",
        formatMetaBudgetIt(
          adSet.dailyBudgetMinor.value ?? adSet.lifetimeBudgetMinor.value,
          adSet.budgetKind === "UNKNOWN" ? "NONE" : adSet.budgetKind,
        ),
      ),
    );
  }

  professional.push(
    line(
      "scheduleStart",
      "Inizio",
      formatMetaConfigDateTimeIt(adSet.startAt.value) ?? "Non disponibile",
    ),
  );
  professional.push(
    line(
      "scheduleEnd",
      "Fine",
      formatMetaConfigDateTimeIt(adSet.endAt.value) ?? "Non disponibile",
    ),
  );
  professional.push(
    line(
      "optimization",
      "Ottimizzazione",
      etichettaOptimizationGoal(adSet.optimizationGoal.value),
    ),
  );
  if (adSet.optimizationGoal.value) {
    professional.push(
      line(
        "optimizationRaw",
        "Ottimizzazione (Meta)",
        adSet.optimizationGoal.value,
      ),
    );
  }
  professional.push(
    line(
      "billing",
      "Fatturazione",
      etichettaBillingEvent(adSet.billingEvent.value),
    ),
  );
  professional.push(
    line(
      "bid",
      "Strategia di offerta",
      etichettaBidStrategy(adSet.bidStrategy.value),
    ),
  );
  professional.push(
    line(
      "bidAmount",
      "Importo offerta",
      adSet.bidAmountMinor.value != null && adSet.bidAmountMinor.value > 0
        ? formatMetaBudgetAmountIt(adSet.bidAmountMinor.value)
        : "Non disponibile",
    ),
  );
  professional.push(
    line(
      "destination",
      "Destinazione",
      etichettaDestinationType(adSet.destinationType.value),
    ),
  );

  const attribution = formatAttributionSpecIt(adSet.attributionSpec.value);
  professional.push(line("attribution", "Attribuzione", attribution.primary));
  if (attribution.technical) {
    professional.push(
      line("attributionRaw", "Attribuzione (Meta)", attribution.technical),
    );
  }

  const promoted = humanPromotedObject(adSet.promotedObject.value);
  if (promoted) {
    professional.push(line("promotedObject", "Oggetto promosso", promoted));
  }

  professional.push(
    line(
      "placementsDetail",
      "Posizionamenti",
      etichettaPlacementMode(adSet.placements.value?.mode ?? "UNAVAILABLE"),
    ),
  );

  return { beginner, professional };
}

function humanPromotedObject(
  obj: Record<string, unknown> | null,
): string | null {
  if (!obj) return null;
  if (typeof obj.page_id === "string" && obj.page_id.trim()) {
    return "Pagina Meta collegata";
  }
  if (typeof obj.pixel_id === "string" && obj.pixel_id.trim()) {
    return "Pixel Meta collegato";
  }
  if (typeof obj.application_id === "string" && obj.application_id.trim()) {
    return "App Meta collegata";
  }
  return null;
}

export function presentAdConfig(ad: MetaAdConfiguration): {
  beginner: ConfigSummaryLine[];
  professional: ConfigSummaryLine[];
} {
  const status =
    etichettaMetaDeliveryStatus(ad.effectiveStatus.value) ||
    ad.effectiveStatus.value ||
    "Non disponibile";
  const beginner: ConfigSummaryLine[] = [
    line("status", "Stato su Meta", status),
    line(
      "creative",
      "Creatività",
      ad.creativeTitle.value ||
        ad.creativeName.value ||
        (ad.creativeId.value ? "Creatività collegata" : "Non disponibile"),
    ),
  ];
  if (ad.creativeCta.value) {
    beginner.push(line("cta", "CTA", ad.creativeCta.value));
  }

  const professional: ConfigSummaryLine[] = [
    line("status", "Stato su Meta", status),
    line(
      "creative",
      "Creatività",
      ad.creativeTitle.value ||
        ad.creativeName.value ||
        (ad.creativeId.value ? "Creatività collegata" : "Non disponibile"),
    ),
    line("creativeId", "Creative id", ad.creativeId.value ?? "Non disponibile"),
    line("cta", "CTA", ad.creativeCta.value ?? "Non disponibile"),
  ];
  if (ad.creativeLinkUrl.value) {
    professional.push(line("link", "Link", ad.creativeLinkUrl.value));
  }

  return { beginner, professional };
}

export function buildConfigPresentation(input: {
  campaign: MetaCampaignConfiguration;
  primaryAdSet: MetaAdSetConfiguration | null;
  observations: ConfigurationObservation[];
  plannedVsActual: PlannedVsActualField[] | null;
}): ConfigPresentation {
  const { beginner, professional } = presentCampaignConfig(
    input.campaign,
    input.primaryAdSet,
  );
  return {
    beginner,
    professional,
    observations: input.observations,
    plannedVsActual: input.plannedVsActual,
  };
}

export function buildAdSetConfigPresentation(input: {
  adSet: MetaAdSetConfiguration;
  campaignBudgetLevel: MetaBudgetLevel;
  observations: ConfigurationObservation[];
}): ConfigPresentation {
  const { beginner, professional } = presentAdSetConfig(input.adSet, {
    campaignBudgetLevel: input.campaignBudgetLevel,
  });
  return {
    beginner,
    professional,
    observations: input.observations,
    plannedVsActual: null,
  };
}
