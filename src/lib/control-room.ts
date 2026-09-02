/**
 * Control Room post-lancio — logica deterministica (stato economico, diagnosi, azioni).
 * Lo stato GREEN/YELLOW/RED non viene mai deciso dall'AI.
 */

import type { Campagna, CampagnaObjective } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";

export type HealthStatus = "GREEN" | "YELLOW" | "RED" | "INSUFFICIENT";

/** economic = soglia break-even/sostenibile; efficiency = CPM pianificato (AWARENESS). */
export type HealthMode = "economic" | "efficiency";

export type ActionPriority = "alta" | "media" | "bassa";

export type RecommendedAction = {
  text: string;
  priority: ActionPriority;
};

export type DiagnosisSignal =
  | "creativita_messaggio"
  | "asta_audience"
  | "conversione_post_click"
  | "fatica_creativa"
  | "soglia_superata"
  | "sotto_soglia"
  | "vicino_soglia"
  | "dati_insufficienti"
  | "economics_roas";

export type PrimaryMetricType =
  | "CPL"
  | "CPA_BOOKING"
  | "CPA_PURCHASE"
  | "COST_PER_RESULT_PROXY"
  | "CPA_RETARGETING"
  | "CPM";

export type DiagnosisArea =
  | "ECONOMICS"
  | "AD_MESSAGE"
  | "DELIVERY"
  | "POST_CLICK"
  | "CREATIVE_FATIGUE"
  | "DATA_INSUFFICIENT"
  | "NO_CLEAR_SIGNAL";

export type DiagnosisConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MetricCompleteness = "MINIMUM" | "INTERMEDIATE" | "FULL";

export type PrimaryOutcome = {
  metricType: PrimaryMetricType;
  label: string;
  actual: number | null;
  threshold: number | null;
  thresholdMode: HealthMode;
  lowerIsBetter: true;
};

export type ControlRoomKpis = {
  spend: number | null;
  results: number | null;
  /** Costo per risultato (CPL/CPA) — può essere calcolato da spend/results. */
  costPerResult: number | null;
  /** CTR/CPC/CPM già canonici (derived preferred, manual fallback). */
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  frequency: number | null;
  roas: number | null;
  clicks: number | null;
  impressions: number | null;
  /** Runtime only: results/clicks × 100. Non persistito. */
  conversionRate: number | null;
};

export type EconomicContext = {
  objective: CampagnaObjective;
  metricType: PrimaryMetricType;
  metricLabel: string;
  /** Valore usato nel confronto semaforo (CPL/CPA oppure CPM per AWARENESS). */
  actual: number | null;
  threshold: number | null;
  /** true se threshold deriva da estimated_cpm (piano), non break-even. */
  thresholdIsPlannedReference: boolean;
  healthMode: HealthMode;
  dailyBudget: number | null;
  settore: string;
  targetMargin: number | null;
  /** ROAS atteso / break-even solo se presenti in campagna — mai inventati. */
  roasAttuale: number | null;
  roasBreakEvenHint: number | null;
};

export type HealthResult = {
  status: HealthStatus;
  label: string;
  explanation: string;
  deltaPercent: number | null;
  deltaLabel: string | null;
  mode: HealthMode;
  efficiencyNote?: string;
};

export type LimitedDataWarning = {
  show: boolean;
  message: string;
};

export type DiagnosisResult = {
  signal: DiagnosisSignal;
  title: string;
  body: string;
  canDiagnose: boolean;
  hint?: string;
  area: DiagnosisArea;
  confidence: DiagnosisConfidence;
  explanation: string;
  evidence: string[];
  completeness: MetricCompleteness;
  /** Plain-text trend sentence. Empty when diagnosis ran without history. */
  trendSummary: string;
  contradictions: string[];
};

export type DiagnosisOptions = {
  datiLimitati?: boolean;
  /** M0.4B: omit to keep M0.2/M0.3 cross-sectional diagnosis. */
  trend?: import("@/lib/campaign-trend").TrendEvaluation;
};

/**
 * CTR in percentuale numerica: 1.2 = 1.2% (non 0.012).
 * L'input manuale e la UI usano sempre questo formato.
 */
export const KPI_CTR_UNIT = "percent" as const;

/** Segnali iniziali secondari (non diagnosi primarie; non determinano lo health). */
export const DIAG_CTR_LOW = 0.9;
export const DIAG_CTR_GOOD = 1.2;
export const DIAG_FREQUENCY_HIGH = 2.5;
/** CPC oltre questa frazione della soglia costo → segnale asta/audience. */
export const DIAG_CPC_HIGH_RATIO = 0.35;

