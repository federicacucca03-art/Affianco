import "server-only";
import { getOwnedImportedMetaCampaign } from "@/lib/meta/campaign-import";
import { aggregateDailyInsights } from "@/lib/meta/insight-aggregate";
import { daysInclusiveYmd } from "@/lib/meta/insights-control-room";
import {
  buildHierarchyDiagnosisLines,
  evaluateEntityVsTarget,
  evaluateSampleSufficiencyForObjective,
  pickFirstAdFocus,
  pickFirstAdSetFocus,
  type AllyHierarchyOperationalState,
  type HierarchyDataSufficiency,
} from "@/lib/meta/hierarchy-evaluate";
import { resolvePerformanceFamily } from "@/lib/meta/objective-performance";
import { MetaError } from "@/lib/meta/errors";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function adminClient() {
  try {
    return createSupabaseAdmin();
  } catch {
    throw new MetaError(
      "META_CONFIG_MISSING",
      "Persistenza server non configurata.",
    );
  }
}

export type HierarchyAdView = {
  metaAdId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  dataSufficiency: HierarchyDataSufficiency;
  operationalState: AllyHierarchyOperationalState;
  creativeThumbnailUrl: string | null;
  creativeTitle: string | null;
  creativeBody: string | null;
};

export type HierarchyAdSetView = {
  metaAdSetId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  dataSufficiency: HierarchyDataSufficiency;
  operationalState: AllyHierarchyOperationalState;
  ads: HierarchyAdView[];
};

export type CampaignHierarchyView = {
  metaCampaignId: string;
  campaignName: string;
  rawObjective: string | null;
  performanceFamily: ReturnType<typeof resolvePerformanceFamily>;
  adSets: HierarchyAdSetView[];
  diagnosis: {
    focusAdSetName: string | null;
    focusAdName: string | null;
    lines: string[];
  };
  hierarchyAvailable: boolean;
};

type DailyInsightDb = {
  meta_ad_set_id?: string;
  meta_ad_id?: string;
  date_start: string;
  date_stop: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  link_clicks: number | null;
  meta_ctr: number | null;
  meta_cpc: number | null;
  meta_cpm: number | null;
  frequency: number | null;
  actions: { action_type: string; value: number }[] | null;
  action_values: { action_type: string; value: number }[] | null;
  primary_result_type: string | null;
  primary_results: number | null;
  primary_result_value: number | null;
  result_mapping_confidence: string | null;
};

function toNormalized(row: DailyInsightDb): NormalizedDailyInsight {
  const actions = Array.isArray(row.actions)
    ? row.actions.map((a) => ({
        actionType: a.action_type,
        value: a.value,
      }))
    : [];
  const actionValues = Array.isArray(row.action_values)
    ? row.action_values.map((a) => ({
        actionType: a.action_type,
        value: a.value,
      }))
    : [];
  return {
    metaCampaignId: null,
    dateStart: row.date_start,
    dateStop: row.date_stop,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    linkClicks: row.link_clicks,
    metaCtr: row.meta_ctr,
    metaCpc: row.meta_cpc,
    metaCpm: row.meta_cpm,
    frequency: row.frequency,
    actions,
    actionValues,
    primaryResultType: row.primary_result_type,
    primaryResults: row.primary_results,
    primaryResultValue: row.primary_result_value,
    resultMappingConfidence:
      row.result_mapping_confidence === "CONFIDENT" ||
      row.result_mapping_confidence === "AMBIGUOUS"
        ? row.result_mapping_confidence
        : "UNKNOWN",
    outcomeLimitation: null,
  };
}

