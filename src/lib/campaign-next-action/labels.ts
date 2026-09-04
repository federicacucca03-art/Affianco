/**
 * Italian labels for M6D next actions — never expose raw enums in UI.
 */

import type { NextActionType } from "@/lib/campaign-next-action/types";

export function etichettaNextAction(type: NextActionType): string {
  switch (type) {
    case "SET_TARGET":
      return "Imposta un target";
    case "VERIFY_TRACKING":
      return "Verifica il tracciamento";
    case "WAIT_FOR_MORE_DATA":
      return "Raccogli altri dati";
    case "REVIEW_CREATIVE":
      return "Controlla la creatività";
    case "CREATE_CREATIVE_VARIANT":
      return "Prepara una nuova variante";
    case "REVIEW_COPY":
      return "Rivedi il copy";
    case "REVIEW_LANDING_OR_FORM":
      return "Controlla landing o form";
    case "REVIEW_AUDIENCE":
      return "Rivedi il pubblico";
    case "REVIEW_BUDGET":
      return "Rivedi il budget";
    case "REVIEW_OFFER":
      return "Rivedi l'offerta";
    case "REVIEW_RESULT_QUALITY":
      return "Valuta la qualità dei risultati";
    case "REVIEW_CAMPAIGN_SETUP":
      return "Completa la configurazione";
    case "CONTACT_CLIENT":
      return "Gestisci la revisione cliente";
    case "NO_ACTION":
      return "Nessun intervento necessario";
    case "HISTORICAL_LEARNING":
      return "Usa questi dati come riferimento";
  }
}

/** True when the home row should show a "Prossimo passo" block. */
export function shouldShowNextAction(type: NextActionType): boolean {
  return type !== "NO_ACTION";
}
