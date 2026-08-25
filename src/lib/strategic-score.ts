import type { NicheBenchmark } from "@/lib/benchmarks";
import type { BookingChannel, CampagnaObjective } from "@/types/campagne";

export type StrategicScoreInput = {
  budgetGiornaliero: number;
  benchmark: NicheBenchmark;
  settore: string;
  citta: string;
  /** True se una variante copy (A/B/C) è selezionata e non vuota. */
  haCopySelezionato: boolean;
  fotoCaricata: boolean;
  paginaFacebookId: string;
  moduloContattiId: string;
  /** ECOMMERCE: URL pagina prodotto / store (destination). */
  destinationUrl?: string;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
};

export type StrategicScoreResult = {
  score: number;
  label: string;
  tone: "green" | "yellow" | "orange";
  suggestions: string[];
  isComplete: boolean;
  breakdown: {
    strategyBudget: number;
    copy: number;
    foto: number;
    pageId: number;
    formId: number;
  };
};

/** Lead Form ID obbligatorio solo per LEADS o BOOKINGS su LEAD_FORM. */
export function richiedeModuloContatti(
  objective?: CampagnaObjective,
  bookingChannel?: BookingChannel,
): boolean {
  if (objective === "BOOKINGS") {
    return bookingChannel === "LEAD_FORM";
  }
  if (
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING" ||
    objective === "AWARENESS"
  ) {
    return false;
  }
  return true;
}

/** Destination URL obbligatorio per E-commerce, In-Store, Retargeting e Apertura. */
export function richiedeDestinationUrl(
  objective?: CampagnaObjective,
): boolean {
  return (
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING" ||
    objective === "AWARENESS"
  );
}

/**
 * Punteggio strategico 0–100.
 * Bozza Affianco (budget + copy) = 60/100.
 * 100 con foto + ID Pagina (+ ID Modulo o URL Store se richiesto).
 */
export function calculateStrategicScore(
  input: StrategicScoreInput,
): StrategicScoreResult {
  const budgetMin = input.benchmark.recommendedDailyBudgetMin;
  const budgetOk = input.budgetGiornaliero + 1e-9 >= budgetMin;
  const pageOk = input.paginaFacebookId.trim() !== "";
  const formRichiesto = richiedeModuloContatti(
    input.objective,
    input.bookingChannel,
  );
  const storeUrlRichiesto = richiedeDestinationUrl(input.objective);
  const formOk = !formRichiesto || input.moduloContattiId.trim() !== "";
  const storeOk =
    !storeUrlRichiesto || (input.destinationUrl ?? "").trim() !== "";
  const fotoOk = input.fotoCaricata;

  const strategyBudget = budgetOk ? 40 : 0;
  const copy = input.haCopySelezionato ? 20 : 0;
  const foto = fotoOk ? 15 : 0;
  const pageId = pageOk ? 15 : 0;
  const formId = formRichiesto
    ? formOk
      ? 10
      : 0
    : storeUrlRichiesto
      ? storeOk
        ? 10
        : 0
      : 10;

  const score = strategyBudget + copy + foto + pageId + formId;
  const isComplete = score === 100;

  const suggestions: string[] = [];
  const settoreLabel = input.settore.trim() || input.benchmark.label;
  const cittaLabel = input.citta.trim() || "la tua zona";

  if (!budgetOk) {
    suggestions.push(
      `⚠️ Per la nicchia ${settoreLabel} a ${cittaLabel} il budget minimo consigliato è ${budgetMin}€/giorno.`,
    );
  }
  if (!input.haCopySelezionato) {
    suggestions.push("⚠️ Seleziona una variante di testo (A, B o C)");
  }
  if (!fotoOk) {
    suggestions.push("⚠️ Carica la foto dell'annuncio");
  }
  if (!pageOk) {
    suggestions.push("⚠️ Aggiungi l'ID Pagina Facebook");
  }
  if (formRichiesto && !formOk) {
    suggestions.push("⚠️ Aggiungi l'ID Modulo Contatti");
  }
  if (storeUrlRichiesto && !storeOk) {
    suggestions.push(
      input.objective === "IN_STORE"
        ? "⚠️ Aggiungi l'URL Mappa Google / Pagina del Negozio"
        : input.objective === "RETARGETING"
          ? "⚠️ Aggiungi l'URL Pagina di Destinazione / Checkout"
          : input.objective === "AWARENESS"
            ? "⚠️ Aggiungi l'URL Pagina Evento / Mappa Google / Sito Web"
            : "⚠️ Aggiungi l'URL Pagina Prodotto / Store",
    );
  }

  let tone: StrategicScoreResult["tone"] = "orange";
  let label = "🔴 Rischio spreco budget";

  if (isComplete) {
    tone = "green";
    label = "🟢 Pronta per il lancio";
  } else if (score >= 40) {
    tone = "yellow";
    label = "🟡 Bozza pronta - Inserisci i dati del cliente";
  }

  return {
    score,
    label,
    tone,
    suggestions,
    isComplete,
    breakdown: { strategyBudget, copy, foto, pageId, formId },
  };
}