function resolveCostPerResult(
  primaryKpi: string | null,
  agg: ReturnType<typeof aggregateDailyInsights>,
): number | null {
  const kpi = (primaryKpi ?? "").toUpperCase();
  if (kpi === "CPL" || kpi === "CPA") {
    if (
      agg.resultMappingConfidence === "CONFIDENT" &&
      agg.primaryResults != null &&
      agg.primaryResults > 0 &&
      agg.spend != null
    ) {
      return Math.round((agg.spend / agg.primaryResults) * 100) / 100;
    }
    return agg.cpl;
  }
  if (kpi === "CPC") return agg.cpc;
  if (kpi === "CPM") return agg.cpm;
  return null;
}

function resolveResults(
  agg: ReturnType<typeof aggregateDailyInsights>,
): number | null {
  if (agg.resultMappingConfidence === "CONFIDENT") {
    return agg.primaryResults;
  }
  return null;
}

function evaluateFromRows(
  rows: NormalizedDailyInsight[],
  primaryKpi: string | null,
  targetValue: number | null,
  rawObjective: string | null,
): {
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  dataSufficiency: HierarchyDataSufficiency;
  operationalState: AllyHierarchyOperationalState;
} {
  if (rows.length === 0) {
    return {
      spend: null,
      results: null,
      costPerResult: null,
      resultMappingConfidence: "UNKNOWN",
      dataSufficiency: "INSUFFICIENT_DATA",
      operationalState: "INSUFFICIENT_DATA",
    };
  }
  const sorted = [...rows].sort((a, b) =>
    a.dateStart.localeCompare(b.dateStart),
  );
  const since = sorted[0]?.dateStart ?? "";
  const until = sorted[sorted.length - 1]?.dateStop ?? since;
  const daysActive = daysInclusiveYmd(since, until);
  const agg = aggregateDailyInsights(rows, {
    reach: null,
    frequency: null,
  });
  const results = resolveResults(agg);
  const family = resolvePerformanceFamily(rawObjective);
  /**
   * M10C.1 — Ambiguous mapping ≠ insufficient sample.
   * Do not feed resultsCount=0 into conversion thresholds when Ally
   * deliberately withheld a primary result for semantic safety.
   */
  let sufficiency: HierarchyDataSufficiency;
  if (agg.resultMappingConfidence === "AMBIGUOUS") {
    const daysOk = daysActive != null && daysActive >= 3;
    const hasDelivery =
      (agg.impressions != null && agg.impressions > 0) ||
      (agg.spend != null && agg.spend > 0);
    sufficiency = daysOk && hasDelivery ? "SUFFICIENT" : "INSUFFICIENT_DATA";
  } else {
    sufficiency = evaluateSampleSufficiencyForObjective({
      rawObjective,
      daysActive,
      resultsCount:
        family === "AWARENESS" || family === "UNKNOWN"
          ? null
          : (results ?? 0),
      impressions: agg.impressions,
      linkClicks: agg.linkClicks,
    });
  }
  const costPerResult = resolveCostPerResult(primaryKpi, agg);
  const operationalState = evaluateEntityVsTarget({
    sufficiency,
    costPerResult,
    targetValue,
    primaryKpi,
    resultMappingConfidence: agg.resultMappingConfidence,
  });
  return {
    spend: agg.spend,
    results,
    costPerResult,
    resultMappingConfidence: agg.resultMappingConfidence,
    dataSufficiency: sufficiency,
    operationalState,
  };
}

