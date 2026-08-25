import type { TargetType } from "@/types/campagne";

export type AlertFattibilita =
  | { tone: "warning"; messaggio: string }
  | { tone: "positive"; messaggio: string }
  | null;

/**
 * Confronta CPL/CPA sostenibile con la nicchia (settore + tipo cliente).
 */
export function alertFattibilitaNicchia(opzioni: {
  cplSostenibile: number;
  settore?: string;
  targetType?: TargetType;
}): AlertFattibilita {
  const cpl = opzioni.cplSostenibile;
  if (!cpl || cpl <= 0) return null;

  const settore = (opzioni.settore ?? "").toLowerCase();
  const nicchiaAlta =
    opzioni.targetType === "B2B" ||
    /b2b|immobil|agenzia immobil|dent|odonto|ristruttur|serrament|edil|infiss|impiant|avvocat|consulenz|notar|commercialist|industrial/.test(
      settore,
    );

  if (cpl < 8 && nicchiaAlta) {
    const etichetta = (opzioni.settore ?? "").trim() || "selezionata";
    return {
      tone: "warning",
      messaggio: `⚠️ CPL Calcolato molto stretto per la nicchia ${etichetta}. L'asta su Meta per questo mercato richiede solitamente un CPL limite più alto. Valuta di alzare lo scontrino medio o considerare l'LTV del cliente.`,
    };
  }

  if (cpl > 80) {
    return {
      tone: "positive",
      messaggio:
        "🟢 Ampio margine di manovra. La soglia di sostenibilità ti permette di fare offerte competitive sulle aste Meta.",
    };
  }

  return null;
}
