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
  | "dati_insufficienti";

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
};

/**
 * CTR in percentuale numerica: 1.2 = 1.2% (non 0.012).
 * L'input manuale e la UI usano sempre questo formato.
 */
export const KPI_CTR_UNIT = "percent" as const;

/** Soglie indicative (non scientifiche) per CTR / frequenza / CPC. */
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

export function etichettaMetricaPrimaria(objective: CampagnaObjective): string {
  switch (objective) {
    case "BOOKINGS":
      return "CPA prenotazione";
    case "ECOMMERCE":
      return "CPA";
    case "IN_STORE":
      return "CPA / proxy";
    case "RETARGETING":
      return "CPA";
    case "AWARENESS":
      return "CPM";
    default:
      return "CPL";
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

  const actual =
    objective === "AWARENESS"
      ? kpis.cpm
      : kpis.costPerResult ??
        calcolaCostoDaSpesaRisultati(kpis.spend, kpis.results);

  return {
    objective,
    metricLabel: etichettaMetricaPrimaria(objective),
    actual,
    threshold,
    thresholdIsPlannedReference,
    healthMode,
    dailyBudget: campagna?.budgetGiornaliero ?? null,
    settore: (campagna?.settore ?? "").trim(),
    targetMargin: campagna?.targetMargin ?? null,
    roasAttuale: kpis.roas,
    roasBreakEvenHint: roasBreakEvenDaCampagna(campagna),
  };
}

/**
 * Semaforo economico (costo: più basso è meglio).
 * GREEN: actual <= threshold * 0.90
 * YELLOW: threshold * 0.90 < actual <= threshold
 * RED: actual > threshold
 */
export function calcolaHealthStatus(
  actual: number | null,
  threshold: number | null,
  mode: HealthMode = "economic",
): HealthResult {
  const efficiencyNote =
    mode === "efficiency"
      ? "Confronto con il CPM pianificato, non soglia economica di break-even."
      : undefined;

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
    if (actual <= threshold * 0.9) {
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

  if (actual <= threshold * 0.9) {
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
  if (ris != null && ris < 3) {
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

export function diagnosticaDeterministica(
  kpis: ControlRoomKpis,
  health: HealthResult,
  economic: EconomicContext,
  options?: { datiLimitati?: boolean },
): DiagnosisResult {
  const { ctr, cpc, frequency, costPerResult, results } = kpis;
  const threshold = economic.threshold;
  const actualCost =
    economic.objective === "AWARENESS"
      ? kpis.cpm
      : costPerResult ?? economic.actual;

  const ctrPct = ctr;
  const hasFunnelSignals =
    ctrPct != null || cpc != null || frequency != null;

  if (options?.datiLimitati && hasFunnelSignals) {
    return {
      signal: "dati_insufficienti",
      title: "Dati ancora limitati",
      body: "La campagna ha ancora pochi giorni o pochi risultati. I segnali sotto sono indicativi: verifica di nuovo tra qualche giorno.",
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  if (health.status === "INSUFFICIENT" && !hasFunnelSignals) {
    return {
      signal: "dati_insufficienti",
      title: "Diagnosi non disponibile",
      body: "Servono almeno il costo attuale e la soglia economica, oppure KPI di supporto (CTR, CPM, CPC).",
      canDiagnose: false,
      hint: "Aggiungi CTR, CPM o CPC per capire meglio dove si sta rompendo la campagna.",
    };
  }

  // ECOMMERCE: ROAS sotto break-even (solo se entrambi presenti in dati reali)
  if (
    economic.objective === "ECOMMERCE" &&
    economic.roasAttuale != null &&
    economic.roasAttuale > 0 &&
    economic.roasBreakEvenHint != null &&
    economic.roasAttuale < economic.roasBreakEvenHint
  ) {
    return {
      signal: "soglia_superata",
      title: "Segnale ROAS sotto break-even",
      body: `ROAS attuale (${economic.roasAttuale}x) sotto il break-even stimato (${economic.roasBreakEvenHint}x) dalla campagna salvata. Verifica CPA e margine.`,
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  // Fatica creativa: frequenza alta + CTR basso
  if (
    frequency != null &&
    frequency >= DIAG_FREQUENCY_HIGH &&
    ctrPct != null &&
    ctrPct < DIAG_CTR_GOOD
  ) {
    return {
      signal: "fatica_creativa",
      title: "Possibile fatica creativa",
      body: "La frequenza è alta e il CTR non è solido: il pubblico potrebbe aver già visto troppo spesso le stesse creatività.",
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  const sopraSoglia =
    health.status === "RED" ||
    (actualCost != null &&
      threshold != null &&
      actualCost > threshold);

  if (sopraSoglia && ctrPct != null && ctrPct < DIAG_CTR_LOW) {
    return {
      signal: "creativita_messaggio",
      title: "Possibile causa: creatività / messaggio",
      body: `Il ${economic.metricLabel} è sopra soglia e il CTR è basso. Segnale tipico di messaggio o creatività poco rilevante rispetto al pubblico.`,
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  if (
    sopraSoglia &&
    ctrPct != null &&
    ctrPct >= DIAG_CTR_GOOD &&
    cpc != null &&
    threshold != null &&
    cpc > threshold * DIAG_CPC_HIGH_RATIO
  ) {
    return {
      signal: "asta_audience",
      title: "Possibile causa: asta / audience",
      body: "Il CTR è buono ma il CPC è elevato: pressione d'asta, pubblico costoso o targeting da verificare.",
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  if (
    sopraSoglia &&
    ctrPct != null &&
    ctrPct >= DIAG_CTR_GOOD &&
    (cpc == null || threshold == null || cpc <= threshold * DIAG_CPC_HIGH_RATIO)
  ) {
    return {
      signal: "conversione_post_click",
      title: "Possibile causa: conversione post-click",
      body: "Il CTR è buono ma il costo per risultato resta alto: da verificare landing, form, offerta o flusso di conversione.",
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  if (sopraSoglia && !hasFunnelSignals) {
    return {
      signal: "soglia_superata",
      title: "Costo sopra soglia",
      body: `Il ${economic.metricLabel} supera la soglia economica. Aggiungi CTR, CPM o CPC per restringere la causa probabile.`,
      canDiagnose: true,
      hint: "Aggiungi CTR, CPM o CPC per capire meglio dove si sta rompendo la campagna.",
    };
  }

  if (sopraSoglia) {
    return {
      signal: "soglia_superata",
      title: "Costo sopra soglia",
      body: `Il ${economic.metricLabel} è fuori soglia. I KPI disponibili non bastano per isolare una sola causa: verifica creatività, pubblico e conversione.`,
      canDiagnose: true,
      hint: "Aggiungi CTR, CPM o CPC per capire meglio dove si sta rompendo la campagna.",
    };
  }

  if (health.status === "YELLOW") {
    return {
      signal: "vicino_soglia",
      title: "Vicino al limite sostenibile",
      body: "I costi sono ancora entro soglia ma senza margine ampio. Meglio osservare prima di aumentare la spesa.",
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  if (health.status === "GREEN") {
    return {
      signal: "sotto_soglia",
      title:
        health.mode === "efficiency"
          ? "CPM sotto il piano"
          : "Dentro la soglia economica",
      body:
        health.mode === "efficiency"
          ? "Il CPM è favorevole rispetto al piano. Continua a monitorare copertura e frequenza."
          : "Il confronto economico è positivo. Continua a monitorare stabilità di CTR e frequenza.",
      canDiagnose: true,
      hint: "Segnali indicativi, da interpretare nel contesto della campagna.",
    };
  }

  if (results != null && results < 3 && !hasFunnelSignals) {
    return {
      signal: "dati_insufficienti",
      title: "Diagnosi non disponibile",
      body: "KPI insufficienti per una diagnosi affidabile.",
      canDiagnose: false,
      hint: "Aggiungi CTR, CPM o CPC per capire meglio dove si sta rompendo la campagna.",
    };
  }

  return {
    signal: "dati_insufficienti",
    title: "Diagnosi non disponibile",
    body: "KPI insufficienti per una diagnosi affidabile.",
    canDiagnose: false,
    hint: "Aggiungi CTR, CPM o CPC per capire meglio dove si sta rompendo la campagna.",
  };
}

export function azioniConsigliate(
  diagnosis: DiagnosisResult,
  health: HealthResult,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  switch (diagnosis.signal) {
    case "creativita_messaggio":
      actions.push(
        { text: "Testa 2 nuove creatività", priority: "alta" },
        { text: "Non aumentare ancora il budget", priority: "alta" },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "asta_audience":
      actions.push(
        {
          text: "Verifica targeting e pressione d'asta (pubblico / placement)",
          priority: "alta",
        },
        { text: "Non aumentare ancora il budget", priority: "alta" },
        {
          text: "Confronta CPC e CPM con i giorni precedenti",
          priority: "media",
        },
      );
      break;
    case "conversione_post_click":
      actions.push(
        {
          text: "Verifica landing, form e offerta post-click",
          priority: "alta",
        },
        {
          text: "Controlla qualità dei lead / conversioni, non solo il volume",
          priority: "media",
        },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "fatica_creativa":
      actions.push(
        { text: "Ruota o sospendi le creatività più viste", priority: "alta" },
        { text: "Testa 2 nuove creatività", priority: "alta" },
        { text: "Non aumentare ancora il budget", priority: "media" },
      );
      break;
    case "soglia_superata":
      actions.push(
        { text: "Non aumentare ancora il budget", priority: "alta" },
        {
          text: "Completa CTR, CPM e CPC per restringere la causa",
          priority: "alta",
        },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
      );
      break;
    case "vicino_soglia":
      actions.push(
        { text: "Non aumentare ancora il budget", priority: "alta" },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
        {
          text: "Prepara 1 creatività di riserva senza pubblicarla subito",
          priority: "bassa",
        },
      );
      break;
    case "sotto_soglia":
      actions.push(
        {
          text: "Lascia correre e monitora stabilità dei costi",
          priority: "media",
        },
        { text: "Ricontrolla la campagna tra 3 giorni", priority: "media" },
        {
          text: "Documenta cosa sta funzionando (creatività / offerta)",
          priority: "bassa",
        },
      );
      break;
    default:
      actions.push(
        {
          text: "Inserisci i KPI principali (spesa, risultati, CTR)",
          priority: "alta",
        },
        {
          text: "Oppure carica uno screenshot di Ads Manager",
          priority: "media",
        },
        {
          text: "Seleziona una campagna con soglia economica salvata",
          priority: "media",
        },
      );
  }

  if (health.status === "RED" && actions[0]?.priority !== "alta") {
    actions.unshift({
      text: "Non aumentare ancora il budget",
      priority: "alta",
    });
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
