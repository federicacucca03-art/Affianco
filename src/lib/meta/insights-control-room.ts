import type { AggregatedMetaInsights } from "@/lib/meta/insight-aggregate";

export const META_INSIGHTS_CONTROL_ROOM_SOURCE = "META_API" as const;

/**
 * Conceptual adapter only. Does not write campaign_checks or run health.
 * M5 decides whether imported Meta campaigns enter the Control Room.
 */
export function metaInsightsToControlRoomInput(input: {
  aggregate: AggregatedMetaInsights;
  since: string;
  until: string;
}): {
  source: typeof META_INSIGHTS_CONTROL_ROOM_SOURCE;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  linkClicks: number | null;
  frequency: number | null;
  results: number | null;
  resultType: string | null;
  dateRange: { since: string; until: string };
} {
  return {
    source: META_INSIGHTS_CONTROL_ROOM_SOURCE,
    spend: input.aggregate.spend,
    impressions: input.aggregate.impressions,
    clicks: input.aggregate.clicks,
    linkClicks: input.aggregate.linkClicks,
    frequency: input.aggregate.periodFrequency,
    results:
      input.aggregate.resultMappingConfidence === "CONFIDENT"
        ? input.aggregate.primaryResults
        : null,
    resultType:
      input.aggregate.resultMappingConfidence === "CONFIDENT"
        ? input.aggregate.primaryResultType
        : null,
    dateRange: { since: input.since, until: input.until },
  };
}
