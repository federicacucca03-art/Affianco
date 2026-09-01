import type { ConversionRateSource } from "@/lib/conversion-rate";
import type { LaunchReadinessResult } from "@/lib/launch-readiness";
import type { WizardStep } from "@/lib/pre-lancio-check";
import {
  LABEL_STRATEGIA_DA_RIVEDERE,
  LABEL_STRATEGIA_SOLIDA,
  type StrategicScoreResult,
} from "@/lib/strategic-score";
import type { CampagnaObjective, TargetAgeBand, TargetType } from "@/types/campagne";
import {
  rilevaMismatchOffertaBrief,
  valutaQualitaBrief,
  valutaQualitaOfferta,
} from "@/lib/qualita-step1";
import {
  budgetRaggioDispersivo,
  cittaLocaleMancante,
  raggioMoltoStretto,
  rilevaMismatchTargetType,
  stepRaggioStretto,
} from "@/lib/qualita-targeting";

/**
 * Guidance Layer V2 — calcolata al volo, non persistita.
 *
 * Priorità visiva (1 principale + max 2 secondari):
 * BLOCKER > WARNING > INFO soglia > SUGGESTION > INFO lieve.
 */

export type GuidanceLevel = "INFO" | "SUGGESTION" | "WARNING" | "BLOCKER";

export type GuidanceItem = {
  id: string;
  level: GuidanceLevel;
  title: string;
  description: string;
  reason?: string;
  actionLabel?: string;
  field?: string;
  step: WizardStep;
};

export type GuidanceSet = {
  principale: GuidanceItem | null;
  secondari: GuidanceItem[];
};

export const MAX_GUIDANCE_SECONDARI = 2;

/**
 * Budget giornaliero «molto inferiore» alla soglia sostenibile.
 * 0,25 = il budget copre meno di un quarto della soglia CPL/CPA.
 * È una regola educativa, non un giudizio sul budget «giusto».
 */
export const BUDGET_PRUDENTE_RAPPORTO = 0.25;

function roundEuro(valore: number): number {
  return Math.round(valore);
}

function isPercorsoLead(objective?: CampagnaObjective): boolean {
  return !objective || objective === "LEADS";
}

function etichettaCosto(objective?: CampagnaObjective): "lead" | "CPA" {
  return isPercorsoLead(objective) ? "lead" : "CPA";
}

function pesoItem(item: GuidanceItem): number {
  if (item.level === "BLOCKER") return 500;
  if (item.level === "WARNING") {
    if (item.id === "step1-mismatch") return 430;
    if (item.id === "economia-cr-unknown") return 420;
    if (item.id === "economia-cr-estimated") return 410;
    return 400;
  }
  if (item.id === "economia-soglia") return 300;
  if (item.id === "step1-offerta-generica" || item.id === "step1-offerta-poco-chiara") {
    return 220;
  }
  if (item.id === "step1-brief-corto") return 210;
  if (item.id === "step1-eta-ampia") return 205;
  if (item.level === "SUGGESTION") return 200;
  if (item.id === "economia-cr-real") return 50;
  return 100;
}

export function ordinaGuidance(items: GuidanceItem[]): GuidanceItem[] {
  return [...items].sort((a, b) => pesoItem(b) - pesoItem(a));
}

export function selezionaGuidanceDaMostrare(
  items: GuidanceItem[],
): GuidanceSet {
  const ordinati = ordinaGuidance(items);
  const principale = ordinati[0] ?? null;
  const secondari = ordinati.slice(1, 1 + MAX_GUIDANCE_SECONDARI);
  return { principale, secondari };
}

export function haGuidanceDaMostrare(items: GuidanceItem[]): boolean {
  return selezionaGuidanceDaMostrare(items).principale != null;
}

export type GuidanceEconomicaInput = {
  ticket?: number | null;
  conversionRate?: number | null;
  conversionRateSource?: ConversionRateSource;
  margine?: number | null;
  budgetGiornaliero?: number | null;
  maxSustainableCpl?: number | null;
  objective?: CampagnaObjective;
};

