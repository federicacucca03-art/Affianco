import {
  getBenchmarkForNiche,
  calculateMaxSustainableCpl,
  type NicheBenchmark,
} from "./benchmarks";

export type VerdictStatus = "good" | "learning" | "warning" | "alert";

export interface AnalysisInput {
  nomeCliente: string;
  settore: string;
  citta: string;
  spesaTotale: number;
  contatti: number;
  impressions: number;
  clicks: number;
  giorniAttivi: number;
  scontrinoMedio?: number;
  tassoConversione?: number;
  /** Margine di profitto target % (default 50). */
  targetMargin?: number;
  /** Frequenza media Meta (impression / reach). */
  frequenza?: number;
  /** CTR % se noto senza impression/click (inserimento manuale). */
  ctrPercent?: number;
  /** Soglia CPL/CPA sostenibile già calcolata (override Wizard). */
  maxCplSustainable?: number;
  nomeCampagna?: string;
}

export interface CampaignAnalysisResult {
  verdict: VerdictStatus;
  badgeLabel: string;
  badgeColor: "green" | "yellow" | "orange" | "red";
  metrics: {
    spesaTotale: number;
    contatti: number;
    cplReale: number;
    ctr: number;
    cpm: number;
    impressions: number;
    clicks: number;
    frequenza: number;
  };
  benchmark: NicheBenchmark;
  maxCplSustainable: number;
  /** Scostamento % del CPL reale rispetto alla soglia (solo se fuori target). */
  scostamentoSogliaPercent: number | null;
  /** Confronto CPL reale vs soglia di margine. */
  marginStatus: "in_target" | "out_of_target" | "unknown";
  marginBadgeLabel: string;
  marginWarningText: string | null;
  headline: string;
  diagnosisText: string;
  actionableAdvice: string;
  /** Azione sintetica per il report WhatsApp cliente. */
  azioneClienteSintetica: string;
  whatsappMessage: string;
}

export interface MetaCsvAggregates {
  spesaTotale: number;
  contatti: number;
  impressions: number;
  clicks: number;
  /** Media ponderata della frequenza Meta, se presente nel CSV. */
  frequenza: number;
}

const HEADER_ALIASES: Record<
  keyof MetaCsvAggregates,
  string[]
> = {
  spesaTotale: [
    "importo speso (eur)",
    "importo speso",
    "amount spent (eur)",
    "amount spent",
    "spend",
  ],
  contatti: ["risultati", "results", "lead", "leads", "contatti"],
  impressions: ["impression", "impressioni", "impressions"],
  clicks: [
    "clic sul link",
    "link clicks",
    "clicks (all)",
    "clicks",
    "clic",
  ],
  frequenza: ["frequency", "frequenza"],
};

function normalizzaHeader(valore: string): string {
  return valore
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Parser numerico robusto per export Meta (IT/EU e US/internazionale).
 * "249.01" resta 249.01 — il punto non viene trattato come migliaia.
 */
export function parseMetaNumber(
  rawVal: string | number | undefined,
): number {
  if (typeof rawVal === "number") {
    return Number.isFinite(rawVal) ? rawVal : 0;
  }
  if (!rawVal) return 0;

  let valStr = String(rawVal).replace(/[€$\s]/g, "").trim();
  if (!valStr) return 0;

  // Caso 1: punto e virgola insieme (es. "1.249,01" o "1,249.01")
  if (valStr.includes(".") && valStr.includes(",")) {
    if (valStr.indexOf(".") < valStr.indexOf(",")) {
      // Formato IT/EU: 1.249,01
      valStr = valStr.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato US: 1,249.01
      valStr = valStr.replace(/,/g, "");
    }
  } else if (valStr.includes(",")) {
    // Caso 2: solo virgola (es. "249,01")
    valStr = valStr.replace(",", ".");
  }
  // Caso 3: solo punto (es. "249.01") -> mantieni il punto come decimale

  const parsed = parseFloat(valStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Parser CSV RFC 4180 semplificato (virgola o tab). */
function parseCsvRows(csvText: string): string[][] {
  const righe: string[][] = [];
  let rigaCorrente: string[] = [];
  let campo = "";
  let inVirgolette = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inVirgolette && next === '"') {
        campo += '"';
        i += 1;
      } else {
        inVirgolette = !inVirgolette;
      }
      continue;
    }

    if (!inVirgolette && (char === "," || char === "\t")) {
      rigaCorrente.push(campo);
      campo = "";
      continue;
    }

    if (!inVirgolette && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      rigaCorrente.push(campo);
      if (rigaCorrente.some((c) => c.trim() !== "")) {
        righe.push(rigaCorrente);
      }
      rigaCorrente = [];
      campo = "";
      continue;
    }

    campo += char;
  }

  if (campo.length > 0 || rigaCorrente.length > 0) {
    rigaCorrente.push(campo);
    if (rigaCorrente.some((c) => c.trim() !== "")) {
      righe.push(rigaCorrente);
    }
  }

  return righe;
}

