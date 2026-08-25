import {
  overlayBenchmarkDaIntel,
  risolviSettoreIntel,
} from "@/lib/sector-intel";

export type TicketLevel = "high" | "medium" | "low";

export interface NicheBenchmark {
  key: string;
  label: string;
  category:
    | "Salute & Cura"
    | "Casa & Servizi"
    | "Fitness & Sport"
    | "Servizi Professionali"
    | "Beauty & Wellness"
    | "Ristorazione & Eventi"
    | "Automotive"
    | "Altro";
  ticketLevel: TicketLevel;
  recommendedDailyBudgetMin: number;
  recommendedDailyBudgetOptimal: number;
  cplMin: number;
  cplOptimal: number;
  cplMax: number;
  recommendedRadiusKm: number;
  /** CTR minimo atteso, es. 1.2 = 1.2% */
  targetCtrMin: number;
  leadFormType: "qualified" | "balanced" | "high_volume";
  explanationText: string;
}

export type CampaignVerdictStatus =
  | "learning"
  | "good"
  | "warning"
  | "alert";

export interface CampaignPerformanceVerdict {
  status: CampaignVerdictStatus;
  label: string;
  message: string;
}

const METROPOLI = [
  "roma",
  "milano",
  "torino",
  "napoli",
  "bologna",
  "firenze",
] as const;

const CITY_COST_MULTIPLIER = 1.2;
const CITY_RADIUS_BONUS_KM = 5;

/** Valori di fallback per ticket stimato quando la nicchia non è in database. */
const FALLBACK_BY_TICKET: Record<
  TicketLevel,
  Omit<
    NicheBenchmark,
    "key" | "label" | "category" | "ticketLevel" | "explanationText"
  >
> = {
  high: {
    recommendedDailyBudgetMin: 25,
    recommendedDailyBudgetOptimal: 40,
    cplMin: 35,
    cplOptimal: 55,
    cplMax: 90,
    recommendedRadiusKm: 20,
    targetCtrMin: 1.0,
    leadFormType: "qualified",
  },
  medium: {
    recommendedDailyBudgetMin: 18,
    recommendedDailyBudgetOptimal: 28,
    cplMin: 18,
    cplOptimal: 30,
    cplMax: 50,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.2,
    leadFormType: "balanced",
  },
  low: {
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 20,
    cplMin: 8,
    cplOptimal: 15,
    cplMax: 28,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.5,
    leadFormType: "high_volume",
  },
};

