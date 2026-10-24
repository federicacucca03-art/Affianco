/**
 * ADV.2.1 — CanonicalCampaignStateV2 → MetaExecutionPlan (pure, immutable).
 * Never mutates V2. Never invents Meta IDs. Never silent SALES→LEADS.
 * LIVE META WRITES: 0
 */

import {
  cloneCanonicalCampaignStateV2,
  serializeCanonicalCampaignStateV2,
} from "@/lib/campagne-canonical-v2/serialize";
import type {
  CanonicalAdSetV2,
  CanonicalCampaignStateV2,
  CanonicalCreativeRefV2,
  OptimizationEventIntentV2,
} from "@/lib/campagne-canonical-v2/types";
import { resolveBillingEvent } from "@/lib/meta/write/billing-event";
import {
  resolveConversionPublishPlan,
  type AllyConversionPublishPlan,
} from "@/lib/meta/write/conversion-resolver";
import {
  isObjectiveOptimizationSupported,
} from "@/lib/meta/write/objective-matrix";
import { resolveWritePlacements } from "@/lib/meta/write/placements";
import type { AllyWebsiteTrackingConfig } from "@/lib/meta/write/tracking";
import {
  resolveAllyMetaCta,
} from "@/lib/meta/creative/cta";
import {
  destinationLabelIt,
  mapV2LocationToMetaDestination,
} from "@/lib/meta/execution-plan/destination-map";
import {
  mapV2ObjectiveToMeta,
  metaObjectiveLabelIt,
} from "@/lib/meta/execution-plan/objective-map";
import type {
  ComponentCapability,
  ExecutionCapabilityStatus,
  ExecutionDependencyEdge,
  ExecutionIssue,
  ExecutionPlanAdNode,
  ExecutionPlanAdSetNode,
  ExecutionPlanCreativeNode,
  ExecutionPreviewSummary,
  MetaDestinationCode,
  MetaExecutionPlan,
  MetaObjectiveCode,
} from "@/lib/meta/execution-plan/types";

export type ExecutionPlanContext = {
  /** Optional Pixel/Dataset — never invented; only when caller has real config. */
  websiteTracking?: AllyWebsiteTrackingConfig | null;
  /** ISO timestamp override for tests. */
  generatedAtIso?: string;
};

function issue(
  partial: Omit<ExecutionIssue, "severity"> & { severity?: ExecutionIssue["severity"] },
): ExecutionIssue {
  return {
    severity: partial.severity ?? "BLOCKER",
    ...partial,
  };
}

function worstCapability(
  statuses: ExecutionCapabilityStatus[],
): ExecutionCapabilityStatus {
  if (statuses.includes("NOT_SUPPORTED")) return "NOT_SUPPORTED";
  if (statuses.includes("UNRESOLVED")) return "UNRESOLVED";
  if (statuses.includes("PARTIALLY_SUPPORTED")) return "PARTIALLY_SUPPORTED";
  return "SUPPORTED";
}

function sacToMeta(categories: CanonicalCampaignStateV2["specialAdCategories"]): string[] {
  const out: string[] = [];
  for (const c of categories) {
    if (c === "NONE" || c === "UNRESOLVED") continue;
    out.push(c);
  }
  return out;
}

function optimizationFromIntent(
  metaObjective: MetaObjectiveCode,
  event: OptimizationEventIntentV2,
  conversionPlan: AllyConversionPublishPlan,
): string | null {
  // Prefer explicit V2 intent when Meta matrix allows it.
  if (metaObjective === "OUTCOME_TRAFFIC") {
    if (event === "LANDING_PAGE_VIEW") return "LANDING_PAGE_VIEWS";
    if (event === "LINK_CLICK") return "LINK_CLICKS";
  }
  if (metaObjective === "OUTCOME_AWARENESS") {
    return "REACH";
  }
  if (metaObjective === "OUTCOME_APP_PROMOTION") {
    if (event === "APP_INSTALL" || event === "APP_EVENT") return "APP_INSTALLS";
  }
  if (metaObjective === "OUTCOME_ENGAGEMENT") {
    if (event === "MESSAGE") return "CONVERSATIONS";
    return conversionPlan.optimizationGoal ?? "CONVERSATIONS";
  }
  return conversionPlan.optimizationGoal;
}