function trovaIndiceColonna(headers: string[], aliases: string[]): number {
  const normalizzati = headers.map(normalizzaHeader);
  return normalizzati.findIndex((h) =>
    aliases.some((alias) => h === alias || h.includes(alias)),
  );
}

/**
 * Estrae e somma spesa, contatti, impression e click da un export CSV di Meta.
 * La frequenza è media ponderata sulle impression (se disponibili).
 */
export function parseMetaCsvReport(csvText: string): MetaCsvAggregates {
  const righe = parseCsvRows(csvText.trim());
  if (righe.length < 2) {
    return {
      spesaTotale: 0,
      contatti: 0,
      impressions: 0,
      clicks: 0,
      frequenza: 0,
    };
  }

  const headers = righe[0];
  const idxSpesa = trovaIndiceColonna(headers, HEADER_ALIASES.spesaTotale);
  const idxContatti = trovaIndiceColonna(headers, HEADER_ALIASES.contatti);
  const idxImpressions = trovaIndiceColonna(
    headers,
    HEADER_ALIASES.impressions,
  );
  const idxClicks = trovaIndiceColonna(headers, HEADER_ALIASES.clicks);
  const idxFrequenza = trovaIndiceColonna(headers, HEADER_ALIASES.frequenza);

  let spesaTotale = 0;
  let contatti = 0;
  let impressions = 0;
  let clicks = 0;
  let freqPeso = 0;
  let freqNumeratore = 0;

  for (let i = 1; i < righe.length; i += 1) {
    const riga = righe[i];
    if (idxSpesa >= 0) spesaTotale += parseMetaNumber(riga[idxSpesa]);
    if (idxContatti >= 0) contatti += parseMetaNumber(riga[idxContatti]);
    const impRiga =
      idxImpressions >= 0 ? parseMetaNumber(riga[idxImpressions]) : 0;
    if (idxImpressions >= 0) impressions += impRiga;
    if (idxClicks >= 0) clicks += parseMetaNumber(riga[idxClicks]);
    if (idxFrequenza >= 0) {
      const freq = parseMetaNumber(riga[idxFrequenza]);
      if (freq > 0) {
        const peso = impRiga > 0 ? impRiga : 1;
        freqNumeratore += freq * peso;
        freqPeso += peso;
      }
    }
  }

  return {
    spesaTotale,
    contatti,
    impressions,
    clicks,
    frequenza:
      freqPeso > 0 ? Math.round((freqNumeratore / freqPeso) * 100) / 100 : 0,
  };
}

function arrotonda(valore: number, decimali = 2): number {
  const f = 10 ** decimali;
  return Math.round(valore * f) / f;
}

function compila(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (testo, [chiave, valore]) =>
      testo.replaceAll(`{${chiave}}`, String(valore)),
    template,
  );
}

function buildPrescriptiveGreen(
  _input: AnalysisInput,
  benchmark: NicheBenchmark,
  maxCplSustainable: number,
  metrics: CampaignAnalysisResult["metrics"],
): CampaignAnalysisResult {
  return {
    verdict: "good",
    badgeLabel: "In target",
    badgeColor: "green",
    metrics,
    benchmark,
    maxCplSustainable,
    scostamentoSogliaPercent: null,
    marginStatus: "in_target",
    marginBadgeLabel: "In target di profitto",
    marginWarningText: null,
    headline: "Cosa fare oggi · 🟢 Verde",
    diagnosisText: "Campagna in piena salute finanziaria.",
    actionableAdvice:
      "Nessun intervento richiesto. Mantieni il budget invariato per non resettare la fase di apprendimento di Meta.",
    azioneClienteSintetica:
      "Nessun intervento: manteniamo budget e asset invariati.",
    whatsappMessage: "",
  };
}

