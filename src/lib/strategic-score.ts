import { analizzaControlloMessaggioLeads } from "@/lib/controllo-messaggio";
import type { ConversionRateSource } from "@/lib/conversion-rate";
import {
  richiedeDestinationUrl,
  richiedeModuloContatti,
} from "@/lib/launch-readiness";
import type { BookingChannel, CampagnaObjective } from "@/types/campagne";

export { richiedeDestinationUrl, richiedeModuloContatti };

export const LABEL_VALUTAZIONE_IN_CORSO = "Valutazione in corso";
export const LABEL_STRATEGIA_DA_RIVEDERE = "Strategia da rivedere";
export const LABEL_BUONA_BASE = "Buona base — alcuni elementi da migliorare";
export const LABEL_STRATEGIA_SOLIDA = "Strategia solida";
export const LABEL_RISCHIO_SPRECO_BUDGET = "Rischio spreco budget";
export const CAVEAT_STIMA =
  "Calcolo basato su una stima — sostituisci con dati reali appena disponibili.";

export const PESI_STRATEGIC_SCORE = {
  economia: 40,
  offerta: 15,
  targeting: 15,
  copy: 20,
  creativita: 10,
} as const;

/**
 * Pesi (totale 100) — qualità / sostenibilità della campagna, non completezza Meta.
 *
 * Economia 40: se l'acquisizione non è sostenibile, copy e targeting non
 * recuperano il cliente. Il benchmark nicchia/città è un riferimento, non
 * un veto binario sul budget.
 *
 * Offerta / brief 15: senza offerta e contesto non c'è una strategia, solo spend.
 *
 * Targeting 15: tipo cliente, fascia d'età e geografia definiscono il perimetro
 * della domanda. Pesa quanto l'offerta perché un'offerta senza pubblico è cieca.
 *
 * Copy 20: il messaggio è il veicolo della strategia. Un testo presente ma
 * incoerente con offerta/brief non vale quanto un testo allineato (checker
 * semantico deterministico esistente).
 *
 * Creatività 10: readiness visiva (c'è un creativo da mostrare), non un
 * requisito tecnico Meta. Pesa meno del copy perché qui si valuta solo la
 * presenza, non la qualità visiva.
 */

export type StrategicScoreFase = "provvisoria" | "completa";

export type StrategicScoreInput = {
  budgetGiornaliero: number;
  /** Riferimento nicchia/città: informativo, non soglia binaria dello score. */
  recommendedDailyBudgetMin?: number;
  cplMercatoMin?: number;
  settore: string;
  citta: string;
  ticket?: number | null;
  conversionRate?: number | null;
  conversionRateSource?: ConversionRateSource;
  targetMargin?: number | null;
  /** CPL/CPA max già calcolato dal wizard (formule esistenti per obiettivo). */
  maxSustainableCpl?: number | null;
  frontEndOffer?: string;
  elevatorPitch?: string;
  targetType?: string;
  targetAge?: string;
  raggioKm?: number | null;
  haCopySelezionato: boolean;
  copyVarianteA?: string;
  titoloAnnuncio?: string;
  fotoCaricata: boolean;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  /**
   * provvisoria (Step 2): sintesi economica, niente punteggio di lancio.
   * completa (Step 5/6): score su dati disponibili, senza Page/Form ID.
   */
  fase?: StrategicScoreFase;
};

export type StrategicScoreBreakdown = {
  economia: number;
  offerta: number;
  targeting: number;
  copy: number;
  creativita: number;
};

export type EconomiaSintesi = {
  ticketPresente: boolean;
  conversionRatePresente: boolean;
  marginPresente: boolean;
  maxCplCalcolabile: boolean;
  maxSustainableCpl: number | null;
  budgetGiornaliero: number;
  conversionRateSource: ConversionRateSource | undefined;
  budgetSostenibile: boolean | null;
  benchmarkBudgetMin: number | null;
  citta: string;
  avvisoSprecoBudget: boolean;
  numeriAffidabili: boolean;
};

export type StrategicScoreResult = {
  score: number;
  label: string;
  tone: "green" | "yellow" | "orange" | "neutral";
  suggestions: string[];
  isComplete: boolean;
  mostraPunteggio: boolean;
  fase: StrategicScoreFase;
  datiSufficienti: boolean;
  avvisoSprecoBudget: boolean;
  economia: EconomiaSintesi;
  breakdown: StrategicScoreBreakdown;
};

const SOTTO_ECONOMIA = {
  ticket: 8,
  conversion: 8,
  margin: 8,
  maxCpl: 8,
  budget: 8,
} as const;

function presente(valore: string | undefined | null): boolean {
  return Boolean((valore ?? "").trim());
}

function numeroPositivo(valore: number | null | undefined): boolean {
  return valore != null && Number.isFinite(valore) && valore > 0;
}

function isPercorsoLeads(objective?: CampagnaObjective): boolean {
  return !objective || objective === "LEADS";
}

