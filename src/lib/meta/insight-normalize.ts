import {
  extractPrimaryLeadResult,
  extractPurchaseValue,
  normalizeMetaActions,
  outboundClickCount,
  type NormalizedMetaAction,
  type ResultMappingConfidence,
} from "@/lib/meta/insight-actions";

export type NormalizedDailyInsight = {
  metaCampaignId: string | null;
  dateStart: string;
  dateStop: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  linkClicks: number | null;
  metaCtr: number | null;
  metaCpc: number | null;
  metaCpm: number | null;
  frequency: number | null;
  actions: NormalizedMetaAction[];
  actionValues: NormalizedMetaAction[];
  primaryResultType: string | null;
  primaryResults: number | null;
  primaryResultValue: number | null;
  resultMappingConfidence: ResultMappingConfidence;
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseNonNegNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function parseNonNegInt(value: unknown): number | null {
  const n = parseNonNegNumber(value);
  if (n == null) return null;
  if (!Number.isInteger(n)) return Math.trunc(n);
  return n;
}

function ymd(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const day = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day;
}

/**
 * Link clicks ≠ all clicks.
 * Prefer inline_link_clicks; else outbound_click from outbound_clicks.
 * Never fall back to generic `clicks`.
 */
export function resolveLinkClicks(
  inlineLinkClicks: unknown,
  outboundClicks: unknown,
): number | null {
  const inline = parseNonNegNumber(inlineLinkClicks);
  if (inline != null) return inline;
  return outboundClickCount(outboundClicks);
}

export function normalizeInsightRow(
  raw: unknown,
  options?: { rawObjective?: string | null },
): NormalizedDailyInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const dateStart = ymd(row.date_start);
  const dateStop = ymd(row.date_stop) ?? dateStart;
  if (!dateStart || !dateStop) return null;
  const actions = normalizeMetaActions(row.actions);
  const actionValues = normalizeMetaActions(row.action_values);
  const objective = (options?.rawObjective ?? "").toUpperCase();
  const isLeadObjective =
    objective === "OUTCOME_LEADS" || objective === "LEADS";
  const lead = isLeadObjective
    ? extractPrimaryLeadResult(actions)
    : {
        primaryResultType: null as string | null,
        primaryResults: null as number | null,
        mappingConfidence: "UNKNOWN" as ResultMappingConfidence,
      };
  const purchase = extractPurchaseValue(actionValues);
  return {
    metaCampaignId: asText(row.campaign_id),
    dateStart,
    dateStop,
    spend: parseNonNegNumber(row.spend),
    impressions: parseNonNegInt(row.impressions),
    reach: parseNonNegInt(row.reach),
    clicks: parseNonNegInt(row.clicks),
    linkClicks: resolveLinkClicks(row.inline_link_clicks, row.outbound_clicks),
    metaCtr: parseNonNegNumber(row.ctr),
    metaCpc: parseNonNegNumber(row.cpc),
    metaCpm: parseNonNegNumber(row.cpm),
    frequency: parseNonNegNumber(row.frequency),
    actions,
    actionValues,
    primaryResultType: lead.primaryResultType,
    primaryResults: lead.primaryResults,
    primaryResultValue: purchase.primaryResultValue,
    resultMappingConfidence: lead.mappingConfidence,
  };
}

export function parseInsightsPage(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  return Array.isArray(data) ? data : [];
}

export function actionsToJson(actions: NormalizedMetaAction[]): {
  action_type: string;
  value: number;
}[] {
  return actions.map((a) => ({ action_type: a.actionType, value: a.value }));
}

export function classifyInsightUpsert(
  existingDates: Set<string>,
  incomingDates: string[],
): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  const seen = new Set<string>();
  for (const date of incomingDates) {
    if (seen.has(date)) continue;
    seen.add(date);
    if (existingDates.has(date)) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated };
}
