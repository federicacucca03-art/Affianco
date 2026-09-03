/**
 * M6A — Monday Control Room attention model (deterministic, no LLM).
 *
 * Answers: "Where should I look first?"
 * Does not answer: "What should I do?"
 *
 * Health ≠ priority. No campaign_checks writes. No Meta writes.
 */

import type { Campagna } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";
import type { CampaignCheck } from "@/lib/campaign-checks-db";
import type { HealthStatus } from "@/lib/control-room";
import { formatEuro } from "@/lib/control-room";
import {
  evaluateTrend,
  type TrendDirection,
  type TrendLevel,
} from "@/lib/campaign-trend";
import type { MetaCampaignMonitoringRow } from "@/lib/meta/meta-campaign-monitoring-row";
import type { MetaTrendDirection, MetaTrendLevel } from "@/lib/meta/meta-trend";
import { kpiLabel } from "@/lib/meta/insights-control-room";

function nomeCampagnaCard(campagna: Campagna): string {
  const nome = (campagna.nomeCampagna ?? "").trim();
  const cliente = (campagna.nomeCliente ?? "").trim();
  if (!nome || nome === cliente) {
    const objective = normalizzaObjective(campagna.objective);
    if (objective === "AWARENESS") return "Campagna awareness";
    if (objective === "BOOKINGS") return "Campagna prenotazioni";
    if (objective === "ECOMMERCE") return "Campagna e-commerce";
    if (objective === "IN_STORE") return "Campagna negozio";
    if (objective === "RETARGETING") return "Campagna retargeting";
    return "Campagna lead";
  }
  return nome;
}

export type AttentionState =
  | "CRITICAL"
  | "NEEDS_ATTENTION"
  | "MONITOR"
  | "STABLE"
  | "CONFIGURATION_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "HISTORICAL";

export type AttentionSource = "NATIVE" | "META";

export type AttentionTrend =
  | "IMPROVING"
  | "WORSENING"
  | "STABLE"
  | "UNKNOWN"
  | "INSUFFICIENT";

export type ControlRoomAttentionItem = {
  campaignId: string;
  clientId: string | null;
  clientName: string;
  campaignName: string;
  source: AttentionSource;
  campaignStatus: string | null;
  attentionState: AttentionState;
  reason: string;
  primaryMetric: string | null;
  primaryMetricValue: number | null;
  targetValue: number | null;
  trend: AttentionTrend;
  lastUpdated: string | null;
  href: string;
  /** Health status when evaluable — distinct from attentionState. */
  healthStatus: HealthStatus | null;
  /** True when this row was suppressed as secondary of a linked pair. */
  suppressedByLink: boolean;
};

export type MondayControlRoomSummary = {
  items: ControlRoomAttentionItem[];
  urgent: ControlRoomAttentionItem[];
  stable: ControlRoomAttentionItem[];
  historical: ControlRoomAttentionItem[];
  counts: Record<AttentionState, number>;
};

/** Deterministic display order for "Da controllare" (lower = first). */
export const ATTENTION_ORDER: Record<AttentionState, number> = {
  CRITICAL: 0,
  NEEDS_ATTENTION: 1,
  CONFIGURATION_REQUIRED: 2,
  MONITOR: 3,
  INSUFFICIENT_DATA: 4,
  STABLE: 5,
  HISTORICAL: 6,
};

export const URGENT_STATES: ReadonlySet<AttentionState> = new Set([
  "CRITICAL",
  "NEEDS_ATTENTION",
  "CONFIGURATION_REQUIRED",
  "MONITOR",
  "INSUFFICIENT_DATA",
]);

export function etichettaAttentionState(state: AttentionState): string {
  switch (state) {
    case "CRITICAL":
      return "Critica";
    case "NEEDS_ATTENTION":
      return "Da controllare";
    case "MONITOR":
      return "Da monitorare";
    case "STABLE":
      return "Stabile";
    case "CONFIGURATION_REQUIRED":
      return "Da configurare";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    case "HISTORICAL":
      return "Storico";
  }
}

export function etichettaAttentionSource(source: AttentionSource): string {
  return source === "META" ? "Meta" : "Affianco";
}

export function etichettaPriorityBand(state: AttentionState): string | null {
  switch (state) {
    case "CRITICAL":
      return "Alta priorità";
    case "NEEDS_ATTENTION":
      return "Priorità";
    case "CONFIGURATION_REQUIRED":
      return "Configurazione";
    case "MONITOR":
      return "Monitoraggio";
    default:
      return null;
  }
}

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

