/**
 * M6D resolver — deterministic first; AI-supported only with valid diagnosis.
 * Pure. Does not mutate health/urgency/attention. No Meta / DB writes.
 */

import type {
  CampaignAiDiagnosis,
  DiagnosisAiConfidence,
  DiagnosisLikelyArea,
} from "@/lib/campaign-diagnosis/types";
import type {
  AttentionSource,
  AttentionState,
  AttentionTrend,
} from "@/lib/monday-control-room";
import type { HealthStatus } from "@/lib/control-room";
import { resolveNextActionCta } from "@/lib/campaign-next-action/cta";
import { etichettaNextAction } from "@/lib/campaign-next-action/labels";
import type {
  CampaignNextAction,
  NextActionConfidence,
  NextActionEligibility,
  NextActionType,
} from "@/lib/campaign-next-action/types";

export type NextActionConfigurationKind =
  | "DRAFT"
  | "ACTIVE_MISSING_TARGET"
  | "ACTIVE_MISSING_RESULTS"
  | "RESULT_MAPPING"
  | "OTHER"
  | null;

export type ResolveNextActionInput = {
  campaignId: string;
  source: AttentionSource;
  campaignStatus: string | null | undefined;
  attentionState: AttentionState;
  health: HealthStatus | null;
  trend?: AttentionTrend;
  healthAvailability?: string | null;
  configurationKind?: NextActionConfigurationKind;
  resultsCount?: number | null;
  rowHref: string;
  /** Optional on-demand diagnosis — never required for deterministic actions. */
  diagnosis?: CampaignAiDiagnosis | null;
};

function statusUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

