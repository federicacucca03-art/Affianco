/**
 * Server-only loader for M6C diagnosis context.
 * Ownership via user_id. No Meta tokens. No browser metrics.
 */

import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isUuid } from "@/lib/meta/ids";
import {
  buildMetaAttentionItem,
  buildNativeAttentionItem,
} from "@/lib/monday-control-room";
import {
  mapMetaCampaignToMonitoringRow,
  type MetaCampaignApiRow,
} from "@/lib/meta/meta-campaign-monitoring-row";
import type { LinkedAffiancoCampaignSnapshot } from "@/lib/meta/campaign-link-compatibility";
import type { ResultMappingConfidence } from "@/lib/meta/insight-actions";
import {
  computeMetaTrend,
  type MetaTrendDirection,
  type MetaTrendLevel,
} from "@/lib/meta/meta-trend";
import type { NormalizedDailyInsight } from "@/lib/meta/insight-normalize";
import type { Campagna } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";
import type { CampaignCheck, CampaignCheckRow } from "@/lib/campaign-checks-db";
import type { HealthStatus } from "@/lib/control-room";
import {
  buildDiagnosisAiPayload,
  buildDiagnosisFacts,
  type BuildDiagnosisContextInput,
} from "@/lib/campaign-diagnosis/build-context";
import { resolveDiagnosisEligibility } from "@/lib/campaign-diagnosis/eligibility";
import type {
  CampaignDiagnosisAiPayload,
  CampaignDiagnosisFacts,
  DiagnosisEligibility,
  DiagnosisSource,
} from "@/lib/campaign-diagnosis/types";

export class DiagnosisLoadError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "CONFIG",
    message: string,
  ) {
    super(message);
    this.name = "DiagnosisLoadError";
  }
}

function admin() {
  try {
    return createSupabaseAdmin();
  } catch {
    throw new DiagnosisLoadError(
      "CONFIG",
      "Persistenza server non configurata.",
    );
  }
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isHealth(v: string): v is HealthStatus {
  return (
    v === "GREEN" || v === "YELLOW" || v === "RED" || v === "INSUFFICIENT"
  );
}

function mapCheck(row: CampaignCheckRow): CampaignCheck | null {
  if (!isHealth(row.health_status)) return null;
  const source =
    row.source === "MANUAL" || row.source === "SCREENSHOT" || row.source === "CSV"
      ? row.source
      : "MANUAL";
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    createdAt: row.created_at,
    daysActive: num(row.days_active),
    spend: num(row.spend),
    resultsCount: num(row.results_count),
    primaryCost: num(row.primary_cost),
    ctr: num(row.ctr),
    cpm: num(row.cpm),
    cpc: num(row.cpc),
    frequency: num(row.frequency),
    roas: num(row.roas),
    clicks: num(row.clicks),
    impressions: num(row.impressions),
    healthStatus: row.health_status,
    signal: row.signal,
    actions: [],
    note: null,
    objective: row.objective,
    threshold: num(row.threshold),
    thresholdMode: null,
    source,
  };
}

function emptyInsight(date: string, metaCampaignId: string): NormalizedDailyInsight {
  return {
    metaCampaignId,
    dateStart: date,
    dateStop: date,
    spend: null,
    impressions: null,
    reach: null,
    clicks: null,
    linkClicks: null,
    metaCtr: null,
    metaCpc: null,
    metaCpm: null,
    frequency: null,
    actions: [],
    actionValues: [],
    primaryResultType: null,
    primaryResults: null,
    primaryResultValue: null,
    resultMappingConfidence: "UNKNOWN",
  };
}

export type LoadedDiagnosisBundle = {
  eligibility: DiagnosisEligibility;
  facts: CampaignDiagnosisFacts;
  aiPayload: CampaignDiagnosisAiPayload;
  healthAvailability: string | null;
};

function audienceHintFromCampagna(c: Campagna): string | null {
  const parts: string[] = [];
  if (c.citta?.trim()) parts.push(c.citta.trim());
  if (c.raggioKm != null) parts.push(`raggio ${c.raggioKm} km`);
  if (c.etaMin != null || c.etaMax != null) {
    parts.push(`età ${c.etaMin ?? "?"}-${c.etaMax ?? "?"}`);
  }
  return parts.length ? parts.join(", ") : null;
}