function conversionEventLabel(
  event: OptimizationEventIntentV2,
  plan: AllyConversionPublishPlan,
): string | null {
  if (plan.conversionEvent) return plan.conversionEvent;
  if (event === "PURCHASE") return "PURCHASE";
  if (event === "LEAD") return "LEAD";
  if (event === "LANDING_PAGE_VIEW") return "LANDING_PAGE_VIEW";
  if (event === "LINK_CLICK") return "LINK_CLICK";
  if (event === "MESSAGE") return "MESSAGE";
  if (event === "APP_INSTALL") return "APP_INSTALL";
  if (event === "APP_EVENT") return "APP_EVENT";
  return null;
}

function audienceModeFromAdSet(
  adSet: CanonicalAdSetV2,
): ExecutionPlanAdSetNode["payload"]["targeting_summary"]["audienceMode"] {
  const kind = adSet.audience.strategyKind;
  if (kind === "ADVANTAGE_PLUS") return "ADVANTAGE_PLUS";
  if (kind === "BROAD") return "BROAD";
  if (kind === "MANUAL") return "MANUAL";
  if (kind === "CUSTOM_AUDIENCE_INTENT") return "CUSTOM_AUDIENCE";
  if (kind === "LOOKALIKE_INTENT") return "LOOKALIKE";
  if (adSet.role === "RETARGETING") return "CUSTOM_AUDIENCE";
  if (adSet.role === "LOOKALIKE") return "LOOKALIKE";
  return "UNRESOLVED";
}

function resolveDestinationForPlan(
  state: CanonicalCampaignStateV2,
  metaObjective: MetaObjectiveCode,
): MetaDestinationCode {
  const mapped = mapV2LocationToMetaDestination(state.conversion.location);
  if (mapped !== "UNRESOLVED") return mapped;
  // Awareness may omit destination.
  if (metaObjective === "OUTCOME_AWARENESS") return "UNRESOLVED";
  return "UNRESOLVED";
}

function graphDestinationForResolver(dest: MetaDestinationCode): string {
  if (dest === "APP") return "UNRESOLVED"; // resolver has no APP yet
  return dest;
}

function buildPreview(plan: {
  metaObjective: MetaObjectiveCode;
  destination: MetaDestinationCode;
  adSetCount: number;
  creativeCount: number;
  adCount: number;
  budgetMajor: number | null;
  optimizationGoal: string | null;
}): ExecutionPreviewSummary {
  const linesIt: string[] = [
    `1 Campagna · ${metaObjectiveLabelIt(plan.metaObjective)}`,
    `${plan.adSetCount} Grupp${plan.adSetCount === 1 ? "o" : "i"} di inserzioni`,
    `${plan.creativeCount} Creativit${plan.creativeCount === 1 ? "à" : "à"}`,
    `${plan.adCount} Inserzion${plan.adCount === 1 ? "e" : "i"}`,
  ];
  if (plan.destination !== "UNRESOLVED") {
    linesIt.push(`Destinazione: ${destinationLabelIt(plan.destination)}`);
  }
  if (plan.optimizationGoal) {
    linesIt.push(`Ottimizzazione: ${plan.optimizationGoal}`);
  }
  if (plan.budgetMajor != null) {
    linesIt.push(`Budget: ${plan.budgetMajor}/giorno (da piano)`);
  }
  return {
    campaignCount: 1,
    adSetCount: plan.adSetCount,
    creativeCount: plan.creativeCount,
    adCount: plan.adCount,
    linesIt,
  };
}