export const BENCHMARK_DATABASE: NicheBenchmark[] = [
  {
    key: "dentista",
    label: "Dentista",
    category: "Salute & Cura",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 20,
    recommendedDailyBudgetOptimal: 35,
    cplMin: 40,
    cplOptimal: 60,
    cplMax: 90,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.1,
    leadFormType: "qualified",
    explanationText:
      "Settore ad alto valore: pochi contatti qualificati valgono di più di volume alto. Form con filtro su urgenza e tipologia di cura.",
  },
  {
    key: "implantologia",
    label: "Implantologia",
    category: "Salute & Cura",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 30,
    recommendedDailyBudgetOptimal: 50,
    cplMin: 50,
    cplOptimal: 80,
    cplMax: 120,
    recommendedRadiusKm: 25,
    targetCtrMin: 0.9,
    leadFormType: "qualified",
    explanationText:
      "Ticket molto alto: mira a lead intenzionali (consulenza implantare). Raggio più ampio perché il paziente è disposto a spostarsi.",
  },
  {
    key: "fisioterapista",
    label: "Fisioterapista",
    category: "Salute & Cura",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 18,
    recommendedDailyBudgetOptimal: 28,
    cplMin: 20,
    cplOptimal: 35,
    cplMax: 55,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.3,
    leadFormType: "balanced",
    explanationText:
      "Domanda locale e ricorrente. Contatti a costo medio: privilegia raggio stretto e messaggio su dolore / recupero rapido.",
  },
  {
    key: "ortodontista",
    label: "Ortodontista",
    category: "Salute & Cura",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 28,
    recommendedDailyBudgetOptimal: 45,
    cplMin: 45,
    cplOptimal: 70,
    cplMax: 110,
    recommendedRadiusKm: 20,
    targetCtrMin: 1.0,
    leadFormType: "qualified",
    explanationText:
      "Ciclo decisionale lungo (allineatori, apparecchi). Qualifica bene età e motivazione nel form.",
  },
  {
    key: "serramenti",
    label: "Serramenti",
    category: "Casa & Servizi",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 22,
    recommendedDailyBudgetOptimal: 35,
    cplMin: 30,
    cplOptimal: 50,
    cplMax: 80,
    recommendedRadiusKm: 25,
    targetCtrMin: 1.0,
    leadFormType: "qualified",
    explanationText:
      "Lead da preventivo: costo alto ma ticket elevato. Chiedi tipologia (finestre, porte, infissi) e tempistica lavori.",
  },
  {
    key: "ristrutturazioni",
    label: "Ristrutturazioni",
    category: "Casa & Servizi",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 25,
    recommendedDailyBudgetOptimal: 40,
    cplMin: 35,
    cplOptimal: 60,
    cplMax: 95,
    recommendedRadiusKm: 20,
    targetCtrMin: 0.9,
    leadFormType: "qualified",
    explanationText:
      "Progetti a valore alto e tempi lunghi. Filtra per metratura e budget stimato per evitare curiosi.",
  },
  {
    key: "solare",
    label: "Solare / Fotovoltaico",
    category: "Casa & Servizi",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 28,
    recommendedDailyBudgetOptimal: 45,
    cplMin: 40,
    cplOptimal: 70,
    cplMax: 110,
    recommendedRadiusKm: 30,
    targetCtrMin: 0.8,
    leadFormType: "qualified",
    explanationText:
      "Mercato competitivo e regolamentato. Lead qualificati (proprietà immobile, consumo bolletta) giustificano CPL più alti.",
  },
  {
    key: "idraulico",
    label: "Idraulico",
    category: "Casa & Servizi",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.4,
    leadFormType: "balanced",
    explanationText:
      "Urgenza locale: messaggi su intervento rapido. Raggio contenuto e budget costante funzionano meglio di burst.",
  },
  {
    key: "elettricista",
    label: "Elettricista",
    category: "Casa & Servizi",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.4,
    leadFormType: "balanced",
    explanationText:
      "Simile all’idraulico: domanda locale e ripetibile. Form corto, risposta telefonica veloce.",
  },
  {
    key: "palestra",
    label: "Palestra",
    category: "Fitness & Sport",
    ticketLevel: "low",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 12,
    cplOptimal: 22,
    cplMax: 35,
    recommendedRadiusKm: 10,
    targetCtrMin: 1.6,
    leadFormType: "high_volume",
    explanationText:
      "Volume alto, ticket medio-basso (abbonamenti). Raggio stretto intorno alla sede e offerta prova gratuita.",
  },
  {
    key: "personal-trainer",
    label: "Personal Trainer",
    category: "Fitness & Sport",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 20,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.5,
    leadFormType: "balanced",
    explanationText:
      "Meno volume della palestra ma lead più intenzionali. Messaggio su obiettivo (dimagrimento, forza, postura).",
  },
  {
    key: "yoga",
    label: "Yoga / Pilates",
    category: "Fitness & Sport",
    ticketLevel: "low",
    recommendedDailyBudgetMin: 10,
    recommendedDailyBudgetOptimal: 18,
    cplMin: 10,
    cplOptimal: 18,
    cplMax: 30,
    recommendedRadiusKm: 10,
    targetCtrMin: 1.7,
    leadFormType: "high_volume",
    explanationText:
      "Community locale e corsi ricorrenti. CPL contenuti se creatività e orari sono chiari.",
  },
  {
    key: "estetista",
    label: "Estetista",
    category: "Beauty & Wellness",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 20,
    cplMin: 12,
    cplOptimal: 22,
    cplMax: 35,
    recommendedRadiusKm: 10,
    targetCtrMin: 1.5,
    leadFormType: "balanced",
    explanationText:
      "Settore visuale: creatività e offerta primo trattamento contano. Raggio urbano stretto.",
  },
  {
    key: "parrucchiere",
    label: "Parrucchiere",
    category: "Beauty & Wellness",
    ticketLevel: "low",
    recommendedDailyBudgetMin: 10,
    recommendedDailyBudgetOptimal: 18,
    cplMin: 8,
    cplOptimal: 16,
    cplMax: 28,
    recommendedRadiusKm: 8,
    targetCtrMin: 1.6,
    leadFormType: "high_volume",
    explanationText:
      "Clientela di quartiere: budget contenuto e raggio molto locale. Offerte stagione / colore funzionano.",
  },
  {
    key: "tatuatore",
    label: "Tatuatore",
    category: "Beauty & Wellness",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 22,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.4,
    leadFormType: "balanced",
    explanationText:
      "Portfolio e stile sono il messaggio. Lead da consulto: filtra per idea / zona corpo.",
  },
  {
    key: "avvocato",
    label: "Avvocato",
    category: "Servizi Professionali",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 22,
    recommendedDailyBudgetOptimal: 35,
    cplMin: 35,
    cplOptimal: 55,
    cplMax: 90,
    recommendedRadiusKm: 20,
    targetCtrMin: 1.0,
    leadFormType: "qualified",
    explanationText:
      "Lead sensibili e competitivi. Specifica area (famiglia, lavoro, penale) e qualifica con domanda di urgenza.",
  },
  {
    key: "commercialista",
    label: "Commercialista",
    category: "Servizi Professionali",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 20,
    cplOptimal: 35,
    cplMax: 55,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.2,
    leadFormType: "balanced",
    explanationText:
      "Stagionalità (dichiarazioni, aperture P.IVA). Form bilanciato su tipologia cliente (privato / azienda).",
  },
  {
    key: "agenzia-immobiliare",
    label: "Agenzia immobiliare",
    category: "Servizi Professionali",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 25,
    recommendedDailyBudgetOptimal: 40,
    cplMin: 30,
    cplOptimal: 50,
    cplMax: 85,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.1,
    leadFormType: "qualified",
    explanationText:
      "CPL alti ma ticket alto (vendita/affitto). Separa campagne vendita vs affitto e zona geografica.",
  },
  {
    key: "ristorante",
    label: "Ristorante",
    category: "Ristorazione & Eventi",
    ticketLevel: "low",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 8,
    cplOptimal: 15,
    cplMax: 28,
    recommendedRadiusKm: 8,
    targetCtrMin: 1.8,
    leadFormType: "high_volume",
    explanationText:
      "Volume e proximity: raggio corto, creatività appetitosa, CTA prenotazione / menu.",
  },
  {
    key: "pizzeria",
    label: "Pizzeria",
    category: "Ristorazione & Eventi",
    ticketLevel: "low",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 20,
    cplMin: 6,
    cplOptimal: 12,
    cplMax: 22,
    recommendedRadiusKm: 7,
    targetCtrMin: 2.0,
    leadFormType: "high_volume",
    explanationText:
      "Domanda locale fortissima. Budget basso e costante, focus su delivery / asporto se rilevante.",
  },
  {
    key: "wedding",
    label: "Wedding / Eventi",
    category: "Ristorazione & Eventi",
    ticketLevel: "high",
    recommendedDailyBudgetMin: 20,
    recommendedDailyBudgetOptimal: 35,
    cplMin: 25,
    cplOptimal: 45,
    cplMax: 75,
    recommendedRadiusKm: 30,
    targetCtrMin: 1.0,
    leadFormType: "qualified",
    explanationText:
      "Ciclo lungo e ticket alto. Qualifica data evento e numero invitati; raggio più ampio della sola città.",
  },
  {
    key: "meccanico",
    label: "Meccanico",
    category: "Automotive",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 22,
    cplMin: 12,
    cplOptimal: 25,
    cplMax: 40,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.4,
    leadFormType: "balanced",
    explanationText:
      "Servizio di prossimità e urgenza (tagliando, guasto). Messaggi chiari su tempi e marca specializzata.",
  },
  {
    key: "scuola-guida",
    label: "Scuola guida",
    category: "Automotive",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.5,
    leadFormType: "balanced",
    explanationText:
      "Target giovane e stagionale. Offerta prima lezione / patenti disponibili riduce il CPL.",
  },
  {
    key: "carrozzeria",
    label: "Carrozzeria",
    category: "Automotive",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 22,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.3,
    leadFormType: "balanced",
    explanationText:
      "Lead da preventivo danno / restyling. Foto before/after e tempi di consegna aiutano CTR e qualità.",
  },
  {
    key: "veterinario",
    label: "Veterinario",
    category: "Salute & Cura",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 15,
    recommendedDailyBudgetOptimal: 25,
    cplMin: 18,
    cplOptimal: 32,
    cplMax: 50,
    recommendedRadiusKm: 15,
    targetCtrMin: 1.3,
    leadFormType: "balanced",
    explanationText:
      "Fiducia e urgenza (pronto soccorso, vaccinazioni). Raggio locale e messaggio empatico.",
  },
  {
    key: "ottica",
    label: "Ottica",
    category: "Salute & Cura",
    ticketLevel: "medium",
    recommendedDailyBudgetMin: 12,
    recommendedDailyBudgetOptimal: 22,
    cplMin: 15,
    cplOptimal: 28,
    cplMax: 45,
    recommendedRadiusKm: 12,
    targetCtrMin: 1.4,
    leadFormType: "balanced",
    explanationText:
      "Promozioni controllo vista e brand occhiali. Volume medio, raggio urbano.",
  },
];

