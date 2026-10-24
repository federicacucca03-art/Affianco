/**
 * ADV.2.2 — Pure in-memory Canonical V2 builder operations.
 * No DB. No Meta. Stable Ally IDs only.
 */

import {
  emptyAdSetV2,
  emptyAudienceIntentV2,
  newCanonicalEntityId,
} from "@/lib/campagne-canonical-v2/empty";
import { cloneCanonicalCampaignStateV2 } from "@/lib/campagne-canonical-v2/serialize";
import type {
  AudienceRoleV2,
  AudienceStrategyKindV2,
  CanonicalAdSetV2,
  CanonicalCampaignStateV2,
  ConversionLocationV2,
  MetaObjectiveFamilyV2,
  OptimizationEventIntentV2,
  ScheduleModelV2,
} from "@/lib/campagne-canonical-v2/types";

export type ObjectiveChangeImpact = {
  previousObjective: MetaObjectiveFamilyV2;
  nextObjective: MetaObjectiveFamilyV2;
  warningsIt: string[];
  /** Fields that become stale — not auto-cleared. */
  staleHints: string[];
};

/** Changing objective never fabricates replacements — surfaces impact only. */
export function describeObjectiveChangeImpact(
  current: CanonicalCampaignStateV2,
  nextObjective: MetaObjectiveFamilyV2,
): ObjectiveChangeImpact {
  const warningsIt: string[] = [];
  const staleHints: string[] = [];
  if (
    current.objective === "LEADS" &&
    current.conversion.location === "INSTANT_FORM" &&
    nextObjective === "SALES"
  ) {
    warningsIt.push(
      "Passando a Vendite, il modulo Instant Form non si applica più. Serve sito, Pixel e evento Acquisto.",
    );
    staleHints.push("formId", "INSTANT_FORM");
  }
  if (current.objective === "SALES" && nextObjective === "LEADS") {
    warningsIt.push(
      "Passando a Contatti, Pixel/Acquisto possono non bastare. Scegli dove ricevere i lead.",
    );
    staleHints.push("PURCHASE", "PIXEL");
  }
  if (nextObjective === "APP_PROMOTION") {
    warningsIt.push("Serve un’app Meta reale. Ally non inventa App ID.");
    staleHints.push("appStoreId");
  }
  return {
    previousObjective: current.objective,
    nextObjective,
    warningsIt,
    staleHints,
  };
}