function normalizeNativeTrend(
  direction: TrendDirection | null | undefined,
  level: TrendLevel | null | undefined,
): AttentionTrend {
  if (!level || level === "INSUFFICIENT_TREND_DATA") return "INSUFFICIENT";
  if (!direction || direction === "UNKNOWN") return "UNKNOWN";
  if (direction === "IMPROVING") return "IMPROVING";
  if (direction === "WORSENING") return "WORSENING";
  return "STABLE";
}

function normalizeMetaTrend(
  direction: MetaTrendDirection | null | undefined,
  level: MetaTrendLevel | null | undefined,
): AttentionTrend {
  if (!level || level === "INSUFFICIENT_TREND_DATA") return "INSUFFICIENT";
  if (!direction) return "UNKNOWN";
  if (direction === "IMPROVING") return "IMPROVING";
  if (direction === "WORSENING") return "WORSENING";
  return "STABLE";
}

/**
 * Core priority matrix. Health alone never implies CRITICAL without
 * evaluable worsening trend + enough confidence.
 */
export function resolveAttentionFromSignals(input: {
  historical: boolean;
  configurationRequired: boolean;
  configurationReason?: string;
  insufficientData: boolean;
  insufficientReason?: string;
  health: HealthStatus | null;
  trend: AttentionTrend;
}): { state: AttentionState; reason: string } {
  if (input.historical) {
    return {
      state: "HISTORICAL",
      reason: "Campagna in pausa — revisione storica.",
    };
  }
  if (input.configurationRequired) {
    return {
      state: "CONFIGURATION_REQUIRED",
      reason:
        input.configurationReason ??
        "Manca un target per valutare la performance.",
    };
  }
  if (input.insufficientData || input.health === "INSUFFICIENT") {
    return {
      state: "INSUFFICIENT_DATA",
      reason:
        input.insufficientReason ?? "I dati sono ancora insufficienti.",
    };
  }

  const health = input.health;
  const trend = input.trend;
  const trendKnown =
    trend === "IMPROVING" || trend === "WORSENING" || trend === "STABLE";

  if (health === "RED" && trend === "WORSENING" && trendKnown) {
    return {
      state: "CRITICAL",
      reason: "Il costo è sopra soglia e sta peggiorando.",
    };
  }
  if (health === "RED") {
    return {
      state: "NEEDS_ATTENTION",
      reason: "Il costo per risultato è sopra la soglia.",
    };
  }
  if (health === "YELLOW" && trend === "WORSENING") {
    return {
      state: "NEEDS_ATTENTION",
      reason: "Il costo è vicino alla soglia e sta peggiorando.",
    };
  }
  if (health === "YELLOW") {
    return {
      state: "MONITOR",
      reason: "Il costo è vicino alla soglia — da tenere sotto controllo.",
    };
  }
  if (health === "GREEN" && (trend === "STABLE" || trend === "IMPROVING")) {
    return {
      state: "STABLE",
      reason: "Performance stabile rispetto al target.",
    };
  }
  if (health === "GREEN" && (trend === "INSUFFICIENT" || trend === "UNKNOWN")) {
    return {
      state: "MONITOR",
      reason: "Sotto soglia, ma lo storico è ancora limitato.",
    };
  }
  if (health === "GREEN" && trend === "WORSENING") {
    return {
      state: "MONITOR",
      reason: "Ancora sotto soglia, ma l'andamento sta peggiorando.",
    };
  }

  // No health yet (should usually be caught by configuration/insufficient).
  return {
    state: "CONFIGURATION_REQUIRED",
    reason: "Manca un target per valutare la performance.",
  };
}