export async function loadCampaignHierarchyView(
  userId: string,
  clientId: string,
  metaCampaignUuid: string,
): Promise<CampaignHierarchyView> {
  const campaign = await getOwnedImportedMetaCampaign(
    userId,
    clientId,
    metaCampaignUuid,
  );

  const { data: campRow, error: campErr } = await adminClient()
    .from("meta_campaigns")
    .select("id, name, primary_kpi, target_value")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("meta_campaign_id", campaign.metaCampaignId)
    .maybeSingle();
  if (campErr) {
    throw new MetaError(
      "META_CAMPAIGN_DISCOVERY_FAILED",
      "Lettura campagna Meta non riuscita.",
    );
  }
  const primaryKpi =
    campRow && typeof (campRow as { primary_kpi?: unknown }).primary_kpi === "string"
      ? ((campRow as { primary_kpi: string }).primary_kpi)
      : null;
  const rawTarget = campRow
    ? (campRow as { target_value?: unknown }).target_value
    : null;
  const targetValue =
    typeof rawTarget === "number" && Number.isFinite(rawTarget)
      ? rawTarget
      : typeof rawTarget === "string" && rawTarget.trim()
        ? Number(rawTarget)
        : null;
  const safeTarget =
    targetValue != null && Number.isFinite(targetValue) ? targetValue : null;

  const [adSetsRes, adsRes, adSetInsightsRes, adInsightsRes] =
    await Promise.all([
      adminClient()
        .from("meta_ad_sets")
        .select(
          "meta_ad_set_id, name, status, effective_status",
        )
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .eq("meta_campaign_id", campaign.metaCampaignId),
      adminClient()
        .from("meta_ads")
        .select(
          "meta_ad_id, meta_ad_set_id, name, status, effective_status, creative_thumbnail_url, creative_title, creative_body",
        )
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .eq("meta_campaign_id", campaign.metaCampaignId),
      adminClient()
        .from("meta_ad_set_insights_daily")
        .select(
          "meta_ad_set_id, date_start, date_stop, spend, impressions, reach, clicks, link_clicks, meta_ctr, meta_cpc, meta_cpm, frequency, actions, action_values, primary_result_type, primary_results, primary_result_value, result_mapping_confidence",
        )
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .eq("meta_campaign_id", campaign.metaCampaignId),
      adminClient()
        .from("meta_ad_insights_daily")
        .select(
          "meta_ad_id, meta_ad_set_id, date_start, date_stop, spend, impressions, reach, clicks, link_clicks, meta_ctr, meta_cpc, meta_cpm, frequency, actions, action_values, primary_result_type, primary_results, primary_result_value, result_mapping_confidence",
        )
        .eq("user_id", userId)
        .eq("client_id", clientId)
        .eq("meta_campaign_id", campaign.metaCampaignId),
    ]);

  // Tables may not exist yet (migration not applied) — degrade gracefully
  if (adSetsRes.error || adsRes.error) {
    return {
      metaCampaignId: campaign.metaCampaignId,
      campaignName: campaign.name,
      rawObjective: campaign.rawObjective,
      performanceFamily: resolvePerformanceFamily(campaign.rawObjective),
      adSets: [],
      diagnosis: { focusAdSetName: null, focusAdName: null, lines: [] },
      hierarchyAvailable: false,
    };
  }

  const adSetRows = (adSetsRes.data ?? []) as {
    meta_ad_set_id: string;
    name: string;
    status: string | null;
    effective_status: string | null;
  }[];
  const adRows = (adsRes.data ?? []) as {
    meta_ad_id: string;
    meta_ad_set_id: string;
    name: string;
    status: string | null;
    effective_status: string | null;
    creative_thumbnail_url: string | null;
    creative_title: string | null;
    creative_body: string | null;
  }[];

  const adSetInsightById = new Map<string, NormalizedDailyInsight[]>();
  for (const row of (adSetInsightsRes.data ?? []) as DailyInsightDb[]) {
    if (!row.meta_ad_set_id) continue;
    const list = adSetInsightById.get(row.meta_ad_set_id) ?? [];
    list.push(toNormalized(row));
    adSetInsightById.set(row.meta_ad_set_id, list);
  }
  const adInsightById = new Map<string, NormalizedDailyInsight[]>();
  for (const row of (adInsightsRes.data ?? []) as DailyInsightDb[]) {
    if (!row.meta_ad_id) continue;
    const list = adInsightById.get(row.meta_ad_id) ?? [];
    list.push(toNormalized(row));
    adInsightById.set(row.meta_ad_id, list);
  }

  const rawObjective = campaign.rawObjective ?? null;

  const adsByAdSet = new Map<string, HierarchyAdView[]>();
  for (const ad of adRows) {
    const metrics = evaluateFromRows(
      adInsightById.get(ad.meta_ad_id) ?? [],
      primaryKpi,
      safeTarget,
      rawObjective,
    );
    const view: HierarchyAdView = {
      metaAdId: ad.meta_ad_id,
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      spend: metrics.spend,
      results: metrics.results,
      costPerResult: metrics.costPerResult,
      resultMappingConfidence: metrics.resultMappingConfidence,
      dataSufficiency: metrics.dataSufficiency,
      operationalState: metrics.operationalState,
      creativeThumbnailUrl: ad.creative_thumbnail_url,
      creativeTitle: ad.creative_title,
      creativeBody: ad.creative_body,
    };
    const list = adsByAdSet.get(ad.meta_ad_set_id) ?? [];
    list.push(view);
    adsByAdSet.set(ad.meta_ad_set_id, list);
  }

  const adSets: HierarchyAdSetView[] = adSetRows.map((as) => {
    const metrics = evaluateFromRows(
      adSetInsightById.get(as.meta_ad_set_id) ?? [],
      primaryKpi,
      safeTarget,
      rawObjective,
    );
    return {
      metaAdSetId: as.meta_ad_set_id,
      name: as.name,
      status: as.status,
      effectiveStatus: as.effective_status,
      spend: metrics.spend,
      results: metrics.results,
      costPerResult: metrics.costPerResult,
      resultMappingConfidence: metrics.resultMappingConfidence,
      dataSufficiency: metrics.dataSufficiency,
      operationalState: metrics.operationalState,
      ads: adsByAdSet.get(as.meta_ad_set_id) ?? [],
    };
  });

  const focusAdSet = pickFirstAdSetFocus(
    adSets.map((a) => ({
      name: a.name,
      metaAdSetId: a.metaAdSetId,
      spend: a.spend,
      results: a.results,
      costPerResult: a.costPerResult,
      state: a.operationalState,
      sufficiency: a.dataSufficiency,
    })),
  );

  let focusAd: ReturnType<typeof pickFirstAdFocus> = null;
  if (focusAdSet?.metaAdSetId) {
    const adsInFocus =
      adSets.find((a) => a.metaAdSetId === focusAdSet.metaAdSetId)?.ads ?? [];
    focusAd = pickFirstAdFocus(
      adsInFocus.map((a) => ({
        name: a.name,
        metaAdId: a.metaAdId,
        spend: a.spend,
        results: a.results,
        costPerResult: a.costPerResult,
        state: a.operationalState,
        sufficiency: a.dataSufficiency,
      })),
    );
  } else {
    const allAds = adSets.flatMap((a) => a.ads);
    focusAd = pickFirstAdFocus(
      allAds.map((a) => ({
        name: a.name,
        metaAdId: a.metaAdId,
        spend: a.spend,
        results: a.results,
        costPerResult: a.costPerResult,
        state: a.operationalState,
        sufficiency: a.dataSufficiency,
      })),
    );
  }

  const campaignNeedsAttention = adSets.some(
    (a) =>
      a.operationalState === "NEEDS_ATTENTION" ||
      a.operationalState === "MONITOR",
  );

  const lines = buildHierarchyDiagnosisLines({
    campaignNeedsAttention,
    focusAdSet: focusAdSet ? { name: focusAdSet.name } : null,
    focusAd: focusAd ? { name: focusAd.name } : null,
  });

  return {
    metaCampaignId: campaign.metaCampaignId,
    campaignName:
      (campRow as { name?: string } | null)?.name?.trim() || campaign.name,
    rawObjective,
    performanceFamily: resolvePerformanceFamily(rawObjective),
    adSets,
    diagnosis: {
      focusAdSetName: focusAdSet?.name ?? null,
      focusAdName: focusAd?.name ?? null,
      lines,
    },
    hierarchyAvailable: adSets.length > 0,
  };
}