export function generaGuidanceEconomica(
  input: GuidanceEconomicaInput,
): GuidanceItem[] {
  const items: GuidanceItem[] = [];
  const soglia =
    input.maxSustainableCpl != null &&
    Number.isFinite(input.maxSustainableCpl) &&
    input.maxSustainableCpl > 0
      ? roundEuro(input.maxSustainableCpl)
      : null;
  const budget =
    input.budgetGiornaliero != null &&
    Number.isFinite(input.budgetGiornaliero) &&
    input.budgetGiornaliero > 0
      ? input.budgetGiornaliero
      : 0;
  const fonte = input.conversionRateSource;
  const labelCosto = etichettaCosto(input.objective);

  if (soglia != null) {
    items.push({
      id: "economia-soglia",
      level: "INFO",
      title:
        labelCosto === "lead"
          ? `Puoi sostenere fino a circa ${soglia}€ per lead.`
          : `Puoi sostenere fino a circa ${soglia}€ di CPA.`,
      description:
        "Questa è la soglia economica massima stimata con i dati inseriti.",
      reason:
        "Deriva da ticket, tasso di conversione e margine già calcolati. Non è una previsione del costo su Meta.",
      field: "maxSustainableCpl",
      step: 2,
    });
  }

  if (fonte === "REAL") {
    items.push({
      id: "economia-cr-real",
      level: "INFO",
      title: "Stai usando un dato reale.",
      description:
        "Il tasso di conversione arriva da risultati già osservati, non da una stima.",
      field: "conversionRateSource",
      step: 2,
    });
  } else if (fonte === "ESTIMATED") {
    items.push({
      id: "economia-cr-estimated",
      level: "WARNING",
      title: "Il dato più fragile è il tasso di conversione.",
      description:
        "La soglia dipende da una stima. Quando avrai dati reali, aggiornala.",
      reason:
        "Una stima sposta la soglia sostenibile. Non è un giudizio sulla campagna.",
      field: "conversionRateSource",
      step: 2,
    });
  } else if (fonte === "UNKNOWN") {
    items.push({
      id: "economia-cr-unknown",
      level: "WARNING",
      title: "Affidabilità economica limitata.",
      description: "Manca una base reale per il tasso di conversione.",
      reason:
        "Senza un tasso noto i numeri di sostenibilità restano indicativi.",
      field: "conversionRateSource",
      step: 2,
    });
  }

  if (
    soglia != null &&
    budget > 0 &&
    budget < soglia * BUDGET_PRUDENTE_RAPPORTO
  ) {
    items.push({
      id: "economia-budget-prudente",
      level: "SUGGESTION",
      title: "Partenza prudente.",
      description:
        "Con questo budget potrebbe servire più tempo per raccogliere abbastanza risultati prima di giudicare la campagna.",
      reason: `Il budget giornaliero (${roundEuro(budget)}€) è molto inferiore alla soglia sostenibile (${soglia}€). Non è un budget sbagliato: implica tempi più lunghi.`,
      field: "budgetGiornaliero",
      step: 2,
    });
  }

  return items;
}

export type GuidanceStep1Input = {
  frontEndOffer?: string | null;
  elevatorPitch?: string | null;
  targetAge?: TargetAgeBand | string | null;
  etaMin?: number | null;
  etaMax?: number | null;
};

function etaEstremamenteAmpia(input: GuidanceStep1Input): boolean {
  const band = (input.targetAge ?? "").trim().toLowerCase();
  if (band === "all" || band === "tutte" || band === "tutte le età") {
    return true;
  }
  const min = input.etaMin;
  const max = input.etaMax;
  if (
    min != null &&
    max != null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min <= 18 &&
    max >= 65
  ) {
    return true;
  }
  return false;
}

/**
 * Step 1: qualità offerta/brief via `qualita-step1.ts` (non soglie di caratteri).
 * Offerta vuota: il wizard già blocca Continua. Non duplicare.
 */