function buildPrescriptiveYellow(
  _input: AnalysisInput,
  benchmark: NicheBenchmark,
  maxCplSustainable: number,
  metrics: CampaignAnalysisResult["metrics"],
  motivo: "learning" | "frequenza",
): CampaignAnalysisResult {
  return {
    verdict: "learning",
    badgeLabel: motivo === "learning" ? "In apprendimento" : "In ottimizzazione",
    badgeColor: "yellow",
    metrics,
    benchmark,
    maxCplSustainable,
    scostamentoSogliaPercent: null,
    marginStatus: "unknown",
    marginBadgeLabel: "In ottimizzazione",
    marginWarningText: null,
    headline: "Cosa fare oggi · 🟡 Giallo",
    diagnosisText:
      "Saturazione iniziale del pubblico o Fase di Apprendimento.",
    actionableAdvice:
      "Non toccare i budget. Prepara una seconda creatività visiva da sostituire nei prossimi 3 giorni se il CPL sale.",
    azioneClienteSintetica:
      "Nessuna modifica al budget: prepariamo una seconda creatività di riserva.",
    whatsappMessage: "",
  };
}

function buildPrescriptiveRed(
  _input: AnalysisInput,
  benchmark: NicheBenchmark,
  maxCplSustainable: number,
  metrics: CampaignAnalysisResult["metrics"],
  scostamentoPercent: number,
): CampaignAnalysisResult {
  const consigli: string[] = [];
  if (metrics.ctr > 0 && metrics.ctr < 1) {
    consigli.push(
      "Il problema è l'aggancio visivo. Cambia l'immagine/video dell'annuncio.",
    );
  }
  if (metrics.frequenza > 3.5) {
    consigli.push(
      "Fatica da inserzione (Ad Fatigue). Duplica il gruppo inserzioni e aggiorna i testi.",
    );
  }
  const cvrClick =
    metrics.clicks > 0
      ? (metrics.contatti / metrics.clicks) * 100
      : null;
  const cvrBasso =
    cvrClick !== null && metrics.clicks >= 5 && cvrClick < 8;
  if (cvrBasso) {
    consigli.push(
      "Verifica che il modulo o la pagina risponda in meno di 3 secondi.",
    );
  }
  if (consigli.length === 0) {
    consigli.push(
      "Sostituisci la variante di testo meno performante e rivedi l'offerta nell'annuncio.",
    );
  }

  const actionableAdvice = consigli.join(" ");
  const azioneClienteSintetica =
    metrics.ctr > 0 && metrics.ctr < 1
      ? "Stiamo aggiornando le creatività per migliorare l'aggancio."
      : metrics.frequenza > 3.5
        ? "Stiamo rinnovando testi e gruppo inserzioni per ridurre la fatica da Ad."
        : "Stiamo ottimizzando l'annuncio per riportare il costo sotto soglia.";

  return {
    verdict: "alert",
    badgeLabel: "Fuori soglia",
    badgeColor: "red",
    metrics,
    benchmark,
    maxCplSustainable,
    scostamentoSogliaPercent: scostamentoPercent,
    marginStatus: "out_of_target",
    marginBadgeLabel: "⚠️ Fuori Target Margine",
    marginWarningText: compila(
      "Attenzione: Il CPL attuale ({cplReale}€) supera la soglia di sostenibilità ({soglia}€) del {scostamento}%.",
      {
        cplReale: metrics.cplReale,
        soglia: maxCplSustainable,
        scostamento: scostamentoPercent,
      },
    ),
    headline: "Cosa fare oggi · 🔴 Rosso",
    diagnosisText: compila(
      "Costo per contatto fuori dalla soglia di sicurezza (+{scostamento}% rispetto al limite).",
      { scostamento: scostamentoPercent },
    ),
    actionableAdvice,
    azioneClienteSintetica,
    whatsappMessage: "",
  };
}

/**
 * Motore Diagnostico Prescrittivo — Cosa fare oggi.
 *
 * 🟢 Verde: CPL ≤ soglia e frequenza < 2.5
 * 🟡 Giallo: primi 4 giorni OPPURE frequenza tra 2.5 e 3.5
 * 🔴 Rosso: CPL reale > CPL sostenibile (+ consigli CTR / fatigue / CVR)
 */
