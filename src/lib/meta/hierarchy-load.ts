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
import {
  buildAdConfiguration,
  buildAdSetConfiguration,
  buildCampaignConfiguration,
  buildConfigurationObservations,
  buildConfigPresentation,
  buildAdSetConfigPresentation,
  comparePlannedVsActual,
  parseStoredTargetingSummary,
  presentAdConfig,
  type AllyPlannedConfigSnapshot,
  type ConfigPresentation,
} from "@/lib/meta/configuration";
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
  configuration: ConfigPresentation | null;
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
  configuration: ConfigPresentation | null;
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
  configuration: ConfigPresentation | null;
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
  options?: { planned?: AllyPlannedConfigSnapshot | null },
): Promise<CampaignHierarchyView> {
  const campaign = await getOwnedImportedMetaCampaign(
    userId,
    clientId,
    metaCampaignUuid,
  );

  const { data: campRowRaw, error: campErr } = await adminClient()
    .from("meta_campaigns")
    .select(
      "id, name, primary_kpi, target_value, raw_objective, status, effective_status, buying_type, daily_budget, lifetime_budget, special_ad_categories, is_adset_budget_sharing_enabled",
    )
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("meta_campaign_id", campaign.metaCampaignId)
    .maybeSingle();

  let campRow: Record<string, unknown> | null =
    !campErr && campRowRaw
      ? (campRowRaw as Record<string, unknown>)
      : null;
  if (campErr || !campRow) {
    const retry = await adminClient()
      .from("meta_campaigns")
      .select("id, name, primary_kpi, target_value")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("meta_campaign_id", campaign.metaCampaignId)
      .maybeSingle();
    if (retry.error) {
      throw new MetaError(
        "META_CAMPAIGN_DISCOVERY_FAILED",
        "Lettura campagna Meta non riuscita.",
      );
    }
    campRow = (retry.data as Record<string, unknown> | null) ?? null;
  }
  const primaryKpi =
    campRow && typeof campRow.primary_kpi === "string"
      ? campRow.primary_kpi
      : null;
  const rawTarget = campRow ? campRow.target_value : null;
  const targetValue =
    typeof rawTarget === "number" && Number.isFinite(rawTarget)
      ? rawTarget
      : typeof rawTarget === "string" && rawTarget.trim()
        ? Number(rawTarget)
        : null;
  const safeTarget =
    targetValue != null && Number.isFinite(targetValue) ? targetValue : null;

  const ADSET_SELECT_FULL =
    "meta_ad_set_id, name, status, effective_status, daily_budget, lifetime_budget, optimization_goal, billing_event, bid_strategy, bid_amount, start_time, end_time, destination_type, attribution_spec, promoted_object, targeting_summary";
  const ADSET_SELECT_BASIC =
    "meta_ad_set_id, name, status, effective_status";
  const AD_SELECT_FULL =
    "meta_ad_id, meta_ad_set_id, name, status, effective_status, creative_id, creative_thumbnail_url, creative_title, creative_body, creative_cta, creative_link_url";
  const AD_SELECT_BASIC =
    "meta_ad_id, meta_ad_set_id, name, status, effective_status, creative_thumbnail_url, creative_title, creative_body";

  let adSetsRes: { data: unknown; error: { message?: string } | null } =
    await adminClient()
      .from("meta_ad_sets")
      .select(ADSET_SELECT_FULL)
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("meta_campaign_id", campaign.metaCampaignId);
  if (adSetsRes.error) {
    adSetsRes = await adminClient()
      .from("meta_ad_sets")
      .select(ADSET_SELECT_BASIC)
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("meta_campaign_id", campaign.metaCampaignId);
  }

  let adsRes: { data: unknown; error: { message?: string } | null } =
    await adminClient()
      .from("meta_ads")
      .select(AD_SELECT_FULL)
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("meta_campaign_id", campaign.metaCampaignId);
  if (adsRes.error) {
    adsRes = await adminClient()
      .from("meta_ads")
      .select(AD_SELECT_BASIC)
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("meta_campaign_id", campaign.metaCampaignId);
  }

  const [adSetInsightsRes, adInsightsRes] = await Promise.all([
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
      configuration: null,
    };
  }

  type AdSetRow = {
    meta_ad_set_id: string;
    name: string;
    status: string | null;
    effective_status: string | null;
    daily_budget?: number | null;
    lifetime_budget?: number | null;
    optimization_goal?: string | null;
    billing_event?: string | null;
    bid_strategy?: string | null;
    bid_amount?: number | null;
    start_time?: string | null;
    end_time?: string | null;
    destination_type?: string | null;
    attribution_spec?: unknown;
    promoted_object?: unknown;
    targeting_summary?: unknown;
  };
  type AdRow = {
    meta_ad_id: string;
    meta_ad_set_id: string;
    name: string;
    status: string | null;
    effective_status: string | null;
    creative_id?: string | null;
    creative_thumbnail_url: string | null;
    creative_title: string | null;
    creative_body: string | null;
    creative_cta?: string | null;
    creative_link_url?: string | null;
  };

  const adSetRows = (adSetsRes.data ?? []) as AdSetRow[];
  const adRows = (adsRes.data ?? []) as AdRow[];

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

  const anyAdSetBudget = adSetRows.some(
    (a) =>
      (typeof a.daily_budget === "number" && a.daily_budget > 0) ||
      (typeof a.lifetime_budget === "number" && a.lifetime_budget > 0),
  );
  const campaignConfig = buildCampaignConfiguration({
    objective:
      (typeof campRow?.raw_objective === "string"
        ? campRow.raw_objective
        : null) ?? rawObjective,
    status:
      (typeof campRow?.status === "string" ? campRow.status : null) ??
      campaign.status,
    effectiveStatus:
      (typeof campRow?.effective_status === "string"
        ? campRow.effective_status
        : null) ?? campaign.effectiveStatus,
    buyingType:
      (typeof campRow?.buying_type === "string" ? campRow.buying_type : null) ??
      campaign.buyingType,
    specialAdCategories: campRow?.special_ad_categories ?? null,
    dailyBudget:
      typeof campRow?.daily_budget === "number"
        ? campRow.daily_budget
        : campaign.dailyBudget,
    lifetimeBudget:
      typeof campRow?.lifetime_budget === "number"
        ? campRow.lifetime_budget
        : campaign.lifetimeBudget,
    isAdsetBudgetSharingEnabled:
      typeof campRow?.is_adset_budget_sharing_enabled === "boolean"
        ? campRow.is_adset_budget_sharing_enabled
        : null,
    anyAdSetBudget,
  });

  const adSetConfigs = adSetRows.map((as) =>
    buildAdSetConfiguration({
      name: as.name,
      status: as.status,
      effectiveStatus: as.effective_status,
      dailyBudget: as.daily_budget ?? null,
      lifetimeBudget: as.lifetime_budget ?? null,
      optimizationGoal: as.optimization_goal ?? null,
      billingEvent: as.billing_event ?? null,
      bidStrategy: as.bid_strategy ?? null,
      bidAmount: as.bid_amount ?? null,
      startAt: as.start_time ?? null,
      endAt: as.end_time ?? null,
      destinationType: as.destination_type ?? null,
      attributionSpec: as.attribution_spec ?? null,
      promotedObject: as.promoted_object ?? null,
      targetingSummary: parseStoredTargetingSummary(as.targeting_summary),
    }),
  );

  const observations = buildConfigurationObservations({
    campaign: campaignConfig,
    adSets: adSetConfigs,
  });
  const plannedVsActual = comparePlannedVsActual({
    planned: options?.planned ?? null,
    campaign: campaignConfig,
    primaryAdSet: adSetConfigs[0] ?? null,
  });
  const campaignPresentation = buildConfigPresentation({
    campaign: campaignConfig,
    primaryAdSet: adSetConfigs[0] ?? null,
    observations,
    plannedVsActual,
  });

  const adsByAdSet = new Map<string, HierarchyAdView[]>();
  for (const ad of adRows) {
    const metrics = evaluateFromRows(
      adInsightById.get(ad.meta_ad_id) ?? [],
      primaryKpi,
      safeTarget,
      rawObjective,
    );
    const adConfig = buildAdConfiguration({
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      creativeId: ad.creative_id ?? null,
      creativeName: null,
      creativeTitle: ad.creative_title,
      creativeCta: ad.creative_cta ?? null,
      creativeLinkUrl: ad.creative_link_url ?? null,
    });
    const { beginner, professional } = presentAdConfig(adConfig);
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
      configuration: {
        beginner,
        professional,
        observations: [],
        plannedVsActual: null,
      },
    };
    const list = adsByAdSet.get(ad.meta_ad_set_id) ?? [];
    list.push(view);
    adsByAdSet.set(ad.meta_ad_set_id, list);
  }

  const adSets: HierarchyAdSetView[] = adSetRows.map((as, idx) => {
    const metrics = evaluateFromRows(
      adSetInsightById.get(as.meta_ad_set_id) ?? [],
      primaryKpi,
      safeTarget,
      rawObjective,
    );
    const cfg = adSetConfigs[idx]!;
    const presentation = buildAdSetConfigPresentation({
      adSet: cfg,
      campaignBudgetLevel: campaignConfig.budgetLevel,
      observations: observations.filter(
        (o) =>
          o.scope === "AD_SET" &&
          o.evidence.some((e) => e.includes(as.name)),
      ),
    });
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
      configuration: presentation,
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
      (typeof campRow?.name === "string" && campRow.name.trim()) ||
      campaign.name,
    rawObjective,
    performanceFamily: resolvePerformanceFamily(rawObjective),
    adSets,
    diagnosis: {
      focusAdSetName: focusAdSet?.name ?? null,
      focusAdName: focusAd?.name ?? null,
      lines,
    },
    hierarchyAvailable: adSets.length > 0,
    configuration: campaignPresentation,
  };
}
