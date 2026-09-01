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
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  frequency: number | null;
  roas: number | null;
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
  // FULL è riservato a metriche P0/P1 non ancora persistite (click, impression, …).
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
  input: Omit<DiagnosisResult, "explanation"> & { explanation?: string },
): DiagnosisResult {
  const explanation = input.explanation ?? input.body;
  return { ...input, explanation };
}

export function diagnosticaDeterministica(
  kpis: ControlRoomKpis,
  health: HealthResult,
  economic: EconomicContext,
  options?: { datiLimitati?: boolean },
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

  if (options?.datiLimitati && hasFunnelSignals) {
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
    return packDiagnosis({
      ...base,
      signal: "conversione_post_click",
      title: "Possibile perdita dopo il click",
      body: "Il traffico arriva, ma il risultato suggerisce di verificare cosa accade dopo il click.",
      canDiagnose: true,
      hint: "Non è una conclusione sulla landing: è un’ipotesi da verificare su form, offerta e flusso.",
      area: "POST_CLICK",
      confidence: "MEDIUM",
      evidence: ["CTR in linea col riferimento iniziale", "CPC non elevato rispetto alla soglia"],
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