export function analyzeCampaignData(
  input: AnalysisInput,
): CampaignAnalysisResult {
  const { spesaTotale, contatti, impressions, clicks } = input;

  const cplReale = contatti > 0 ? arrotonda(spesaTotale / contatti) : 0;
  const ctrDaClick =
    impressions > 0 ? arrotonda((clicks / impressions) * 100, 2) : 0;
  const ctr =
    input.ctrPercent !== undefined && input.ctrPercent > 0
      ? arrotonda(input.ctrPercent, 2)
      : ctrDaClick;
  const cpm =
    impressions > 0 ? arrotonda((spesaTotale / impressions) * 1000) : 0;
  const frequenza =
    input.frequenza !== undefined && input.frequenza > 0
      ? arrotonda(input.frequenza, 2)
      : 0;

  const benchmark = getBenchmarkForNiche(input.settore, input.citta);
  const maxCplSustainable =
    input.maxCplSustainable !== undefined && input.maxCplSustainable > 0
      ? arrotonda(input.maxCplSustainable)
      : calculateMaxSustainableCpl(
          input.scontrinoMedio ?? 0,
          input.tassoConversione ?? 10,
          input.targetMargin ?? 50,
        );

  const metrics: CampaignAnalysisResult["metrics"] = {
    spesaTotale: arrotonda(spesaTotale),
    contatti,
    cplReale,
    ctr,
    cpm,
    impressions,
    clicks,
    frequenza,
  };

  const haCplConfronto = cplReale > 0 && maxCplSustainable > 0;
  const cplSopraSoglia = haCplConfronto && cplReale > maxCplSustainable;
  const cplSottoSoglia = haCplConfronto && cplReale <= maxCplSustainable;
  const scostamento = cplSopraSoglia
    ? arrotonda(((cplReale - maxCplSustainable) / maxCplSustainable) * 100, 0)
    : null;

  let result: CampaignAnalysisResult;

  // Priorità: apprendimento (primi 4 giorni) → rosso fuori soglia → giallo frequenza → verde
  if (input.giorniAttivi < 4) {
    result = buildPrescriptiveYellow(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
      "learning",
    );
  } else if (cplSopraSoglia && scostamento !== null) {
    result = buildPrescriptiveRed(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
      scostamento,
    );
  } else if (frequenza >= 2.5 && frequenza <= 3.5) {
    result = buildPrescriptiveYellow(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
      "frequenza",
    );
  } else if (cplSottoSoglia && (frequenza === 0 || frequenza < 2.5)) {
    result = buildPrescriptiveGreen(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
    );
  } else if (frequenza > 3.5 && !cplSopraSoglia) {
    // Frequenza alta ma CPL ancora ok → giallo preventivo
    result = buildPrescriptiveYellow(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
      "frequenza",
    );
  } else if (cplSottoSoglia) {
    result = buildPrescriptiveGreen(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
    );
  } else {
    // Pochi dati: trattiamo come fase di osservazione
    result = buildPrescriptiveYellow(
      input,
      benchmark,
      maxCplSustainable,
      metrics,
      "learning",
    );
  }

  return result;
}

/**
 * Report WhatsApp 1-click: testo trasparente e autorevole per il cliente.
 */