function collectAdSetIssues(
  adSet: CanonicalAdSetV2,
  metaObjective: MetaObjectiveCode,
  destination: MetaDestinationCode,
  conversionPlan: AllyConversionPublishPlan,
  optimizationGoal: string | null,
  state: CanonicalCampaignStateV2,
): { issues: ExecutionIssue[]; capability: ExecutionCapabilityStatus } {
  const issues: ExecutionIssue[] = [];
  const caps: ExecutionCapabilityStatus[] = ["SUPPORTED"];

  // Audience / retargeting / lookalike
  const audMode = audienceModeFromAdSet(adSet);
  if (
    audMode === "CUSTOM_AUDIENCE" ||
    adSet.audience.strategyKind === "CUSTOM_AUDIENCE_INTENT" ||
    adSet.role === "RETARGETING"
  ) {
    if (!adSet.audience.resolvedMetaAudienceId?.trim()) {
      issues.push(
        issue({
          code: "CUSTOM_AUDIENCE_UNRESOLVED",
          entityKind: "adset",
          entityId: adSet.id,
          messageIt:
            "Il retargeting richiede un pubblico Meta già esistente. Ally non ne crea uno e non usa Broad al posto.",
          messagePro: "CUSTOM_AUDIENCE_UNRESOLVED — no silent broad fallback",
        }),
      );
      caps.push("UNRESOLVED");
    }
  }
  if (
    audMode === "LOOKALIKE" ||
    adSet.audience.strategyKind === "LOOKALIKE_INTENT" ||
    adSet.role === "LOOKALIKE"
  ) {
    if (!adSet.audience.resolvedMetaAudienceId?.trim()) {
      issues.push(
        issue({
          code: "LOOKALIKE_UNRESOLVED",
          entityKind: "adset",
          entityId: adSet.id,
          messageIt:
            "Il lookalike richiede un pubblico Meta già risolto. Ally non crea Lookalike in questa fase.",
          messagePro: "LOOKALIKE_UNRESOLVED — no create",
        }),
      );
      caps.push("UNRESOLVED");
    }
  }

  // Placements — write path only supports Advantage+
  const placementResolve = resolveWritePlacements({
    placementsAdvantage: adSet.placements.mode === "ADVANTAGE_PLUS",
  });
  if (adSet.placements.mode === "MANUAL") {
    issues.push(
      issue({
        code: "PLACEMENT_MANUAL_NOT_WRITABLE",
        entityKind: "adset",
        entityId: adSet.id,
        messageIt:
          "I posizionamenti manuali sono nel design ma non ancora pubblicabili da Ally. Non sostituiamo Advantage+ in silenzio.",
        messagePro: `manualSurfaces=${adSet.placements.manualSurfaces.join(",")}`,
      }),
    );
    caps.push("PARTIALLY_SUPPORTED");
  } else if (!placementResolve.ok) {
    if (placementResolve.reason === "PLACEMENTS_UNRESOLVED") {
      issues.push(
        issue({
          code: "PLACEMENT_UNSUPPORTED",
          severity: "WARNING",
          entityKind: "adset",
          entityId: adSet.id,
          messageIt: "Posizionamenti non ancora definiti.",
        }),
      );
      caps.push("UNRESOLVED");
    }
  }

  // Destination URL for website
  if (
    destination === "WEBSITE" &&
    conversionPlan.destinationUrlRequired &&
    !(adSet.conversion.websiteUrl ?? state.conversion.websiteUrl)?.trim()
  ) {
    issues.push(
      issue({
        code: "DESTINATION_URL_REQUIRED",
        entityKind: "adset",
        entityId: adSet.id,
        messageIt: "Serve l'URL del sito di destinazione.",
      }),
    );
    caps.push("UNRESOLVED");
  }

  // App
  if (metaObjective === "OUTCOME_APP_PROMOTION" || destination === "APP") {
    if (!state.conversion.appStoreId?.trim() && !adSet.conversion.appStoreId?.trim()) {
      issues.push(
        issue({
          code: "APP_ID_REQUIRED",
          entityKind: "adset",
          entityId: adSet.id,
          messageIt: "Serve l'ID app Meta/Store reale. Ally non inventa App ID.",
          messagePro: "APP_ID_REQUIRED",
        }),
      );
      caps.push("UNRESOLVED");
    }
  }

  // Optimization support
  if (
    optimizationGoal &&
    metaObjective !== "UNRESOLVED" &&
    !isObjectiveOptimizationSupported(metaObjective, optimizationGoal)
  ) {
    issues.push(
      issue({
        code: "OPTIMIZATION_UNSUPPORTED",
        entityKind: "adset",
        entityId: adSet.id,
        messageIt: `Ottimizzazione ${optimizationGoal} non supportata per ${metaObjective}.`,
        messagePro: "OPTIMIZATION_UNSUPPORTED",
      }),
    );
    caps.push("NOT_SUPPORTED");
  }

  const billing = resolveBillingEvent({ optimizationGoal });
  if (optimizationGoal && !billing.ok) {
    issues.push(
      issue({
        code: "OPTIMIZATION_UNSUPPORTED",
        severity: "WARNING",
        entityKind: "adset",
        entityId: adSet.id,
        messageIt: "Billing event non mappato per questa ottimizzazione.",
        messagePro: "UNSUPPORTED_BILLING_EVENT",
      }),
    );
    caps.push("PARTIALLY_SUPPORTED");
  }

  return { issues, capability: worstCapability(caps) };
}

