export const META_INSIGHTS_MAX_LOOKBACK_DAYS = 90;

export type InsightDateRange = {
  since: string;
  until: string;
  truncated: boolean;
  fallback: "campaign_dates" | "created_at" | "lookback";
};

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Historical: since = meta_start_at, until = meta_stop_at if past else today.
 * Missing dates: last META_INSIGHTS_MAX_LOOKBACK_DAYS (not unlimited / not date_preset=maximum).
 */
export function resolveInsightDateRange(input: {
  metaStartAt: string | null;
  metaStopAt: string | null;
  metaCreatedAt: string | null;
  now?: Date;
}): InsightDateRange {
  const now = input.now ?? new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = parseDay(input.metaStartAt) ?? parseDay(input.metaCreatedAt);
  const stop = parseDay(input.metaStopAt);
  let until = stop && stop.getTime() < today.getTime() ? stop : today;
  let since = start;
  let fallback: InsightDateRange["fallback"] = start
    ? input.metaStartAt
      ? "campaign_dates"
      : "created_at"
    : "lookback";
  if (!since) {
    since = addUtcDays(until, -(META_INSIGHTS_MAX_LOOKBACK_DAYS - 1));
    fallback = "lookback";
  }
  if (since.getTime() > until.getTime()) {
    since = until;
  }
  const earliest = addUtcDays(until, -(META_INSIGHTS_MAX_LOOKBACK_DAYS - 1));
  let truncated = false;
  if (since.getTime() < earliest.getTime()) {
    since = earliest;
    truncated = true;
  }
  return {
    since: ymdUtc(since),
    until: ymdUtc(until),
    truncated,
    fallback,
  };
}
