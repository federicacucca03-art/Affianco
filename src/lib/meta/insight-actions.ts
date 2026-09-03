export type ResultMappingConfidence = "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";

export type NormalizedMetaAction = {
  actionType: string;
  value: number;
};

/** Deterministic lead-like types. Do not treat every *lead* substring as a result. */
export const LEAD_ACTION_PRIORITY = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "omni_lead",
] as const;

export const PURCHASE_ACTION_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
] as const;

function parseActionValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function normalizeMetaActions(raw: unknown): NormalizedMetaAction[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedMetaAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { action_type?: unknown; value?: unknown };
    const actionType =
      typeof row.action_type === "string" ? row.action_type.trim() : "";
    const value = parseActionValue(row.value);
    if (!actionType || value == null) continue;
    out.push({ actionType, value });
  }
  return out;
}

export function outboundClickCount(raw: unknown): number | null {
  const actions = normalizeMetaActions(raw);
  const hit = actions.find((a) => a.actionType === "outbound_click");
  return hit ? hit.value : null;
}

export function extractPrimaryLeadResult(
  actions: NormalizedMetaAction[],
): {
  primaryResultType: string | null;
  primaryResults: number | null;
  mappingConfidence: ResultMappingConfidence;
} {
  const hits = LEAD_ACTION_PRIORITY.map((type) =>
    actions.find((a) => a.actionType === type && a.value > 0),
  ).filter((a): a is NormalizedMetaAction => a != null);
  if (hits.length === 0) {
    return {
      primaryResultType: null,
      primaryResults: null,
      mappingConfidence: "UNKNOWN",
    };
  }
  if (hits.length > 1) {
    return {
      primaryResultType: null,
      primaryResults: null,
      mappingConfidence: "AMBIGUOUS",
    };
  }
  return {
    primaryResultType: hits[0].actionType,
    primaryResults: hits[0].value,
    mappingConfidence: "CONFIDENT",
  };
}

export function extractPurchaseValue(
  actionValues: NormalizedMetaAction[],
): {
  primaryResultValue: number | null;
  mappingConfidence: ResultMappingConfidence;
} {
  const hits = PURCHASE_ACTION_TYPES.map((type) =>
    actionValues.find((a) => a.actionType === type && a.value > 0),
  ).filter((a): a is NormalizedMetaAction => a != null);
  if (hits.length === 0) {
    return { primaryResultValue: null, mappingConfidence: "UNKNOWN" };
  }
  if (hits.length > 1) {
    return { primaryResultValue: null, mappingConfidence: "AMBIGUOUS" };
  }
  return { primaryResultValue: hits[0].value, mappingConfidence: "CONFIDENT" };
}

export function deriveRoas(
  spend: number | null,
  purchaseValue: number | null,
): number | null {
  if (spend == null || spend <= 0 || purchaseValue == null) return null;
  return purchaseValue / spend;
}