export function generaReportWhatsAppCliente(opzioni: {
  nomeCliente: string;
  nomeAzienda?: string;
  nomeCampagna?: string;
  spesaTotale: number;
  contatti: number;
  cplReale: number;
  cplSostenibile: number;
  giorniAttivi: number;
  marginStatus: CampaignAnalysisResult["marginStatus"];
  verdict: VerdictStatus;
  azioneClienteSintetica?: string;
  objective?:
    | "LEADS"
    | "BOOKINGS"
    | "ECOMMERCE"
    | "IN_STORE"
    | "RETARGETING"
    | "AWARENESS";
  fatturato?: number;
  roasReale?: number;
  roasBreakEven?: number;
  roasTarget?: number;
}): string {
  const nome = opzioni.nomeCliente.trim() || "Cliente";
  const campagna =
    (opzioni.nomeCampagna ?? "").trim() ||
    (opzioni.nomeAzienda ?? opzioni.nomeCliente).trim() ||
    "la campagna";
  const spesa = opzioni.spesaTotale;
  const lead = opzioni.contatti;
  const cpl =
    opzioni.cplReale > 0
      ? String(opzioni.cplReale)
      : lead > 0
        ? "0"
        : "n/d";
  const soglia =
    opzioni.cplSostenibile > 0 ? String(opzioni.cplSostenibile) : "n/d";
  const isBookings = opzioni.objective === "BOOKINGS";
  const isEcommerce = opzioni.objective === "ECOMMERCE";
  const isInStore = opzioni.objective === "IN_STORE";
  const isRetargeting = opzioni.objective === "RETARGETING";
  const isAwareness = opzioni.objective === "AWARENESS";

  const etichettaRisultati = isBookings
    ? "Prenotazioni"
    : isEcommerce
      ? "Acquisti"
      : isInStore
        ? "Clienti in negozio"
        : isRetargeting
          ? "Recuperi"
          : isAwareness
            ? "Copertura (proxy)"
            : "Contatti/Prenotazioni";

  const etichettaCosto = isBookings || isInStore || isEcommerce || isRetargeting
    ? "Costo per risultato"
    : "Costo per contatto";

  let statoAlgoritmo: string;
  if (
    opzioni.verdict === "good" ||
    opzioni.marginStatus === "in_target"
  ) {
    statoAlgoritmo = "🟢 In target";
  } else if (
    opzioni.verdict === "alert" ||
    opzioni.marginStatus === "out_of_target"
  ) {
    statoAlgoritmo = "🔴 Fuori soglia — intervento in corso";
  } else {
    statoAlgoritmo = "🟡 In ottimizzazione";
  }

  let prossimoPasso =
    opzioni.azioneClienteSintetica?.trim() ||
    "Monitoraggio continuo senza modifiche strutturali.";
  if (opzioni.giorniAttivi < 4 && opzioni.verdict === "learning") {
    prossimoPasso =
      "Nessuna modifica: siamo nella fase di apprendimento di Meta.";
  }

  if (isEcommerce && (opzioni.roasReale ?? 0) > 0) {
    const roas = opzioni.roasReale ?? 0;
    const breakEven = opzioni.roasBreakEven ?? 0;
    const target = opzioni.roasTarget ?? 0;
    const fatturato = opzioni.fatturato ?? 0;
    if (roas >= target && target > 0) {
      statoAlgoritmo = "🟢 In target";
      prossimoPasso = "Campagna in profitto: manteniamo il setup attuale.";
    } else if (breakEven > 0 && roas < breakEven) {
      statoAlgoritmo = "🔴 Fuori soglia — intervento in corso";
      prossimoPasso =
        "Stiamo ottimizzando creatività e offerta per riportare il ROAS sopra il pareggio.";
    } else {
      statoAlgoritmo = "🟡 In ottimizzazione";
    }
    return (
      `Ciao ${nome}! 👋 Ecco il report settimanale sulla campagna ${campagna}:\n` +
      `📊 Risultati:\n` +
      `- Investimento: ${spesa}€\n` +
      `- Fatturato: ${fatturato}€ · Acquisti: ${lead}\n` +
      `- ROAS reale: ${roas}x (break-even ${breakEven || "n/d"}x · target ${target || "n/d"}x)\n` +
      `\n` +
      `💡 Stato dell'algoritmo: ${statoAlgoritmo}\n` +
      `🎯 Prossimo passo operativo: ${prossimoPasso}`
    );
  }

  if (isAwareness) {
    return (
      `Ciao ${nome}! 👋 Ecco il report settimanale sulla campagna ${campagna}:\n` +
      `📊 Risultati:\n` +
      `- Investimento: ${spesa}€\n` +
      `- Copertura locale in corso nella zona target\n` +
      `\n` +
      `💡 Stato dell'algoritmo: ${statoAlgoritmo}\n` +
      `🎯 Prossimo passo operativo: ${prossimoPasso}`
    );
  }

  return (
    `Ciao ${nome}! 👋 Ecco il report settimanale sulla campagna ${campagna}:\n` +
    `📊 Risultati:\n` +
    `- Investimento: ${spesa}€\n` +
    `- ${etichettaRisultati}: ${lead}\n` +
    `- ${etichettaCosto}: ${cpl}€ (Soglia limite di sicurezza: ${soglia}€)\n` +
    `\n` +
    `💡 Stato dell'algoritmo: ${statoAlgoritmo}\n` +
    `🎯 Prossimo passo operativo: ${prossimoPasso}`
  );
}
