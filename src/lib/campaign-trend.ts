/**
 * M0.4A — canonical campaign_checks history + trend evaluation.
 * Does not change health, diagnosis, confidence, or actions.
 *
 * Contextual metrics (non-awareness CPM, frequency, spend, results) never
 * use IMPROVING/WORSENING as quality. `direction` stays UNKNOWN; raw
 * up/down is `movement` (RISING/FALLING/STABLE/UNKNOWN).
 */

import type {
  CampaignCheck,
  CampaignCheckSource,
  CampaignCheckThresholdMode,
} from "@/lib/campaign-checks-db";
import {
  calcolaCostoDaSpesaRisultati,
  type HealthStatus,
} from "@/lib/control-room";
import { deriveFunnelMetrics } from "@/lib/funnel-metrics";
import {
  normalizzaObjective,
  type CampagnaObjective,
} from "@/types/campagne";

export type TrendDirection =
  | "IMPROVING"
  | "STABLE"
  | "WORSENING"
  | "UNKNOWN";

export type TrendLevel =
  | "INSUFFICIENT_TREND_DATA"
  | "ONE_PERIOD_CHANGE"
  | "CONSISTENT_TREND";

export type HistoricalMetricKey =
  | "primary"
  | "ctr"
  | "cpc"
  | "cpm"
  | "frequency"
  | "roas"
  | "spend"
  | "results"
  | "conversionRate";

export type MetricMovement = "RISING" | "FALLING" | "STABLE" | "UNKNOWN";

export type MetricPolarity =
  | "LOWER_IS_BETTER"
  | "HIGHER_IS_BETTER"
  | "CONTEXTUAL";

export type TrendAlignedPattern =
  | "AD_MESSAGE"
  | "DELIVERY"
  | "POST_CLICK"
  | "CREATIVE_FATIGUE"
  | "ECONOMICS"
  | "NONE";

export type TrendCap =
  | "SOURCE_CHANGE"
  | "THRESHOLD_CHANGE"
  | "UNEVEN_SPACING";

export interface MetricTrend {
  metric: HistoricalMetricKey;
  current: number | null;
  previous: number | null;
  earlier: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  /** Quality direction. CONTEXTUAL metrics are always UNKNOWN. */
  direction: TrendDirection;
  intervalsUsed: number;
  consistent: boolean;
  polarity: MetricPolarity;
  /** Raw movement. Use this for frequency / CPM-context / volume. */
  movement: MetricMovement;
}

export interface TrendEvaluation {
  level: TrendLevel;
  primary: MetricTrend;
  diagnostics: MetricTrend[];
  alignedPattern: TrendAlignedPattern;
  contradictions: string[];
  evidence: string[];
  caps: TrendCap[];
}

export type CanonicalHistoricalMetrics = {
  primary: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  roas: number | null;
  spend: number | null;
  results: number | null;
  conversionRate: number | null;
};

/** Same cap as `leggiChecksCampagna` default. */
export const TREND_HISTORY_LIMIT = 8;

const GENERIC_RELATIVE_STABLE = 0.05;
const FREQUENCY_RELATIVE_STABLE = 0.08;
const FREQUENCY_ABSOLUTE_STABLE = 0.15;
const CTR_RELATIVE_STABLE = 0.05;
const CTR_ABSOLUTE_STABLE = 0.1;
const THRESHOLD_CHANGE_RATIO = 0.1;
const UNEVEN_SPACING_DAYS = 10;

function finiteNum(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n;
}