function richiedeRaggio(objective?: CampagnaObjective): boolean {
  return (
    !objective ||
    objective === "LEADS" ||
    objective === "BOOKINGS" ||
    objective === "IN_STORE" ||
    objective === "AWARENESS"
  );
}

function copyCoerenteLeads(input: StrategicScoreInput): "ok" | "ko" | "na" {
  if (!isPercorsoLeads(input.objective)) return "na";
  const testo = (input.copyVarianteA ?? "").trim();
  if (!testo) return "na";
  const esito = analizzaControlloMessaggioLeads({
    testoVarianteA: testo,
    headline: input.titoloAnnuncio,
    citta: input.citta,
    frontEndOffer: input.frontEndOffer ?? "",
    brief: input.elevatorPitch,
    settore: input.settore,
  });
  const coerenza = esito.voci.find((voce) => voce.id === "coerenza");
  if (!coerenza) return "na";
  if (coerenza.emoji === "🟢") return "ok";
  if (coerenza.emoji === "🟡") return "ko";
  return "na";
}

function puntiCopy(input: StrategicScoreInput): number {
  if (!input.haCopySelezionato) return 0;
  const coerenza = copyCoerenteLeads(input);
  if (coerenza === "ok") return PESI_STRATEGIC_SCORE.copy;
  if (coerenza === "ko") return Math.round(PESI_STRATEGIC_SCORE.copy / 2);
  return 15;
}

function puntiEconomia(input: StrategicScoreInput): {
  punti: number;
  sintesi: EconomiaSintesi;
} {
  const ticketOk = numeroPositivo(input.ticket);
  const source = input.conversionRateSource;
  const conversionOk =
    source !== "UNKNOWN" && numeroPositivo(input.conversionRate);
  const marginOk = numeroPositivo(input.targetMargin);
  const maxCplDaWizard = numeroPositivo(input.maxSustainableCpl)
    ? (input.maxSustainableCpl as number)
    : null;
  const maxCplCalcolabile = maxCplDaWizard != null;
  const budgetOk = numeroPositivo(input.budgetGiornaliero);
  const numeriAffidabili = source !== "UNKNOWN" && conversionOk && ticketOk;

  const cplMercato = numeroPositivo(input.cplMercatoMin)
    ? (input.cplMercatoMin as number)
    : null;

  /**
   * Spreco verificabile: il CPL di mercato tipico supera il massimo sostenibile.
   * Non si deriva dal totale numerico né da budget < benchmark città.
   */
  const avvisoSprecoBudget =
    numeriAffidabili &&
    maxCplCalcolabile &&
    cplMercato != null &&
    cplMercato > maxCplDaWizard;

  /**
   * Budget coerente con l'economia reale: se il max CPL è calcolabile,
   * il budget giornaliero non è un veto. Un budget sotto il benchmark città
   * resta valido se l'economia (ticket × conv × margine) sostiene l'acquisizione.
   */
  let budgetSostenibile: boolean | null = null;
  if (maxCplCalcolabile && budgetOk && numeriAffidabili) {
    budgetSostenibile = !avvisoSprecoBudget;
  } else if (budgetOk && !numeriAffidabili) {
    budgetSostenibile = null;
  }

  let puntiBudget = 0;
  if (budgetOk) {
    if (maxCplCalcolabile && numeriAffidabili) {
      puntiBudget = avvisoSprecoBudget
        ? Math.round(SOTTO_ECONOMIA.budget / 2)
        : SOTTO_ECONOMIA.budget;
    } else {
      puntiBudget = Math.round(SOTTO_ECONOMIA.budget / 2);
    }
  }

  const punti =
    (ticketOk ? SOTTO_ECONOMIA.ticket : 0) +
    (conversionOk ? SOTTO_ECONOMIA.conversion : 0) +
    (marginOk ? SOTTO_ECONOMIA.margin : 0) +
    (maxCplCalcolabile ? SOTTO_ECONOMIA.maxCpl : 0) +
    puntiBudget;

  return {
    punti,
    sintesi: {
      ticketPresente: ticketOk,
      conversionRatePresente: conversionOk,
      marginPresente: marginOk,
      maxCplCalcolabile,
      maxSustainableCpl: maxCplDaWizard,
      budgetGiornaliero: Number(input.budgetGiornaliero) || 0,
      conversionRateSource: source,
      budgetSostenibile,
      benchmarkBudgetMin: numeroPositivo(input.recommendedDailyBudgetMin)
        ? (input.recommendedDailyBudgetMin as number)
        : null,
      citta: input.citta.trim(),
      avvisoSprecoBudget,
      numeriAffidabili,
    },
  };
}

function puntiOfferta(input: StrategicScoreInput): number {
  const offertaOk = presente(input.frontEndOffer);
  const briefOk = presente(input.elevatorPitch);
  if (offertaOk && briefOk) return PESI_STRATEGIC_SCORE.offerta;
  if (offertaOk || briefOk) return Math.round(PESI_STRATEGIC_SCORE.offerta / 2);
  return 0;
}