export function patchObjectiveV2(
  current: CanonicalCampaignStateV2,
  objective: MetaObjectiveFamilyV2,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.objective = objective;
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchConversionLocationV2(
  current: CanonicalCampaignStateV2,
  location: ConversionLocationV2,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.conversion = { ...next.conversion, location };
  next.adSets = next.adSets.map((a) => ({
    ...a,
    conversion: { ...a.conversion, location },
  }));
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchOptimizationEventV2(
  current: CanonicalCampaignStateV2,
  optimizationEvent: OptimizationEventIntentV2,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.conversion = { ...next.conversion, optimizationEvent };
  next.adSets = next.adSets.map((a) => ({
    ...a,
    conversion: { ...a.conversion, optimizationEvent },
  }));
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchScheduleV2(
  current: CanonicalCampaignStateV2,
  schedule: ScheduleModelV2,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.schedule = { ...schedule };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchWebsiteUrlV2(
  current: CanonicalCampaignStateV2,
  websiteUrl: string | null,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.conversion = { ...next.conversion, websiteUrl };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchTrackingAssetV2(
  current: CanonicalCampaignStateV2,
  tracking: {
    trackingAssetId: string | null;
    trackingAssetName: string | null;
    trackingAssetKind: "PIXEL" | "DATASET" | null;
  },
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.conversion = { ...next.conversion, ...tracking };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchAppRefV2(
  current: CanonicalCampaignStateV2,
  app: { appStoreId: string | null; appDisplayName: string | null },
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.conversion = { ...next.conversion, ...app };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function resolveBudgetSplitExplicit(
  current: CanonicalCampaignStateV2,
  amounts: Record<string, number>,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  const adSetAmountsMajor: Record<string, number | null> = {
    ...next.budget.adSetAmountsMajor,
  };
  for (const as of next.adSets) {
    const v = amounts[as.id];
    if (v != null && Number.isFinite(v) && v > 0) {
      adSetAmountsMajor[as.id] = v;
      as.budgetAmountMajor = v;
      as.budgetPeriod = "DAILY";
    }
  }
  const allSet = next.adSets.every(
    (a) => adSetAmountsMajor[a.id] != null && (adSetAmountsMajor[a.id] ?? 0) > 0,
  );
  next.budget = {
    ...next.budget,
    adSetAmountsMajor,
    allocationStatus: allSet ? "ADSET_EXPLICIT" : "UNRESOLVED_SPLIT",
  };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function setCampaignBudgetOnly(
  current: CanonicalCampaignStateV2,
  amountMajor: number | null,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.budget = {
    ...next.budget,
    period: "DAILY",
    campaignAmountMajor: amountMajor,
    allocationStatus: amountMajor != null ? "CAMPAIGN_ONLY" : "MISSING",
  };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

function cloneAdSet(source: CanonicalAdSetV2, role?: AudienceRoleV2): CanonicalAdSetV2 {
  const id = newCanonicalEntityId("adset");
  const copy = JSON.parse(JSON.stringify(source)) as CanonicalAdSetV2;
  return {
    ...copy,
    id,
    metaAdSetId: null,
    name: source.name ? `${source.name} (copia)` : "Gruppo copiato",
    role: role ?? source.role,
    audience: {
      ...copy.audience,
      // Never clone unresolved Meta entity as resolved.
      resolvedMetaAudienceId: null,
      resolvedMetaAudienceName: null,
    },
    creativeIds: [],
  };
}

export function addAdSetV2(
  current: CanonicalCampaignStateV2,
  opts?: {
    role?: AudienceRoleV2;
    strategyKind?: AudienceStrategyKindV2;
    name?: string;
  },
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  const role = opts?.role ?? "PROSPECTING";
  const strategyKind =
    opts?.strategyKind ??
    (role === "RETARGETING"
      ? "CUSTOM_AUDIENCE_INTENT"
      : role === "LOOKALIKE"
        ? "LOOKALIKE_INTENT"
        : "BROAD");
  const template = next.adSets[0];
  const adSet = emptyAdSetV2({
    id: newCanonicalEntityId("adset"),
    name: opts?.name ?? (role === "RETARGETING" ? "Retargeting" : "Gruppo"),
    role,
    geography: template
      ? { ...template.geography }
      : {
          labelIt: null,
          countryCode: null,
          metaGeoKey: null,
          query: null,
        },
    age: template ? { ...template.age } : { min: null, max: null },
    placements: template
      ? { ...template.placements, manualSurfaces: [...template.placements.manualSurfaces] }
      : { mode: "ADVANTAGE_PLUS", manualSurfaces: [] },
    conversion: { ...next.conversion },
    audience: {
      ...emptyAudienceIntentV2(),
      role,
      strategyKind,
      summaryIt:
        role === "RETARGETING"
          ? "Visitatori sito (da collegare)"
          : role === "LOOKALIKE"
            ? "Lookalike (da collegare)"
            : "Pubblico ampio",
      retargetingSource: role === "RETARGETING" ? "WEBSITE_VISITORS" : null,
      retargetingWindowDays: role === "RETARGETING" ? 30 : null,
    },
    provenance: {
      structure: "USER",
      audience: "USER",
      geography: template?.geography.labelIt ? "USER" : "MISSING",
    },
  });
  next.adSets = [...next.adSets, adSet];
  if (
    next.adSets.length > 1 &&
    (next.budget.allocationStatus === "CAMPAIGN_ONLY" ||
      next.budget.allocationStatus === "MISSING" ||
      next.budget.campaignAmountMajor != null)
  ) {
    // Multi-AdSet → split must be explicit (never invent 50/50).
    next.budget = {
      ...next.budget,
      allocationStatus: "UNRESOLVED_SPLIT",
    };
  }
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function duplicateAdSetV2(
  current: CanonicalCampaignStateV2,
  adSetId: string,
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  const src = next.adSets.find((a) => a.id === adSetId);
  if (!src) return current;
  next.adSets = [...next.adSets, cloneAdSet(src)];
  if (next.budget.allocationStatus === "CAMPAIGN_ONLY") {
    next.budget = { ...next.budget, allocationStatus: "UNRESOLVED_SPLIT" };
  }
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function removeAdSetV2(
  current: CanonicalCampaignStateV2,
  adSetId: string,
): CanonicalCampaignStateV2 {
  if (current.adSets.length <= 1) return current;
  const next = cloneCanonicalCampaignStateV2(current);
  next.adSets = next.adSets.filter((a) => a.id !== adSetId);
  next.creatives = next.creatives.map((c) => ({
    ...c,
    assignedAdSetIds: c.assignedAdSetIds.filter((id) => id !== adSetId),
  }));
  const amounts = { ...next.budget.adSetAmountsMajor };
  delete amounts[adSetId];
  next.budget = { ...next.budget, adSetAmountsMajor: amounts };
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchAdSetAudienceV2(
  current: CanonicalCampaignStateV2,
  adSetId: string,
  patch: Partial<CanonicalAdSetV2["audience"]> & {
    role?: AudienceRoleV2;
    name?: string | null;
  },
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.adSets = next.adSets.map((a) => {
    if (a.id !== adSetId) return a;
    const role = patch.role ?? a.role;
    return {
      ...a,
      role,
      name: patch.name !== undefined ? patch.name : a.name,
      audience: {
        ...a.audience,
        ...patch,
        role,
        // Clearing resolved id unless explicitly provided
        resolvedMetaAudienceId:
          patch.resolvedMetaAudienceId !== undefined
            ? patch.resolvedMetaAudienceId
            : a.audience.resolvedMetaAudienceId,
      },
    };
  });
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function assignCreativeToAdSetsV2(
  current: CanonicalCampaignStateV2,
  creativeId: string,
  adSetIds: string[],
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.creatives = next.creatives.map((c) =>
    c.id === creativeId
      ? { ...c, assignedAdSetIds: [...adSetIds] }
      : c,
  );
  next.adSets = next.adSets.map((a) => ({
    ...a,
    creativeIds: adSetIds.includes(a.id)
      ? Array.from(new Set([...a.creativeIds, creativeId]))
      : a.creativeIds.filter((id) => id !== creativeId),
  }));
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchAdSetGenderV2(
  current: CanonicalCampaignStateV2,
  adSetId: string,
  gender: CanonicalAdSetV2["gender"],
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.adSets = next.adSets.map((a) =>
    a.id === adSetId ? { ...a, gender } : a,
  );
  next.updatedAtIso = new Date().toISOString();
  return next;
}

export function patchAdSetPlacementsV2(
  current: CanonicalCampaignStateV2,
  adSetId: string,
  placements: CanonicalAdSetV2["placements"],
): CanonicalCampaignStateV2 {
  const next = cloneCanonicalCampaignStateV2(current);
  next.adSets = next.adSets.map((a) =>
    a.id === adSetId ? { ...a, placements: { ...placements, manualSurfaces: [...placements.manualSurfaces] } } : a,
  );
  next.updatedAtIso = new Date().toISOString();
  return next;
}