export function buildNativeAttentionItem(input: {
  campagna: Campagna;
  check: CampaignCheck | null;
  checksForTrend?: CampaignCheck[];
}): ControlRoomAttentionItem {
  const campagna = input.campagna;
  const check = input.check;
  const status = statusUpper(campagna.status);
  const objective = normalizzaObjective(campagna.objective);

  let trend: AttentionTrend = "UNKNOWN";
  if (input.checksForTrend && input.checksForTrend.length > 0) {
    const evaluation = evaluateTrend(input.checksForTrend, objective);
    trend = normalizeNativeTrend(
      evaluation.primary.direction,
      evaluation.level,
    );
  } else if (!check) {
    trend = "INSUFFICIENT";
  }

  let configurationRequired = false;
  let configurationReason: string | undefined;
  let insufficientData = false;
  let insufficientReason: string | undefined;
  let historical = false;
  let health: HealthStatus | null = check?.healthStatus ?? null;

  if (status === "DRAFT" || !status) {
    configurationRequired = true;
    configurationReason = "La campagna è ancora in bozza.";
    health = null;
  } else if (status === "REVISION_REQUESTED") {
    // Client revision is operational work, not a health failure.
    return {
      campaignId: campagna.id,
      clientId: null,
      clientName: campagna.nomeCliente,
      campaignName: nomeCampagnaCard(campagna),
      source: "NATIVE",
      campaignStatus: campagna.status ?? null,
      attentionState: "NEEDS_ATTENTION",
      reason: "Il cliente ha richiesto una revisione.",
      primaryMetric: check?.primaryCost != null ? "Costo" : null,
      primaryMetricValue: check?.primaryCost ?? null,
      targetValue: check?.threshold ?? null,
      trend,
      lastUpdated: check?.createdAt ?? null,
      href: `/campagne/${campagna.id}`,
      healthStatus: health,
      suppressedByLink: false,
    };
  } else if (!check) {
    configurationRequired = true;
    configurationReason =
      "Mancano i risultati per valutare la performance.";
  } else if (check.healthStatus === "INSUFFICIENT") {
    insufficientData = true;
    insufficientReason = "I dati sono ancora insufficienti.";
  }

  const resolved = resolveAttentionFromSignals({
    historical,
    configurationRequired,
    configurationReason,
    insufficientData,
    insufficientReason,
    health: configurationRequired ? null : health,
    trend,
  });

  return {
    campaignId: campagna.id,
    clientId: null,
    clientName: campagna.nomeCliente,
    campaignName: nomeCampagnaCard(campagna),
    source: "NATIVE",
    campaignStatus: campagna.status ?? null,
    attentionState: resolved.state,
    reason: resolved.reason,
    primaryMetric:
      check?.primaryCost != null
        ? objective === "AWARENESS"
          ? "CPM"
          : "Costo"
        : null,
    primaryMetricValue: check?.primaryCost ?? null,
    targetValue: check?.threshold ?? null,
    trend,
    lastUpdated: check?.createdAt ?? null,
    href: `/risultati?campaignId=${encodeURIComponent(campagna.id)}`,
    healthStatus: configurationRequired ? null : health,
    suppressedByLink: false,
  };
}

export function buildMetaAttentionItem(input: {
  row: MetaCampaignMonitoringRow;
  trendDirection?: MetaTrendDirection | null;
  trendLevel?: MetaTrendLevel | null;
}): ControlRoomAttentionItem {
  const row = input.row;
  const trend = normalizeMetaTrend(input.trendDirection, input.trendLevel);
  const historical = row.mode === "HISTORICAL_REVIEW";

  // Paused/archived Meta campaigns are historical review only — never urgent.
  if (historical) {
    return {
      campaignId: row.id,
      clientId: row.clientId,
      clientName: row.clientName,
      campaignName: row.name,
      source: "META",
      campaignStatus: row.effectiveStatus,
      attentionState: "HISTORICAL",
      reason: "Campagna in pausa — revisione storica.",
      primaryMetric: row.primaryKpi ? kpiLabel(row.primaryKpi) : null,
      primaryMetricValue:
        row.primaryKpi === "CPC"
          ? row.cpc
          : row.primaryKpi === "CPM"
            ? row.cpm
            : null,
      targetValue: row.targetValue,
      trend,
      lastUpdated: row.lastSyncedAt,
      href: "/risultati",
      healthStatus: null,
      suppressedByLink: false,
    };
  }

  let configurationRequired = false;
  let configurationReason: string | undefined;
  let insufficientData = false;
  let insufficientReason: string | undefined;
  let health: HealthStatus | null = row.healthStatus;

  switch (row.healthAvailability) {
    case "TARGET_REQUIRED":
      configurationRequired = true;
      configurationReason =
        "Manca un target per valutare la performance.";
      health = null;
      break;
    case "LINKED_BUT_KPI_INCOMPATIBLE":
      configurationRequired = true;
      configurationReason =
        "Il KPI pianificato non è compatibile con i risultati Meta disponibili.";
      health = null;
      break;
    case "RESULT_MAPPING_REQUIRED":
      configurationRequired = true;
      configurationReason =
        "Il risultato principale Meta non è identificato con sufficiente certezza.";
      health = null;
      break;
    case "ROAS_DEFERRED":
      configurationRequired = true;
      configurationReason = "Il ROAS non è ancora valutabile in Control Room.";
      health = null;
      break;
    case "INSUFFICIENT_DATA":
      insufficientData = true;
      insufficientReason = "I dati sono ancora insufficienti.";
      health = null;
      break;
    case "AVAILABLE":
      break;
  }

  // Fundamentals beat trend: no target + worsening still CONFIGURATION_REQUIRED.
  const resolved = resolveAttentionFromSignals({
    historical: false,
    configurationRequired,
    configurationReason,
    insufficientData,
    insufficientReason,
    health: configurationRequired || insufficientData ? null : health,
    trend,
  });

  const metricValue =
    row.primaryKpi === "CPC"
      ? row.cpc
      : row.primaryKpi === "CPM"
        ? row.cpm
        : null;

  return {
    campaignId: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    campaignName: row.name,
    source: "META",
    campaignStatus: row.effectiveStatus,
    attentionState: resolved.state,
    reason: resolved.reason,
    primaryMetric: row.primaryKpi ? kpiLabel(row.primaryKpi) : null,
    primaryMetricValue: metricValue,
    targetValue: row.targetValue,
    trend,
    lastUpdated: row.lastSyncedAt,
    href: "/risultati",
    healthStatus:
      resolved.state === "CONFIGURATION_REQUIRED" ? null : health,
    suppressedByLink: false,
  };
}