export function generaGuidanceStep1(
  input: GuidanceStep1Input,
): GuidanceItem[] {
  const items: GuidanceItem[] = [];
  const offerta = (input.frontEndOffer ?? "").trim();
  const brief = (input.elevatorPitch ?? "").trim();

  if (offerta && brief && rilevaMismatchOffertaBrief(offerta, brief)) {
    items.push({
      id: "step1-mismatch",
      level: "WARNING",
      title: "Offerta e brief non sembrano allineati.",
      description:
        "Il brief sembra parlare di un servizio diverso rispetto all'offerta indicata.",
      actionLabel: "Rivedi offerta e brief",
      field: "frontEndOffer",
      step: 1,
    });
  }

  // Offerta vuota: il wizard già blocca il Continua. Non duplicare.
  if (offerta.length > 0) {
    const qOfferta = valutaQualitaOfferta(offerta);
    if (qOfferta === "GENERIC") {
      items.push({
        id: "step1-offerta-generica",
        level: "SUGGESTION",
        title: "Rendi l'offerta più specifica.",
        description:
          "Il servizio è ancora descritto in modo generico. Specifica cosa riceve concretamente il cliente.",
        actionLabel: "Rivedi offerta",
        field: "frontEndOffer",
        step: 1,
      });
    } else if (qOfferta === "TOO_SHORT" || qOfferta === "UNCLEAR") {
      items.push({
        id: "step1-offerta-poco-chiara",
        level: "SUGGESTION",
        title: "Chiarisci meglio l'offerta.",
        description:
          "Aggiungi il servizio concreto e cosa riceve il cliente.",
        field: "frontEndOffer",
        step: 1,
      });
    }
  }

  const qBrief = valutaQualitaBrief(brief);
  if (qBrief === "TOO_SHORT" || qBrief === "INCOMPLETE") {
    items.push({
      id: "step1-brief-corto",
      level: "SUGGESTION",
      title: "Il brief può guidare meglio Affianco.",
      description:
        "Aggiungi target, obiettivo e tono della comunicazione.",
      actionLabel: "Completa il brief",
      field: "elevatorPitch",
      step: 1,
    });
  }

  if (etaEstremamenteAmpia(input)) {
    items.push({
      id: "step1-eta-ampia",
      level: "SUGGESTION",
      title: "Il target è molto ampio.",
      description:
        "Verifica che questa fascia sia davvero coerente con l'offerta.",
      field: "targetAge",
      step: 1,
    });
  }

  return items;
}

export type GuidanceTargetingInput = {
  objective?: CampagnaObjective | null;
  citta?: string | null;
  raggioKm?: number | null;
  budgetGiornaliero?: number | null;
  targetType?: TargetType | null;
  elevatorPitch?: string | null;
};

/**
 * Targeting contestuale (città, raggio, budget+raggio, B2C/B2B).
 * Non tocca economia P0 né qualità offerta/brief.
 */