function puntiTargeting(input: StrategicScoreInput): number {
  const tipoOk = presente(input.targetType);
  const etaOk = presente(input.targetAge);
  const cittaOk = presente(input.citta);
  const raggioOk =
    !richiedeRaggio(input.objective) || numeroPositivo(input.raggioKm);
  const pezzi = [tipoOk, etaOk, cittaOk || raggioOk].filter(Boolean).length;
  if (pezzi === 3) return PESI_STRATEGIC_SCORE.targeting;
  if (pezzi === 2) return 10;
  if (pezzi === 1) return 5;
  return 0;
}

/**
 * Punteggio strategico 0–100: qualità e sostenibilità.
 * Page ID e Form ID non entrano: sono Launch Readiness.
 * Budget < benchmark città non azzera l'economia.
 */
export function calculateStrategicScore(
  input: StrategicScoreInput,
): StrategicScoreResult {
  const fase: StrategicScoreFase = input.fase ?? "completa";
  const { punti: economia, sintesi } = puntiEconomia(input);
  const offerta = puntiOfferta(input);
  const targeting = puntiTargeting(input);
  const copy = puntiCopy(input);
  const creativita = input.fotoCaricata ? PESI_STRATEGIC_SCORE.creativita : 0;

  const score = economia + offerta + targeting + copy + creativita;
  const datiSufficienti =
    sintesi.ticketPresente &&
    sintesi.marginPresente &&
    sintesi.conversionRatePresente &&
    sintesi.maxCplCalcolabile;

  const suggestions: string[] = [];
  const cittaLabel = input.citta.trim() || "la tua zona";

  if (fase === "completa") {
    if (!sintesi.ticketPresente) {
      suggestions.push("Manca il valore medio di vendita (ticket).");
    }
    if (input.conversionRateSource === "UNKNOWN") {
      suggestions.push(
        "Tasso di conversione sconosciuto: i numeri economici non sono ancora affidabili.",
      );
    } else if (!sintesi.conversionRatePresente) {
      suggestions.push("Manca il tasso di conversione.");
    }
    if (!sintesi.marginPresente) {
      suggestions.push("Manca il margine target.");
    }
    if (!input.haCopySelezionato) {
      suggestions.push("Manca il copy della campagna.");
    } else if (copyCoerenteLeads(input) === "ko") {
      suggestions.push(
        "Il copy non è allineato a offerta e brief: rivedi il messaggio.",
      );
    }
    if (!input.fotoCaricata) {
      suggestions.push("Manca la creatività.");
    }
    if (!presente(input.frontEndOffer) || !presente(input.elevatorPitch)) {
      suggestions.push("Completa offerta e brief.");
    }
  }

  if (sintesi.benchmarkBudgetMin != null) {
    suggestions.push(
      `Per realtà simili a ${cittaLabel} il benchmark indicativo parte da circa ${sintesi.benchmarkBudgetMin}€/giorno.`,
    );
  }

  if (input.conversionRateSource === "ESTIMATED") {
    suggestions.push(`ℹ️ ${CAVEAT_STIMA}`);
  }

  if (sintesi.avvisoSprecoBudget && fase === "completa") {
    suggestions.push(
      `⚠️ ${LABEL_RISCHIO_SPRECO_BUDGET}: il CPL di mercato tipico supera la soglia sostenibile calcolata sui dati economici.`,
    );
  }

  let label = LABEL_VALUTAZIONE_IN_CORSO;
  let tone: StrategicScoreResult["tone"] = "neutral";
  let mostraPunteggio = false;

  if (fase === "provvisoria" || !datiSufficienti) {
    label = LABEL_VALUTAZIONE_IN_CORSO;
    tone = "neutral";
    mostraPunteggio = false;
  } else if (sintesi.avvisoSprecoBudget && score < 45) {
    label = LABEL_STRATEGIA_DA_RIVEDERE;
    tone = "orange";
    mostraPunteggio = true;
  } else if (score < 45) {
    label = LABEL_STRATEGIA_DA_RIVEDERE;
    tone = "orange";
    mostraPunteggio = true;
  } else if (score < 75) {
    label = LABEL_BUONA_BASE;
    tone = "yellow";
    mostraPunteggio = true;
  } else {
    label = LABEL_STRATEGIA_SOLIDA;
    tone = "green";
    mostraPunteggio = true;
  }

  return {
    score,
    label,
    tone,
    suggestions,
    isComplete: datiSufficienti && score === 100,
    mostraPunteggio,
    fase,
    datiSufficienti,
    avvisoSprecoBudget: sintesi.avvisoSprecoBudget,
    economia: sintesi,
    breakdown: { economia, offerta, targeting, copy, creativita },
  };
}