export function chiaveGiornataLocale(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inizioGiornataLocale(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function differenzaGiorniLocali(
  fromIso: string,
  toIso: string,
): number | null {
  const a = inizioGiornataLocale(fromIso);
  const b = inizioGiornataLocale(toIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function snapshotObiettivoCompatibile(
  snapshot: string | null | undefined,
  current: CampagnaObjective,
): boolean {
  const trimmed = snapshot?.trim();
  if (!trimmed) return true;
  return normalizzaObjective(trimmed) === current;
}

function createdAtMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Oldest → newest, one check per local day (latest created_at),
 * same objective as current (null snapshot = current), max 8.
 */
export function normalizeCampaignCheckHistory(
  checks: CampaignCheck[],
  currentObjective: CampagnaObjective,
  maxRecords = TREND_HISTORY_LIMIT,
): CampaignCheck[] {
  const byDay = new Map<string, CampaignCheck>();
  for (const check of checks) {
    const day = chiaveGiornataLocale(check.createdAt);
    if (!day) continue;
    const prev = byDay.get(day);
    if (!prev || createdAtMs(check.createdAt) >= createdAtMs(prev.createdAt)) {
      byDay.set(day, check);
    }
  }

  const segmented = [...byDay.values()].filter((check) =>
    snapshotObiettivoCompatibile(check.objective, currentObjective),
  );

  segmented.sort(
    (a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt),
  );

  if (segmented.length <= maxRecords) return segmented;
  return segmented.slice(segmented.length - maxRecords);
}

export function canonicalHistoricalMetrics(
  check: CampaignCheck,
  objective: CampagnaObjective,
): CanonicalHistoricalMetrics {
  const awareness = objective === "AWARENESS";
  const fromSpendResults = calcolaCostoDaSpesaRisultati(
    check.spend,
    check.resultsCount,
  );
  const primary = awareness
    ? (finiteNum(check.primaryCost) ?? finiteNum(check.cpm))
    : (finiteNum(check.primaryCost) ?? fromSpendResults);

  const funnel = deriveFunnelMetrics({
    spend: check.spend,
    results: check.resultsCount,
    clicks: check.clicks,
    impressions: check.impressions,
    manualCtr: check.ctr,
    manualCpc: check.cpc,
    manualCpm: check.cpm,
  });

  const roasApplicable =
    objective === "ECOMMERCE" || objective === "RETARGETING";

  return {
    primary,
    ctr: funnel.ctr,
    cpc: funnel.cpc,
    cpm: funnel.cpm,
    frequency: finiteNum(check.frequency),
    roas: roasApplicable ? finiteNum(check.roas) : null,
    spend: finiteNum(check.spend),
    results: finiteNum(check.resultsCount),
    conversionRate: awareness ? null : funnel.conversionRate,
  };
}

function polarityFor(
  metric: HistoricalMetricKey,
  objective: CampagnaObjective,
): MetricPolarity {
  if (metric === "primary") return "LOWER_IS_BETTER";
  if (metric === "cpc") return "LOWER_IS_BETTER";
  if (metric === "cpm") {
    return objective === "AWARENESS" ? "LOWER_IS_BETTER" : "CONTEXTUAL";
  }
  if (metric === "ctr" || metric === "roas" || metric === "conversionRate") {
    return "HIGHER_IS_BETTER";
  }
  return "CONTEXTUAL";
}

function readCanonical(
  metrics: CanonicalHistoricalMetrics,
  metric: HistoricalMetricKey,
): number | null {
  return metrics[metric];
}

function deltaPercentOf(previous: number, current: number): number | null {
  if (previous === 0) return null;
  const pct = (current - previous) / previous;
  return Number.isFinite(pct) ? pct : null;
}

function isStableMovement(
  metric: HistoricalMetricKey,
  deltaAbsolute: number,
  deltaPercent: number | null,
): boolean {
  if (deltaAbsolute === 0) return true;
  if (metric === "frequency") {
    const relOk =
      deltaPercent != null && Math.abs(deltaPercent) < FREQUENCY_RELATIVE_STABLE;
    const absOk = Math.abs(deltaAbsolute) < FREQUENCY_ABSOLUTE_STABLE;
    return relOk || absOk;
  }
  if (metric === "ctr") {
    return (
      deltaPercent != null &&
      Math.abs(deltaPercent) < CTR_RELATIVE_STABLE &&
      Math.abs(deltaAbsolute) < CTR_ABSOLUTE_STABLE
    );
  }
  return (
    deltaPercent != null && Math.abs(deltaPercent) < GENERIC_RELATIVE_STABLE
  );
}

function movementFromDelta(
  metric: HistoricalMetricKey,
  previous: number | null,
  current: number | null,
): {
  movement: MetricMovement;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
} {
  if (previous == null || current == null) {
    return { movement: "UNKNOWN", deltaAbsolute: null, deltaPercent: null };
  }
  const deltaAbsolute = current - previous;
  if (!Number.isFinite(deltaAbsolute)) {
    return { movement: "UNKNOWN", deltaAbsolute: null, deltaPercent: null };
  }
  const deltaPercent = deltaPercentOf(previous, current);
  if (isStableMovement(metric, deltaAbsolute, deltaPercent)) {
    return { movement: "STABLE", deltaAbsolute, deltaPercent };
  }
  if (deltaPercent == null && metric !== "frequency") {
    return { movement: "UNKNOWN", deltaAbsolute, deltaPercent };
  }
  if (deltaAbsolute > 0) {
    return { movement: "RISING", deltaAbsolute, deltaPercent };
  }
  if (deltaAbsolute < 0) {
    return { movement: "FALLING", deltaAbsolute, deltaPercent };
  }
  return { movement: "STABLE", deltaAbsolute, deltaPercent };
}

function qualityDirection(
  polarity: MetricPolarity,
  movement: MetricMovement,
): TrendDirection {
  if (movement === "STABLE") return "STABLE";
  if (movement === "UNKNOWN") return "UNKNOWN";
  if (polarity === "CONTEXTUAL") return "UNKNOWN";
  if (polarity === "LOWER_IS_BETTER") {
    return movement === "FALLING" ? "IMPROVING" : "WORSENING";
  }
  return movement === "RISING" ? "IMPROVING" : "WORSENING";
}

function emptyMetricTrend(
  metric: HistoricalMetricKey,
  polarity: MetricPolarity,
): MetricTrend {
  return {
    metric,
    current: null,
    previous: null,
    earlier: null,
    deltaAbsolute: null,
    deltaPercent: null,
    direction: "UNKNOWN",
    intervalsUsed: 0,
    consistent: false,
    polarity,
    movement: "UNKNOWN",
  };
}

type Point = { value: number; check: CampaignCheck };

function buildMetricTrend(
  metric: HistoricalMetricKey,
  points: Point[],
  objective: CampagnaObjective,
): MetricTrend {
  const polarity = polarityFor(metric, objective);
  if (points.length === 0) return emptyMetricTrend(metric, polarity);

  const current = points[points.length - 1]?.value ?? null;
  const previous = points.length >= 2 ? (points[points.length - 2]?.value ?? null) : null;
  const earlier = points.length >= 3 ? (points[points.length - 3]?.value ?? null) : null;

  const latest = movementFromDelta(metric, previous, current);
  const direction = qualityDirection(polarity, latest.movement);

  const intervalDirections: TrendDirection[] = [];
  const intervalMovements: MetricMovement[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    const step = movementFromDelta(metric, prev.value, curr.value);
    intervalMovements.push(step.movement);
    intervalDirections.push(qualityDirection(polarity, step.movement));
  }

  const intervalsUsed = intervalDirections.length;
  let consistent = false;
  if (points.length >= 3 && intervalDirections.length >= 2) {
    const last = intervalDirections[intervalDirections.length - 1];
    const prevDir = intervalDirections[intervalDirections.length - 2];
    const lastMove = intervalMovements[intervalMovements.length - 1];
    const prevMove = intervalMovements[intervalMovements.length - 2];
    if (polarity === "CONTEXTUAL") {
      consistent =
        lastMove === prevMove &&
        (lastMove === "RISING" || lastMove === "FALLING");
    } else {
      consistent =
        last === prevDir &&
        (last === "IMPROVING" || last === "WORSENING");
    }
  }

  return {
    metric,
    current,
    previous,
    earlier,
    deltaAbsolute: latest.deltaAbsolute,
    deltaPercent: latest.deltaPercent,
    direction,
    intervalsUsed,
    consistent,
    polarity,
    movement: latest.movement,
  };
}

function pointsForMetric(
  series: CampaignCheck[],
  objective: CampagnaObjective,
  metric: HistoricalMetricKey,
): Point[] {
  const points: Point[] = [];
  for (const check of series) {
    const value = readCanonical(
      canonicalHistoricalMetrics(check, objective),
      metric,
    );
    if (value == null) continue;
    points.push({ value, check });
  }
  return points;
}

function sourcesDiffer(
  a: CampaignCheckSource,
  b: CampaignCheckSource,
): boolean {
  return a !== b;
}

function formatEvidenceValue(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "n/d";
  return String(n);
}

/**
 * Trend from stored checks. `alignedPattern` is always NONE in M0.4A.
 */
export function evaluateTrend(
  checks: CampaignCheck[],
  currentObjective: CampagnaObjective,
): TrendEvaluation {
  const series = normalizeCampaignCheckHistory(checks, currentObjective);
  const evidence: string[] = [];
  const contradictions: string[] = [];
  const caps: TrendCap[] = [];

  const primaryPoints = pointsForMetric(series, currentObjective, "primary");
  const primary = buildMetricTrend("primary", primaryPoints, currentObjective);

  let level: TrendLevel;
  if (primaryPoints.length <= 1) {
    level = "INSUFFICIENT_TREND_DATA";
  } else if (primaryPoints.length === 2) {
    level = "ONE_PERIOD_CHANGE";
  } else if (primary.consistent) {
    level = "CONSISTENT_TREND";
  } else {
    level = "ONE_PERIOD_CHANGE";
  }

  if (primaryPoints.length >= 2) {
    const newer = primaryPoints[primaryPoints.length - 1];
    const older = primaryPoints[primaryPoints.length - 2];
    if (newer && older && sourcesDiffer(older.check.source, newer.check.source)) {
      caps.push("SOURCE_CHANGE");
      evidence.push("fonte dati cambiata tra gli ultimi due controlli");
    }
    const prevTh = finiteNum(older?.check.threshold);
    const currTh = finiteNum(newer?.check.threshold);
    if (
      older &&
      newer &&
      prevTh != null &&
      currTh != null &&
      prevTh > 0 &&
      Math.abs((currTh - prevTh) / prevTh) >= THRESHOLD_CHANGE_RATIO
    ) {
      caps.push("THRESHOLD_CHANGE");
      evidence.push("la soglia di riferimento è cambiata");
    }
  }

  for (let i = 1; i < primaryPoints.length; i++) {
    const from = primaryPoints[i - 1];
    const to = primaryPoints[i];
    if (!from || !to) continue;
    const days = differenzaGiorniLocali(from.check.createdAt, to.check.createdAt);
    if (days != null && days > UNEVEN_SPACING_DAYS) {
      if (!caps.includes("UNEVEN_SPACING")) {
        caps.push("UNEVEN_SPACING");
        evidence.push("i controlli non sono a distanza regolare");
      }
    }
  }

  evidence.push(`${primaryPoints.length} valori primary utilizzabili`);
  if (primaryPoints.length >= 2) {
    evidence.push(
      `primary ${formatEvidenceValue(primary.previous)} → ${formatEvidenceValue(primary.current)}`,
    );
  }
  if (
    primaryPoints.length >= 3 &&
    !primary.consistent &&
    primary.direction !== "STABLE"
  ) {
    evidence.push("andamento primary non coerente su più intervalli");
  }

  const diagnosticKeys: HistoricalMetricKey[] = [
    "ctr",
    "cpc",
    ...(currentObjective === "AWARENESS" ? [] : (["cpm"] as const)),
    "frequency",
    ...(currentObjective === "ECOMMERCE" || currentObjective === "RETARGETING"
      ? (["roas"] as const)
      : []),
    "spend",
    "results",
    ...(currentObjective === "AWARENESS" ? [] : (["conversionRate"] as const)),
  ];

  const diagnostics = diagnosticKeys.map((metric) =>
    buildMetricTrend(
      metric,
      pointsForMetric(series, currentObjective, metric),
      currentObjective,
    ),
  );

  return {
    level,
    primary,
    diagnostics,
    alignedPattern: "NONE",
    contradictions,
    evidence,
    caps,
  };
}

export function metricaDiagnostica(
  evaluation: TrendEvaluation,
  metric: HistoricalMetricKey,
): MetricTrend | undefined {
  if (metric === "primary") return evaluation.primary;
  return evaluation.diagnostics.find((item) => item.metric === metric);
}

export function snapshotCheckLive(input: {
  campaignId: string;
  daysActive: number | null;
  spend: number | null;
  resultsCount: number | null;
  primaryCost: number | null;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  frequency: number | null;
  roas: number | null;
  clicks: number | null;
  impressions: number | null;
  healthStatus: HealthStatus;
  objective: string | null;
  threshold: number | null;
  thresholdMode: CampaignCheckThresholdMode | null;
  source: CampaignCheckSource;
}): CampaignCheck {
  return {
    id: "live-current",
    campaignId: input.campaignId,
    userId: "",
    createdAt: new Date().toISOString(),
    daysActive: input.daysActive,
    spend: input.spend,
    resultsCount: input.resultsCount,
    primaryCost: input.primaryCost,
    ctr: input.ctr,
    cpm: input.cpm,
    cpc: input.cpc,
    frequency: input.frequency,
    roas: input.roas,
    clicks: input.clicks,
    impressions: input.impressions,
    healthStatus: input.healthStatus,
    signal: null,
    actions: [],
    note: null,
    objective: input.objective,
    threshold: input.threshold,
    thresholdMode: input.thresholdMode,
    source: input.source,
  };
}

/** Live form is a point only if no check exists for the local day. */
export function trendPerLiveCheck(
  saved: CampaignCheck[],
  live: CampaignCheck,
  giaSalvatoOggi: boolean,
  objective: CampagnaObjective,
): TrendEvaluation {
  if (giaSalvatoOggi) {
    return evaluateTrend(saved, objective);
  }
  return evaluateTrend([live, ...saved], objective);
}

export function direzionePrimaryTraDue(
  precedente: CampaignCheck,
  attuale: CampaignCheck,
  objective: CampagnaObjective,
): TrendDirection {
  return evaluateTrend([precedente, attuale], objective).primary.direction;
}

export function etichettaDirezioneRiga(direction: TrendDirection): string {
  if (direction === "IMPROVING") return "Migliora";
  if (direction === "WORSENING") return "Peggiora";
  if (direction === "STABLE") return "Stabile";
  return "—";
}

export function etichettaLivelloTrend(level: TrendLevel): string {
  if (level === "INSUFFICIENT_TREND_DATA") return "Storico ancora insufficiente";
  if (level === "ONE_PERIOD_CHANGE") {
    return "Variazione rispetto all'ultimo controllo";
  }
  return "Andamento coerente su più controlli";
}

export function testiCapTrend(caps: TrendCap[]): string[] {
  const lines: string[] = [];
  if (caps.includes("SOURCE_CHANGE")) {
    lines.push("Fonte dati cambiata tra gli ultimi controlli.");
  }
  if (caps.includes("THRESHOLD_CHANGE")) {
    lines.push("La soglia di riferimento è cambiata.");
  }
  if (caps.includes("UNEVEN_SPACING")) {
    lines.push("I controlli non sono a distanza regolare.");
  }
  return lines;
}

const CAP_EVIDENCE_MARKERS = [
  "Fonte dati cambiata",
  "soglia economica è cambiata",
  "soglia di riferimento è cambiata",
  "non sono a distanza regolare",
];

export function evidenzeDiagnosiBrevi(evidence: string[], max = 3): string[] {
  return evidence
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      return !CAP_EVIDENCE_MARKERS.some((m) => t.includes(m));
    })
    .slice(0, max);
}

export function testoAndamentoDiagnosi(
  trend: TrendEvaluation | null | undefined,
  trendSummary: string | undefined,
): string {
  const summary = trendSummary?.trim();
  if (summary) return summary;
  if (!trend) return "Storico ancora insufficiente";
  return etichettaLivelloTrend(trend.level);
}
