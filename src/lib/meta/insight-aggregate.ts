import type { ResultMappingConfidence } from "@/lib/meta/insight-actions";
import { deriveRoas } from "@/lib/meta/insight-actions";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";

export type AggregatedMetaInsights = {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  linkClicks: number | null;
  periodReach: number | null;
  periodFrequency: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  primaryResultType: string | null;
  primaryResults: number | null;
  primaryResultValue: number | null;
  resultMappingConfidence: ResultMappingConfidence;
  cpl: number | null;
  roas: number | null;
  dayCount: number;
};

function sumNullable(
  rows: NormalizedDailyInsight[],
  pick: (r: NormalizedDailyInsight) => number | null,
): number | null {
  let sum = 0;
  let saw = false;
  for (const row of rows) {
    const n = pick(row);
    if (n == null) continue;
    saw = true;
    sum += n;
  }
  return saw ? sum : null;
}

/**
 * Daily reach is not unique lifetime reach — never sum it.
 * Daily frequency is not period frequency — never average it.
 * Pass Meta period aggregate reach/frequency from a separate all_days request.
 */
export function aggregateDailyInsights(
  rows: NormalizedDailyInsight[],
  period: { reach: number | null; frequency: number | null },
): AggregatedMetaInsights {
  const spend = sumNullable(rows, (r) => r.spend);
  const impressions = sumNullable(rows, (r) => r.impressions);
  const clicks = sumNullable(rows, (r) => r.clicks);
  const linkClicks = sumNullable(rows, (r) => r.linkClicks);
  const clickNumerator = linkClicks ?? null;
  const ctr =
    clickNumerator != null && impressions != null && impressions > 0
      ? (clickNumerator / impressions) * 100
      : null;
  const cpc =
    spend != null && clickNumerator != null && clickNumerator > 0
      ? spend / clickNumerator
      : null;
  const cpm =
    spend != null && impressions != null && impressions > 0
      ? (spend / impressions) * 1000
      : null;

  const confident = rows.filter(
    (r) => r.resultMappingConfidence === "CONFIDENT" && r.primaryResultType,
  );
  const ambiguous = rows.some(
    (r) => r.resultMappingConfidence === "AMBIGUOUS",
  );
  const types = new Set(confident.map((r) => r.primaryResultType as string));
  let primaryResultType: string | null = null;
  let primaryResults: number | null = null;
  let resultMappingConfidence: ResultMappingConfidence = "UNKNOWN";
  if (ambiguous || types.size > 1) {
    resultMappingConfidence = "AMBIGUOUS";
  } else if (types.size === 1) {
    primaryResultType = [...types][0];
    primaryResults = sumNullable(confident, (r) => r.primaryResults);
    resultMappingConfidence = "CONFIDENT";
  }

  const valueRows = rows.filter((r) => r.primaryResultValue != null);
  const primaryResultValue = sumNullable(valueRows, (r) => r.primaryResultValue);
  const cpl =
    resultMappingConfidence === "CONFIDENT" &&
    primaryResults != null &&
    primaryResults > 0 &&
    spend != null
      ? spend / primaryResults
      : null;

  return {
    spend,
    impressions,
    clicks,
    linkClicks,
    periodReach: period.reach,
    periodFrequency: period.frequency,
    ctr,
    cpc,
    cpm,
    primaryResultType,
    primaryResults,
    primaryResultValue,
    resultMappingConfidence,
    cpl,
    roas: deriveRoas(spend, primaryResultValue),
    dayCount: rows.length,
  };
}
