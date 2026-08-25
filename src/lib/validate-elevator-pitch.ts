/**
 * Validazione brief / elevator pitch.
 * Matching su testo ASCII (NFD) con confini di parola (\b).
 */

import type { CampagnaObjective } from "@/types/campagne";

export function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Ancore di dominio in ASCII normalizzato (senza diacritici) — lead / servizi. */
export const DOMAIN_ANCHORS_REGEX: RegExp[] = [
  /\bpolizz[aei]?\b/i,
  /\bbollett[aei]?\b/i,
  /\butenz[aei]?\b/i,
  /\bfiscal[ei]?\b/i,
  /\bcontabilita\b/i,
  /\bsocieta\b/i,
  /\bimmobil[ei]?\b/i,
  /\bcas[ae]\b/i,
  /\bdent[ei]\b|\bdentist[aei]\b|\bdental[ei]\b/i,
  /\bimpiant[oi]\b/i,
  /\bristrutturazion[ei]\b/i,
  /\bpalestr[ae]\b/i,
  /\bauto\b|\bautovettur[ae]\b/i,
  /\bnoleggi[oi]?\b/i,
  /\bpellicol[aei]\b/i,
  /\bvetrat[aei]\b|\bvetri\b/i,
  /\brivestiment[oi]\b/i,
  /\bcontrollo\s+solare\b/i,
  /\bisolamento\b|\btermic[oa]\b/i,
];

/**
 * Dettagli concreti e-commerce (almeno 2 per brief valido):
 * formato/quantità, ingrediente/materiale chiave, beneficio temporale, garanzia.
 */
const ECOMMERCE_DETTAGLIO_REGEX: RegExp[] = [
  // Formato / quantità / pack
  /\b\d+\s?(ml|mg|g|kg|l|lt|cl|oz|pz|pz\.|pezzi|capsule|compresse|bustine|fiale|dose|dosi)\b/i,
  /\b\d+\s?x\s?\d+\b/i,
  /\b(formato|pack|confezione|flacon[ei]|barattol[oi]|tub[oi]|bottigli[ae])\b/i,
  // Ingrediente / materiale / composizione chiave
  /\b(a base di|arricchit[oa]\s+(di|con)|principio attivo|vitamina\s?[a-z0-9]+|acido\s+\w+|olio di\s+\w+|estratto di\s+\w+)\b/i,
  /\b(retinolo|niacinamide|ialuronic[oa]|collagene|caffein[ae]|peptidi?|spf\s?\d+|cotone|lino|pelle|cuoio|ceramica|acciaio)\b/i,
  // Beneficio temporale / risultato misurabile
  /\b(\d+\s?(h|ore|gg|giorni|settiman[ae]|mes[ei]|minuti)|24h|48h|7\s?giorni|30\s?giorni)\b/i,
  /\b(idratazion[ei]|anti[- ]?age|rassodant[ei]|illuminant[ei]|lenitiv[oa]|idratant[ei]|rimpolpant[ei])\b/i,
  // Garanzia / reso / prova
  /\b(reso|rimborso|garanzia|soddisfatt[oi]|prova|soddisfatti[ ]?o[ ]?rimborsati)\b/i,
  /\b(spedizion[ei]\s+(gratis|gratuita|rapida|24|48)|consegna\s+\d+)\b/i,
];

const ECOMMERCE_BRIEF_WARNING =
  "⚠️ Brief poco specifico. Inserisci il nome esatto del prodotto hero, i benefici principali e la garanzia (es. Siero viso anti-age 50ml, idratazione 24h, reso 30gg).";

export type ElevatorPitchValidation = {
  isValid: boolean;
  reason?: string;
};

export type ValidateElevatorPitchOptions = {
  objective?: CampagnaObjective;
};

function contaDettagliEcommerce(cleanText: string): number {
  let count = 0;
  for (const pattern of ECOMMERCE_DETTAGLIO_REGEX) {
    if (pattern.test(cleanText)) count += 1;
  }
  return count;
}

function validateEcommerceBrief(cleanText: string, words: string[]): ElevatorPitchValidation {
  if (words.length < 5) {
    return {
      isValid: false,
      reason:
        "Brief troppo breve. Scrivi almeno una frase completa (almeno 5 parole).",
    };
  }

  const dettagli = contaDettagliEcommerce(cleanText);
  if (dettagli < 2) {
    return {
      isValid: false,
      reason: ECOMMERCE_BRIEF_WARNING,
    };
  }

  return { isValid: true };
}

export function validateElevatorPitch(
  pitch: string,
  options?: ValidateElevatorPitchOptions,
): ElevatorPitchValidation {
  const cleanText = stripAccents(pitch.toLowerCase().trim());
  const words = cleanText.split(/\s+/).filter(Boolean);

  if (options?.objective === "ECOMMERCE") {
    return validateEcommerceBrief(cleanText, words);
  }

  if (words.length < 5) {
    return {
      isValid: false,
      reason:
        "Brief troppo breve. Scrivi almeno una frase completa (almeno 5 parole).",
    };
  }

  const hasDomainAnchor = DOMAIN_ANCHORS_REGEX.some((pattern) =>
    pattern.test(cleanText),
  );

  if (!hasDomainAnchor) {
    return {
      isValid: false,
      reason:
        "⚠️ Brief troppo generico. Inserisci il servizio o prodotto specifico (es. polizze, immobili, contabilità, auto).",
    };
  }

  return { isValid: true };
}

/**
 * Settore “ampio” (Livello 3): niente forchette numeriche CPL,
 * solo guida qualitativa.
 */
export function isCategoriaAmpia(settore: string | null | undefined): boolean {
  const n = stripAccents((settore ?? "").toLowerCase().trim());
  if (!n) return true;

  const ancoreSpecifiche = DOMAIN_ANCHORS_REGEX.some((pattern) =>
    pattern.test(n),
  );
  if (ancoreSpecifiche) return false;

  // Etichette generiche / fallback
  return (
    /\b(servizi|azienda|attivita|locale|altro|generico|business)\b/i.test(n) ||
    n.length < 3
  );
}