export function parseNum(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Input manuale KPI: già percentuale (0.5 → 0.5%, 1.2 → 1.2%). Nessuna ×100. */
export function parseCtrInput(raw: string): number | null {
  const n = parseNum(raw);
  if (n == null || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

/**
 * CTR da API/screenshot.
 * Il prompt chiede percentuale (1.2 = 1.2%). Se il provider restituisce una
 * frazione decimale chiara (0 < n < 0.1, es. 0.012), converti in percentuale.
 * Valori come 0.5 restano 0.5% (non vengono moltiplicati).
 */
export function normalizzaCtrDaApi(
  raw: string | number | null | undefined,
): number | null {
  const n = parseNum(raw);
  if (n == null || n < 0) return null;
  if (n > 0 && n < 0.1) {
    return Math.round(n * 10000) / 100;
  }
  return Math.round(n * 1000) / 1000;
}

export function calcolaCostoDaSpesaRisultati(
  spend: number | null,
  results: number | null,
): number | null {
  if (spend == null || results == null || results <= 0 || spend < 0) return null;
  return Math.round((spend / results) * 100) / 100;
}

export function primaryMetricTypeDaObjective(
  objective: CampagnaObjective,
): PrimaryMetricType {
  switch (objective) {
    case "BOOKINGS":
      return "CPA_BOOKING";
    case "ECOMMERCE":
      return "CPA_PURCHASE";
    case "IN_STORE":
      return "COST_PER_RESULT_PROXY";
    case "RETARGETING":
      return "CPA_RETARGETING";
    case "AWARENESS":
      return "CPM";
    default:
      return "CPL";
  }
}

export function etichettaMetricaPrimaria(objective: CampagnaObjective): string {
  switch (objective) {
    case "BOOKINGS":
      return "CPA prenotazione";
    case "ECOMMERCE":
      return "CPA";
    case "IN_STORE":
      return "Costo per risultato (proxy)";
    case "RETARGETING":
      return "Costo per risultato";
    case "AWARENESS":
      return "CPM";
    default:
      return "CPL";
  }
}

export function etichettaSogliaEconomica(objective: CampagnaObjective): string {
  switch (objective) {
    case "BOOKINGS":
      return "CPA massimo sostenibile";
    case "ECOMMERCE":
      return "CPA Max (Break-Even)";
    case "IN_STORE":
      return "Costo per risultato sostenibile";
    case "RETARGETING":
      return "Costo per risultato sostenibile";
    case "AWARENESS":
      return "CPM di piano";
    default:
      return "CPL massimo sostenibile";
  }
}

export function getPrimaryOutcome(
  objective: CampagnaObjective,
  kpis: ControlRoomKpis,
  threshold: number | null,
  healthMode: HealthMode,
): PrimaryOutcome {
  const actual =
    objective === "AWARENESS"
      ? kpis.cpm
      : kpis.costPerResult ??
        calcolaCostoDaSpesaRisultati(kpis.spend, kpis.results);
  return {
    metricType: primaryMetricTypeDaObjective(objective),
    label: etichettaMetricaPrimaria(objective),
    actual,
    threshold,
    thresholdMode: healthMode,
    lowerIsBetter: true,
  };
}

export function valutaCompleteness(
  kpis: ControlRoomKpis,
  objective: CampagnaObjective,
): MetricCompleteness {
  const hasCtr = kpis.ctr != null;
  const hasCpc = kpis.cpc != null;
  const hasCpm = kpis.cpm != null;
  const hasFreq = kpis.frequency != null;
  const roasOk = objective !== "ECOMMERCE" || kpis.roas != null;
  if (hasCtr && hasCpc && hasCpm && hasFreq && roasOk) {
    return "INTERMEDIATE";
  }
  // FULL resta riservato. clicks/impressions non alzano completeness a FULL.
  return "MINIMUM";
}

export function etichettaSegnaleDiagnosi(
  signal: string | null | undefined,
): string {
  switch (signal) {
    case "creativita_messaggio":
      return "Possibile problema a monte del click";
    case "asta_audience":
      return "Possibile pressione in delivery";
    case "conversione_post_click":
      return "Possibile perdita dopo il click";
    case "fatica_creativa":
      return "Possibile affaticamento creativo";
    case "economics_roas":
      return "Segnale economico sul ROAS";
    case "soglia_superata":
      return "Costo fuori soglia, causa non isolata";
    case "sotto_soglia":
      return "Entro la soglia economica";
    case "vicino_soglia":
      return "Vicino al limite sostenibile";
    case "dati_insufficienti":
      return "Dati ancora insufficienti";
    default:
      return signal ? signal.replace(/_/g, " ") : "—";
  }
}

export function etichettaConfidenza(level: DiagnosisConfidence): string {
  if (level === "HIGH") return "Confidenza alta";
  if (level === "MEDIUM") return "Confidenza media";
  return "Confidenza bassa";
}

export function etichettaCompleteness(level: MetricCompleteness): string {
  if (level === "FULL") return "Diagnosi completa";
  if (level === "INTERMEDIATE") return "Diagnosi di base disponibile";
  return "Metriche essenziali";
}

export function etichettaAreaDiagnosi(area: DiagnosisArea): string {
  switch (area) {
    case "ECONOMICS":
      return "Economia";
    case "AD_MESSAGE":
      return "A monte del click";
    case "DELIVERY":
      return "Delivery";
    case "POST_CLICK":
      return "Dopo il click";
    case "CREATIVE_FATIGUE":
      return "Possibile affaticamento";
    case "DATA_INSUFFICIENT":
      return "Dati insufficienti";
    default:
      return "Nessun segnale chiaro";
  }
}

/**
 * Risolve soglia economica dalla campagna già salvata.
 * Non inventa: se non c'è riferimento → null.
 */
export function resolveThresholdFromCampaign(
  campagna: Campagna | null,
  objectiveOverride?: CampagnaObjective,
): { threshold: number | null; source: string | null } {
  if (!campagna) return { threshold: null, source: null };
  const objective = objectiveOverride ?? normalizzaObjective(campagna.objective);

  if (
    campagna.maxSustainableCpa != null &&
    Number.isFinite(campagna.maxSustainableCpa) &&
    campagna.maxSustainableCpa > 0 &&
    objective !== "AWARENESS"
  ) {
    return {
      threshold: Math.round(campagna.maxSustainableCpa * 100) / 100,
      source: "max_sustainable_cpa",
    };
  }

  if (objective === "AWARENESS") {
    if (
      campagna.estimatedCpm != null &&
      Number.isFinite(campagna.estimatedCpm) &&
      campagna.estimatedCpm > 0
    ) {
      return {
        threshold: Math.round(campagna.estimatedCpm * 100) / 100,
        source: "estimated_cpm_planned",
      };
    }
    return { threshold: null, source: null };
  }

  if (objective === "BOOKINGS") {
    const ticket = campagna.bookingServiceValue;
    const showUp = campagna.showUpRate ?? 75;
    const margine = campagna.targetMargin ?? 50;
    if (ticket != null && ticket > 0) {
      const valore = ticket * (showUp / 100);
      return {
        threshold: Math.round(valore * (1 - margine / 100) * 100) / 100,
        source: "booking_economics",
      };
    }
  }

  if (objective === "IN_STORE") {
    const receipt = campagna.averageReceipt;
    const storeMargin = campagna.storeMargin ?? campagna.targetMargin ?? 50;
    if (receipt != null && receipt > 0) {
      return {
        threshold: Math.round(receipt * (1 - storeMargin / 100) * 100) / 100,
        source: "instore_economics",
      };
    }
  }

  if (objective === "RETARGETING") {
    const value = campagna.recoveryValue;
    const margin = campagna.recoveryMargin ?? campagna.targetMargin ?? 50;
    if (value != null && value > 0) {
      return {
        threshold: Math.round(value * (1 - margin / 100) * 100) / 100,
        source: "retargeting_economics",
      };
    }
  }

  if (objective === "ECOMMERCE") {
    // Solo maxSustainableCpa già gestito sopra — non inventare da AOV.
    return { threshold: null, source: null };
  }

  return { threshold: null, source: null };
}

/** Break-even ROAS da AOV + margine — solo se entrambi presenti in campagna. */
export function roasBreakEvenDaCampagna(campagna: Campagna | null): number | null {
  if (!campagna) return null;
  const aov = campagna.averageOrderValue;
  const margin = campagna.productMargin ?? campagna.targetMargin;
  if (aov == null || aov <= 0 || margin == null || margin <= 0 || margin >= 100) {
    return null;
  }
  const be = 1 / (1 - margin / 100);
  return Math.round(be * 100) / 100;
}

export function buildEconomicContext(
  campagna: Campagna | null,
  kpis: ControlRoomKpis,
  manualThreshold: number | null,
  manualObjective?: CampagnaObjective,
): EconomicContext {
  const objective = normalizzaObjective(
    manualObjective ?? campagna?.objective ?? "LEADS",
  );
  const resolved = resolveThresholdFromCampaign(campagna, objective);

  const threshold =
    manualThreshold != null && manualThreshold > 0
      ? manualThreshold
      : resolved.threshold;

  const thresholdIsPlannedReference =
    objective === "AWARENESS" &&
    threshold != null &&
    threshold > 0 &&
    (resolved.source === "estimated_cpm_planned" ||
      (manualThreshold != null && manualThreshold > 0));

  const healthMode: HealthMode =
    objective === "AWARENESS" && threshold != null && threshold > 0
      ? "efficiency"
      : "economic";

  const outcome = getPrimaryOutcome(objective, kpis, threshold, healthMode);

  return {
    objective,
    metricType: outcome.metricType,
    metricLabel: outcome.label,
    actual: outcome.actual,
    threshold: outcome.threshold,
    thresholdIsPlannedReference,
    healthMode,
    dailyBudget: campagna?.budgetGiornaliero ?? null,
    settore: (campagna?.settore ?? "").trim(),
    targetMargin: campagna?.targetMargin ?? null,
    roasAttuale: kpis.roas,
    roasBreakEvenHint: roasBreakEvenDaCampagna(campagna),
  };
}

/** GREEN se actual ≤ questa frazione della soglia (costo: più basso è meglio). */
export const HEALTH_GREEN_MAX_RATIO = 0.8;

export type HealthStatusOpts = {
  daysActive?: number | null;
  resultsCount?: number | null;
};

function healthInsufficient(
  mode: HealthMode,
  efficiencyNote: string | undefined,
  explanation: string,
): HealthResult {
  return {
    status: "INSUFFICIENT",
    label: "Dati insufficienti",
    explanation,
    deltaPercent: null,
    deltaLabel: null,
    mode,
    efficiencyNote,
  };
}

/**
 * Semaforo V3 (costo: più basso è meglio).
 * GREEN: actual <= threshold * 0.80
 * YELLOW: threshold * 0.80 < actual <= threshold
 * RED: actual > threshold
 * INSUFFICIENT: days_active < 3 OR results_count < 2 (se i valori sono noti)
 */
export function calcolaHealthStatus(
  actual: number | null,
  threshold: number | null,
  mode: HealthMode = "economic",
  opts?: HealthStatusOpts,
): HealthResult {
  const efficiencyNote =
    mode === "efficiency"
      ? "Confronto di efficienza rispetto al CPM pianificato. Non è una soglia di break-even."
      : undefined;

  const days = opts?.daysActive;
  const results = opts?.resultsCount;
  if (days != null && days < 3) {
    return healthInsufficient(
      mode,
      efficiencyNote,
      "La campagna ha ancora pochi giorni di dati. Non è possibile una diagnosi affidabile.",
    );
  }
  if (results != null && results < 2) {
    return healthInsufficient(
      mode,
      efficiencyNote,
      "Volume risultati ancora troppo basso per una diagnosi affidabile.",
    );
  }

  if (
    actual == null ||
    threshold == null ||
    !(actual >= 0) ||
    !(threshold > 0)
  ) {
    return {
      status: "INSUFFICIENT",
      label: "Dati insufficienti",
      explanation:
        mode === "efficiency"
          ? "Dati insufficienti per il controllo di efficienza. Serve CPM attuale e CPM di riferimento dal piano."
          : "Dati insufficienti per lo stato economico. Manca la soglia o il costo attuale.",
      deltaPercent: null,
      deltaLabel: null,
      mode,
      efficiencyNote,
    };
  }

  const deltaPercent =
    Math.round(((actual - threshold) / threshold) * 1000) / 10;

  if (mode === "efficiency") {
    if (actual <= threshold * HEALTH_GREEN_MAX_RATIO) {
      return {
        status: "GREEN",
        label: "Sotto il piano",
        explanation:
          "Il CPM attuale è sotto il CPM di riferimento pianificato.",
        deltaPercent,
        deltaLabel:
          deltaPercent <= 0
            ? `${Math.abs(deltaPercent)}% sotto il CPM pianificato`
            : "In linea col piano",
        mode,
        efficiencyNote,
      };
    }
    if (actual <= threshold) {
      return {
        status: "YELLOW",
        label: "Vicino al piano",
        explanation:
          "Il CPM è vicino al valore pianificato. Monitora prima di aumentare la spesa.",
        deltaPercent,
        deltaLabel: `+${Math.max(0, deltaPercent)}% rispetto al CPM pianificato`,
        mode,
        efficiencyNote,
      };
    }
    return {
      status: "RED",
      label: "Sopra il piano",
      explanation: "Il CPM attuale supera il CPM di riferimento pianificato.",
      deltaPercent,
      deltaLabel: `+${deltaPercent}% sopra il CPM pianificato`,
      mode,
      efficiencyNote,
    };
  }

  if (actual <= threshold * HEALTH_GREEN_MAX_RATIO) {
    return {
      status: "GREEN",
      label: "Sostenibile",
      explanation:
        "La campagna è sotto la soglia economica sostenibile.",
      deltaPercent,
      deltaLabel:
        deltaPercent === 0
          ? "In linea con la soglia"
          : `${Math.abs(deltaPercent)}% sotto la soglia`,
      mode,
    };
  }

  if (actual <= threshold) {
    return {
      status: "YELLOW",
      label: "Da monitorare",
      explanation:
        "La campagna è vicina al limite sostenibile. Conviene monitorarla prima di aumentare la spesa.",
      deltaPercent,
      deltaLabel:
        deltaPercent <= 0
          ? "Vicino alla soglia"
          : `+${deltaPercent}% sopra la soglia (ancora entro il limite)`,
      mode,
    };
  }

  return {
    status: "RED",
    label: "Fuori soglia",
    explanation:
      "Il costo per risultato è superiore alla soglia sostenibile del cliente.",
    deltaPercent,
    deltaLabel: `+${deltaPercent}% sopra la soglia`,
    mode,
  };
}

export function avvisoDatiLimitati(
  giorniAttivi: number | null,
  results: number | null,
): LimitedDataWarning {
  const giorni = giorniAttivi != null && giorniAttivi > 0 ? giorniAttivi : null;
  const ris = results != null && results >= 0 ? results : null;

  if (giorni != null && giorni < 3) {
    return {
      show: true,
      message:
        "La campagna ha ancora pochi dati. Interpreta la diagnosi con cautela.",
    };
  }
  if (ris != null && ris < 2) {
    return {
      show: true,
      message:
        "Volume risultati ancora limitato. Evita conclusioni forti finché non accumuli più conversioni.",
    };
  }
  return { show: false, message: "" };
}

export function diagnosisConfidenceReduced(
  warning: LimitedDataWarning,
  health: HealthResult,
): boolean {
  return warning.show && health.status !== "INSUFFICIENT";
}

function packDiagnosis(
  input: Omit<DiagnosisResult, "explanation" | "trendSummary" | "contradictions"> & {
    explanation?: string;
    trendSummary?: string;
    contradictions?: string[];
  },
): DiagnosisResult {
  const explanation = input.explanation ?? input.body;
  return {
    ...input,
    explanation,
    trendSummary: input.trendSummary ?? "",
    contradictions: input.contradictions ?? [],
  };
}

export function riassuntoAndamento(
  trend: import("@/lib/campaign-trend").TrendEvaluation,
  metricLabel: string,
): string {
  if (trend.level === "INSUFFICIENT_TREND_DATA") {
    return "Servono almeno due controlli con lo stesso obiettivo per leggere un andamento.";
  }
  const label = metricLabel;
  if (trend.level === "CONSISTENT_TREND") {
    if (trend.primary.direction === "WORSENING") {
      return `Il ${label} è aumentato negli ultimi due intervalli.`;
    }
    if (trend.primary.direction === "IMPROVING") {
      return `Il ${label} sta migliorando da due controlli.`;
    }
  }
  if (trend.primary.direction === "WORSENING") {
    return `Rispetto al controllo precedente il ${label} è aumentato.`;
  }
  if (trend.primary.direction === "IMPROVING") {
    return `Rispetto al controllo precedente il ${label} è diminuito.`;
  }
  if (trend.primary.direction === "STABLE") {
    return `Rispetto al controllo precedente il ${label} è stabile.`;
  }
  return `Lo storico del ${label} non indica un andamento chiaro.`;
}

function trendMetric(
  trend: import("@/lib/campaign-trend").TrendEvaluation,
  key: import("@/lib/campaign-trend").HistoricalMetricKey,
): import("@/lib/campaign-trend").MetricTrend | undefined {
  if (key === "primary") return trend.primary;
  return trend.diagnostics.find((item) => item.metric === key);
}

function capEvidenceLines(
  trend: import("@/lib/campaign-trend").TrendEvaluation,
): string[] {
  const lines: string[] = [];
  if (trend.caps.includes("SOURCE_CHANGE")) {
    lines.push("Fonte dati cambiata tra gli ultimi controlli.");
  }
  if (trend.caps.includes("THRESHOLD_CHANGE")) {
    lines.push("La soglia economica è cambiata.");
  }
  if (trend.caps.includes("UNEVEN_SPACING")) {
    lines.push("I controlli non sono a distanza regolare.");
  }
  return lines;
}

function hasTrendConfidenceCap(
  trend: import("@/lib/campaign-trend").TrendEvaluation,
): boolean {
  return (
    trend.caps.includes("SOURCE_CHANGE") ||
    trend.caps.includes("THRESHOLD_CHANGE") ||
    trend.caps.includes("UNEVEN_SPACING")
  );
}

function finalizeTrendConfidence(
  desired: DiagnosisConfidence,
  trend: import("@/lib/campaign-trend").TrendEvaluation,
  health: HealthResult,
): DiagnosisConfidence {
  if (health.status === "INSUFFICIENT") return "LOW";
  if (desired === "HIGH" && hasTrendConfidenceCap(trend)) return "MEDIUM";
  return desired;
}

function isDir(
  metric: import("@/lib/campaign-trend").MetricTrend | undefined,
  direction: import("@/lib/campaign-trend").TrendDirection,
): boolean {
  return metric?.direction === direction;
}

function qualifiesHighTrend(input: {
  trend: import("@/lib/campaign-trend").TrendEvaluation;
  health: HealthResult;
  namedPattern: boolean;
  supportingAligned: number;
  supportingConsistent: boolean;
  contradictions: string[];
}): boolean {
  return (
    input.namedPattern &&
    input.trend.level === "CONSISTENT_TREND" &&
    input.trend.primary.consistent === true &&
    input.supportingAligned >= 2 &&
    input.supportingConsistent &&
    input.contradictions.length === 0 &&
    input.health.status !== "INSUFFICIENT" &&
    !hasTrendConfidenceCap(input.trend)
  );
}

export function diagnosticaDeterministica(
  kpis: ControlRoomKpis,
  health: HealthResult,
  economic: EconomicContext,
  options?: DiagnosisOptions,
): DiagnosisResult {
  if (options?.trend) {
    return diagnosticaConTrend(
      kpis,
      health,
      economic,
      options.trend,
      options.datiLimitati,
    );
  }
  return diagnosticaTrasversale(kpis, health, economic, options?.datiLimitati);
}

function diagnosticaConTrend(
  kpis: ControlRoomKpis,
  health: HealthResult,
  economic: EconomicContext,
  trend: import("@/lib/campaign-trend").TrendEvaluation,
  datiLimitati?: boolean,
): DiagnosisResult {
  const completeness = valutaCompleteness(kpis, economic.objective);
  const trendSummary = riassuntoAndamento(trend, economic.metricLabel);
  const capLines = capEvidenceLines(trend);
  const primary = trend.primary;
  const ctrT = trendMetric(trend, "ctr");
  const cpcT = trendMetric(trend, "cpc");
  const cpmT = trendMetric(trend, "cpm");
  const freqT = trendMetric(trend, "frequency");
  const roasT = trendMetric(trend, "roas");
  const crT = trendMetric(trend, "conversionRate");
  const objective = economic.objective;
  const metricLabel = economic.metricLabel;

  const contradictions: string[] = [];
  if (
    isDir(primary, "WORSENING") &&
    isDir(ctrT, "IMPROVING") &&
    isDir(cpcT, "IMPROVING")
  ) {
    contradictions.push("Costo in aumento con CTR e CPC in miglioramento");
  }
  if (
    freqT?.movement === "RISING" &&
    isDir(ctrT, "WORSENING") &&
    isDir(primary, "IMPROVING")
  ) {
    contradictions.push(
      "Frequenza in crescita e CTR in calo, ma costo in miglioramento",
    );
  }
  if (
    objective === "ECOMMERCE" &&
    isDir(primary, "WORSENING") &&
    isDir(roasT, "IMPROVING")
  ) {
    contradictions.push("CPA in aumento e ROAS in miglioramento");
  }

  const crAvailable =
    crT != null && crT.current != null && crT.previous != null;
  const suppressAdMessage = contradictions.some((c) => c.includes("CTR e CPC"));
  const suppressFatigue = contradictions.some((c) =>
    c.includes("costo in miglioramento"),
  );
  const suppressHighEconomics = contradictions.some((c) =>
    c.includes("ROAS in miglioramento"),
  );

  const base = {
    completeness,
    trendSummary,
    contradictions,
  };

  if (health.status === "INSUFFICIENT") {
    return packDiagnosis({
      ...base,
      signal: "dati_insufficienti",
      title: "Dati ancora insufficienti",
      body: "Dati ancora insufficienti per una diagnosi affidabile.",
      canDiagnose: false,
      hint: "Continua a raccogliere dati prima di cambiare budget o creatività.",
      area: "DATA_INSUFFICIENT",
      confidence: "LOW",
      evidence: capLines,
    });
  }

  if (datiLimitati) {
    return packDiagnosis({
      ...base,
      signal: "dati_insufficienti",
      title: "Dati ancora limitati",
      body: "La campagna ha ancora pochi giorni o pochi risultati. Eventuali segnali diagnostici restano indicativi.",
      canDiagnose: true,
      hint: "Verifica di nuovo tra qualche giorno prima di cambiare struttura o budget.",
      area: "DATA_INSUFFICIENT",
      confidence: "LOW",
      evidence: capLines,
    });
  }

  if (trend.level === "INSUFFICIENT_TREND_DATA") {
    const cross = diagnosticaTrasversale(kpis, health, economic, datiLimitati);
    return packDiagnosis({
      ...cross,
      trendSummary,
      contradictions,
      confidence: "LOW",
      evidence: [...cross.evidence, ...capLines],
    });
  }

  if (health.status === "GREEN" || health.status === "YELLOW") {
    const worsening = isDir(primary, "WORSENING");
    const ecommerceTension =
      objective === "ECOMMERCE" &&
      (isDir(primary, "STABLE") || isDir(primary, "IMPROVING")) &&
      isDir(roasT, "WORSENING");
    if (ecommerceTension) {
      return packDiagnosis({
        ...base,
        signal: "economics_roas",
        title: "Segnale economico sul ROAS",
        body: "Il costo per acquisto non sta peggiorando, ma il ROAS è in calo. Verifica valore medio ordine e marginalità, senza trattare la campagna come un fallimento.",
        canDiagnose: true,
        hint: "Lo stato resta sul CPA. Il ROAS è un segnale economico secondario.",
        area: "ECONOMICS",
        confidence: finalizeTrendConfidence("MEDIUM", trend, health),
        evidence: [
          `${metricLabel} stabile o in miglioramento`,
          "ROAS in calo",
          ...capLines,
        ],
      });
    }
    const watchBody =
      health.status === "GREEN" && worsening
        ? `Il ${metricLabel} è ancora entro la soglia, ma sta aumentando.`
        : health.status === "YELLOW" && worsening
          ? `I costi sono ancora entro soglia, ma ${metricLabel.toLowerCase()} sta aumentando.`
          : health.status === "GREEN"
            ? health.mode === "efficiency"
              ? "Il CPM è sotto il riferimento di piano. La campagna è in uno stato di efficienza coerente con il piano. Continua a monitorare prima di intervenire."
              : "La campagna è entro la soglia. Continua a monitorare prima di intervenire."
            : "I costi sono ancora entro soglia ma senza margine ampio. Meglio osservare prima di aumentare la spesa.";
    const watchConfidence: DiagnosisConfidence =
      worsening && trend.level === "CONSISTENT_TREND" ? "MEDIUM" : "LOW";
    return packDiagnosis({
      ...base,
      signal: health.status === "YELLOW" ? "vicino_soglia" : "sotto_soglia",
      title:
        health.status === "YELLOW"
          ? "Vicino al limite sostenibile"
          : health.mode === "efficiency"
            ? "CPM sotto il piano"
            : "Entro la soglia economica",
      body: watchBody,
      canDiagnose: true,
      hint: "Nessun intervento strutturale necessario solo per questo stato.",
      area: "NO_CLEAR_SIGNAL",
      confidence: finalizeTrendConfidence(watchConfidence, trend, health),
      evidence: [
        worsening ? `${metricLabel} in aumento` : "Outcome entro soglia",
        ...capLines,
      ],
    });
  }

  if (health.status === "RED" && isDir(primary, "IMPROVING")) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Costo fuori soglia, in miglioramento",
      body: `Il ${metricLabel} resta sopra soglia, ma sta migliorando.`,
      canDiagnose: true,
      hint: "Evita di azzerare ciò che potrebbe stare recuperando. Continua a monitorare.",
      area: "NO_CLEAR_SIGNAL",
      confidence: finalizeTrendConfidence(
        trend.level === "CONSISTENT_TREND" ? "MEDIUM" : "LOW",
        trend,
        health,
      ),
      evidence: [
        `${metricLabel} in calo rispetto ai controlli precedenti`,
        ...capLines,
      ],
    });
  }

  type Named =
    | "AD_MESSAGE"
    | "POST_CLICK"
    | "CREATIVE_FATIGUE"
    | "DELIVERY"
    | "ECONOMICS"
    | null;

  const conversionObjectives =
    objective === "LEADS" ||
    objective === "BOOKINGS" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING";

  let named: Named = null;
  let supportingAligned = 0;
  let supportingConsistent = false;

  if (objective === "ECOMMERCE" && isDir(roasT, "WORSENING")) {
    if (isDir(primary, "WORSENING") && !suppressHighEconomics) {
      named = "ECONOMICS";
      supportingAligned = 1;
      supportingConsistent = roasT?.consistent === true;
      if (isDir(crT, "WORSENING")) {
        supportingAligned += 1;
        supportingConsistent =
          supportingConsistent && crT?.consistent === true;
      }
    } else if (
      (isDir(primary, "STABLE") || isDir(primary, "IMPROVING")) &&
      isDir(roasT, "WORSENING")
    ) {
      named = "ECONOMICS";
      supportingAligned = 1;
      supportingConsistent = false;
    }
  }

  if (
    named == null &&
    !suppressFatigue &&
    isDir(primary, "WORSENING") &&
    freqT?.movement === "RISING" &&
    isDir(ctrT, "WORSENING")
  ) {
    named = "CREATIVE_FATIGUE";
    supportingAligned = 2;
    supportingConsistent =
      freqT?.consistent === true && ctrT?.consistent === true;
  }

  if (
    named == null &&
    conversionObjectives &&
    !suppressAdMessage &&
    isDir(primary, "WORSENING") &&
    isDir(ctrT, "WORSENING") &&
    isDir(cpcT, "WORSENING")
  ) {
    named = "AD_MESSAGE";
    supportingAligned = 2;
    supportingConsistent =
      ctrT?.consistent === true && cpcT?.consistent === true;
  }

  if (
    named == null &&
    conversionObjectives &&
    isDir(primary, "WORSENING") &&
    crAvailable &&
    isDir(crT, "WORSENING") &&
    (isDir(ctrT, "STABLE") || isDir(ctrT, "IMPROVING")) &&
    (isDir(cpcT, "STABLE") || isDir(cpcT, "IMPROVING"))
  ) {
    named = "POST_CLICK";
    supportingAligned = 2;
    supportingConsistent = crT?.consistent === true;
  }

  if (
    named == null &&
    objective !== "AWARENESS" &&
    isDir(primary, "WORSENING") &&
    cpmT?.movement === "RISING" &&
    isDir(cpcT, "WORSENING") &&
    isDir(ctrT, "STABLE")
  ) {
    named = "DELIVERY";
    supportingAligned = 2;
    supportingConsistent =
      cpmT?.consistent === true && cpcT?.consistent === true;
  }

  if (
    named == null &&
    objective === "AWARENESS" &&
    isDir(primary, "WORSENING") &&
    freqT?.movement === "RISING"
  ) {
    named = isDir(ctrT, "WORSENING") ? "CREATIVE_FATIGUE" : "DELIVERY";
    supportingAligned = isDir(ctrT, "WORSENING") ? 2 : 1;
    supportingConsistent =
      freqT?.consistent === true &&
      (named === "DELIVERY" || ctrT?.consistent === true);
  }

  const highOk = qualifiesHighTrend({
    trend,
    health,
    namedPattern: named != null,
    supportingAligned,
    supportingConsistent,
    contradictions: named === "ECONOMICS" && !suppressHighEconomics ? [] : contradictions,
  });

  if (suppressAdMessage) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Costo fuori soglia, causa non attribuibile",
      body: "Il costo sta peggiorando, ma le metriche non indicano una causa unica.",
      canDiagnose: true,
      hint: "Non forzare una causa: i segnali a monte del click non sono coerenti.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: [
        `${metricLabel} in aumento`,
        "CTR in miglioramento",
        "CPC in calo",
        ...capLines,
      ],
    });
  }

  if (suppressFatigue) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Segnali non coerenti con un affaticamento",
      body: "Frequenza e CTR si muovono in modo che potrebbe sembrare affaticamento, ma il costo è in miglioramento. Non è una diagnosi di saturazione.",
      canDiagnose: true,
      hint: "Non attribuire un affaticamento creativo con questo quadro.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: [
        "Frequenza in crescita",
        "CTR in calo",
        `${metricLabel} in miglioramento`,
        ...capLines,
      ],
    });
  }

  if (named === "AD_MESSAGE") {
    const desired: DiagnosisConfidence = highOk
      ? "HIGH"
      : "MEDIUM";
    const conf = finalizeTrendConfidence(desired, trend, health);
    const high = conf === "HIGH";
    return packDiagnosis({
      ...base,
      signal: "creativita_messaggio",
      title: "Possibile problema a monte del click",
      body: high
        ? "I segnali sono fortemente coerenti con un possibile problema a monte del click."
        : "I segnali possono indicare un problema a monte del click. Un solo scarto, o dati parziali, non basta per attribuire il problema alla creatività.",
      canDiagnose: true,
      hint: "Non è una prova che la creatività o l'audience siano sbagliate.",
      area: "AD_MESSAGE",
      confidence: conf,
      evidence: [
        primary.consistent
          ? `${metricLabel} in aumento su 2 intervalli`
          : `${metricLabel} in aumento`,
        "CTR in calo",
        "CPC in aumento",
        ...capLines,
      ],
    });
  }

  if (named === "CREATIVE_FATIGUE") {
    const desired: DiagnosisConfidence =
      highOk && objective !== "AWARENESS" ? "HIGH" : "MEDIUM";
    const conf = finalizeTrendConfidence(desired, trend, health);
    const high = conf === "HIGH";
    return packDiagnosis({
      ...base,
      signal: "fatica_creativa",
      title: "Possibile affaticamento creativo",
      body: high
        ? "I segnali sono fortemente coerenti con un possibile affaticamento creativo."
        : objective === "AWARENESS"
          ? "Il CPM è in aumento e la frequenza cresce. È un'ipotesi cauta su delivery o creatività, non una saturazione dell'audience."
          : "Costo in aumento, frequenza in crescita e CTR in calo: i segnali possono essere coerenti con un possibile affaticamento creativo.",
      canDiagnose: true,
      hint: "Non è una prova di saturazione del pubblico.",
      area: "CREATIVE_FATIGUE",
      confidence: conf,
      evidence: [
        `${metricLabel} in aumento`,
        "Frequenza in crescita",
        ...(isDir(ctrT, "WORSENING") ? ["CTR in calo"] : []),
        ...capLines,
      ],
    });
  }

  if (named === "POST_CLICK") {
    const desired: DiagnosisConfidence = highOk ? "HIGH" : "MEDIUM";
    const conf = finalizeTrendConfidence(desired, trend, health);
    const high = conf === "HIGH";
    return packDiagnosis({
      ...base,
      signal: "conversione_post_click",
      title: "Possibile perdita dopo il click",
      body: high
        ? "I segnali sono fortemente coerenti con una possibile perdita dopo il click. Il traffico non mostra un peggioramento evidente a monte, mentre una quota minore dei click genera risultati."
        : "Il traffico non mostra un peggioramento evidente a monte, mentre una quota minore dei click genera risultati.",
      canDiagnose: true,
      hint: "Non è una conclusione sulla landing: è un’ipotesi da verificare su form, offerta e flusso.",
      area: "POST_CLICK",
      confidence: conf,
      evidence: [
        `${metricLabel} in aumento`,
        "CTR stabile o in miglioramento",
        "CPC stabile o in miglioramento",
        "Tasso click → risultato in calo",
        ...capLines,
      ],
    });
  }

  if (named === "DELIVERY") {
    const conf = finalizeTrendConfidence("MEDIUM", trend, health);
    return packDiagnosis({
      ...base,
      signal: "asta_audience",
      title: "Possibile pressione in delivery",
      body:
        objective === "AWARENESS"
          ? "Il CPM è in aumento e la frequenza cresce. I segnali restano cauti: non indicano da soli una saturazione."
          : "Il costo elevato potrebbe dipendere dalla fase di delivery o dalla qualità del traffico. Il CTR non è il segnale debole.",
      canDiagnose: true,
      hint: "Non è una prova che l'audience sia sbagliata.",
      area: "DELIVERY",
      confidence: conf,
      evidence: [
        `${metricLabel} in aumento`,
        ...(cpmT?.movement === "RISING" ? ["CPM in crescita"] : []),
        ...(freqT?.movement === "RISING" ? ["Frequenza in crescita"] : []),
        ...(isDir(cpcT, "WORSENING") ? ["CPC in aumento"] : []),
        ...capLines,
      ],
    });
  }

  if (named === "ECONOMICS") {
    const desired: DiagnosisConfidence =
      highOk && !suppressHighEconomics ? "HIGH" : "MEDIUM";
    const conf = finalizeTrendConfidence(
      suppressHighEconomics ? "LOW" : desired,
      trend,
      health,
    );
    const cpaWorse = isDir(primary, "WORSENING");
    return packDiagnosis({
      ...base,
      signal: "economics_roas",
      title: "Segnale economico sul ROAS",
      body: cpaWorse
        ? conf === "HIGH"
          ? "I segnali sono fortemente coerenti con un peggioramento economico: costo per acquisto e ROAS si muovono insieme in modo sfavorevole."
          : "Il costo per acquisto e il ROAS stanno entrambi peggiorando. Verifica valore medio ordine e marginalità."
        : "Il costo per acquisto non indica un peggioramento della campagna, ma il ROAS è in calo. Verifica valore medio ordine e marginalità.",
      canDiagnose: true,
      hint: "Lo stato resta sul CPA. Il ROAS è un segnale economico secondario.",
      area: "ECONOMICS",
      confidence: conf,
      evidence: [
        cpaWorse
          ? `${metricLabel} in aumento`
          : `${metricLabel} stabile o in miglioramento`,
        "ROAS in calo",
        ...capLines,
      ],
    });
  }

  if (suppressHighEconomics) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Segnali economici non allineati",
      body: "Il costo sta peggiorando, ma le metriche non indicano una causa unica.",
      canDiagnose: true,
      hint: "CPA e ROAS si muovono in direzioni opposte: non attribuire un unico verdetto economico.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: [
        `${metricLabel} in aumento`,
        "ROAS in miglioramento",
        ...capLines,
      ],
    });
  }

  if (
    isDir(primary, "WORSENING") &&
    trend.level === "CONSISTENT_TREND" &&
    health.status === "RED"
  ) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Costo fuori soglia",
      body: `Il ${metricLabel} è sopra la soglia e sta aumentando, ma le metriche non isolano una causa unica.`,
      canDiagnose: true,
      hint: "Aggiungi o completa CTR, CPC, CPM e frequenza per capire dove intervenire.",
      area: "NO_CLEAR_SIGNAL",
      confidence: finalizeTrendConfidence("MEDIUM", trend, health),
      evidence: [
        primary.consistent
          ? `${metricLabel} in aumento su 2 intervalli`
          : `${metricLabel} in aumento`,
        ...capLines,
      ],
    });
  }

  const fallback = diagnosticaTrasversale(kpis, health, economic, datiLimitati);
  const capped: DiagnosisConfidence =
    fallback.confidence === "HIGH" ? "MEDIUM" : fallback.confidence;
  return packDiagnosis({
    ...fallback,
    trendSummary,
    contradictions,
    confidence: capped,
    evidence: [...fallback.evidence, ...capLines],
  });
}