export function generaGuidanceTargeting(
  input: GuidanceTargetingInput,
): GuidanceItem[] {
  const items: GuidanceItem[] = [];
  const objective = input.objective ?? undefined;

  if (cittaLocaleMancante(objective, input.citta)) {
    items.push({
      id: "step1-citta-assente",
      level: "SUGGESTION",
      title: "Manca la zona della campagna.",
      description:
        "Indica una città per aiutare Affianco a impostare correttamente il pubblico locale.",
      field: "citta",
      step: 1,
    });
  }

  const mismatchTipo = rilevaMismatchTargetType(
    input.targetType,
    input.elevatorPitch,
  );
  if (mismatchTipo === "B2B") {
    items.push({
      id: "step1-target-type-mismatch",
      level: "SUGGESTION",
      title: "Il brief sembra descrivere un pubblico B2B.",
      description:
        "Verifica che il tipo cliente selezionato sia coerente con il pubblico descritto.",
      field: "targetType",
      step: 1,
    });
  } else if (mismatchTipo === "B2C") {
    items.push({
      id: "step1-target-type-mismatch",
      level: "SUGGESTION",
      title: "Il brief sembra descrivere un pubblico B2C.",
      description:
        "Verifica che il tipo cliente selezionato sia coerente con il pubblico descritto.",
      field: "targetType",
      step: 1,
    });
  }

  if (raggioMoltoStretto(objective, input.raggioKm)) {
    items.push({
      id: "targeting-raggio-stretto",
      level: "SUGGESTION",
      title: "Il raggio è molto ristretto.",
      description:
        "Potrebbe limitare il volume disponibile. Verifica che sia intenzionale.",
      field: "raggioKm",
      step: stepRaggioStretto(objective),
    });
  }

  if (
    budgetRaggioDispersivo(
      objective,
      input.budgetGiornaliero,
      input.raggioKm,
    )
  ) {
    items.push({
      id: "targeting-budget-raggio",
      level: "SUGGESTION",
      title: "Il pubblico potrebbe essere dispersivo rispetto al budget.",
      description:
        "Con un raggio così ampio e un budget contenuto, potrebbe servire più tempo per raccogliere segnali utili.",
      field: "budgetGiornaliero",
      step: 2,
    });
  }

  return items;
}

export type RaccomandazioneLancioStato =
  | "READY_TO_LAUNCH"
  | "READY_WITH_CAUTION"
  | "NOT_READY";

export type RaccomandazioneLancio = {
  stato: RaccomandazioneLancioStato;
  title: string;
  description: string;
  reasons: string[];
  actions: string[];
};

const IDS_TECNICI_LANCIO = new Set([
  "pageId",
  "destinazione",
  "export",
  "creativita",
]);

function economiaCalcolabile(
  score: StrategicScoreResult,
  objective?: CampagnaObjective,
): boolean {
  if (objective === "AWARENESS") {
    return score.economia.budgetGiornaliero > 0;
  }
  if (score.economia.conversionRateSource === "UNKNOWN") return false;
  return score.economia.maxCplCalcolabile && score.economia.numeriAffidabili;
}

function warningCriticiAperti(
  score: StrategicScoreResult,
): boolean {
  const fonte = score.economia.conversionRateSource;
  return (
    fonte === "ESTIMATED" ||
    fonte === "UNKNOWN" ||
    score.avvisoSprecoBudget
  );
}

function tagliaTre(voci: string[]): string[] {
  return voci.filter(Boolean).slice(0, 3);
}

export type RaccomandaLancioInput = {
  strategicScore: StrategicScoreResult;
  launchReadiness: LaunchReadinessResult;
  haErroriBloccantiPreLancio?: boolean;
  guidanceBlockers?: GuidanceItem[];
  objective?: CampagnaObjective;
};

/**
 * Combina Strategic Score V2 + Launch Readiness + errori diagnosi.
 * Non modifica gli score: produce solo una raccomandazione di lancio.
 */