function availabilityUpper(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export function isSmallSample(results: number | null | undefined): boolean {
  return results != null && results > 0 && results <= 2;
}

function minConf(
  a: NextActionConfidence,
  b: NextActionConfidence,
): NextActionConfidence {
  const rank = (c: NextActionConfidence) =>
    c === "HIGH" ? 2 : c === "MEDIUM" ? 1 : 0;
  return rank(a) <= rank(b) ? a : b;
}

function buildAction(input: {
  actionType: NextActionType;
  rationale: string;
  confidence: NextActionConfidence;
  eligibility: NextActionEligibility;
  actionSource: CampaignNextAction["actionSource"];
  blockingReason?: string | null;
  relatedDiagnosisArea?: DiagnosisLikelyArea | null;
  campaignId: string;
  source: AttentionSource;
  rowHref: string;
}): CampaignNextAction {
  const cta = resolveNextActionCta({
    actionType: input.actionType,
    source: input.source,
    campaignId: input.campaignId,
    rowHref: input.rowHref,
  });
  return {
    actionType: input.actionType,
    title: etichettaNextAction(input.actionType),
    rationale: input.rationale,
    confidence: input.confidence,
    eligibility: input.eligibility,
    actionSource: input.actionSource,
    blockingReason: input.blockingReason ?? null,
    relatedDiagnosisArea: input.relatedDiagnosisArea ?? null,
    ctaHref: cta.href,
    ctaLabel: cta.label,
  };
}

/** Map diagnosis area → review action (never execution). */
export function actionTypeFromDiagnosisArea(
  area: DiagnosisLikelyArea,
  confidence: DiagnosisAiConfidence,
): NextActionType {
  if (area === "UNKNOWN" || confidence === "LOW") {
    return "WAIT_FOR_MORE_DATA";
  }
  switch (area) {
    case "CREATIVE":
      return confidence === "HIGH"
        ? "CREATE_CREATIVE_VARIANT"
        : "REVIEW_CREATIVE";
    case "POST_CLICK":
      return "REVIEW_LANDING_OR_FORM";
    case "TRAFFIC_COST":
      return "REVIEW_AUDIENCE";
    case "TRACKING":
      return "VERIFY_TRACKING";
    case "DELIVERY":
      return "REVIEW_BUDGET";
    case "RESULT_QUALITY":
      return "REVIEW_RESULT_QUALITY";
  }
}

function rationaleForAiAction(
  type: NextActionType,
  area: DiagnosisLikelyArea,
): string {
  switch (type) {
    case "REVIEW_CREATIVE":
      return "I segnali disponibili puntano soprattutto alla creatività: conviene controllarla prima di altri interventi.";
    case "CREATE_CREATIVE_VARIANT":
      return "I segnali sulla creatività sono abbastanza chiari da giustificare la preparazione di una nuova variante.";
    case "REVIEW_LANDING_OR_FORM":
      return "Il segnale più coerente è dopo il clic: conviene controllare landing o form.";
    case "REVIEW_AUDIENCE":
      return "I costi di traffico risultano in peggioramento rispetto al periodo precedente: valuta il pubblico senza modifiche automatiche.";
    case "VERIFY_TRACKING":
      return "Prima di ottimizzare la performance, conviene verificare che il tracciamento sia affidabile.";
    case "REVIEW_BUDGET":
      return "Ci sono segnali sulla distribuzione: valuta il budget senza cambiarlo automaticamente.";
    case "REVIEW_RESULT_QUALITY":
      return "Ci sono segnali sulla qualità a valle dei risultati: valuta lead/conversioni senza interventi automatici.";
    case "WAIT_FOR_MORE_DATA":
      return area === "UNKNOWN"
        ? "I dati non localizzano ancora una causa: meglio raccogliere altre evidenze prima di intervenire."
        : "La confidenza è ancora bassa: meglio raccogliere altri dati prima di un intervento specifico.";
    default:
      return "Valuta il prossimo passo con cautela, senza modifiche automatiche.";
  }
}

function baseOf(input: ResolveNextActionInput) {
  return {
    campaignId: input.campaignId,
    source: input.source,
    rowHref: input.rowHref,
  };
}

/**
 * Deterministic path — runs before any AI mapping.
 * Returns null when no deterministic action applies (open performance case).
 */
export function resolveDeterministicNextAction(
  input: ResolveNextActionInput,
): CampaignNextAction | null {
  const status = statusUpper(input.campaignStatus);
  const availability = availabilityUpper(input.healthAvailability);
  const kind = input.configurationKind ?? null;
  const base = baseOf(input);

  if (input.attentionState === "HISTORICAL") {
    return buildAction({
      ...base,
      actionType: "HISTORICAL_LEARNING",
      rationale:
        "Usa questi dati come riferimento per la prossima campagna — senza interventi live.",
      confidence: "MEDIUM",
      eligibility: "ACTION_HISTORICAL_ONLY",
      actionSource: "DETERMINISTIC",
    });
  }

  if (status === "DRAFT" || kind === "DRAFT") {
    return buildAction({
      ...base,
      actionType: "REVIEW_CAMPAIGN_SETUP",
      rationale: "Completa la configurazione prima di valutare la performance.",
      confidence: "HIGH",
      eligibility: "ACTION_BLOCKED_CONFIGURATION",
      actionSource: "DETERMINISTIC",
      blockingReason: "Campagna in bozza.",
    });
  }

  if (status === "REVISION_REQUESTED") {
    return buildAction({
      ...base,
      actionType: "CONTACT_CLIENT",
      rationale:
        "Il cliente ha chiesto una revisione: gestisci le modifiche richieste.",
      confidence: "HIGH",
      eligibility: "ACTION_AVAILABLE",
      actionSource: "DETERMINISTIC",
    });
  }

  if (availability === "TARGET_REQUIRED" || kind === "ACTIVE_MISSING_TARGET") {
    return buildAction({
      ...base,
      actionType: "SET_TARGET",
      rationale:
        "Senza un target non è possibile valutare se la performance è accettabile.",
      confidence: "HIGH",
      eligibility: "ACTION_BLOCKED_CONFIGURATION",
      actionSource: "DETERMINISTIC",
      blockingReason: "Target mancante.",
    });
  }

  if (
    availability === "RESULT_MAPPING_REQUIRED" ||
    availability === "LINKED_BUT_KPI_INCOMPATIBLE" ||
    kind === "RESULT_MAPPING"
  ) {
    return buildAction({
      ...base,
      actionType: "VERIFY_TRACKING",
      rationale:
        "Prima di ottimizzare, verifica che il risultato Meta sia mappato correttamente.",
      confidence: "HIGH",
      eligibility: "ACTION_BLOCKED_CONFIGURATION",
      actionSource: "DETERMINISTIC",
      blockingReason: "Mappatura risultato incompleta.",
    });
  }

  if (input.attentionState === "CONFIGURATION_REQUIRED") {
    if (kind === "ACTIVE_MISSING_RESULTS") {
      return buildAction({
        ...base,
        actionType: "WAIT_FOR_MORE_DATA",
        rationale:
          "Mancano ancora risultati utilizzabili: raccogli dati prima di intervenire.",
        confidence: "MEDIUM",
        eligibility: "ACTION_BLOCKED_CONFIGURATION",
        actionSource: "DETERMINISTIC",
        blockingReason: "Risultati mancanti.",
      });
    }
    return buildAction({
      ...base,
      actionType: "REVIEW_CAMPAIGN_SETUP",
      rationale: "Completa la configurazione della campagna.",
      confidence: "MEDIUM",
      eligibility: "ACTION_BLOCKED_CONFIGURATION",
      actionSource: "DETERMINISTIC",
      blockingReason: "Configurazione incompleta.",
    });
  }

  if (
    input.attentionState === "INSUFFICIENT_DATA" ||
    input.health === "INSUFFICIENT" ||
    availability === "INSUFFICIENT_DATA"
  ) {
    return buildAction({
      ...base,
      actionType: "WAIT_FOR_MORE_DATA",
      rationale:
        "I dati sono ancora insufficienti per un intervento affidabile.",
      confidence: "HIGH",
      eligibility: "ACTION_BLOCKED_INSUFFICIENT_DATA",
      actionSource: "DETERMINISTIC",
      blockingReason: "Dati insufficienti.",
    });
  }

  if (input.attentionState === "STABLE") {
    return buildAction({
      ...base,
      actionType: "NO_ACTION",
      rationale:
        input.health === "GREEN"
          ? "La campagna è stabile rispetto al target: nessun intervento necessario."
          : "Nessun intervento prioritario al momento.",
      confidence: "HIGH",
      eligibility: "ACTION_NOT_NEEDED",
      actionSource: "DETERMINISTIC",
    });
  }

  // Small sample — conservative even before diagnosis.
  if (isSmallSample(input.resultsCount)) {
    const n = input.resultsCount!;
    return buildAction({
      ...base,
      actionType: "WAIT_FOR_MORE_DATA",
      rationale: `Con soli ${n} risultati, il campione è ancora troppo piccolo per intervenire con sicurezza.`,
      confidence: "LOW",
      eligibility: "ACTION_AVAILABLE",
      actionSource: "DETERMINISTIC",
    });
  }

  return null;
}

/**
 * AI-supported mapping from diagnosis. Never contradicts diagnosis area.
 */
export function resolveAiSupportedNextAction(
  input: ResolveNextActionInput,
  diagnosis: CampaignAiDiagnosis,
): CampaignNextAction {
  const base = baseOf(input);

  if (isSmallSample(input.resultsCount)) {
    const n = input.resultsCount!;
    return buildAction({
      ...base,
      actionType: "WAIT_FOR_MORE_DATA",
      rationale: `Con soli ${n} risultati, il campione è ancora troppo piccolo per intervenire con sicurezza.`,
      confidence: "LOW",
      eligibility: "ACTION_AVAILABLE",
      actionSource: "DETERMINISTIC",
      relatedDiagnosisArea: diagnosis.likely_area,
    });
  }

  let actionType = actionTypeFromDiagnosisArea(
    diagnosis.likely_area,
    diagnosis.confidence,
  );
  // LOW never yields aggressive intervention.
  if (diagnosis.confidence === "LOW") {
    actionType = "WAIT_FOR_MORE_DATA";
  }

  const confidence = minConf(
    diagnosis.confidence,
    actionType === "WAIT_FOR_MORE_DATA" ? "LOW" : diagnosis.confidence,
  );

  return buildAction({
    ...base,
    actionType,
    rationale: rationaleForAiAction(actionType, diagnosis.likely_area),
    confidence,
    eligibility: "ACTION_AVAILABLE",
    actionSource: "AI_SUPPORTED",
    relatedDiagnosisArea: diagnosis.likely_area,
  });
}

/**
 * Consistency guard: specific area actions require matching diagnosis area.
 */
export function actionConsistentWithDiagnosis(
  actionType: NextActionType,
  diagnosis: CampaignAiDiagnosis | null | undefined,
): boolean {
  if (!diagnosis) return true;
  if (diagnosis.likely_area === "UNKNOWN") {
    return (
      actionType === "WAIT_FOR_MORE_DATA" ||
      actionType === "NO_ACTION" ||
      actionType === "HISTORICAL_LEARNING"
    );
  }
  const expected = actionTypeFromDiagnosisArea(
    diagnosis.likely_area,
    diagnosis.confidence === "LOW" ? "MEDIUM" : diagnosis.confidence,
  );
  // LOW diagnosis always expects wait
  if (diagnosis.confidence === "LOW") {
    return actionType === "WAIT_FOR_MORE_DATA";
  }
  if (actionType === "WAIT_FOR_MORE_DATA") return true;
  // CREATIVE may be REVIEW or CREATE_VARIANT
  if (diagnosis.likely_area === "CREATIVE") {
    return (
      actionType === "REVIEW_CREATIVE" ||
      actionType === "CREATE_CREATIVE_VARIANT"
    );
  }
  if (diagnosis.likely_area === "TRAFFIC_COST") {
    return (
      actionType === "REVIEW_AUDIENCE" || actionType === "REVIEW_BUDGET"
    );
  }
  return actionType === expected;
}

/**
 * Full resolver: deterministic first, then diagnosis-backed if present.
 */
export function resolveNextAction(
  input: ResolveNextActionInput,
): CampaignNextAction {
  const deterministic = resolveDeterministicNextAction(input);

  if (deterministic) {
    const locksDiagnosis =
      deterministic.eligibility === "ACTION_BLOCKED_CONFIGURATION" ||
      deterministic.eligibility === "ACTION_BLOCKED_INSUFFICIENT_DATA" ||
      deterministic.eligibility === "ACTION_HISTORICAL_ONLY" ||
      deterministic.eligibility === "ACTION_NOT_NEEDED" ||
      deterministic.actionType === "CONTACT_CLIENT" ||
      deterministic.actionType === "WAIT_FOR_MORE_DATA";
    if (locksDiagnosis) {
      return deterministic;
    }
  }

  if (input.diagnosis) {
    return resolveAiSupportedNextAction(input, input.diagnosis);
  }

  if (deterministic) return deterministic;

  return buildAction({
    ...baseOf(input),
    actionType: "WAIT_FOR_MORE_DATA",
    rationale:
      "Valuta prima i segnali disponibili (o apri Perché?) prima di cambiare la campagna.",
    confidence: "LOW",
    eligibility: "ACTION_AVAILABLE",
    actionSource: "DETERMINISTIC",
  });
}

/** Phrases that must never appear in M6D rationales. */
export const PROHIBITED_ACTION_PHRASES = [
  "aumenta il budget",
  "riduci il budget",
  "increase budget",
  "decrease budget",
  "metti in pausa",
  "pause campaign",
  "duplica l'ad set",
  "cambia audience",
  "sostituisci la creatività",
] as const;
