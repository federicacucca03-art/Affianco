/**
 * M11A.1/M11A.2E — Map Ally objective → Meta OUTCOME_* + optimization/destination.
 * P0.1 — Website conversion paths delegate to conversion-resolver (no silent LINK_CLICKS).
 */

import { mapBusinessIntentToMetaArchitecture } from "@/lib/meta/guided-plan/map-intent";
import {
  conversionPlanToLegacyDestOpts,
  resolveConversionPublishPlan,
} from "@/lib/meta/write/conversion-resolver";
import type { AllyWebsiteTrackingConfig } from "@/lib/meta/write/tracking";

export function resolveMetaObjectiveCode(
  objectiveRaw: string | null | undefined,
): string | null {
  const raw = (objectiveRaw ?? "").trim().toUpperCase();
  if (raw.startsWith("OUTCOME_")) return raw;
  const mapped = mapBusinessIntentToMetaArchitecture({
    objective: raw || null,
  });
  return mapped.metaObjective;
}

export function resolveOptimizationAndDestination(input: {
  metaObjective: string | null;
  destination: string;
  /** When set, enables true OFFSITE_CONVERSIONS for Website Leads/Sales. */
  websiteTracking?: AllyWebsiteTrackingConfig | null;
  pageId?: string | null;
  formId?: string | null;
  destinationUrl?: string | null;
}): {
  optimizationGoal: string | null;
  destinationType: string | null;
  promotedObject: Record<string, unknown> | null;
  needsPage: boolean;
  needsForm: boolean;
  needsUrl: boolean;
  needsTracking: boolean;
} {
  const plan = resolveConversionPublishPlan({
    metaObjective: input.metaObjective,
    destination: input.destination,
    websiteTracking: input.websiteTracking,
    pageId: input.pageId,
    formId: input.formId,
    destinationUrl: input.destinationUrl,
  });
  return conversionPlanToLegacyDestOpts(plan);
}