function parseCreativitaMeta(raw: unknown): Campagna["creativitaMeta"] {
  if (!raw) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const out: NonNullable<Campagna["creativitaMeta"]> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as {
      width?: unknown;
      height?: unknown;
      storagePath?: unknown;
      id?: unknown;
      nomeFile?: unknown;
      ruolo?: unknown;
      avvisoFormato?: unknown;
    };
    if (typeof o.width !== "number" || typeof o.height !== "number") continue;
    out.push({
      id: typeof o.id === "string" ? o.id : "asset",
      nomeFile: typeof o.nomeFile === "string" ? o.nomeFile : "creativita",
      width: o.width,
      height: o.height,
      ruolo: (typeof o.ruolo === "string" ? o.ruolo : "principale") as never,
      avvisoFormato: Boolean(o.avvisoFormato),
      storagePath:
        typeof o.storagePath === "string" ? o.storagePath : undefined,
    });
  }
  return out.length ? out : undefined;
}

function formatHintFromCampagna(c: Campagna): string | null {
  const meta = Array.isArray(c.creativitaMeta)
    ? c.creativitaMeta[0]
    : c.creativitaMeta;
  if (!meta || typeof meta !== "object") return null;
  const m = meta as { width?: number; height?: number };
  if (m.width && m.height) return `${m.width}x${m.height}`;
  return null;
}

function hasCreativeFromCampagna(c: Campagna): boolean {
  const meta = Array.isArray(c.creativitaMeta)
    ? c.creativitaMeta[0]
    : c.creativitaMeta;
  if (!meta || typeof meta !== "object") return false;
  return Boolean((meta as { storagePath?: string }).storagePath);
}