function diagnosticaTrasversale(
  kpis: ControlRoomKpis,
  health: HealthResult,
  economic: EconomicContext,
  datiLimitati?: boolean,
): DiagnosisResult {
  const completeness = valutaCompleteness(kpis, economic.objective);
  const { ctr, cpc, frequency } = kpis;
  const threshold = economic.threshold;
  const ctrLow = ctr != null && ctr < DIAG_CTR_LOW;
  const ctrHealthy = ctr != null && ctr >= DIAG_CTR_GOOD;
  const freqHigh = frequency != null && frequency >= DIAG_FREQUENCY_HIGH;
  const cpcElevated =
    cpc != null &&
    threshold != null &&
    cpc > threshold * DIAG_CPC_HIGH_RATIO;
  const cpcNotElevated =
    cpc == null ||
    threshold == null ||
    cpc <= threshold * DIAG_CPC_HIGH_RATIO;
  const hasDiagnosisSignals =
    ctr != null || cpc != null || frequency != null;
  const hasFunnelSignals = hasDiagnosisSignals || kpis.cpm != null;

  const base = { completeness };

  if (health.status === "INSUFFICIENT") {
    return packDiagnosis({
      ...base,
      signal: "dati_insufficienti",
      title: "Dati ancora insufficienti",
      body: "Dati ancora insufficienti per una diagnosi affidabile.",
      canDiagnose: false,
      hint: "Continua a raccogliere dati prima di cambiare budget o creatività.",
      area: "DATA_INSUFFICIENT",
      confidence: "LOW",
      evidence: [],
    });
  }

  if (datiLimitati && hasFunnelSignals) {
    return packDiagnosis({
      ...base,
      signal: "dati_insufficienti",
      title: "Dati ancora limitati",
      body: "La campagna ha ancora pochi giorni o pochi risultati. Eventuali segnali diagnostici restano indicativi.",
      canDiagnose: true,
      hint: "Verifica di nuovo tra qualche giorno prima di cambiare struttura o budget.",
      area: "DATA_INSUFFICIENT",
      confidence: "LOW",
      evidence: [],
    });
  }

  const cpaEntroSoglia =
    health.status === "GREEN" || health.status === "YELLOW";
  if (
    economic.objective === "ECOMMERCE" &&
    cpaEntroSoglia &&
    economic.roasAttuale != null &&
    economic.roasAttuale > 0 &&
    economic.roasBreakEvenHint != null &&
    economic.roasAttuale < economic.roasBreakEvenHint
  ) {
    return packDiagnosis({
      ...base,
      signal: "economics_roas",
      title: "Segnale economico sul ROAS",
      body: `Il costo per acquisto è entro la soglia, ma il ROAS è sotto il livello economico di riferimento. Verifica valore medio ordine e marginalità.`,
      canDiagnose: true,
      hint: "Lo stato resta sul CPA. Il ROAS è un segnale economico secondario.",
      area: "ECONOMICS",
      confidence: "MEDIUM",
      evidence: [
        `ROAS ${economic.roasAttuale}x vs riferimento ${economic.roasBreakEvenHint}x`,
      ],
    });
  }

  const sopraSoglia = health.status === "RED";

  if (sopraSoglia && !hasDiagnosisSignals) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Costo fuori soglia, causa non attribuibile",
      body: `Il ${economic.metricLabel} è sopra la soglia, ma non ci sono ancora abbastanza metriche diagnostiche per individuare con affidabilità la causa.`,
      canDiagnose: true,
      hint: "Aggiungi CTR, CPC, CPM e frequenza per capire dove intervenire.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: [`${economic.metricLabel} sopra soglia`],
    });
  }

  if (sopraSoglia && freqHigh && ctrLow) {
    return packDiagnosis({
      ...base,
      signal: "fatica_creativa",
      title: "Possibile affaticamento creativo",
      body: "Frequency e CTR possono indicare un possibile affaticamento creativo. Da soli, e senza uno storico di più controlli, non bastano per una conclusione definitiva.",
      canDiagnose: true,
      hint: "Il CTR basso è un segnale iniziale, non una prova che la creatività sia sbagliata.",
      area: "CREATIVE_FATIGUE",
      confidence: "MEDIUM",
      evidence: ["Frequency sopra il riferimento iniziale", "CTR sotto il riferimento iniziale"],
    });
  }

  if (sopraSoglia && ctrLow && cpcElevated) {
    return packDiagnosis({
      ...base,
      signal: "creativita_messaggio",
      title: "Possibile problema a monte del click",
      body: "I segnali possono indicare un problema a monte del click. Il CTR è sotto il riferimento usato come segnale iniziale. Da solo non basta per attribuire il problema alla creatività.",
      canDiagnose: true,
      hint: "Il costo elevato potrebbe dipendere anche dalla fase di delivery o dalla qualità del traffico.",
      area: "AD_MESSAGE",
      confidence: "MEDIUM",
      evidence: ["CTR sotto riferimento iniziale", "CPC elevato rispetto alla soglia campagna"],
    });
  }

  if (sopraSoglia && ctrLow) {
    return packDiagnosis({
      ...base,
      signal: "creativita_messaggio",
      title: "Possibile problema a monte del click",
      body: "I segnali possono indicare un problema a monte del click. Il CTR è sotto il riferimento usato come segnale iniziale. Da solo non basta per attribuire il problema alla creatività.",
      canDiagnose: true,
      hint: "Completa CPC e frequenza per restringere il segnale.",
      area: "AD_MESSAGE",
      confidence: "MEDIUM",
      evidence: ["CTR sotto riferimento iniziale"],
    });
  }

  if (sopraSoglia && ctrHealthy && cpcElevated) {
    return packDiagnosis({
      ...base,
      signal: "asta_audience",
      title: "Possibile pressione in delivery",
      body: "Il costo elevato potrebbe dipendere dalla fase di delivery o dalla qualità del traffico. Il CTR non è il segnale debole: conviene verificare asta, pubblico e placement.",
      canDiagnose: true,
      hint: "Non è una prova che l'audience sia sbagliata.",
      area: "DELIVERY",
      confidence: "MEDIUM",
      evidence: ["CTR in linea col riferimento iniziale", "CPC elevato rispetto alla soglia campagna"],
    });
  }

  if (sopraSoglia && ctrHealthy && cpcNotElevated) {
    const postClickEvidence = [
      "CTR in linea col riferimento iniziale",
      "CPC non elevato rispetto alla soglia",
    ];
    if (
      economic.objective !== "AWARENESS" &&
      kpis.conversionRate != null &&
      Number.isFinite(kpis.conversionRate)
    ) {
      postClickEvidence.push(
        `Tasso click → risultato calcolato: ${kpis.conversionRate.toFixed(2)}%`,
      );
    }
    return packDiagnosis({
      ...base,
      signal: "conversione_post_click",
      title: "Possibile perdita dopo il click",
      body: "Il traffico arriva, ma il risultato suggerisce di verificare cosa accade dopo il click.",
      canDiagnose: true,
      hint: "Non è una conclusione sulla landing: è un’ipotesi da verificare su form, offerta e flusso.",
      area: "POST_CLICK",
      confidence: "MEDIUM",
      evidence: postClickEvidence,
    });
  }

  if (sopraSoglia) {
    return packDiagnosis({
      ...base,
      signal: "soglia_superata",
      title: "Costo fuori soglia",
      body: `Il ${economic.metricLabel} è sopra la soglia. I KPI disponibili non isolano una causa unica.`,
      canDiagnose: true,
      hint: "Aggiungi o completa CTR, CPC, CPM e frequenza per capire dove intervenire.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: [`${economic.metricLabel} sopra soglia`],
    });
  }

  if (health.status === "YELLOW") {
    return packDiagnosis({
      ...base,
      signal: "vicino_soglia",
      title: "Vicino al limite sostenibile",
      body: "I costi sono ancora entro soglia ma senza margine ampio. Meglio osservare prima di aumentare la spesa.",
      canDiagnose: true,
      hint: "Nessun intervento strutturale necessario solo per questo stato.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: ["Outcome entro soglia, margine ridotto"],
    });
  }

  if (health.status === "GREEN") {
    return packDiagnosis({
      ...base,
      signal: "sotto_soglia",
      title:
        health.mode === "efficiency"
          ? "CPM sotto il piano"
          : "Entro la soglia economica",
      body:
        health.mode === "efficiency"
          ? "Il CPM è sotto il riferimento di piano. La campagna è in uno stato di efficienza coerente con il piano. Continua a monitorare prima di intervenire."
          : "La campagna è entro la soglia. Continua a monitorare prima di intervenire.",
      canDiagnose: true,
      hint:
        freqHigh
          ? "Frequency alta rispetto al riferimento iniziale, da sola, non indica saturazione e non cambia lo stato."
          : "Nessun cambio drastico di budget, audience o ads.",
      area: "NO_CLEAR_SIGNAL",
      confidence: "LOW",
      evidence: freqHigh
        ? ["Outcome entro soglia", "Frequency sopra riferimento iniziale (non determina lo stato)"]
        : ["Outcome entro soglia"],
    });
  }

  return packDiagnosis({
    ...base,
    signal: "dati_insufficienti",
    title: "Diagnosi non disponibile",
    body: "KPI insufficienti per una diagnosi affidabile.",
    canDiagnose: false,
    hint: "Aggiungi CTR, CPC, CPM e frequenza per capire dove intervenire.",
    area: "DATA_INSUFFICIENT",
    confidence: "LOW",
    evidence: [],
  });
}