/**
 * Linked Meta + native: keep separate underlying items, but suppress the
 * native row from Monday urgent/stable lists when Meta is the active
 * monitoring surface. Never merge metrics/health.
 */
/**
 * Caller passes native Affianco ids that have ≥1 ACTIVE linked Meta row.
 * Those native rows stay in the dataset but are hidden from Monday lists
 * (no silent metric merge).
 */
export function applyLinkedCampaignSuppression(
  items: ControlRoomAttentionItem[],
  linkedNativeIds: ReadonlySet<string>,
): ControlRoomAttentionItem[] {
  return items.map((item) => {
    if (item.source !== "NATIVE") return item;
    if (!linkedNativeIds.has(item.campaignId)) return item;
    return {
      ...item,
      suppressedByLink: true,
    };
  });
}

export function collectActiveLinkedNativeIds(
  metaRows: MetaCampaignMonitoringRow[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of metaRows) {
    if (
      row.linkState === "LINKED" &&
      row.mode === "ACTIVE_MONITORING" &&
      row.linkedCampaignId
    ) {
      ids.add(row.linkedCampaignId);
    }
  }
  return ids;
}

export function sortAttentionItems(
  items: ControlRoomAttentionItem[],
): ControlRoomAttentionItem[] {
  return [...items].sort((a, b) => {
    const oa = ATTENTION_ORDER[a.attentionState];
    const ob = ATTENTION_ORDER[b.attentionState];
    if (oa !== ob) return oa - ob;
    const da = a.lastUpdated ?? "";
    const db = b.lastUpdated ?? "";
    if (da && db && da !== db) return db.localeCompare(da);
    const client = a.clientName.localeCompare(b.clientName, "it");
    if (client !== 0) return client;
    return a.campaignName.localeCompare(b.campaignName, "it");
  });
}

export function buildMondayControlRoom(
  items: ControlRoomAttentionItem[],
): MondayControlRoomSummary {
  const visible = sortAttentionItems(
    items.filter((i) => !i.suppressedByLink),
  );
  const counts: Record<AttentionState, number> = {
    CRITICAL: 0,
    NEEDS_ATTENTION: 0,
    MONITOR: 0,
    STABLE: 0,
    CONFIGURATION_REQUIRED: 0,
    INSUFFICIENT_DATA: 0,
    HISTORICAL: 0,
  };
  for (const item of visible) {
    counts[item.attentionState] += 1;
  }
  return {
    items: visible,
    urgent: visible.filter((i) => URGENT_STATES.has(i.attentionState)),
    stable: visible.filter((i) => i.attentionState === "STABLE"),
    historical: visible.filter((i) => i.attentionState === "HISTORICAL"),
    counts,
  };
}

export function formatAttentionMetric(
  item: ControlRoomAttentionItem,
): string | null {
  if (item.primaryMetricValue == null || !item.primaryMetric) return null;
  const value =
    item.primaryMetric === "ROAS"
      ? `${item.primaryMetricValue.toFixed(2)}x`
      : formatEuro(item.primaryMetricValue);
  if (item.targetValue != null && item.primaryMetric !== "ROAS") {
    return `${item.primaryMetric} ${value} / soglia ${formatEuro(item.targetValue)}`;
  }
  return `${item.primaryMetric} ${value}`;
}
