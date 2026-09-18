/**
 * M10D — Build configuration models from Graph-normalized / DB rows.
 */

import { normalizeTargetingSummary } from "@/lib/meta/configuration/normalize-targeting";
import type {
  MetaAdConfiguration,
  MetaAdSetConfiguration,
  MetaBudgetKind,
  MetaBudgetLevel,
  MetaCampaignConfiguration,
  MetaConfigAvailability,
  MetaConfigField,
  MetaConfigSource,
  MetaTargetingSummaryStored,
} from "@/lib/meta/configuration/types";

const SOURCE: MetaConfigSource = "META";

function field<T>(
  value: T | null,
  raw: unknown = value,
): MetaConfigField<T> {
  const availability: MetaConfigAvailability =
    value == null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "string" && !value.trim())
      ? "UNAVAILABLE"
      : "AVAILABLE";
  return { raw, value, availability, source: SOURCE };
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function asBudget(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((x) => asText(x))
    .filter((x): x is string => x != null);
  return out.length > 0 ? out : [];
}

function asIso(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function resolveBudgetKind(
  daily: number | null,
  lifetime: number | null,
): MetaBudgetKind {
  if (daily != null && daily > 0) return "DAILY";
  if (lifetime != null && lifetime > 0) return "LIFETIME";
  if (daily == null && lifetime == null) return "UNKNOWN";
  return "NONE";
}

export function resolveCampaignBudgetLevel(input: {
  campaignDaily: number | null;
  campaignLifetime: number | null;
  adsetBudgetSharing: boolean | null;
  anyAdSetBudget: boolean;
}): MetaBudgetLevel {
  const campaignBudget =
    (input.campaignDaily != null && input.campaignDaily > 0) ||
    (input.campaignLifetime != null && input.campaignLifetime > 0);
  if (input.adsetBudgetSharing === true || campaignBudget) {
    return "CAMPAIGN";
  }
  if (input.anyAdSetBudget) return "AD_SET";
  return "UNKNOWN";
}

export function buildCampaignConfiguration(input: {
  objective: string | null;
  status: string | null;
  effectiveStatus: string | null;
  buyingType: string | null;
  specialAdCategories: unknown;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  isAdsetBudgetSharingEnabled: boolean | null;
  anyAdSetBudget: boolean;
}): MetaCampaignConfiguration {
  const daily = input.dailyBudget;
  const lifetime = input.lifetimeBudget;
  const cats = asStringArray(input.specialAdCategories);
  return {
    objective: field(asText(input.objective)),
    status: field(asText(input.status)),
    effectiveStatus: field(asText(input.effectiveStatus)),
    buyingType: field(asText(input.buyingType)),
    specialAdCategories: field(cats, input.specialAdCategories),
    dailyBudgetMinor: field(daily),
    lifetimeBudgetMinor: field(lifetime),
    adsetBudgetSharingEnabled: field(
      asBool(input.isAdsetBudgetSharingEnabled),
      input.isAdsetBudgetSharingEnabled,
    ),
    budgetLevel: resolveCampaignBudgetLevel({
      campaignDaily: daily,
      campaignLifetime: lifetime,
      adsetBudgetSharing: input.isAdsetBudgetSharingEnabled,
      anyAdSetBudget: input.anyAdSetBudget,
    }),
  };
}

export function buildAdSetConfiguration(input: {
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  bidStrategy: string | null;
  bidAmount: number | null;
  startAt: string | null;
  endAt: string | null;
  destinationType: string | null;
  attributionSpec: unknown;
  promotedObject: unknown;
  targetingSummary: MetaTargetingSummaryStored | null;
}): MetaAdSetConfiguration {
  const daily = input.dailyBudget;
  const lifetime = input.lifetimeBudget;
  const targeting =
    input.targetingSummary ??
    normalizeTargetingSummary(null);
  const audienceAvail = targeting.audience.detailAvailable
    ? "AVAILABLE"
    : "UNAVAILABLE";
  const placementAvail =
    targeting.placements.mode === "UNAVAILABLE"
      ? "UNAVAILABLE"
      : "AVAILABLE";

  return {
    name: input.name,
    status: field(asText(input.status)),
    effectiveStatus: field(asText(input.effectiveStatus)),
    dailyBudgetMinor: field(daily),
    lifetimeBudgetMinor: field(lifetime),
    budgetKind: resolveBudgetKind(daily, lifetime),
    startAt: field(asIso(input.startAt) ?? asText(input.startAt)),
    endAt: field(asIso(input.endAt) ?? asText(input.endAt)),
    optimizationGoal: field(asText(input.optimizationGoal)),
    billingEvent: field(asText(input.billingEvent)),
    bidStrategy: field(asText(input.bidStrategy)),
    bidAmountMinor: field(asBudget(input.bidAmount)),
    destinationType: field(asText(input.destinationType)),
    attributionSpec: field(
      input.attributionSpec == null ? null : input.attributionSpec,
      input.attributionSpec,
    ),
    promotedObject: field(asObject(input.promotedObject), input.promotedObject),
    audience: {
      raw: targeting.audience,
      value: targeting.audience,
      availability: audienceAvail,
      source: SOURCE,
    },
    placements: {
      raw: targeting.placements,
      value: targeting.placements,
      availability: placementAvail,
      source: SOURCE,
    },
  };
}

export function buildAdConfiguration(input: {
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  creativeId: string | null;
  creativeName: string | null;
  creativeTitle: string | null;
  creativeCta: string | null;
  creativeLinkUrl: string | null;
}): MetaAdConfiguration {
  return {
    name: input.name,
    status: field(asText(input.status)),
    effectiveStatus: field(asText(input.effectiveStatus)),
    creativeId: field(asText(input.creativeId)),
    creativeName: field(asText(input.creativeName)),
    creativeTitle: field(asText(input.creativeTitle)),
    creativeCta: field(asText(input.creativeCta)),
    creativeLinkUrl: field(asText(input.creativeLinkUrl)),
  };
}

/** Parse targeting_summary jsonb from DB safely. */
export function parseStoredTargetingSummary(
  raw: unknown,
): MetaTargetingSummaryStored | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<MetaTargetingSummaryStored>;
  if (typeof obj.targetingReturned !== "boolean") return null;
  if (!obj.audience || !obj.placements) return null;
  return obj as MetaTargetingSummaryStored;
}