export async function loadNativeDiagnosisBundle(
  userId: string,
  campaignId: string,
): Promise<LoadedDiagnosisBundle> {
  if (!isUuid(campaignId)) {
    throw new DiagnosisLoadError("BAD_REQUEST", "campaignId non valido.");
  }
  const { data, error } = await admin()
    .from("campaigns")
    .select(
      "id, created_at, client_id, user_id, name, objective, status, daily_budget, max_sustainable_cpa, estimated_cpm, target_margin, front_end_offer, settore, citta, raggio_km, eta_min, eta_max, creativita, clients(id, name)",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) {
    throw new DiagnosisLoadError("CONFIG", "Lettura campagna non riuscita.");
  }
  const row = data as {
    id: string;
    user_id: string | null;
    client_id: string | null;
    name: string | null;
    objective: string | null;
    status: string | null;
    daily_budget: number | null;
    max_sustainable_cpa: number | null;
    estimated_cpm: number | null;
    target_margin: number | null;
    front_end_offer: string | null;
    settore: string | null;
    citta: string | null;
    raggio_km: number | null;
    eta_min: number | null;
    eta_max: number | null;
    creativita: unknown;
    clients: { id: string; name: string } | { id: string; name: string }[] | null;
  } | null;
  if (!row) {
    throw new DiagnosisLoadError("NOT_FOUND", "Campagna non trovata.");
  }
  if (row.user_id !== userId) {
    throw new DiagnosisLoadError("FORBIDDEN", "Campagna non autorizzata.");
  }

  const clientJoin = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const nomeCliente = clientJoin?.name?.trim() || "Cliente";
  const creativitaMeta = parseCreativitaMeta(row.creativita);

  const campagna: Campagna = {
    id: row.id,
    nomeCliente,
    iniziali: nomeCliente.slice(0, 2).toUpperCase(),
    stato: "Attiva",
    giudizio: "Va bene",
    objective: normalizzaObjective(row.objective),
    nomeCampagna: row.name ?? undefined,
    status: row.status ?? undefined,
    budgetGiornaliero: row.daily_budget ?? undefined,
    maxSustainableCpa: row.max_sustainable_cpa ?? undefined,
    estimatedCpm: row.estimated_cpm ?? undefined,
    targetMargin: row.target_margin ?? undefined,
    frontEndOffer: row.front_end_offer ?? undefined,
    settore: row.settore ?? undefined,
    citta: row.citta ?? undefined,
    raggioKm: row.raggio_km ?? undefined,
    etaMin: row.eta_min ?? undefined,
    etaMax: row.eta_max ?? undefined,
    creativitaMeta: creativitaMeta ?? undefined,
  };

  const { data: checkRows } = await admin()
    .from("campaign_checks")
    .select("*")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(30);

  const checks = ((checkRows ?? []) as CampaignCheckRow[])
    .map(mapCheck)
    .filter((c): c is CampaignCheck => c != null);
  const latest = checks[0] ?? null;

  const item = buildNativeAttentionItem({
    campagna,
    check: latest,
    checksForTrend: checks,
  });

  const eligibility = resolveDiagnosisEligibility({
    attentionState: item.attentionState,
    health: item.healthStatus,
    campaignStatus: campagna.status,
  });

  const input: BuildDiagnosisContextInput = {
    source: "NATIVE",
    objective: campagna.objective ?? null,
    status: campagna.status ?? null,
    monitoringMode: "ACTIVE",
    health: item.healthStatus,
    attentionState: item.attentionState,
    urgencyLevel: item.urgencyLevel,
    attentionReason: item.reason,
    primaryKpi: item.primaryMetric,
    actualValue: item.primaryMetricValue,
    targetValue: item.targetValue,
    spend: latest?.spend ?? null,
    impressions: latest?.impressions ?? null,
    linkClicks: latest?.clicks ?? null,
    ctr: latest?.ctr ?? null,
    cpc: latest?.cpc ?? null,
    cpm: latest?.cpm ?? null,
    frequency: latest?.frequency ?? null,
    results: latest?.resultsCount ?? null,
    trend: item.trend,
    resultMappingConfidence: null,
    maxSustainableCpa: campagna.maxSustainableCpa ?? null,
    dailyBudget: campagna.budgetGiornaliero ?? null,
    targetMargin: campagna.targetMargin ?? null,
    offer: campagna.frontEndOffer?.trim() || null,
    settore: campagna.settore?.trim() || null,
    audienceHint: audienceHintFromCampagna(campagna),
    hasCreativeAsset: hasCreativeFromCampagna(campagna),
    formatHint: formatHintFromCampagna(campagna),
  };

  return {
    eligibility,
    facts: buildDiagnosisFacts(input),
    aiPayload: buildDiagnosisAiPayload(input),
    healthAvailability: null,
  };
}