export function raccomandaLancio(
  input: RaccomandaLancioInput,
): RaccomandazioneLancio {
  const { strategicScore, launchReadiness, objective } = input;
  const blockers = (input.guidanceBlockers ?? []).filter(
    (item) => item.level === "BLOCKER",
  );
  const tecniciMancanti = launchReadiness.items.filter(
    (item) => IDS_TECNICI_LANCIO.has(item.id) && !item.ok,
  );
  const approvalMancante = launchReadiness.items.find(
    (item) => item.id === "approvazione" && !item.ok,
  );
  const economiaOk = economiaCalcolabile(strategicScore, objective);
  const strategiaSolida = strategicScore.label === LABEL_STRATEGIA_SOLIDA;
  const strategiaDaRivedere =
    strategicScore.label === LABEL_STRATEGIA_DA_RIVEDERE;

  const reasonsNotReady: string[] = [];
  const actionsNotReady: string[] = [];

  if (input.haErroriBloccantiPreLancio) {
    reasonsNotReady.push(
      "Ci sono elementi da correggere nella diagnosi pre-lancio.",
    );
    actionsNotReady.push("Torna alla diagnosi e sistema i punti in rosso.");
  }
  if (blockers.length > 0) {
    reasonsNotReady.push(blockers[0].title);
    if (blockers[0].actionLabel) {
      actionsNotReady.push(blockers[0].actionLabel);
    }
  }
  if (!economiaOk) {
    reasonsNotReady.push("L'economia non è ancora calcolabile.");
    actionsNotReady.push(
      "Completa ticket, tasso di conversione e margine nello step Economia.",
    );
  }
  for (const item of tecniciMancanti) {
    reasonsNotReady.push(item.mancante ?? `${item.label} mancante`);
    if (item.id === "pageId") {
      actionsNotReady.push("Inserisci l'ID Pagina Facebook.");
    } else if (item.id === "destinazione") {
      actionsNotReady.push(
        item.mancante?.includes("Modulo")
          ? "Inserisci l'ID Modulo Contatti."
          : "Completa la destinazione della campagna.",
      );
    } else if (item.id === "export") {
      actionsNotReady.push("Completa copy e titolo per l'export.");
    } else if (item.id === "creativita") {
      actionsNotReady.push("Carica almeno una creatività.");
    }
  }

  const notReadyTecnicoOBlocco =
    input.haErroriBloccantiPreLancio ||
    blockers.length > 0 ||
    !economiaOk ||
    tecniciMancanti.length > 0;

  if (notReadyTecnicoOBlocco) {
    const soloTecnico =
      tecniciMancanti.length > 0 &&
      !input.haErroriBloccantiPreLancio &&
      blockers.length === 0 &&
      economiaOk;
    return {
      stato: "NOT_READY",
      title: "Non lancerei ancora.",
      description: soloTecnico
        ? strategiaSolida
          ? "La strategia è solida, ma mancano elementi operativi per il lancio."
          : "Prima sistemerei questi elementi."
        : "Prima sistemerei questi elementi.",
      reasons: tagliaTre(reasonsNotReady),
      actions: tagliaTre(actionsNotReady),
    };
  }

  const reasonsCaution: string[] = [];
  const actionsCaution: string[] = [];

  if (!launchReadiness.isReady && approvalMancante) {
    reasonsCaution.push(
      approvalMancante.mancante ?? "Approvazione cliente mancante",
    );
    actionsCaution.push("Fai approvare la campagna al cliente.");
  } else if (!launchReadiness.isReady) {
    reasonsCaution.push("La configurazione operativa non è ancora completa.");
    actionsCaution.push("Completa gli elementi ancora aperti in Prontezza al lancio.");
  }

  if (warningCriticiAperti(strategicScore)) {
    if (strategicScore.economia.conversionRateSource === "ESTIMATED") {
      reasonsCaution.push(
        "Il tasso di conversione è una stima: la soglia va riletta con dati reali.",
      );
      actionsCaution.push("Aggiorna il tasso quando avrai risultati veri.");
    }
    if (strategicScore.avvisoSprecoBudget) {
      reasonsCaution.push(
        "Il riferimento di mercato supera la soglia sostenibile.",
      );
    }
  }

  if (!strategiaSolida) {
    reasonsCaution.push(
      strategiaDaRivedere
        ? "La strategia va ancora riletta prima di spendere."
        : "La strategia è una buona base, non ancora solida.",
    );
  }

  const caution =
    !launchReadiness.isReady ||
    warningCriticiAperti(strategicScore) ||
    !strategiaSolida;

  if (caution) {
    return {
      stato: "READY_WITH_CAUTION",
      title: "Quasi pronta.",
      description:
        "La strategia è solida, ma ci sono ancora elementi da completare o verificare.",
      reasons: tagliaTre(reasonsCaution),
      actions: tagliaTre(actionsCaution),
    };
  }

  return {
    stato: "READY_TO_LAUNCH",
    title: "Puoi lanciare.",
    description:
      "La strategia e la configurazione operativa sono complete.",
    reasons: tagliaTre([
      "Strategic Score in stato solido.",
      "Prontezza al lancio completa.",
    ]),
    actions: [],
  };
}

