import type {
  AnalyzeScreenshotBody,
  ScreenshotAnalysisResult,
  VerdettoScreenshot,
} from "@/types/screenshot-analysis";
import { normalizzaObjective } from "@/types/campagne";

function tipoRisultatoDaObiettivo(obiettivo: string): string {
  const o = normalizzaObjective(obiettivo);
  if (o === "ECOMMERCE") return "Acquisti";
  if (o === "BOOKINGS") return "Prenotazioni";
  if (o === "IN_STORE") return "Risultati (proxy)";
  if (o === "RETARGETING") return "Risultati";
  if (o === "AWARENESS") return "Copertura / Impression";
  return "Lead Instant Form";
}

function calcolaVerdetto(
  costo: number,
  target: number,
  risultati: number,
  spesa: number,
): VerdettoScreenshot {
  if (risultati < 3 || spesa < 25) return "dati_insufficienti";
  if (costo <= target * 0.85) return "ottimo";
  if (costo <= target) return "in_target";
  return "fuori_target";
}

function spiegazioneDaVerdetto(
  verdetto: VerdettoScreenshot,
  costo: number,
  target: number,
  tipo: string,
): string {
  switch (verdetto) {
    case "ottimo":
      return `Il ${tipo} reale (${costo.toFixed(2)}€) è sotto la soglia di sicurezza (${target.toFixed(2)}€): margine operativo ampio e campagna economicamente sostenibile.`;
    case "in_target":
      return `Il ${tipo} reale (${costo.toFixed(2)}€) rientra nella soglia calcolata al Passo 2 (${target.toFixed(2)}€). Monitora la frequenza e attendi almeno 7 giorni prima di scalare.`;
    case "fuori_target":
      return `Il ${tipo} reale (${costo.toFixed(2)}€) supera la soglia sostenibile (${target.toFixed(2)}€). Serve ottimizzare creatività, offerta o targeting prima di aumentare budget.`;
    default:
      return "Dati ancora limitati (meno di 3 risultati o spesa sotto 25€). Attendi 3–4 giorni di apprendimento prima di giudicare la sostenibilità.";
  }
}

function azioniMock(
  verdetto: VerdettoScreenshot,
  fase: ScreenshotAnalysisResult["faseApprendimento"],
): string[] {
  if (verdetto === "dati_insufficienti" || fase === "in_corso") {
    return [
      "Non modificare budget, audience o creatività per almeno 72 ore: lascia completare la fase di apprendimento.",
      "Verifica che il pixel / evento di conversione sia attivo e che l'offerta nel copy corrisponda alla landing.",
      "Programma un nuovo screenshot tra 3 giorni per confrontare CPL/CPA e frequenza.",
    ];
  }
  if (verdetto === "fuori_target") {
    return [
      "Duplica l'ad set migliore e testa 2 nuove creatività con hook diverso (beneficio vs urgenza).",
      "Riduci il budget del 15–20% sul set con CPA più alto e sposta verso quello sotto soglia.",
      "Controlla in Breakdown per età/genere: pausa le fasce con costo per risultato oltre il 150% della media.",
    ];
  }
  return [
    "Aumenta il budget del 10–15% sul set vincente (max una modifica al giorno).",
    "Duplica la creatività con CTR più alto in un nuovo ad set Broad per espandere volume.",
    "Esporta i risultati e condividi con il cliente: la campagna è in target rispetto al margine concordato.",
  ];
}

/** Mock realistico per test locale senza API Vision. */
export function mockScreenshotAnalysis(
  body: AnalyzeScreenshotBody,
): ScreenshotAnalysisResult {
  const target = Math.max(Number(body.targetCpl) || 45, 1);
  const giorni = Math.max(Number(body.giorniAttiva) || 5, 1);
  const obiettivo = body.obiettivo ?? "LEADS";
  const tipoRisultato = tipoRisultatoDaObiettivo(obiettivo);
  const obj = normalizzaObjective(obiettivo);
  const isEcommerce = obj === "ECOMMERCE";
  const isAwareness = obj === "AWARENESS";

  const fattore =
    giorni < 4 ? 1.08 : giorni < 7 ? 0.96 : 0.88;
  const costoPerRisultato =
    Math.round(target * fattore * 100) / 100;
  const risultati = Math.max(
    2,
    Math.round((giorni * (isEcommerce ? 1.2 : 2.5)) / fattore),
  );
  const spesaTotale =
    Math.round(costoPerRisultato * risultati * 100) / 100;
  const ctr = Math.round((1.1 + (giorni % 3) * 0.15) * 100) / 100;
  const frequenza = Math.round((1.4 + giorni * 0.08) * 100) / 100;
  const cpm = Math.round((6.5 + (100 - Math.min(ctr, 2)) * 0.8) * 100) / 100;
  const roas = isEcommerce
    ? Math.round((2.1 + (target / costoPerRisultato) * 0.4) * 10) / 10
    : null;

  const faseApprendimento: ScreenshotAnalysisResult["faseApprendimento"] =
    giorni < 4
      ? "in_corso"
      : frequenza > 2.8
        ? "limitata"
        : "completata";

  const verdetto = calcolaVerdetto(
    costoPerRisultato,
    target,
    risultati,
    spesaTotale,
  );

  return {
    spesaTotale,
    risultati,
    tipoRisultato,
    costoPerRisultato,
    ctr,
    frequenza,
    cpm,
    cpc: null,
    clicks: null,
    impressions: null,
    roas,
    faseApprendimento,
    verdetto,
    spiegazioneSostenibilita: spiegazioneDaVerdetto(
      verdetto,
      costoPerRisultato,
      target,
      isAwareness ? "CPM" : isEcommerce ? "CPA" : "CPL/CPA",
    ),
    azioniConsigliate: azioniMock(verdetto, faseApprendimento),
  };
}