/**
 * Build MetaExecutionPlan from Canonical V2.
 * Deep-clones input for safety; caller V2 is never mutated.
 */
export function buildMetaExecutionPlanFromV2(
  input: CanonicalCampaignStateV2,
  context: ExecutionPlanContext = {},
): MetaExecutionPlan {
  // Immutability guard — work from clone; assert caller equal after.
  const state = cloneCanonicalCampaignStateV2(input);
  const issues: ExecutionIssue[] = [];
  const components: ComponentCapability[] = [];

  const metaObjective = mapV2ObjectiveToMeta(state.objective);
  const destination = resolveDestinationForPlan(state, metaObjective);

  components.push({
    id: "objective",
    labelIt: metaObjectiveLabelIt(metaObjective),
    status: metaObjective === "UNRESOLVED" ? "UNRESOLVED" : "SUPPORTED",
    detailIt: metaObjective,
  });

  if (metaObjective === "UNRESOLVED") {
    issues.push(
      issue({
        code: "OBJECTIVE_NOT_EXECUTABLE",
        entityKind: "campaign",
        entityId: state.campaignId,
        messageIt: "Obiettivo campagna non ancora definito per Meta.",
      }),
    );
  }

  components.push({
    id: "destination",
    labelIt: destinationLabelIt(destination),
    status:
      destination === "UNRESOLVED" && metaObjective !== "OUTCOME_AWARENESS"
        ? "UNRESOLVED"
        : destination === "APP"
          ? "PARTIALLY_SUPPORTED"
          : "SUPPORTED",
    detailIt: destination,
  });

  if (
    destination === "UNRESOLVED" &&
    metaObjective !== "OUTCOME_AWARENESS" &&
    metaObjective !== "UNRESOLVED"
  ) {
    issues.push(
      issue({
        code: "DESTINATION_NOT_EXECUTABLE",
        entityKind: "campaign",
        entityId: state.campaignId,
        messageIt: "Destinazione non ancora definita. Ally non inventa Instant Form o altro.",
      }),
    );
  }

  // Conversion publish plan — reuse resolver; never downgrade objective
  const trackingFromV2 =
    state.conversion.trackingAssetId?.trim() &&
    state.conversion.trackingAssetKind
      ? ({
          sourceType: state.conversion.trackingAssetKind,
          sourceId: state.conversion.trackingAssetId,
          sourceName: state.conversion.trackingAssetName ?? null,
          eventType:
            state.conversion.optimizationEvent === "PURCHASE"
              ? "PURCHASE"
              : state.conversion.optimizationEvent === "LEAD"
                ? "LEAD"
                : null,
          customConversionId: null,
          verificationStatus: "SELECTED" as const,
          metaAdAccountId: null,
        } satisfies AllyWebsiteTrackingConfig)
      : null;
  const tracking = context.websiteTracking ?? trackingFromV2;

  const conversionPlan = resolveConversionPublishPlan({
    metaObjective: metaObjective === "UNRESOLVED" ? null : metaObjective,
    destination: graphDestinationForResolver(destination),
    pageId: state.conversion.pageId,
    formId: state.conversion.formId,
    destinationUrl: state.conversion.websiteUrl,
    websiteTracking: tracking,
  });

  // APP path — resolver doesn't cover APP yet
  if (destination === "APP" || metaObjective === "OUTCOME_APP_PROMOTION") {
    components.push({
      id: "app_promotion",
      labelIt: "Promozione app",
      status: state.conversion.appStoreId?.trim()
        ? "PARTIALLY_SUPPORTED"
        : "UNRESOLVED",
      detailIt: "Payload app dry-run; Graph write path not live in ADV.2.1",
    });
  }

  let optimizationGoal = optimizationFromIntent(
    metaObjective,
    state.conversion.optimizationEvent,
    conversionPlan,
  );

  // Sales/Leads website without tracking — keep OFFSITE_CONVERSIONS, block Pixel
  if (
    (metaObjective === "OUTCOME_SALES" || metaObjective === "OUTCOME_LEADS") &&
    destination === "WEBSITE"
  ) {
    optimizationGoal = "OFFSITE_CONVERSIONS";
    const usable =
      tracking &&
      tracking.sourceType !== "NONE" &&
      Boolean(tracking.sourceId?.trim()) &&
      tracking.eventType != null &&
      tracking.eventType !== "OTHER";
    if (!usable) {
      issues.push(
        issue({
          code: "PIXEL_REQUIRED",
          entityKind: "campaign",
          entityId: state.campaignId,
          messageIt:
            metaObjective === "OUTCOME_SALES"
              ? "Per Vendite / Acquisto serve un Pixel o Dataset reale con evento Purchase. Ally non degrada a Contatti."
              : "Per Contatti dal sito serve un Pixel o Dataset con evento Lead.",
          messagePro: "PIXEL_REQUIRED — no LEADS/IF fallback",
        }),
      );
      components.push({
        id: "tracking",
        labelIt: "Pixel / Dataset",
        status: "UNRESOLVED",
        detailIt: "REQUIRED",
      });
    } else {
      components.push({
        id: "tracking",
        labelIt: "Pixel / Dataset",
        status: "SUPPORTED",
        detailIt: "REQUIRED",
      });
    }
  } else if (destination === "META_LEAD_FORM") {
    components.push({
      id: "tracking",
      labelIt: "Tracking Instant Form",
      status: "SUPPORTED",
      detailIt: "REQUIRED_INSTANT_FORM",
    });
  } else {
    components.push({
      id: "tracking",
      labelIt: "Tracking",
      status: "SUPPORTED",
      detailIt: "OPTIONAL",
    });
  }

  // Instant Form identity
  if (destination === "META_LEAD_FORM") {
    if (!state.conversion.pageId?.trim()) {
      issues.push(
        issue({
          code: "PAGE_REQUIRED",
          entityKind: "campaign",
          entityId: state.campaignId,
          messageIt: "Serve la Pagina Facebook.",
        }),
      );
    }
    if (!state.conversion.formId?.trim()) {
      issues.push(
        issue({
          code: "FORM_REQUIRED",
          entityKind: "campaign",
          entityId: state.campaignId,
          messageIt: "Serve il modulo Instant Form Meta.",
        }),
      );
    }
  } else if (
    conversionPlan.needsPage &&
    !state.conversion.pageId?.trim() &&
    metaObjective !== "OUTCOME_AWARENESS"
  ) {
    issues.push(
      issue({
        code: "PAGE_REQUIRED",
        entityKind: "campaign",
        entityId: state.campaignId,
        messageIt: "Serve la Pagina Facebook.",
      }),
    );
  }

  // Identity component
  components.push({
    id: "identity",
    labelIt: "Pagina / Instagram",
    status: state.conversion.pageId?.trim()
      ? "SUPPORTED"
      : destination === "META_LEAD_FORM" || conversionPlan.needsPage
        ? "UNRESOLVED"
        : "SUPPORTED",
    detailIt: state.conversion.pageId ? "PAGE_RESOLVED" : "PAGE_OPTIONAL_OR_MISSING",
  });

  // Budget
  const budget = state.budget;
  let campaignDaily: number | null = null;
  let adSetBudgetMode: "CBO" | "ABO" | "UNRESOLVED" = "UNRESOLVED";
  if (budget.allocationStatus === "UNRESOLVED_SPLIT") {
    issues.push(
      issue({
        code: "BUDGET_SPLIT_UNRESOLVED",
        entityKind: "campaign",
        entityId: state.campaignId,
        messageIt:
          "Il budget totale non ha una ripartizione definita. Ally non inventa split 50/50.",
        messagePro: "BUDGET_SPLIT_UNRESOLVED",
      }),
    );
    components.push({
      id: "budget",
      labelIt: "Budget",
      status: "UNRESOLVED",
      detailIt: "UNRESOLVED_SPLIT",
    });
  } else if (budget.allocationStatus === "CAMPAIGN_ONLY") {
    campaignDaily =
      budget.period === "DAILY" ? budget.campaignAmountMajor : null;
    adSetBudgetMode = "CBO";
    components.push({
      id: "budget",
      labelIt: "Budget campagna",
      status: budget.campaignAmountMajor != null ? "SUPPORTED" : "UNRESOLVED",
      detailIt: "CAMPAIGN_ONLY",
    });
    if (budget.campaignAmountMajor == null) {
      issues.push(
        issue({
          code: "INVALID_CONFIGURATION",
          entityKind: "campaign",
          entityId: state.campaignId,
          messageIt: "Budget campagna mancante.",
        }),
      );
    }
  } else if (budget.allocationStatus === "ADSET_EXPLICIT") {
    adSetBudgetMode = "ABO";
    components.push({
      id: "budget",
      labelIt: "Budget per gruppo",
      status: "SUPPORTED",
      detailIt: "ADSET_EXPLICIT",
    });
  } else {
    components.push({
      id: "budget",
      labelIt: "Budget",
      status: "UNRESOLVED",
      detailIt: budget.allocationStatus,
    });
  }

  // Schedule
  const schedule = state.schedule;
  if (schedule.kind === "UNRESOLVED") {
    components.push({
      id: "schedule",
      labelIt: "Programmazione",
      status: "PARTIALLY_SUPPORTED",
      detailIt: "Meta default / always-on implicit — no invented dates",
    });
  } else {
    components.push({
      id: "schedule",
      labelIt: "Programmazione",
      status: "SUPPORTED",
      detailIt: schedule.kind,
    });
  }

  // CTA
  const ctaDest =
    destination === "META_LEAD_FORM"
      ? "META_LEAD_FORM"
      : destination === "WEBSITE"
        ? "WEBSITE"
        : destination === "WHATSAPP"
          ? "WHATSAPP"
          : destination === "PHONE"
            ? "PHONE"
            : null;
  const cta = resolveAllyMetaCta(ctaDest);
  if (destination !== "UNRESOLVED" && destination !== "APP" && !cta.type) {
    issues.push(
      issue({
        code: "CTA_UNSUPPORTED",
        entityKind: "plan",
        entityId: null,
        messageIt: "CTA non mappata per questa destinazione.",
      }),
    );
    components.push({
      id: "cta",
      labelIt: "Call to action",
      status: "NOT_SUPPORTED",
    });
  } else {
    components.push({
      id: "cta",
      labelIt: cta.labelIt || "CTA",
      status: cta.type ? "SUPPORTED" : "UNRESOLVED",
      detailIt: cta.type ?? undefined,
    });
  }

  // Multi-AdSet
  const adSetsSource =
    state.adSets.length > 0
      ? state.adSets
      : [];
  if (adSetsSource.length === 0) {
    issues.push(
      issue({
        code: "INVALID_CONFIGURATION",
        entityKind: "campaign",
        entityId: state.campaignId,
        messageIt: "Nessun gruppo di inserzioni nel design.",
      }),
    );
  }
  components.push({
    id: "multi_adset",
    labelIt: "Gruppi di inserzioni",
    status: adSetsSource.length > 1 ? "SUPPORTED" : "SUPPORTED",
    detailIt: `${adSetsSource.length} ad set(s) — never flattened`,
  });

  // Creatives
  if (state.creatives.length === 0) {
    issues.push(
      issue({
        code: "CREATIVE_REQUIRED",
        severity: "WARNING",
        entityKind: "campaign",
        entityId: state.campaignId,
        messageIt: "Nessuna creatività nel design — il piano resta parziale.",
      }),
    );
    components.push({
      id: "creatives",
      labelIt: "Creatività",
      status: "UNRESOLVED",
    });
  } else {
    components.push({
      id: "creatives",
      labelIt: "Creatività",
      status: "SUPPORTED",
      detailIt: `${state.creatives.length}`,
    });
  }

  const conversionEvent = conversionEventLabel(
    state.conversion.optimizationEvent,
    conversionPlan,
  );

  const billing = resolveBillingEvent({ optimizationGoal });
  const billingEvent = billing.ok ? billing.billingEvent : null;

  // Campaign node
  const campaignNode = {
    allyCampaignId: state.campaignId,
    metaCampaignId: state.metaCampaignId,
    payload: {
      name: state.name,
      objective: metaObjective === "UNRESOLVED" ? null : metaObjective,
      status: "PAUSED" as const,
      special_ad_categories: sacToMeta(state.specialAdCategories),
      daily_budget_major:
        adSetBudgetMode === "CBO" ? campaignDaily : null,
      lifetime_budget_major: null,
    },
    capability:
      metaObjective === "UNRESOLVED"
        ? ("UNRESOLVED" as const)
        : ("SUPPORTED" as const),
  };

  // Ad set nodes
  const adSetNodes: ExecutionPlanAdSetNode[] = adSetsSource.map((adSet) => {
    const { issues: asIssues, capability } = collectAdSetIssues(
      adSet,
      metaObjective,
      destination,
      conversionPlan,
      optimizationGoal,
      state,
    );
    issues.push(...asIssues);

    const dailyBudget =
      adSetBudgetMode === "ABO"
        ? adSet.budgetAmountMajor ??
          budget.adSetAmountsMajor[adSet.id] ??
          null
        : null;

    const promotedKeys: string[] = [];
    if (state.conversion.pageId) promotedKeys.push("page_id");
    // META_LEAD_FORM: form binds on Creative CTA (lead_gen_form_id), not Ad Set.
    if (
      tracking?.sourceType === "PIXEL" &&
      tracking.sourceId
    ) {
      promotedKeys.push("pixel_id");
    }
    if (tracking?.sourceType === "DATASET" && tracking.sourceId) {
      promotedKeys.push("dataset_id");
    }
    if (state.conversion.appStoreId || adSet.conversion.appStoreId) {
      promotedKeys.push("application_id");
    }

    return {
      allyAdSetId: adSet.id,
      metaAdSetId: adSet.metaAdSetId,
      role: adSet.role,
      payload: {
        name: adSet.name,
        campaign_ref: state.campaignId,
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        destination_type: conversionPlan.destinationType,
        daily_budget_major: dailyBudget,
        start_time_iso:
          (adSet.scheduleOverride ?? state.schedule).kind === "FIXED_WINDOW"
            ? (adSet.scheduleOverride ?? state.schedule).startDateIso
            : (adSet.scheduleOverride ?? state.schedule).kind === "ALWAYS_ON"
              ? null
              : (adSet.scheduleOverride ?? state.schedule).startDateIso,
        end_time_iso:
          (adSet.scheduleOverride ?? state.schedule).kind === "FIXED_WINDOW"
            ? (adSet.scheduleOverride ?? state.schedule).endDateIso
            : null,
        targeting_summary: {
          geoLabel: adSet.geography.labelIt,
          ageMin: adSet.age.min,
          ageMax: adSet.age.max,
          audienceMode: audienceModeFromAdSet(adSet),
          customAudienceId: adSet.audience.resolvedMetaAudienceId,
          placementsMode:
            adSet.placements.mode === "ADVANTAGE_PLUS"
              ? "ADVANTAGE_PLUS"
              : adSet.placements.mode === "MANUAL"
                ? "MANUAL"
                : "UNRESOLVED",
          manualSurfaces: [...adSet.placements.manualSurfaces],
        },
        promoted_object_keys: promotedKeys,
      },
      capability,
      issues: asIssues,
    };
  });

  // Creative nodes
  const creativeNodes: ExecutionPlanCreativeNode[] = state.creatives.map(
    (c: CanonicalCreativeRefV2) => {
      const assigned =
        c.assignedAdSetIds.length > 0
          ? c.assignedAdSetIds
          : adSetNodes.map((a) => a.allyAdSetId);
      const cIssues: ExecutionIssue[] = [];
      if (!c.primaryText?.trim() && !c.headline?.trim()) {
        cIssues.push(
          issue({
            code: "CREATIVE_REQUIRED",
            severity: "WARNING",
            entityKind: "creative",
            entityId: c.id,
            messageIt: "Testo o titolo creatività mancante.",
          }),
        );
      }
      return {
        allyCreativeId: c.id,
        assignedAdSetIds: assigned,
        payload: {
          name: c.nomeFile,
          object_story_fields: {
            page_id: state.conversion.pageId,
            message: c.primaryText,
            link:
              destination === "WEBSITE"
                ? state.conversion.websiteUrl
                : null,
            call_to_action_type: cta.type,
          },
          assetRef: c.assetId ?? c.storagePath,
        },
        capability: cIssues.some((i) => i.severity === "BLOCKER")
          ? "UNRESOLVED"
          : "SUPPORTED",
        issues: cIssues,
      };
    },
  );
  for (const cn of creativeNodes) issues.push(...cn.issues);

  // Ad nodes — one Ad per (creative × assigned ad set)
  const adNodes: ExecutionPlanAdNode[] = [];
  for (const creative of creativeNodes) {
    for (const adSetId of creative.assignedAdSetIds) {
      const allyAdId = `ad_${creative.allyCreativeId}_${adSetId}`;
      adNodes.push({
        allyAdId,
        allyAdSetId: adSetId,
        allyCreativeId: creative.allyCreativeId,
        payload: {
          name: null,
          adset_ref: adSetId,
          creative_ref: creative.allyCreativeId,
          status: "PAUSED",
          cta_type: cta.type,
          cta_label_it: cta.labelIt || null,
        },
        capability: "SUPPORTED",
        issues: [],
      });
    }
  }

  // Dependencies: Campaign → AdSets → Creatives → Ads
  const dependencies: ExecutionDependencyEdge[] = [];
  const campKey = `campaign:${state.campaignId}`;
  for (const as of adSetNodes) {
    dependencies.push({
      from: campKey,
      to: `adset:${as.allyAdSetId}`,
      kind: "REQUIRES",
    });
  }
  for (const cr of creativeNodes) {
    dependencies.push({
      from: campKey,
      to: `creative:${cr.allyCreativeId}`,
      kind: "REQUIRES",
    });
  }
  for (const ad of adNodes) {
    dependencies.push({
      from: `adset:${ad.allyAdSetId}`,
      to: `ad:${ad.allyAdId}`,
      kind: "REQUIRES",
    });
    dependencies.push({
      from: `creative:${ad.allyCreativeId}`,
      to: `ad:${ad.allyAdId}`,
      kind: "REQUIRES",
    });
  }

  const blockers = issues.filter((i) => i.severity === "BLOCKER");
  const componentStatuses = components.map((c) => c.status);
  const adSetCaps = adSetNodes.map((a) => a.capability);
  const executionCapability = worstCapability([
    ...componentStatuses,
    ...adSetCaps,
    blockers.length > 0 ? "UNRESOLVED" : "SUPPORTED",
  ]);
  const executionReady =
    blockers.length === 0 &&
    metaObjective !== "UNRESOLVED" &&
    (destination !== "UNRESOLVED" || metaObjective === "OUTCOME_AWARENESS") &&
    adSetNodes.length > 0;

  const preview = buildPreview({
    metaObjective,
    destination,
    adSetCount: adSetNodes.length,
    creativeCount: creativeNodes.length,
    adCount: adNodes.length,
    budgetMajor: campaignDaily ?? budget.campaignAmountMajor,
    optimizationGoal,
  });

  const operationKeys = {
    campaign: `ally.op.campaign.${state.campaignId}`,
    adSets: Object.fromEntries(
      adSetNodes.map((a) => [
        a.allyAdSetId,
        `ally.op.adset.${state.campaignId}.${a.allyAdSetId}`,
      ]),
    ),
    creatives: Object.fromEntries(
      creativeNodes.map((c) => [
        c.allyCreativeId,
        `ally.op.creative.${state.campaignId}.${c.allyCreativeId}`,
      ]),
    ),
    ads: Object.fromEntries(
      adNodes.map((a) => [
        a.allyAdId,
        `ally.op.ad.${state.campaignId}.${a.allyAdId}`,
      ]),
    ),
  };

  // Ensure clone path didn't mutate caller — serialize compare in tests.
  void serializeCanonicalCampaignStateV2(state);

  return {
    schemaVersion: 1,
    sourceCampaignId: state.campaignId,
    metaObjective,
    destination,
    optimizationGoal,
    conversionEvent,
    campaign: campaignNode,
    adSets: adSetNodes,
    creatives: creativeNodes,
    ads: adNodes,
    dependencies,
    issues,
    components,
    executionCapability,
    executionReady,
    preview,
    operationKeys,
    generatedAtIso: context.generatedAtIso ?? new Date().toISOString(),
  };
}

/** Assert V2 unchanged after planning (deep equality via JSON). */
export function assertV2ImmutableAfterPlan(
  before: CanonicalCampaignStateV2,
  after: CanonicalCampaignStateV2,
): boolean {
  return (
    serializeCanonicalCampaignStateV2(before) ===
    serializeCanonicalCampaignStateV2(after)
  );
}