export type CopyHeaderStep6 = {
  titolo: string;
  sottotitolo: string;
};

/** Sintesi header Step 6: non duplica la card Guidance. */
export function copyHeaderStep6(
  stato: RaccomandazioneLancioStato,
): CopyHeaderStep6 {
  if (stato === "READY_TO_LAUNCH") {
    return {
      titolo: "Campagna pronta",
      sottotitolo:
        "La strategia e la configurazione operativa sono complete.",
    };
  }
  if (stato === "READY_WITH_CAUTION") {
    return {
      titolo: "Configurazione quasi pronta",
      sottotitolo:
        "Ci sono ancora alcuni elementi da verificare prima del lancio.",
    };
  }
  return {
    titolo: "Configurazione da completare",
    sottotitolo:
      "Completa gli elementi indicati da Affianco prima di andare live.",
  };
}

export function etichettaStepperStep6(
  stato: RaccomandazioneLancioStato,
): string {
  if (stato === "READY_TO_LAUNCH") return "Pronta";
  if (stato === "READY_WITH_CAUTION") return "Da verificare";
  return "Da completare";
}

export const LABEL_EXPORT_PRONTA = "Esporta Campagna Pronta per Meta";
export const LABEL_EXPORT_BOZZA = "Esporta bozza per Meta";
export const MICROCOPY_EXPORT_PRONTA =
  "La configurazione è completa per l'importazione.";
export const MICROCOPY_EXPORT_BOZZA =
  "Puoi preparare il file ora e completare gli elementi mancanti in Ads Manager prima della pubblicazione.";
export const MICROCOPY_EXPORT_PAGE_FORM =
  "Page ID e Form ID dovranno essere completati in Meta Ads Manager prima di andare live.";
export const MICROCOPY_EXPORT_PAGE =
  "Page ID dovrà essere completato in Meta Ads Manager prima di andare live.";
export const MICROCOPY_EXPORT_FORM =
  "Form ID dovrà essere completato in Meta Ads Manager prima di andare live.";
export const MICROCOPY_EXPORT_BLOCCATO =
  "Inserisci almeno un testo annuncio per generare il file.";

export type EtichetteExportMeta = {
  labelCta: string;
  microcopy: string;
  exportAbilitato: boolean;
  motivoBlocco?: string;
};

export type EtichetteExportMetaInput = {
  statoLancio: RaccomandazioneLancioStato;
  /** Almeno una variante A/B/C con testo: il CSV non usa il placeholder. */
  haCopyExport: boolean;
  pageIdMancante?: boolean;
  formIdMancante?: boolean;
};

/**
 * Label e microcopy export: lancio ≠ file CSV.
 * Page/Form vuoti non bloccano se il generatore li accetta.
 * Blocco solo se manca il copy necessario a produrre un file valido.
 */
export function etichetteExportMeta(
  input: EtichetteExportMetaInput,
): EtichetteExportMeta {
  if (!input.haCopyExport) {
    return {
      labelCta: LABEL_EXPORT_BOZZA,
      microcopy: MICROCOPY_EXPORT_BLOCCATO,
      exportAbilitato: false,
      motivoBlocco: MICROCOPY_EXPORT_BLOCCATO,
    };
  }

  if (input.statoLancio === "READY_TO_LAUNCH") {
    return {
      labelCta: LABEL_EXPORT_PRONTA,
      microcopy: MICROCOPY_EXPORT_PRONTA,
      exportAbilitato: true,
    };
  }

  const page = Boolean(input.pageIdMancante);
  const form = Boolean(input.formIdMancante);
  const microcopy =
    page && form
      ? MICROCOPY_EXPORT_PAGE_FORM
      : page
        ? MICROCOPY_EXPORT_PAGE
        : form
          ? MICROCOPY_EXPORT_FORM
          : MICROCOPY_EXPORT_BOZZA;

  return {
    labelCta: LABEL_EXPORT_BOZZA,
    microcopy,
    exportAbilitato: true,
  };
}