export function azioniConsigliate(
  diagnosis: DiagnosisResult,
  health: HealthResult,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const low = diagnosis.confidence === "LOW";
  const completenessMin = diagnosis.completeness === "MINIMUM";

  if (health.status === "GREEN" && diagnosis.area === "ECONOMICS") {
    return [
      {
        text: "Verifica valore medio ordine e marginalità rispetto al ROAS",
        priority: "alta",
      },
      {
        text: "Non cambiare budget solo in base al ROAS se il CPA è in soglia",
        priority: "media",
      },
      { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
    ];
  }

  if (health.status === "GREEN") {
    return [
      {
        text: "La campagna è entro la soglia. Continua a monitorare prima di intervenire.",
        priority: "media",
      },
      { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      {
        text: "Documenta cosa sta funzionando (creatività / offerta)",
        priority: "bassa",
      },
    ].slice(0, 3) as RecommendedAction[];
  }

  if (health.status === "INSUFFICIENT" || diagnosis.area === "DATA_INSUFFICIENT") {
    return [
      {
        text: "Continua a raccogliere dati prima di giudicare",
        priority: "alta",
      },
      {
        text: "Verifica che il tracking dei risultati sia corretto",
        priority: "media",
      },
      {
        text: "Evita modifiche drastiche troppo presto",
        priority: "media",
      },
    ];
  }

  if (health.status === "RED" && (low || completenessMin)) {
    actions.push(
      {
        text: "Aggiungi CTR, CPC, CPM e frequenza per capire dove intervenire",
        priority: "alta",
      },
      { text: "Non aumentare ancora il budget", priority: "alta" },
      { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
    );
    return actions.slice(0, 3);
  }

  switch (diagnosis.area) {
    case "POST_CLICK":
      actions.push(
        {
          text: "Verifica landing, form e offerta dopo il click",
          priority: "alta",
        },
        { text: "Non aumentare ancora il budget", priority: "alta" },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "AD_MESSAGE":
      actions.push(
        {
          text: "Verifica creatività e messaggio, senza attribuire una causa unica",
          priority: "alta",
        },
        { text: "Non aumentare ancora il budget", priority: "alta" },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "DELIVERY":
      actions.push(
        {
          text: "Verifica delivery: asta, pubblico e placement",
          priority: "alta",
        },
        { text: "Non aumentare ancora il budget", priority: "alta" },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "CREATIVE_FATIGUE":
      actions.push(
        {
          text: "Valuta se ruotare le creatività più viste, dopo aver controllato i dati",
          priority: "alta",
        },
        { text: "Non aumentare ancora il budget", priority: "alta" },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "ECONOMICS":
      actions.push(
        {
          text: "Verifica valore medio ordine e marginalità rispetto al ROAS",
          priority: "alta",
        },
        {
          text: "Non cambiare budget solo in base al ROAS se il CPA è in soglia",
          priority: "media",
        },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    default:
      if (health.status === "YELLOW") {
        actions.push(
          { text: "Non aumentare ancora il budget", priority: "alta" },
          { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
          {
            text: "Prepara 1 creatività di riserva senza pubblicarla subito",
            priority: "bassa",
          },
        );
      } else {
        actions.push(
          { text: "Non aumentare ancora il budget", priority: "alta" },
          {
            text: "Aggiungi CTR, CPC, CPM e frequenza per capire dove intervenire",
            priority: "alta",
          },
          { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
        );
      }
  }

  return actions.slice(0, 3);
}

export function healthBadgeClasses(status: HealthStatus): string {
  switch (status) {
    case "GREEN":
      return "border-[#B7E4C7] bg-[#E8F5EE] text-[#2D6A4A]";
    case "YELLOW":
      return "border-[#F5D78E] bg-[#FFF6E5] text-[#9A6700]";
    case "RED":
      return "border-[#F5C2C2] bg-[#FDEDED] text-[#B42318]";
    default:
      return "border-[#D8DCE3] bg-[#EEF0F3] text-[#5A6578]";
  }
}

export function priorityBadgeClasses(priority: ActionPriority): string {
  switch (priority) {
    case "alta":
      return "bg-[#FDEDED] text-[#B42318]";
    case "media":
      return "bg-[#FFF6E5] text-[#9A6700]";
    default:
      return "bg-[#EEF0F3] text-[#5A6578]";
  }
}

export function priorityLabel(priority: ActionPriority): string {
  switch (priority) {
    case "alta":
      return "Priorità alta";
    case "media":
      return "Priorità media";
    default:
      return "Priorità bassa";
  }
}

export function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("it-IT", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}

export type TrendCheck = "migliorato" | "stabile" | "peggiorato";

/** Costo: più basso è meglio (CPL/CPA/CPM). */
export function trendVsPrecedente(
  precedente: number | null | undefined,
  attuale: number | null | undefined,
): TrendCheck | null {
  if (
    precedente == null ||
    attuale == null ||
    !Number.isFinite(precedente) ||
    !Number.isFinite(attuale)
  ) {
    return null;
  }
  const a = Math.round(attuale * 100) / 100;
  const b = Math.round(precedente * 100) / 100;
  if (a === b) return "stabile";
  return a < b ? "migliorato" : "peggiorato";
}

export function etichettaTrend(trend: TrendCheck | null): string {
  if (trend === "migliorato") return "Migliorato";
  if (trend === "peggiorato") return "Peggiorato";
  if (trend === "stabile") return "Stabile";
  return "—";
}

export function healthStatusOrdine(status: HealthStatus | null): number {
  switch (status) {
    case "RED":
      return 0;
    case "YELLOW":
      return 1;
    case "INSUFFICIENT":
      return 2;
    case "GREEN":
      return 3;
    default:
      return 4;
  }
}

export function thresholdModeDaHealth(
  mode: HealthMode,
): "BREAK_EVEN" | "EFFICIENCY" | "OTHER" {
  if (mode === "efficiency") return "EFFICIENCY";
  if (mode === "economic") return "BREAK_EVEN";
  return "OTHER";
}

export function emojiHealth(status: HealthStatus | null): string {
  switch (status) {
    case "GREEN":
      return "🟢";
    case "YELLOW":
      return "🟡";
    case "RED":
      return "🔴";
    case "INSUFFICIENT":
      return "⚪";
    default:
      return "•";
  }
}

export function etichettaHealth(status: HealthStatus | null): string {
  switch (status) {
    case "GREEN":
      return "Sostenibile";
    case "YELLOW":
      return "Da monitorare";
    case "RED":
      return "Fuori soglia";
    case "INSUFFICIENT":
      return "Dati insufficienti";
    default:
      return "Mai controllata";
  }
}

export function formatDataCheck(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function descrizioneLogControllo(input: {
  status: HealthStatus;
  metricLabel: string;
  primaryCost: number | null;
  threshold: number | null;
}): string {
  const kpi =
    input.primaryCost != null && Number.isFinite(input.primaryCost)
      ? `${input.metricLabel} ${formatEuro(input.primaryCost)}`
      : `${input.metricLabel} n/d`;
  const soglia =
    input.threshold != null && Number.isFinite(input.threshold)
      ? `soglia ${formatEuro(input.threshold)}`
      : "soglia n/d";
  return `Stato: ${input.status} · ${kpi} · ${soglia}`;
}