export async function loadMetaDiagnosisBundle(
  userId: string,
  metaCampaignUuid: string,
): Promise<LoadedDiagnosisBundle> {
  if (!isUuid(metaCampaignUuid)) {
    throw new DiagnosisLoadError("BAD_REQUEST", "campaignId non valido.");
  }

  const { data: camp, error } = await admin()
    .from("meta_campaigns")
    .select(
      "id, client_id, user_id, meta_campaign_id, name, effective_status, raw_objective, last_synced_at, insights_period_since, insights_period_until, insights_period_frequency, primary_kpi, target_value, affianco_campaign_id",
    )
    .eq("id", metaCampaignUuid)
    .maybeSingle();

  if (error) {
    throw new DiagnosisLoadError("CONFIG", "Lettura campagna Meta non riuscita.");
  }
  const campRow = camp as (MetaCampaignApiRow & { user_id: string }) | null;
  if (!campRow) {
    throw new DiagnosisLoadError("NOT_FOUND", "Campagna Meta non trovata.");
  }
  if (campRow.user_id !== userId) {
    throw new DiagnosisLoadError("FORBIDDEN", "Campagna Meta non autorizzata.");
  }

  const { data: insightData } = await admin()
    .from("meta_campaign_insights_daily")
    .select(
      "meta_campaign_id, date_start, date_stop, spend, impressions, link_clicks, primary_result_type, primary_results, result_mapping_confidence",
    )
    .eq("user_id", userId)
    .eq("meta_campaign_id", campRow.meta_campaign_id);

  type InsightRow = {
    meta_campaign_id: string;
    date_start: string;
    date_stop: string | null;
    spend: number | null;
    impressions: number | null;
    link_clicks: number | null;
    primary_result_type: string | null;
    primary_results: number | null;
    result_mapping_confidence: string | null;
  };

  const agg = {
    spend: 0,
    impressions: 0,
    linkClicks: 0,
    primaryResults: 0 as number | null,
    primaryResultType: null as string | null,
    resultMappingConfidence: "UNKNOWN" as ResultMappingConfidence,
  };
  const types = new Set<string>();
  let ambiguous = false;
  const daily: NormalizedDailyInsight[] = [];

  for (const ins of (insightData ?? []) as InsightRow[]) {
    agg.spend += ins.spend ?? 0;
    agg.impressions += ins.impressions ?? 0;
    agg.linkClicks += ins.link_clicks ?? 0;
    if (ins.result_mapping_confidence === "AMBIGUOUS") ambiguous = true;
    if (
      ins.result_mapping_confidence === "CONFIDENT" &&
      ins.primary_result_type
    ) {
      types.add(ins.primary_result_type);
      agg.primaryResults = (agg.primaryResults ?? 0) + (ins.primary_results ?? 0);
    }
    const day = emptyInsight(ins.date_start, ins.meta_campaign_id);
    day.dateStop = ins.date_stop ?? ins.date_start;
    day.spend = ins.spend;
    day.impressions = ins.impressions;
    day.linkClicks = ins.link_clicks;
    day.primaryResultType = ins.primary_result_type;
    day.primaryResults = ins.primary_results;
    day.resultMappingConfidence =
      ins.result_mapping_confidence === "CONFIDENT" ||
      ins.result_mapping_confidence === "AMBIGUOUS"
        ? ins.result_mapping_confidence
        : "UNKNOWN";
    daily.push(day);
  }

  if (ambiguous) {
    agg.resultMappingConfidence = "AMBIGUOUS";
    agg.primaryResultType = null;
    agg.primaryResults = null;
  } else if (types.size === 0) {
    agg.resultMappingConfidence = "UNKNOWN";
    agg.primaryResultType = null;
    agg.primaryResults = null;
  } else if (types.size > 1) {
    agg.resultMappingConfidence = "AMBIGUOUS";
    agg.primaryResultType = null;
    agg.primaryResults = null;
  } else {
    agg.resultMappingConfidence = "CONFIDENT";
    agg.primaryResultType = [...types][0] ?? null;
  }

  let linked: LinkedAffiancoCampaignSnapshot | null = null;
  let linkedPlan: {
    offer: string | null;
    settore: string | null;
    audienceHint: string | null;
    hasCreative: boolean;
    formatHint: string | null;
    dailyBudget: number | null;
  } | null = null;

  if (campRow.affianco_campaign_id) {
    const { data: native } = await admin()
      .from("campaigns")
      .select(
        "id, name, objective, status, max_sustainable_cpa, estimated_cpm, target_margin, booking_service_value, show_up_rate, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin, daily_budget, front_end_offer, settore, citta, raggio_km, eta_min, eta_max, creativita, user_id",
      )
      .eq("id", campRow.affianco_campaign_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (native) {
      const n = native as {
        id: string;
        name: string;
        objective: string | null;
        status: string | null;
        max_sustainable_cpa: number | null;
        estimated_cpm: number | null;
        target_margin: number | null;
        booking_service_value: number | null;
        show_up_rate: number | null;
        average_order_value: number | null;
        product_margin: number | null;
        average_receipt: number | null;
        store_margin: number | null;
        recovery_value: number | null;
        recovery_margin: number | null;
        daily_budget: number | null;
        front_end_offer: string | null;
        settore: string | null;
        citta: string | null;
        raggio_km: number | null;
        eta_min: number | null;
        eta_max: number | null;
        creativita: unknown;
        user_id: string;
      };
      linked = {
        id: n.id,
        name: n.name,
        objective: n.objective,
        status: n.status,
        maxSustainableCpa: n.max_sustainable_cpa,
        estimatedCpm: n.estimated_cpm,
        targetMargin: n.target_margin,
        bookingServiceValue: n.booking_service_value,
        showUpRate: n.show_up_rate,
        averageOrderValue: n.average_order_value,
        productMargin: n.product_margin,
        averageReceipt: n.average_receipt,
        storeMargin: n.store_margin,
        recoveryValue: n.recovery_value,
        recoveryMargin: n.recovery_margin,
      };
      const audienceParts: string[] = [];
      if (n.citta?.trim()) audienceParts.push(n.citta.trim());
      if (n.raggio_km != null) audienceParts.push(`raggio ${n.raggio_km} km`);
      const meta = parseCreativitaMeta(n.creativita);
      const first = Array.isArray(meta) ? meta[0] : meta;
      const fm = first as { width?: number; height?: number; storagePath?: string } | undefined;
      linkedPlan = {
        offer: n.front_end_offer?.trim() || null,
        settore: n.settore?.trim() || null,
        audienceHint: audienceParts.length ? audienceParts.join(", ") : null,
        hasCreative: Boolean(fm?.storagePath),
        formatHint:
          fm?.width && fm?.height ? `${fm.width}x${fm.height}` : null,
        dailyBudget: n.daily_budget,
      };
    }
  }

  const monitoring = mapMetaCampaignToMonitoringRow(
    campRow,
    {
      spend: agg.spend,
      impressions: agg.impressions,
      linkClicks: agg.linkClicks,
      primaryResults: agg.primaryResults,
      primaryResultType: agg.primaryResultType,
      resultMappingConfidence: agg.resultMappingConfidence,
    },
    "Cliente",
    linked,
  );

  const trendResult = computeMetaTrend(daily);
  const trendDirection: MetaTrendDirection | null =
    trendResult.primary?.direction ?? null;
  const trendLevel: MetaTrendLevel = trendResult.level;

  const item = buildMetaAttentionItem({
    row: monitoring,
    trendDirection,
    trendLevel,
  });

  const eligibility = resolveDiagnosisEligibility({
    attentionState: item.attentionState,
    health: item.healthStatus,
    campaignStatus: monitoring.effectiveStatus,
    healthAvailability: monitoring.healthAvailability,
    trend: item.trend,
  });

  const input: BuildDiagnosisContextInput = {
    source: "META",
    objective: monitoring.rawObjective,
    status: monitoring.effectiveStatus,
    monitoringMode:
      monitoring.mode === "HISTORICAL_REVIEW" ? "HISTORICAL" : "ACTIVE",
    health: item.healthStatus,
    attentionState: item.attentionState,
    urgencyLevel: item.urgencyLevel,
    attentionReason: item.reason,
    primaryKpi: item.primaryMetric,
    actualValue: item.primaryMetricValue,
    targetValue: item.targetValue,
    spend: monitoring.spend,
    impressions: monitoring.impressions,
    linkClicks: monitoring.linkClicks,
    ctr: monitoring.ctr,
    cpc: monitoring.cpc,
    cpm: monitoring.cpm,
    frequency: monitoring.frequency,
    results:
      agg.resultMappingConfidence === "CONFIDENT" ? agg.primaryResults : null,
    trend: item.trend,
    resultMappingConfidence: agg.resultMappingConfidence,
    maxSustainableCpa: linked?.maxSustainableCpa ?? null,
    dailyBudget: linkedPlan?.dailyBudget ?? null,
    targetMargin: linked?.targetMargin ?? null,
    offer: linkedPlan?.offer ?? null,
    settore: linkedPlan?.settore ?? null,
    audienceHint: linkedPlan?.audienceHint ?? null,
    hasCreativeAsset: linkedPlan?.hasCreative ?? false,
    formatHint: linkedPlan?.formatHint ?? null,
  };

  return {
    eligibility,
    facts: buildDiagnosisFacts(input),
    aiPayload: buildDiagnosisAiPayload(input),
    healthAvailability: monitoring.healthAvailability,
  };
}

export async function loadDiagnosisBundle(
  userId: string,
  source: DiagnosisSource,
  campaignId: string,
): Promise<LoadedDiagnosisBundle> {
  if (source === "NATIVE") {
    return loadNativeDiagnosisBundle(userId, campaignId);
  }
  if (source === "META") {
    return loadMetaDiagnosisBundle(userId, campaignId);
  }
  throw new DiagnosisLoadError("BAD_REQUEST", "source non valido.");
}