function normalizzaTesto(valore: string): string {
  return valore
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isMetropoli(citta: string): boolean {
  const n = normalizzaTesto(citta);
  return METROPOLI.some(
    (m) => n === m || n.includes(m) || m.includes(n),
  );
}

function arrotonda(valore: number, decimali = 1): number {
  const f = 10 ** decimali;
  return Math.round(valore * f) / f;
}

function applicaCityMultiplier(
  base: NicheBenchmark,
  citta: string,
): NicheBenchmark {
  if (!isMetropoli(citta)) return { ...base };

  return {
    ...base,
    recommendedDailyBudgetMin: arrotonda(
      base.recommendedDailyBudgetMin * CITY_COST_MULTIPLIER,
    ),
    recommendedDailyBudgetOptimal: arrotonda(
      base.recommendedDailyBudgetOptimal * CITY_COST_MULTIPLIER,
    ),
    cplMin: arrotonda(base.cplMin * CITY_COST_MULTIPLIER),
    cplOptimal: arrotonda(base.cplOptimal * CITY_COST_MULTIPLIER),
    cplMax: arrotonda(base.cplMax * CITY_COST_MULTIPLIER),
    recommendedRadiusKm: base.recommendedRadiusKm + CITY_RADIUS_BONUS_KM,
    explanationText: `${base.explanationText} In ${citta.trim() || "metropoli"} i costi attesi sono più alti (~+20%) e il raggio consigliato è leggermente più ampio.`,
  };
}

function stimaTicketDaTesto(settore: string): TicketLevel {
  const n = normalizzaTesto(settore);
  if (
    /implant|chirurg|avvocat|notar|immobil|solare|fotovolt|ristruttur|serrament|luxury|clinica/.test(
      n,
    )
  ) {
    return "high";
  }
  if (
    /pizza|bar|gelat|parrucchi|barber|yoga|pilates|palestra|ristorant|caff/.test(
      n,
    )
  ) {
    return "low";
  }
  return "medium";
}

function trovaNelDatabase(settore: string): NicheBenchmark | null {
  const n = normalizzaTesto(settore);
  if (!n) return null;

  const esatta = BENCHMARK_DATABASE.find(
    (b) =>
      normalizzaTesto(b.key) === n ||
      normalizzaTesto(b.label) === n,
  );
  if (esatta) return esatta;

  const parziale = BENCHMARK_DATABASE.find((b) => {
    const key = normalizzaTesto(b.key);
    const label = normalizzaTesto(b.label);
    return (
      n.includes(key) ||
      n.includes(label) ||
      key.includes(n) ||
      label.includes(n) ||
      label.split(/[\s/]+/).some((token) => token.length > 3 && n.includes(token))
    );
  });

  return parziale ?? null;
}

function fallbackBenchmark(settore: string): NicheBenchmark {
  const ticket = stimaTicketDaTesto(settore);
  const valori = FALLBACK_BY_TICKET[ticket];
  const label = settore.trim() || "Attività locale";

  return {
    key: `fallback-${ticket}`,
    label,
    category: "Altro",
    ticketLevel: ticket,
    ...valori,
    explanationText: `Nessun benchmark dedicato per “${label}”. Usiamo valori medi per ticket ${ticket}: budget e CPL di riferimento tipici delle attività locali italiane.`,
  };
}

/**
 * Restituisce il benchmark per nicchia + città, con moltiplicatore metropoli.
 * Se la nicchia è nel Sector Intelligence Engine, sovrascrive CPL, raggio e budget.
 */
export function getBenchmarkForNiche(
  settore: string,
  citta: string,
): NicheBenchmark {
  const trovato = trovaNelDatabase(settore) ?? fallbackBenchmark(settore);
  const intel = risolviSettoreIntel(settore);
  const arricchito = intel
    ? overlayBenchmarkDaIntel(trovato, intel)
    : trovato;
  return applicaCityMultiplier(arricchito, citta);
}

/**
 * Valuta la performance post-lancio rispetto al benchmark di nicchia.
 */
export function evaluateCampaignPerformance(
  cplReale: number,
  benchmark: NicheBenchmark,
  giorniAttivi: number,
  contattiOttenuti: number,
): CampaignPerformanceVerdict {
  if (giorniAttivi < 3 || contattiOttenuti === 0) {
    return {
      status: "learning",
      label: "Ancora presto",
      message: "Ancora presto - fase di apprendimento in corso",
    };
  }

  if (cplReale <= benchmark.cplOptimal) {
    return {
      status: "good",
      label: "Va bene",
      message: "Va bene - le metriche rientrano nella media di settore",
    };
  }

  if (cplReale <= benchmark.cplMax) {
    return {
      status: "warning",
      label: "Da monitorare",
      message:
        "Da monitorare - i costi sono leggermente sopra la media",
    };
  }

  return {
    status: "alert",
    label: "Da controllare",
    message: "Da controllare - il costo per contatto è troppo alto",
  };
}

/**
 * Economia CPL: break-even e massimo sostenibile.
 *
 * - Break-even per lead = scontrino × tasso conversione
 * - CPL massimo = break-even × (100 − margine target)%
 *   (il margine target è il profitto da preservare su ogni vendita)
 *
 * Prenotazioni (BOOKINGS) — stessa matematica, semantica diversa:
 * - Break-even = Valore visita × (Show-up Rate / 100)
 * - CPA sostenibile = Break-even × (1 − Margine / 100)
 */
export type TargetMarginPercent = 30 | 50 | 70;

export const TARGET_MARGIN_OPTIONS: TargetMarginPercent[] = [30, 50, 70];

/** Valore economico di un lead a break-even (prima del margine di profitto). */
export const calculateBreakEvenPerLead = (
  ticketValue: number,
  conversionRatePercent: number = 10,
): number => {
  if (!ticketValue || ticketValue <= 0) return 0;
  return Math.round(ticketValue * (conversionRatePercent / 100) * 100) / 100;
};

/**
 * CPL massimo sostenibile: quanto può costare un lead
 * affinché, con conversione e margine target, il cliente guadagni.
 * @param targetMarginPercent margine di profitto da preservare (default 50)
 */
export const calculateMaxSustainableCpl = (
  ticketValue: number,
  conversionRatePercent: number = 10,
  targetMarginPercent: number = 50,
): number => {
  if (!ticketValue || ticketValue <= 0) return 0;
  const breakEven = ticketValue * (conversionRatePercent / 100);
  const spendSharePercent = Math.max(0, 100 - targetMarginPercent);
  return Math.round(breakEven * (spendSharePercent / 100));
};

/** Break-even per prenotazione = valore visita × show-up rate. */
export const calculateBreakEvenPerBooking = (
  valoreVisita: number,
  showUpRatePercent: number = 80,
): number => calculateBreakEvenPerLead(valoreVisita, showUpRatePercent);

/**
 * CPA massimo sostenibile per prenotazione confermata.
 * Break-even × (1 − margine/100).
 */
export const calculateMaxSustainableBookingCpa = (
  valoreVisita: number,
  showUpRatePercent: number = 80,
  targetMarginPercent: number = 50,
): number =>
  calculateMaxSustainableCpl(
    valoreVisita,
    showUpRatePercent,
    targetMarginPercent,
  );

/**
 * Economia E-commerce (ROAS) — Passo 2 vendite-online.
 *
 * - CPA Max (Break-Even) = AOV × (margine lordo % / 100) − costo spedizione
 * - Break-even ROAS = AOV / CPA Max
 * - Target ROAS (profitto 30%) = AOV / (CPA Max × 0.7)
 * - LTV (+20%) è un uplift informativo, NON entra nel CPA Max di break-even.
 */
export const calculateRoasBreakEven = (
  productMarginPercent: number,
): number => {
  if (!productMarginPercent || productMarginPercent <= 0) return 0;
  return Math.round((1 / (productMarginPercent / 100)) * 100) / 100;
};

export const calculateMaxSustainablePurchaseCpa = (
  averageOrderValue: number,
  productMarginPercent: number,
  targetMarginPercent: number = 50,
): number => {
  if (!averageOrderValue || averageOrderValue <= 0) return 0;
  if (!productMarginPercent || productMarginPercent <= 0) return 0;
  const gross = averageOrderValue * (productMarginPercent / 100);
  const spendShare = Math.max(0, 100 - targetMarginPercent) / 100;
  return Math.round(gross * spendShare * 100) / 100;
};

export const calculateRoasTarget = (
  productMarginPercent: number,
  targetMarginPercent: number = 50,
): number => {
  if (!productMarginPercent || productMarginPercent <= 0) return 0;
  const denom =
    (productMarginPercent / 100) *
    (Math.max(0, 100 - targetMarginPercent) / 100);
  if (denom <= 0) return 0;
  return Math.round((1 / denom) * 100) / 100;
};

/** Margine % effettivo con eventuale boost LTV (+20% relativo) — solo uplift. */
export const calculateEcommerceMargineEffettivoPercent = (
  productMarginPercent: number,
  ltvRiacquisto60g: boolean,
): number => {
  if (!productMarginPercent || productMarginPercent <= 0) return 0;
  const boosted = ltvRiacquisto60g
    ? productMarginPercent * 1.2
    : productMarginPercent;
  return Math.round(Math.min(100, boosted) * 100) / 100;
};

/**
 * Margine netto / CPA Max break-even (€) =
 * AOV × (margine lordo % / 100) − costo spedizione/fulfillment.
 * Il flag LTV non altera questo valore (break-even rigoroso).
 */
export const calculateEcommerceMargineNetto = (
  averageOrderValue: number,
  productMarginPercent: number,
  shippingCost: number,
  _ltvRiacquisto60g: boolean = false,
): number => {
  if (!averageOrderValue || averageOrderValue <= 0) return 0;
  if (!productMarginPercent || productMarginPercent <= 0) return 0;
  const net =
    averageOrderValue * (productMarginPercent / 100) -
    Math.max(0, shippingCost || 0);
  return Math.round(Math.max(0, net) * 100) / 100;
};

/** CPA Max (break-even) = AOV × (margine%/100) − spedizione. */
export const calculateEcommerceCpaMax = (
  averageOrderValue: number,
  productMarginPercent: number,
  shippingCost: number,
  ltvRiacquisto60g: boolean = false,
): number =>
  calculateEcommerceMargineNetto(
    averageOrderValue,
    productMarginPercent,
    shippingCost,
    ltvRiacquisto60g,
  );

/** Uplift informativo: CPA Max × 1.2 se LTV 60gg attivo. */
export const calculateEcommerceCpaMaxConLtv = (
  cpaMaxBreakEven: number,
  ltvRiacquisto60g: boolean,
): number => {
  if (!cpaMaxBreakEven || cpaMaxBreakEven <= 0) return 0;
  if (!ltvRiacquisto60g) return cpaMaxBreakEven;
  return Math.round(cpaMaxBreakEven * 1.2 * 100) / 100;
};

/** Break-even ROAS = AOV / CPA Max. */
export const calculateEcommerceBreakEvenRoas = (
  averageOrderValue: number,
  cpaMax: number,
): number => {
  if (!averageOrderValue || averageOrderValue <= 0 || !cpaMax || cpaMax <= 0) {
    return 0;
  }
  return Math.round((averageOrderValue / cpaMax) * 100) / 100;
};

/** Target ROAS (profitto 30%) = AOV / (CPA Max × 0.7). */
export const calculateEcommerceTargetRoas = (
  averageOrderValue: number,
  cpaMax: number,
): number => {
  if (!averageOrderValue || averageOrderValue <= 0 || !cpaMax || cpaMax <= 0) {
    return 0;
  }
  return Math.round((averageOrderValue / (cpaMax * 0.7)) * 100) / 100;
};

/** ROAS reale = fatturato / spesa. */
export const calculateRoasReale = (
  fatturato: number,
  spesa: number,
): number => {
  if (!spesa || spesa <= 0) return 0;
  return Math.round((fatturato / spesa) * 100) / 100;
};

/**
 * Economia Drive-to-Store / IN_STORE.
 *
 * - Utile per Scontrino = average_receipt × (store_margin / 100)
 * - CPA Sostenibile = Utile × (1 − target_margin / 100)
 */
export const calculateUtilePerScontrino = (
  averageReceipt: number,
  storeMarginPercent: number,
): number => {
  if (!averageReceipt || averageReceipt <= 0) return 0;
  if (!storeMarginPercent || storeMarginPercent <= 0) return 0;
  return Math.round(averageReceipt * (storeMarginPercent / 100) * 100) / 100;
};

export const calculateMaxSustainableInStoreCpa = (
  averageReceipt: number,
  storeMarginPercent: number,
  targetMarginPercent: number = 50,
): number => {
  const utile = calculateUtilePerScontrino(
    averageReceipt,
    storeMarginPercent,
  );
  if (utile <= 0) return 0;
  const spendShare = Math.max(0, 100 - targetMarginPercent) / 100;
  return Math.round(utile * spendShare * 100) / 100;
};

/**
 * Economia RETARGETING / recupero carrelli.
 *
 * - Valore Netto = valoreMedio × (1 − sconto/100)
 * - CPA Sostenibile = Valore Netto × (margineLordo/100) × 0.6
 *   (soglia aggressiva per pubblico caldo)
 */
export const calculateValoreNettoRecupero = (
  valoreMedio: number,
  scontoPercent: number = 0,
): number => {
  if (!valoreMedio || valoreMedio <= 0) return 0;
  const sconto = Math.min(100, Math.max(0, scontoPercent || 0));
  return Math.round(valoreMedio * (1 - sconto / 100) * 100) / 100;
};

export const calculateMaxSustainableRecoveryCpa = (
  valoreMedio: number,
  margineLordoPercent: number,
  scontoPercent: number = 0,
): number => {
  const netto = calculateValoreNettoRecupero(valoreMedio, scontoPercent);
  if (netto <= 0) return 0;
  if (!margineLordoPercent || margineLordoPercent <= 0) return 0;
  return Math.round(netto * (margineLordoPercent / 100) * 0.6 * 100) / 100;
};

/**
 * Economia AWARENESS / lancio locale.
 *
 * - Impressions = (budgetTotale / CPM) × 1000
 * - Persone uniche ≈ Impressions / frequenza (default 2.5)
 */
export const FREQUENZA_AWARENESS_DEFAULT = 2.5;

export const calculateImpressionsAwareness = (
  budgetTotale: number,
  cpmStimato: number = 7,
): number => {
  const budget = Math.abs(Number(budgetTotale) || 0);
  const cpm = Math.abs(Number(cpmStimato) || 0);
  if (budget <= 0 || cpm <= 0) return 0;
  return Math.round((budget / cpm) * 1000);
};

export const calculatePersoneUnicheAwareness = (
  budgetTotale: number,
  cpmStimato: number = 7,
  frequenza: number = FREQUENZA_AWARENESS_DEFAULT,
): number => {
  const impressions = calculateImpressionsAwareness(budgetTotale, cpmStimato);
  const freq = Math.abs(Number(frequenza) || 0);
  if (impressions <= 0 || freq <= 0) return 0;
  return Math.abs(Math.round(impressions / freq));
};

/**
 * Business Simulator Avanzato — LTV (Lifetime Value).
 *
 * - LTV = scontrino × frequenza annuale × anni permanenza × (1 + loyalty/100)
 *   (loyalty 0% = nessun uplift; es. 20% → LTV × 1,2)
 * - Valore Netto Cliente = LTV × (margine lordo / 100)
 * - Break-even CPL/CPA su LTV = Valore Netto × (tasso conversione / 100)
 * - CPL/CPA Sostenibile Target = Break-even × (1 − margine target / 100)
 */
export type LtvInput = {
  scontrinoMedio: number;
  frequenzaAnnuale: number;
  anniPermanenza: number;
  /** Tasso di riacquisto / loyalty in % (uplift sull'LTV). */
  loyaltyPercent?: number;
  margineLordoPercent: number;
  tassoConversionePercent: number;
  targetMarginPercent: number;
};

export type LtvEconomics = {
  ltv: number;
  valoreNettoCliente: number;
  breakEvenCpl: number;
  cplSostenibileLtv: number;
  /** CPL/CPA sul solo primo acquisto (senza LTV). */
  cplPrimoAcquisto: number;
  anniPermanenza: number;
};

export const calculateLifetimeValue = (
  scontrinoMedio: number,
  frequenzaAnnuale: number = 1,
  anniPermanenza: number = 1,
  loyaltyPercent: number = 0,
): number => {
  if (!scontrinoMedio || scontrinoMedio <= 0) return 0;
  const freq = Math.max(0, frequenzaAnnuale || 0);
  const anni = Math.max(0, anniPermanenza || 0);
  const loyalty = Math.min(100, Math.max(0, loyaltyPercent || 0));
  const uplift = 1 + loyalty / 100;
  return Math.round(scontrinoMedio * freq * anni * uplift * 100) / 100;
};

export const calculateValoreNettoClienteLtv = (
  ltv: number,
  margineLordoPercent: number,
): number => {
  if (!ltv || ltv <= 0) return 0;
  if (!margineLordoPercent || margineLordoPercent <= 0) return 0;
  return Math.round(ltv * (margineLordoPercent / 100) * 100) / 100;
};

export const calculateBreakEvenCplLtv = (
  valoreNettoCliente: number,
  tassoConversionePercent: number,
): number => {
  if (!valoreNettoCliente || valoreNettoCliente <= 0) return 0;
  const tasso = Math.max(0, tassoConversionePercent || 0);
  return Math.round(valoreNettoCliente * (tasso / 100) * 100) / 100;
};

export const calculateMaxSustainableCplLtv = (
  valoreNettoCliente: number,
  tassoConversionePercent: number,
  targetMarginPercent: number = 50,
): number => {
  const breakEven = calculateBreakEvenCplLtv(
    valoreNettoCliente,
    tassoConversionePercent,
  );
  if (breakEven <= 0) return 0;
  const spendShare = Math.max(0, 100 - targetMarginPercent) / 100;
  return Math.round(breakEven * spendShare * 100) / 100;
};

/** Calcolo completo LTV + CPL primo acquisto vs CPL su ciclo di vita. */
export const calculateLtvEconomics = (input: LtvInput): LtvEconomics => {
  const ltv = calculateLifetimeValue(
    input.scontrinoMedio,
    input.frequenzaAnnuale,
    input.anniPermanenza,
    input.loyaltyPercent ?? 0,
  );
  const valoreNettoCliente = calculateValoreNettoClienteLtv(
    ltv,
    input.margineLordoPercent,
  );
  const breakEvenCpl = calculateBreakEvenCplLtv(
    valoreNettoCliente,
    input.tassoConversionePercent,
  );
  const cplSostenibileLtv = calculateMaxSustainableCplLtv(
    valoreNettoCliente,
    input.tassoConversionePercent,
    input.targetMarginPercent,
  );
  const cplPrimoAcquisto = calculateMaxSustainableCpl(
    input.scontrinoMedio,
    input.tassoConversionePercent,
    input.targetMarginPercent,
  );
  return {
    ltv,
    valoreNettoCliente,
    breakEvenCpl,
    cplSostenibileLtv,
    cplPrimoAcquisto,
    anniPermanenza: Math.max(0, input.anniPermanenza || 0),
  };
};
