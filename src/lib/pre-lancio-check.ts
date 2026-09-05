import {
  calculateImpressionsAwareness,
  calculatePersoneUnicheAwareness,
  getBenchmarkForNiche,
} from "@/lib/benchmarks";
import { analizzaControlloMessaggioLeads } from "@/lib/controllo-messaggio";
import { analizzaControlloMessaggioBookings } from "@/lib/controllo-messaggio-bookings";
import { analizzaControlloMessaggioEcommerce } from "@/lib/controllo-messaggio-ecommerce";
import { analizzaControlloMessaggioInstore } from "@/lib/controllo-messaggio-instore";
import { analizzaControlloMessaggioRetargeting } from "@/lib/controllo-messaggio-retargeting";
import { analizzaControlloMessaggioAwareness } from "@/lib/controllo-messaggio-awareness";
import type {
  BookingChannel,
  CampagnaObjective,
  EcommerceShippingMarket,
  TargetType,
} from "@/types/campagne";

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export const WIZARD_STEPS: {
  id: WizardStep;
  etichetta: string;
  titolo: string;
}[] = [
  {
    id: 1,
    etichetta: "Cliente",
    titolo: "Partiamo dal cliente",
  },
  {
    id: 2,
    etichetta: "Economia",
    titolo: "💰 Economia del Business",
  },
  {
    id: 3,
    etichetta: "Messaggio",
    titolo: "✍️ Messaggio & Copywriting",
  },
  {
    id: 4,
    etichetta: "Creatività",
    titolo: "🎬 Studio Creativo & Formati",
  },
  {
    id: 5,
    etichetta: "Diagnosi",
    titolo: "🩺 Diagnosi Pre-Lancio",
  },
  {
    id: 6,
    etichetta: "Pronta",
    titolo: "🚀 Campagna Pronta",
  },
];

export type PreLancioCheckLevel = "ok" | "warning" | "tip";

/** Severità operativa (layout LEADS). */
export type PreLancioSeverita = "ok" | "consiglio" | "errore" | "info";

export type PreLancioAzioneRapida =
  | "espandi-raggio"
  | "trunca-headline"
  | "vai-passo-1"
  | "vai-passo-2"
  | "vai-passo-3"
  | "vai-passo-4";

export type PreLancioCheckItem = {
  id: string;
  level: PreLancioCheckLevel;
  messaggio: string;
  /** Layout operativo LEADS. */
  titolo?: string;
  severita?: PreLancioSeverita;
  motivazione?: string;
  /** Pulsante 1-click accanto all'avviso. */
  azione?: {
    tipo: PreLancioAzioneRapida;
    etichetta: string;
  };
};

export type PreLancioRiepilogo = {
  ok: number;
  consigli: number;
  errori: number;
};

/** Box secondario RETARGETING: azioni manuali in Meta (fuori dal riepilogo). */
export type PreLancioIstruzioniMeta = {
  titolo: string;
  microcopy: string;
  voci: string[];
  /** Nota informativa sull'evento usato in export (non implica Pixel già collegato). */
  notaEvento?: string;
};

export type CreativitaDiagnosiSnapshot = {
  avvisoFormato: boolean;
  formatoOrizzontale: boolean;
  width: number;
  height: number;
  isVideo?: boolean;
};

export type StimaSaturazione = {
  popolazioneUnica: number;
  impressionsGiornaliere: number;
  giorniSaturazione: number;
  cpmUsato: number;
};

export type StimaAppuntamentiSettimanali = {
  appuntamenti: number;
  budgetSettimanale: number;
  costoPerContatto: number;
  showUpRate: number;
};

/** Solo ECOMMERCE: stima ordini attesi / mese. */
export type StimaOrdiniMensili = {
  ordiniMensili: number;
  budgetGiornaliero: number;
  cpaMax: number;
};

export type PreLancioDiagnosi = {
  checks: PreLancioCheckItem[];
  score: number;
  label: string;
  tone: "green" | "yellow" | "orange";
  saturazione: StimaSaturazione | null;
  /** Solo BOOKINGS: stima clienti reali in struttura / settimana. */
  stimaAppuntamenti: StimaAppuntamentiSettimanali | null;
  /** Solo ECOMMERCE: stima conversioni / ordini. */
  stimaOrdini: StimaOrdiniMensili | null;
  /** Solo RETARGETING legacy: mostra box copertura pubblico caldo. */
  stimaCoperturaRetargeting: boolean;
  /** Obiettivo campagna (per copy del box saturazione). */
  objective?: CampagnaObjective;
  /** Layout operativo LEADS (richieste-contatto). */
  layoutOperativo?: boolean;
  riepilogo?: PreLancioRiepilogo;
  haErroriBloccanti?: boolean;
  /**
   * RETARGETING moderno: istruzioni manuali Meta (Custom Audience, pixel, …).
   * Fuori dal riepilogo OK / consigli / errori.
   */
  istruzioniMeta?: PreLancioIstruzioniMeta;
  /**
   * AWARENESS moderno: stime Step 2 (impression / copertura) fuori checklist.
   * Non usa densità 900 né saturazione.
   */
  stimaModelloAwareness?: {
    impressions: number;
    coperturaIndicativa: number;
  } | null;
};

function isB2BNiche(settore: string | undefined): boolean {
  const s = (settore ?? "").toLowerCase();
  if (
    s.includes("avvocat") ||
    s.includes("dentist") ||
    s.includes("commercialist") ||
    s.includes("consulenz") ||
    s.includes("agenzia") ||
    s.includes("b2b") ||
    s.includes("studio") ||
    s.includes("notar") ||
    s.includes("ingegner") ||
    s.includes("architett")
  ) {
    return true;
  }
  const bench = getBenchmarkForNiche(settore ?? "", "");
  return (
    bench.category === "Servizi Professionali" ||
    bench.recommendedDailyBudgetMin >= 22
  );
}

export type PreLancioInput = {
  raggioKm: number;
  titoloAnnuncio: string;
  budgetGiornaliero: number;
  settore?: string;
  haCopy: boolean;
  haCreativita: boolean;
  objective?: CampagnaObjective;
  /** CPM stimato locale (€ / 1.000 impressions). Default 7. */
  cpmStimato?: number;
  /** BOOKINGS: canale prenotazione. */
  bookingChannel?: BookingChannel;
  /** BOOKINGS: show-up rate % (tasso di presenza). */
  showUpRate?: number;
  /** BOOKINGS: CPA/CPL di riferimento (€) per stima appuntamenti. */
  costoPerContatto?: number;
  /** ECOMMERCE: mercato di spedizione / copertura. */
  shippingMarket?: EcommerceShippingMarket;
  /** ECOMMERCE: etichetta mercato (città o testo libero). */
  mercatoLabel?: string;
  /** ECOMMERCE: Break-even ROAS (AOV / CPA Max). */
  breakEvenRoas?: number;
  /** ECOMMERCE: CPA Max (€) per stima ordini. */
  cpaMax?: number;
  /** LEADS: ID pagina Facebook (export Meta). */
  pageId?: string;
  /** LEADS: ID modulo lead Meta. */
  formId?: string;
  /** LEADS: città per controllo hook. */
  citta?: string;
  /** LEADS: offerta front-end per controllo hook. */
  frontEndOffer?: string;
  /** LEADS: testo Variante A per controllo messaggio. */
  varianteA?: string;
  /** ECOMMERCE: URL pagina di destinazione / store. */
  sitoWeb?: string;
  /** ECOMMERCE: brief prodotto per controllo messaggio. */
  elevatorPitch?: string;
  /** ECOMMERCE: prodotto hero (snippet) per controllo messaggio. */
  heroProduct?: string;
  /** INSTORE: nome negozio / attività per controllo messaggio. */
  nomeCliente?: string;
  /** RETARGETING: fork copy/export B2C vs B2B. */
  targetType?: TargetType;
  /** BOOKINGS: numero WhatsApp (canale WHATSAPP). */
  whatsappNumber?: string;
  /** BOOKINGS: URL calendario / pagina prenotazioni (canale BOOKING_LINK). */
  bookingLinkUrl?: string;
  /** LEADS: snapshot creatività per controllo formato. */
  creativita?: CreativitaDiagnosiSnapshot[];
  /** AWARENESS: budget totale di lancio (€) — check economia, non budget giornaliero. */
  launchBudget?: number;
};

export function etichettaMercatoEcommerce(
  shippingMarket?: EcommerceShippingMarket,
  mercatoLabel?: string,
): string {
  if (shippingMarket === "ITALY") return "Italia";
  if (shippingMarket === "EUROPE") return "Europa";
  if (shippingMarket === "GLOBAL") return "Globale";
  const libero = (mercatoLabel ?? "").trim();
  return libero || "Selezionato";
}

/**
 * Ordini/mese ≈ (budget giornaliero × 30) / CPA Max.
 */
export function stimaOrdiniMensili(input: {
  budgetGiornaliero: number;
  cpaMax: number;
}): StimaOrdiniMensili | null {
  const budget = input.budgetGiornaliero;
  const cpa = input.cpaMax;
  if (budget <= 0 || cpa <= 0) return null;
  return {
    ordiniMensili: Math.max(0, Math.round((budget * 30) / cpa)),
    budgetGiornaliero: Math.round(budget * 100) / 100,
    cpaMax: Math.round(cpa * 100) / 100,
  };
}

export function etichettaBookingChannel(
  channel?: BookingChannel,
): string {
  switch (channel) {
    case "WHATSAPP":
      return "WhatsApp Diretto";
    case "BOOKING_LINK":
      return "Software di Prenotazione / Sito Web";
    case "PHONE_CALL":
      return "Chiamata Telefonica Diretta";
    case "INSTAGRAM_DM":
      return "Messaggio Direct Instagram / Facebook";
    case "LEAD_FORM":
      return "Modulo Lead Meta";
    default:
      return "Non impostato";
  }
}

/**
 * Appuntamenti reali/settimana ≈ ((budget×7) / CPA) × (show-up / 100).
 */
export function stimaAppuntamentiSettimanali(input: {
  budgetGiornaliero: number;
  costoPerContatto: number;
  showUpRate: number;
}): StimaAppuntamentiSettimanali | null {
  const budget = input.budgetGiornaliero;
  const cpa = input.costoPerContatto;
  const showUp = input.showUpRate;
  if (budget <= 0 || cpa <= 0 || showUp <= 0) return null;

  const budgetSettimanale = budget * 7;
  const contatti = budgetSettimanale / cpa;
  const appuntamenti = Math.max(
    0,
    Math.round(contatti * (showUp / 100)),
  );

  return {
    appuntamenti,
    budgetSettimanale: Math.round(budgetSettimanale * 100) / 100,
    costoPerContatto: Math.round(cpa * 100) / 100,
    showUpRate: showUp,
  };
}

/**
 * Popolazione unica indicativa raggiungibile in un raggio (densità Meta locale ~900 ab/km²).
 */
export function stimaPopolazioneUnicaPerRaggio(raggioKm: number): number {
  const r = Math.abs(Number(raggioKm) || 0);
  if (r <= 0) return 0;
  const densitaEffettiva = 900;
  return Math.abs(Math.round(Math.PI * r * r * densitaEffettiva));
}

/**
 * Giorni prima della saturazione del pubblico locale.
 * Giorni = Popolazione / (Budget giornaliero / CPM × 1000)
 */
export function stimaSaturazionePubblico(input: {
  raggioKm: number;
  budgetGiornaliero: number;
  cpmStimato?: number;
}): StimaSaturazione | null {
  const cpmRaw =
    input.cpmStimato && input.cpmStimato !== 0 ? input.cpmStimato : 7;
  const cpm = Math.abs(Number(cpmRaw) || 7);
  const budget = Math.abs(Number(input.budgetGiornaliero) || 0);
  const popolazioneUnica = Math.abs(
    stimaPopolazioneUnicaPerRaggio(input.raggioKm),
  );
  if (budget <= 0 || popolazioneUnica <= 0 || cpm <= 0) return null;

  const impressionsGiornaliere = Math.abs((budget / cpm) * 1000);
  if (impressionsGiornaliere <= 0) return null;

  const giorniSaturazione = Math.max(
    1,
    Math.abs(Math.round(popolazioneUnica / impressionsGiornaliere)),
  );

  return {
    popolazioneUnica,
    impressionsGiornaliere: Math.round(impressionsGiornaliere),
    giorniSaturazione,
    cpmUsato: cpm,
  };
}

/** Trunca headline a max caratteri (preferisce fine parola se possibile). */
export function truncaHeadline(testo: string, max = 45): string {
  const t = testo.trim();
  if (t.length <= max) return t;
  const taglio = t.slice(0, max);
  const ultimoSpazio = taglio.lastIndexOf(" ");
  if (ultimoSpazio >= Math.floor(max * 0.6)) {
    return taglio.slice(0, ultimoSpazio).trimEnd();
  }
  return taglio.trimEnd();
}

/**
 * Headline AI / Meta: max ~5 parole o 45 caratteri.
 * Se supera 50 caratteri, usa clausola corta o fallback a 5 parole + trim.
 */
export function pulisciHeadlineBreve(testo: string, max = 45): string {
  let t = (testo ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";

  if (t.length > 50) {
    const primaClausola = t.split(/[.|;—–]/)[0]?.trim() ?? t;
    if (primaClausola.length >= 6 && primaClausola.length <= 50) {
      t = primaClausola;
    } else {
      const parole = t.split(/\s+/).filter(Boolean).slice(0, 5);
      t = parole.join(" ");
    }
  }

  const parole = t.split(/\s+/).filter(Boolean);
  if (parole.length > 5 && t.length > max) {
    t = parole.slice(0, 5).join(" ");
  }

  return truncaHeadline(t, max);
}

/**
 * Pre-Flight Check automatico prima dell'export Meta.
 */
export function calcolaDiagnosiPreLancio(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;
  const isEcommerce = input.objective === "ECOMMERCE";
  const isRetargeting = input.objective === "RETARGETING";
  const isAwareness = input.objective === "AWARENESS";

  if (isEcommerce) {
    const mercato = etichettaMercatoEcommerce(
      input.shippingMarket,
      input.mercatoLabel,
    );
    checks.push({
      id: "target",
      level: "ok",
      messaggio: `🟢 Copertura Nazionale: Mercato ${mercato} impostato.`,
    });

    const breakEvenRoas = input.breakEvenRoas ?? 0;
    const cpaMax = input.cpaMax ?? 0;
    if (breakEvenRoas > 0 && cpaMax > 0) {
      checks.push({
        id: "roas",
        level: "ok",
        messaggio: `🟢 Break-Even ROAS calcolato (${breakEvenRoas}x): Budget allineato alla CPA max.`,
      });
    } else {
      checks.push({
        id: "roas",
        level: "warning",
        messaggio:
          "⚠️ Economia incompleta: inserisci AOV e margine al Passo 2 per calcolare Break-Even ROAS e CPA max.",
      });
      score -= 20;
    }
  } else if (isRetargeting) {
    checks.push({
      id: "target",
      level: "ok",
      messaggio:
        "🟢 Pubblico Caldo Intercettato: Target basato su Custom Audience (Pixel / Carrelli / Interazioni).",
    });
    checks.push({
      id: "frequenza",
      level: "ok",
      messaggio:
        "🟢 Controllo Frequenza: Budget bilanciato per evitare la sovraesposizione sugli stessi utenti.",
    });
  } else if (isAwareness) {
    checks.push({
      id: "impatto-locale",
      level: "ok",
      messaggio:
        "🟢 Impatto Locale: Budget e raggio calibrati per saturare l'area target prima dell'inaugurazione.",
    });
  } else if (input.raggioKm > 0 && input.raggioKm < 5) {
    checks.push({
      id: "raggio",
      level: "warning",
      messaggio:
        "⚠️ Raggio geografico stretto: rischia di saturare subito il pubblico.",
      azione: {
        tipo: "espandi-raggio",
        etichetta: "⚡ Espandi Raggio a 15 km",
      },
    });
    score -= 25;
  } else {
    checks.push({
      id: "raggio",
      level: "ok",
      messaggio: `Raggio locale impostato a ${input.raggioKm || "—"} km: copertura sostenibile.`,
    });
  }

  const headline = (input.titoloAnnuncio ?? "").trim();
  if (headline.length > 50) {
    checks.push({
      id: "headline",
      level: "tip",
      messaggio:
        "💡 Headline lunga: sui telefoni potrebbe venire tagliata.",
      azione: {
        tipo: "trunca-headline",
        etichetta: "⚡ Trunca Headline a 45 caratteri",
      },
    });
    score -= 15;
  } else if (headline.length === 0) {
    checks.push({
      id: "headline",
      level: "warning",
      messaggio: "⚠️ Headline mancante: aggiungi un titolo breve per il feed.",
    });
    score -= 20;
  } else {
    checks.push({
      id: "headline",
      level: "ok",
      messaggio: `Headline entro ${headline.length} caratteri: ok per mobile.`,
    });
  }

  const b2b = isB2BNiche(input.settore);
  if (b2b && input.budgetGiornaliero > 0 && input.budgetGiornaliero < 15) {
    checks.push({
      id: "budget",
      level: "warning",
      messaggio:
        "⚠️ Budget ridotto per la nicchia selezionata.",
    });
    score -= 25;
  } else if (input.budgetGiornaliero > 0 && input.budgetGiornaliero < 10) {
    checks.push({
      id: "budget",
      level: "warning",
      messaggio:
        "⚠️ Budget giornaliero molto basso: l'apprendimento Meta sarà lento.",
    });
    score -= 15;
  } else {
    checks.push({
      id: "budget",
      level: "ok",
      messaggio: `Budget giornaliero ${input.budgetGiornaliero}€: coerente con la nicchia.`,
    });
  }

  if (!input.haCopy) {
    checks.push({
      id: "copy",
      level: "warning",
      messaggio: "⚠️ Nessun testo annuncio: genera o inserisci almeno la Variante A.",
    });
    score -= 20;
  } else {
    checks.push({
      id: "copy",
      level: "ok",
      messaggio: "Copywriting presente: almeno una variante pronta.",
    });
  }

  if (!input.haCreativita) {
    checks.push({
      id: "creativita",
      level: "tip",
      messaggio:
        "💡 Creatività non caricata: puoi esportare comunque, ma l'anteprima Meta sarà incompleta.",
      azione: {
        tipo: "vai-passo-4",
        etichetta: "📸 Torna al Passo 4 per caricare una foto",
      },
    });
    score -= 10;
  } else {
    checks.push({
      id: "creativita",
      level: "ok",
      messaggio: "Creatività caricata: anteprima feed completa.",
    });
  }

  const isBookings = input.objective === "BOOKINGS";

  if (isBookings) {
    const canaleLabel = etichettaBookingChannel(input.bookingChannel);
    if (input.bookingChannel) {
      checks.push({
        id: "canale",
        level: "ok",
        messaggio: `🟢 Canale selezionato: ${canaleLabel} (CTA e tracciamento allineati).`,
      });
    } else {
      checks.push({
        id: "canale",
        level: "warning",
        messaggio:
          "⚠️ Canale di prenotazione non impostato: CTA e tracciamento potrebbero non essere allineati.",
      });
      score -= 15;
    }

    const showUp = input.showUpRate ?? 0;
    if (showUp > 0 && showUp < 50) {
      checks.push({
        id: "show-up",
        level: "warning",
        messaggio: `⚠️ Tasso di presenza stimato basso (${showUp}%). Consigliamo di attivare un promemoria automatico 24h prima per ridurre gli appuntamenti bucati.`,
      });
      score -= 15;
    } else if (showUp > 0) {
      checks.push({
        id: "show-up",
        level: "ok",
        messaggio: `Tasso di presenza ${showUp}%: coerente con un'agenda locale sostenibile.`,
      });
    }
  }

  score = Math.max(0, Math.min(100, score));

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (score >= 80) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Quasi pronta — rivedi gli avvisi";
  }

  const saturazione =
    isEcommerce || isRetargeting
      ? null
      : stimaSaturazionePubblico({
          raggioKm: input.raggioKm,
          budgetGiornaliero: input.budgetGiornaliero,
          cpmStimato: input.cpmStimato,
        });

  const stimaAppuntamenti = isBookings
    ? stimaAppuntamentiSettimanali({
        budgetGiornaliero: input.budgetGiornaliero,
        costoPerContatto:
          input.costoPerContatto && input.costoPerContatto > 0
            ? input.costoPerContatto
            : getBenchmarkForNiche(input.settore ?? "", "").cplOptimal,
        showUpRate: input.showUpRate && input.showUpRate > 0
          ? input.showUpRate
          : 75,
      })
    : null;

  const stimaOrdini = isEcommerce
    ? stimaOrdiniMensili({
        budgetGiornaliero: input.budgetGiornaliero,
        cpaMax:
          input.cpaMax && input.cpaMax > 0
            ? input.cpaMax
            : getBenchmarkForNiche(input.settore ?? "", "").cplOptimal,
      })
    : null;

  return {
    checks,
    score,
    label,
    tone,
    saturazione,
    stimaAppuntamenti,
    stimaOrdini,
    stimaCoperturaRetargeting: isRetargeting,
    objective: input.objective,
  };
}

const RATIO_STORIES = 9 / 16;
const TOLLERANZA_STORIES = 0.05;

function haFormatoStories(asset: CreativitaDiagnosiSnapshot): boolean {
  if (asset.isVideo) return true;
  if (!asset.width || !asset.height) return false;
  const ratio = asset.width / asset.height;
  return Math.abs(ratio - RATIO_STORIES) <= TOLLERANZA_STORIES;
}

function itemOperativo(
  partial: Omit<PreLancioCheckItem, "level" | "messaggio"> & {
    severita: PreLancioSeverita;
    motivazione: string;
  },
): PreLancioCheckItem {
  const emoji =
    partial.severita === "ok"
      ? "🟢"
      : partial.severita === "consiglio"
        ? "🟡"
        : partial.severita === "errore"
          ? "🔴"
          : "ℹ️";
  const level: PreLancioCheckLevel =
    partial.severita === "ok"
      ? "ok"
      : partial.severita === "consiglio"
        ? "tip"
        : partial.severita === "errore"
          ? "warning"
          : "ok";
  return {
    ...partial,
    level,
    messaggio: `${emoji} ${partial.titolo}: ${partial.motivazione}`,
  };
}

function riepilogoDaChecks(checks: PreLancioCheckItem[]): PreLancioRiepilogo {
  let ok = 0;
  let consigli = 0;
  let errori = 0;
  for (const c of checks) {
    const s =
      c.severita ??
      (c.level === "ok"
        ? "ok"
        : c.level === "tip"
          ? "consiglio"
          : "consiglio");
    if (s === "ok") ok += 1;
    else if (s === "consiglio") consigli += 1;
    else if (s === "errore") errori += 1;
  }
  return { ok, consigli, errori };
}

/**
 * Diagnosi operativa LEADS (richieste-contatto).
 * L'export CSV accetta pageId/formId vuoti → consiglio, non blocco wizard.
 */
export function calcolaDiagnosiPreLancioLeads(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;

  const raggio = input.raggioKm ?? 0;
  if (raggio > 0 && raggio < 5) {
    checks.push(
      itemOperativo({
        id: "raggio",
        titolo: "Raggio geografico",
        severita: "consiglio",
        motivazione: `${raggio} km è molto stretto: rischi di saturare presto il pubblico locale.`,
        azione: {
          tipo: "espandi-raggio",
          etichetta: "Espandi raggio a 15 km",
        },
      }),
    );
    score -= 15;
  } else if (raggio > 0) {
    checks.push(
      itemOperativo({
        id: "raggio",
        titolo: "Raggio geografico",
        severita: "ok",
        motivazione: `${raggio} km è coerente con una campagna locale.`,
      }),
    );
  }

  const headline = (input.titoloAnnuncio ?? "").trim();
  if (headline.length > 50) {
    checks.push(
      itemOperativo({
        id: "headline",
        titolo: "Titolo annuncio",
        severita: "consiglio",
        motivazione:
          "Oltre ~50 caratteri rischia di essere troncato su mobile.",
        azione: {
          tipo: "trunca-headline",
          etichetta: "Tronca a 45 caratteri",
        },
      }),
    );
    score -= 10;
  } else if (headline.length === 0) {
    checks.push(
      itemOperativo({
        id: "headline",
        titolo: "Titolo annuncio",
        severita: "consiglio",
        motivazione:
          "Mancante: l'export userà un titolo di fallback, ma conviene personalizzarlo.",
      }),
    );
    score -= 8;
  } else {
    checks.push(
      itemOperativo({
        id: "headline",
        titolo: "Titolo annuncio",
        severita: "ok",
        motivazione: `${headline.length} caratteri — adatto al feed mobile.`,
      }),
    );
  }

  const benchmark = getBenchmarkForNiche(
    input.settore ?? "",
    input.citta ?? "",
  );
  const budgetMin = benchmark.recommendedDailyBudgetMin;
  const budget = input.budgetGiornaliero ?? 0;

  if (budget <= 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget giornaliero",
        severita: "consiglio",
        motivazione:
          "Imposta un budget giornaliero maggiore di zero al Passo 2.",
      }),
    );
    score -= 20;
  } else if (budget < budgetMin) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget giornaliero",
        severita: "consiglio",
        motivazione: `${budget}€ è sotto il minimo consigliato per ${input.settore?.trim() || "questa nicchia"} (${budgetMin}€/giorno).`,
      }),
    );
    score -= 15;
  } else {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget giornaliero",
        severita: "ok",
        motivazione: `${budget}€/giorno è in linea con il minimo di nicchia (${budgetMin}€).`,
      }),
    );
  }

  const testoA = (input.varianteA ?? "").trim();
  if (!testoA) {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "errore",
        motivazione:
          "Senza testo principale l'annuncio non è pronto per il lancio.",
      }),
    );
    score -= 30;
  } else {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "ok",
        motivazione: "Copy presente e pronto per l'export.",
      }),
    );

    const ctrl = analizzaControlloMessaggioLeads({
      testoVarianteA: testoA,
      headline,
      citta: input.citta ?? "",
      frontEndOffer: input.frontEndOffer ?? "",
    });
    const hook = ctrl.voci.find((v) => v.id === "hook");
    if (hook?.emoji === "🟢") {
      checks.push(
        itemOperativo({
          id: "hook-mobile",
          titolo: "Hook mobile",
          severita: "ok",
          motivazione: hook.messaggio,
        }),
      );
    } else if (hook) {
      checks.push(
        itemOperativo({
          id: "hook-mobile",
          titolo: "Hook mobile",
          severita: "consiglio",
          motivazione: hook.messaggio,
        }),
      );
      score -= 10;
    }
  }

  const assets = input.creativita ?? [];
  if (!input.haCreativita || assets.length === 0) {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "consiglio",
        motivazione:
          "Nessuna immagine caricata: puoi procedere, ma l'anteprima e l'import Meta saranno incompleti.",
        azione: {
          tipo: "vai-passo-4",
          etichetta: "Torna al Passo 4",
        },
      }),
    );
    score -= 10;
  } else {
    const problemiFormato = assets.some(
      (a) => !a.isVideo && (a.avvisoFormato || a.formatoOrizzontale),
    );
    const haStories = assets.some(haFormatoStories);

    if (problemiFormato) {
      checks.push(
        itemOperativo({
          id: "creativita",
          titolo: "Creatività",
          severita: "consiglio",
          motivazione:
            "Almeno un asset ha formato da ottimizzare (preferisci 4:5, 1:1 o 9:16).",
          azione: {
            tipo: "vai-passo-4",
            etichetta: "Rivedi creatività",
          },
        }),
      );
      score -= 8;
    } else {
      checks.push(
        itemOperativo({
          id: "creativita",
          titolo: "Creatività",
          severita: "ok",
          motivazione: `${assets.length} asset caricati con formato compatibile feed.`,
        }),
      );
    }

    if (!haStories && assets.every((a) => !a.isVideo)) {
      checks.push(
        itemOperativo({
          id: "creativita-stories",
          titolo: "Variante verticale (Stories/Reels)",
          severita: "consiglio",
          motivazione:
            "Nessun asset 9:16 rilevato: considera una variante verticale per Stories e Reels.",
          azione: {
            tipo: "vai-passo-4",
            etichetta: "Aggiungi formato 9:16",
          },
        }),
      );
      score -= 5;
    }
  }

  const pageId = (input.pageId ?? "").trim();
  const formId = (input.formId ?? "").trim();
  if (!pageId) {
    checks.push(
      itemOperativo({
        id: "page-id",
        titolo: "ID Pagina Facebook",
        severita: "consiglio",
        motivazione:
          "Mancante nel CSV: il file si genera, ma in Meta Ads Manager va collegata la pagina prima del go-live.",
      }),
    );
    score -= 8;
  } else {
    checks.push(
      itemOperativo({
        id: "page-id",
        titolo: "ID Pagina Facebook",
        severita: "ok",
        motivazione: "Presente — pronto per l'import in blocco.",
      }),
    );
  }

  if (!formId) {
    checks.push(
      itemOperativo({
        id: "form-id",
        titolo: "ID Modulo Lead Meta",
        severita: "consiglio",
        motivazione:
          "Mancante nel CSV: l'export funziona, ma il modulo va associato manualmente in Meta.",
      }),
    );
    score -= 8;
  } else {
    checks.push(
      itemOperativo({
        id: "form-id",
        titolo: "ID Modulo Lead Meta",
        severita: "ok",
        motivazione: "Presente — allineato all'obiettivo Lead Generation.",
      }),
    );
  }

  score = Math.max(0, Math.min(100, score));
  const riepilogo = riepilogoDaChecks(checks);
  const haErroriBloccanti = riepilogo.errori > 0;

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (haErroriBloccanti) {
    tone = "orange";
    label = "Correggi gli elementi in rosso";
  } else if (score >= 80 && riepilogo.consigli === 0) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Puoi procedere — rivedi i consigli";
  }

  const saturazione = stimaSaturazionePubblico({
    raggioKm: input.raggioKm,
    budgetGiornaliero: input.budgetGiornaliero,
    cpmStimato: input.cpmStimato,
  });

  return {
    checks,
    score,
    label,
    tone,
    saturazione,
    stimaAppuntamenti: null,
    stimaOrdini: null,
    stimaCoperturaRetargeting: false,
    objective: "LEADS",
    layoutOperativo: true,
    riepilogo,
    haErroriBloccanti,
  };
}

function severitaDaEmojiControllo(
  emoji: string,
): PreLancioSeverita {
  if (emoji === "🟢") return "ok";
  if (emoji === "🟡") return "consiglio";
  return "info";
}

/**
 * Diagnosi operativa BOOKINGS (prenotazioni).
 * Solo il copy vuoto blocca l'avanzamento dal Passo 5.
 */
export function calcolaDiagnosiPreLancioBookings(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;

  const testoA = (input.varianteA ?? "").trim();
  if (!testoA) {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "errore",
        motivazione:
          "Senza testo principale l'annuncio non è pronto per generare prenotazioni.",
      }),
    );
    score -= 30;
  } else {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "ok",
        motivazione: "Copy presente e pronto per l'export.",
      }),
    );
  }

  const channel = input.bookingChannel;
  if (channel) {
    checks.push(
      itemOperativo({
        id: "canale",
        titolo: "Canale di prenotazione",
        severita: "ok",
        motivazione: `${etichettaBookingChannel(channel)} — CTA e flusso allineati al percorso scelto.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "canale",
        titolo: "Canale di prenotazione",
        severita: "consiglio",
        motivazione:
          "Non impostato: scegli come deve prenotare il cliente al Passo 1.",
      }),
    );
    score -= 12;
  }

  if (testoA && channel) {
    const ctrlCta = analizzaControlloMessaggioBookings({
      testoVarianteA: testoA,
      headline: input.titoloAnnuncio ?? "",
      citta: input.citta ?? "",
      frontEndOffer: input.frontEndOffer ?? "",
      bookingChannel: channel,
    });
    const ctaVoce = ctrlCta.voci.find((v) => v.id === "cta-canale");
    if (ctaVoce) {
      const severita = severitaDaEmojiControllo(ctaVoce.emoji);
      checks.push(
        itemOperativo({
          id: "cta-canale",
          titolo: "CTA e canale",
          severita,
          motivazione: ctaVoce.messaggio,
        }),
      );
      if (severita === "consiglio") score -= 10;
    }
  } else if (!testoA) {
    checks.push(
      itemOperativo({
        id: "cta-canale",
        titolo: "CTA e canale",
        severita: "info",
        motivazione: "Da verificare — inserisci prima il testo annuncio.",
      }),
    );
  }

  if (channel === "BOOKING_LINK") {
    const url = (input.bookingLinkUrl ?? "").trim();
    if (!url) {
      checks.push(
        itemOperativo({
          id: "booking-url",
          titolo: "Link prenotazione",
          severita: "consiglio",
          motivazione:
            "Canale calendario/sito senza URL: l'export funziona, ma conviene indicarlo al Passo 1.",
        }),
      );
      score -= 8;
    } else {
      checks.push(
        itemOperativo({
          id: "booking-url",
          titolo: "Link prenotazione",
          severita: "ok",
          motivazione: "URL calendario o pagina prenotazioni presente.",
        }),
      );
    }
  }

  if (channel === "WHATSAPP") {
    const wa = (input.whatsappNumber ?? "").trim();
    if (!wa) {
      checks.push(
        itemOperativo({
          id: "whatsapp",
          titolo: "Numero WhatsApp",
          severita: "consiglio",
          motivazione:
            "Non indicato: puoi collegarlo alla Pagina Facebook in Meta, ma conviene averlo a portata di mano.",
        }),
      );
      score -= 6;
    } else {
      checks.push(
        itemOperativo({
          id: "whatsapp",
          titolo: "Numero WhatsApp",
          severita: "ok",
          motivazione: "Numero WhatsApp Business indicato.",
        }),
      );
    }
  }

  const showUp = input.showUpRate ?? 0;
  if (showUp > 0 && showUp < 50) {
    checks.push(
      itemOperativo({
        id: "show-up",
        titolo: "Tasso di presenza (show-up)",
        severita: "consiglio",
        motivazione: `Stimato al ${showUp}% — basso: valuta promemoria automatico 24h prima per ridurre i no-show.`,
      }),
    );
    score -= 12;
  } else if (showUp > 0) {
    checks.push(
      itemOperativo({
        id: "show-up",
        titolo: "Tasso di presenza (show-up)",
        severita: "ok",
        motivazione: `${showUp}% — coerente con un'agenda locale sostenibile.`,
      }),
    );
  }

  const offerta = (input.frontEndOffer ?? "").trim();
  if (!offerta) {
    checks.push(
      itemOperativo({
        id: "offerta",
        titolo: "Offerta d'ingresso",
        severita: "consiglio",
        motivazione:
          "Mancante: un incentivo chiaro (es. prima visita, check-up) aiuta a prenotare.",
      }),
    );
    score -= 10;
  } else {
    checks.push(
      itemOperativo({
        id: "offerta",
        titolo: "Offerta d'ingresso",
        severita: "ok",
        motivazione: "Offerta indicata nel brief della campagna.",
      }),
    );
  }

  const benchmark = getBenchmarkForNiche(
    input.settore ?? "",
    input.citta ?? "",
  );
  const budgetMin = benchmark.recommendedDailyBudgetMin;
  const budget = input.budgetGiornaliero ?? 0;
  const cpa = input.costoPerContatto ?? 0;

  if (budget <= 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA sostenibile",
        severita: "consiglio",
        motivazione:
          "Budget giornaliero a zero: imposta un importo al Passo 2 per stimare le prenotazioni.",
      }),
    );
    score -= 15;
  } else if (cpa > 0 && budget * 7 < cpa) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA sostenibile",
        severita: "consiglio",
        motivazione: `Con ${budget}€/giorno (~${Math.round(budget * 7)}€/settimana) e CPA target ${Math.round(cpa * 100) / 100}€ difficile generare almeno un contatto a settimana.`,
      }),
    );
    score -= 12;
  } else if (budget < budgetMin) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA sostenibile",
        severita: "consiglio",
        motivazione: `${budget}€/giorno è sotto il minimo consigliato per ${input.settore?.trim() || "questa nicchia"} (${budgetMin}€/giorno).`,
      }),
    );
    score -= 10;
  } else {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA sostenibile",
        severita: "ok",
        motivazione:
          cpa > 0
            ? `${budget}€/giorno copre il CPA target (${Math.round(cpa * 100) / 100}€) con margine operativo.`
            : `${budget}€/giorno è in linea con il minimo di nicchia (${budgetMin}€).`,
      }),
    );
  }

  const saturazione = stimaSaturazionePubblico({
    raggioKm: input.raggioKm,
    budgetGiornaliero: input.budgetGiornaliero,
    cpmStimato: input.cpmStimato,
  });
  if (saturazione) {
    checks.push(
      itemOperativo({
        id: "saturazione",
        titolo: "Saturazione pubblico (stima)",
        severita: "info",
        motivazione: `STIMA: bacino locale (~${Math.abs(saturazione.popolazioneUnica).toLocaleString("it-IT")} persone) potrebbe saturarsi in circa ${saturazione.giorniSaturazione} giorni con budget e raggio attuali — modello indicativo, non dato Meta.`,
      }),
    );
  }

  const assets = input.creativita ?? [];
  if (!input.haCreativita || assets.length === 0) {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "consiglio",
        motivazione:
          "Nessuna immagine caricata: puoi procedere, ma anteprima e import Meta saranno incompleti.",
        azione: {
          tipo: "vai-passo-4",
          etichetta: "Torna al Passo 4",
        },
      }),
    );
    score -= 10;
  } else {
    const problemiFormato = assets.some(
      (a) => !a.isVideo && (a.avvisoFormato || a.formatoOrizzontale),
    );
    if (problemiFormato) {
      checks.push(
        itemOperativo({
          id: "creativita",
          titolo: "Creatività",
          severita: "consiglio",
          motivazione:
            "Almeno un asset ha formato da ottimizzare (preferisci 4:5, 1:1 o 9:16).",
          azione: {
            tipo: "vai-passo-4",
            etichetta: "Rivedi creatività",
          },
        }),
      );
      score -= 8;
    } else {
      checks.push(
        itemOperativo({
          id: "creativita",
          titolo: "Creatività",
          severita: "ok",
          motivazione: `${assets.length} asset caricati con formato compatibile feed.`,
        }),
      );
    }

    const haStories = assets.some(haFormatoStories);
    if (!haStories && assets.every((a) => !a.isVideo)) {
      checks.push(
        itemOperativo({
          id: "creativita-stories",
          titolo: "Creatività — formato verticale",
          severita: "info",
          motivazione:
            "Da verificare — nessun asset 9:16 rilevato: considera una variante verticale per Stories/Reels.",
          azione: {
            tipo: "vai-passo-4",
            etichetta: "Aggiungi formato 9:16",
          },
        }),
      );
    }
  }

  score = Math.max(0, Math.min(100, score));
  const riepilogo = riepilogoDaChecks(checks);
  const haErroriBloccanti = riepilogo.errori > 0;

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (haErroriBloccanti) {
    tone = "orange";
    label = "Correggi gli elementi in rosso";
  } else if (score >= 80 && riepilogo.consigli === 0) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Puoi procedere — rivedi i consigli";
  }

  const stimaAppuntamenti = stimaAppuntamentiSettimanali({
    budgetGiornaliero: input.budgetGiornaliero,
    costoPerContatto:
      cpa > 0 ? cpa : benchmark.cplOptimal,
    showUpRate: showUp > 0 ? showUp : 75,
  });

  return {
    checks,
    score,
    label,
    tone,
    saturazione: null,
    stimaAppuntamenti,
    stimaOrdini: null,
    stimaCoperturaRetargeting: false,
    objective: "BOOKINGS",
    layoutOperativo: true,
    riepilogo,
    haErroriBloccanti,
  };
}

/**
 * Diagnosi operativa ECOMMERCE (vendite-online).
 * Unico blocker: Variante A vuota. Niente saturazione, niente stima ordini,
 * niente benchmark CPA di mercato (resta nello Step 2).
 */
export function calcolaDiagnosiPreLancioEcommerce(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;

  const testoA = (input.varianteA ?? "").trim();
  if (!testoA) {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "errore",
        motivazione: "Il testo dell'annuncio è vuoto.",
      }),
    );
    score -= 30;
  } else {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "ok",
        motivazione: "Copy presente e pronto per l'export.",
      }),
    );
  }

  const sito = (input.sitoWeb ?? "").trim();
  if (sito) {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Pagina di destinazione",
        severita: "ok",
        motivazione: "Pagina di destinazione impostata.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Pagina di destinazione",
        severita: "consiglio",
        motivazione: "Non hai ancora indicato una pagina di destinazione.",
      }),
    );
    score -= 8;
  }

  const offerta = (input.frontEndOffer ?? "").trim();
  if (offerta) {
    checks.push(
      itemOperativo({
        id: "offerta",
        titolo: "Offerta",
        severita: "ok",
        motivazione: "Offerta definita.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "offerta",
        titolo: "Offerta",
        severita: "consiglio",
        motivazione: "L'offerta non è ancora definita chiaramente.",
      }),
    );
    score -= 8;
  }

  const ctrlMessaggio = analizzaControlloMessaggioEcommerce({
    testoVarianteA: testoA,
    headline: input.titoloAnnuncio ?? "",
    frontEndOffer: input.frontEndOffer ?? "",
    elevatorPitch: input.elevatorPitch ?? "",
    heroProduct: input.heroProduct ?? "",
    sitoWeb: input.sitoWeb ?? "",
  });

  const ctaVoce = ctrlMessaggio.voci.find((v) => v.id === "cta");
  if (ctaVoce) {
    const severita =
      ctaVoce.emoji === "⚪"
        ? "consiglio"
        : severitaDaEmojiControllo(ctaVoce.emoji);
    checks.push(
      itemOperativo({
        id: "cta",
        titolo: "CTA acquisto",
        severita,
        motivazione: ctaVoce.messaggio,
      }),
    );
    if (severita === "consiglio") score -= 10;
  }

  for (const id of ["prezzo", "scarsita"] as const) {
    const voce = ctrlMessaggio.voci.find(
      (v) => v.id === id && v.emoji === "🟡",
    );
    if (!voce) continue;
    checks.push(
      itemOperativo({
        id: `messaggio-${id}`,
        titolo: voce.label,
        severita: "consiglio",
        motivazione: voce.messaggio,
      }),
    );
    score -= 6;
  }

  const cpaMax = input.cpaMax ?? 0;
  const breakEvenRoas = input.breakEvenRoas ?? 0;
  if (cpaMax > 0 && breakEvenRoas > 0) {
    checks.push(
      itemOperativo({
        id: "economia",
        titolo: "Economia dell'acquisto",
        severita: "ok",
        motivazione: `Limite economico definito. CPA Max ${Math.round(cpaMax * 100) / 100}€ · Break-Even ROAS ${breakEvenRoas}x.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "economia",
        titolo: "Economia dell'acquisto",
        severita: "consiglio",
        motivazione:
          "Completa i dati economici per definire la soglia sostenibile.",
      }),
    );
    score -= 15;
  }

  const budget = input.budgetGiornaliero ?? 0;
  const budgetSettimanale = budget * 7;
  if (budget <= 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA Max",
        severita: "consiglio",
        motivazione: "Budget non ancora definito.",
      }),
    );
    score -= 12;
  } else if (cpaMax > 0 && budgetSettimanale < cpaMax) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA Max",
        severita: "consiglio",
        motivazione:
          "Il budget potrebbe essere troppo basso per generare anche un singolo acquisto al CPA di riferimento.",
      }),
    );
    score -= 12;
  } else {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget vs CPA Max",
        severita: "ok",
        motivazione:
          cpaMax > 0
            ? `${budget}€/giorno (~${Math.round(budgetSettimanale)}€/settimana) copre almeno 1× CPA Max (${Math.round(cpaMax * 100) / 100}€).`
            : `${budget}€/giorno impostato.`,
      }),
    );
  }

  const assets = input.creativita ?? [];
  if (!input.haCreativita || assets.length === 0) {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "consiglio",
        motivazione: "Non hai ancora caricato una creatività.",
        azione: {
          tipo: "vai-passo-4",
          etichetta: "Torna al Passo 4",
        },
      }),
    );
    score -= 10;
  } else {
    const problemiFormato = assets.some(
      (a) => !a.isVideo && (a.avvisoFormato || a.formatoOrizzontale),
    );
    if (problemiFormato) {
      checks.push(
        itemOperativo({
          id: "creativita",
          titolo: "Creatività",
          severita: "consiglio",
          motivazione:
            "Almeno un asset ha formato da ottimizzare (preferisci 4:5, 1:1 o 9:16).",
          azione: {
            tipo: "vai-passo-4",
            etichetta: "Rivedi creatività",
          },
        }),
      );
      score -= 8;
    } else {
      checks.push(
        itemOperativo({
          id: "creativita",
          titolo: "Creatività",
          severita: "ok",
          motivazione: `${assets.length} asset caricati.`,
        }),
      );
    }
  }

  const mercato = etichettaMercatoEcommerce(
    input.shippingMarket,
    input.mercatoLabel,
  );
  checks.push(
    itemOperativo({
      id: "targeting",
      titolo: "Targeting",
      severita: "info",
      motivazione: `Mercato configurato: ${mercato}`,
    }),
  );

  score = Math.max(0, Math.min(100, score));
  const riepilogo = riepilogoDaChecks(checks);
  const haErroriBloccanti = riepilogo.errori > 0;

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (haErroriBloccanti) {
    tone = "orange";
    label = "Correggi gli elementi in rosso";
  } else if (score >= 80 && riepilogo.consigli === 0) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Puoi procedere — rivedi i consigli";
  }

  return {
    checks,
    score,
    label,
    tone,
    saturazione: null,
    stimaAppuntamenti: null,
    stimaOrdini: null,
    stimaCoperturaRetargeting: false,
    objective: "ECOMMERCE",
    layoutOperativo: true,
    riepilogo,
    haErroriBloccanti,
  };
}

/**
 * Diagnosi operativa INSTORE (drive-to-store / traffico in negozio).
 * Unico blocker: Variante A vuota.
 * Saturazione: solo box STIMA (non nel riepilogo OK/consigli/errori).
 */
export function calcolaDiagnosiPreLancioInstore(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;

  const testoA = (input.varianteA ?? "").trim();
  if (!testoA) {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "errore",
        motivazione: "Il testo dell'annuncio è vuoto.",
        azione: {
          tipo: "vai-passo-3",
          etichetta: "Compila Variante A",
        },
      }),
    );
    score -= 30;
  } else {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "ok",
        motivazione: "Copy presente.",
      }),
    );
  }

  const citta = (input.citta ?? "").trim();
  const raggio = Number(input.raggioKm) || 0;
  if (citta && raggio > 0) {
    checks.push(
      itemOperativo({
        id: "area",
        titolo: "Area locale",
        severita: "ok",
        motivazione: `Area locale configurata. ${citta} · ${raggio} km`,
      }),
    );
  } else if (!citta) {
    checks.push(
      itemOperativo({
        id: "area",
        titolo: "Area locale",
        severita: "consiglio",
        motivazione: "La città / zona del punto vendita non è ancora indicata.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Aggiungi città / zona",
        },
      }),
    );
    score -= 8;
  } else {
    checks.push(
      itemOperativo({
        id: "area",
        titolo: "Area locale",
        severita: "consiglio",
        motivazione: "Imposta un raggio locale maggiore di 0 km.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Imposta raggio",
        },
      }),
    );
    score -= 8;
  }

  if (raggio > 0 && raggio < 5) {
    checks.push(
      itemOperativo({
        id: "raggio-stretto",
        titolo: "Raggio locale",
        severita: "consiglio",
        motivazione:
          "Raggio sotto i 5 km: il bacino può essere molto ristretto. Valuta di ampliarlo se ha senso per l'attività.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Rivedi raggio",
        },
      }),
    );
    score -= 4;
  }

  const offerta = (input.frontEndOffer ?? "").trim();
  if (offerta) {
    checks.push(
      itemOperativo({
        id: "offerta",
        titolo: "Offerta locale",
        severita: "ok",
        motivazione: "Offerta locale definita.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "offerta",
        titolo: "Offerta locale",
        severita: "consiglio",
        motivazione: "L'offerta locale non è ancora definita chiaramente.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Aggiungi offerta",
        },
      }),
    );
    score -= 8;
  }

  const ctrlMessaggio = analizzaControlloMessaggioInstore({
    testoVarianteA: testoA,
    headline: input.titoloAnnuncio ?? "",
    nomeCliente: input.nomeCliente ?? "",
    elevatorPitch: input.elevatorPitch ?? "",
    citta: input.citta ?? "",
    frontEndOffer: input.frontEndOffer ?? "",
    sitoWeb: input.sitoWeb ?? "",
  });

  const ctaVoce = ctrlMessaggio.voci.find((v) => v.id === "cta");
  if (ctaVoce) {
    const severita = severitaDaEmojiControllo(ctaVoce.emoji);
    checks.push(
      itemOperativo({
        id: "cta",
        titolo: "CTA locale",
        severita,
        motivazione: ctaVoce.messaggio,
        azione:
          severita === "consiglio"
            ? { tipo: "vai-passo-3", etichetta: "Rivedi CTA" }
            : undefined,
      }),
    );
    if (severita === "consiglio") score -= 10;
  }

  for (const id of ["coupon", "scarsita"] as const) {
    const voce = ctrlMessaggio.voci.find(
      (v) => v.id === id && v.emoji === "🟡",
    );
    if (!voce) continue;
    checks.push(
      itemOperativo({
        id: `messaggio-${id}`,
        titolo: voce.label,
        severita: "consiglio",
        motivazione: voce.messaggio,
        azione: {
          tipo: "vai-passo-3",
          etichetta: "Rivedi messaggio",
        },
      }),
    );
    score -= 6;
  }

  const sito = (input.sitoWeb ?? "").trim();
  if (sito) {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Destinazione",
        severita: "ok",
        motivazione: "Destinazione impostata.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Destinazione",
        severita: "consiglio",
        motivazione:
          "Non hai ancora indicato una pagina Maps o una destinazione del punto vendita.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Aggiungi URL Maps / sito",
        },
      }),
    );
    score -= 8;
  }

  const cpaMax = Number(input.cpaMax) || 0;
  if (cpaMax > 0) {
    checks.push(
      itemOperativo({
        id: "economia",
        titolo: "CPA Max sostenibile",
        severita: "ok",
        motivazione: `Soglia economica definita (${cpaMax}€). È un limite economico del business, non una previsione del costo che Meta genererà.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "economia",
        titolo: "CPA Max sostenibile",
        severita: "consiglio",
        motivazione: "Completa i dati economici del punto vendita.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Completa economia",
        },
      }),
    );
    score -= 8;
  }

  const budgetGiorno = Number(input.budgetGiornaliero) || 0;
  const budgetSettimana = budgetGiorno * 7;
  if (budgetGiorno <= 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "consiglio",
        motivazione: "Budget non ancora definito.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Imposta budget",
        },
      }),
    );
    score -= 8;
  } else if (cpaMax > 0 && budgetSettimana < cpaMax) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "consiglio",
        motivazione:
          "Il budget settimanale è inferiore al CPA sostenibile di riferimento.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Rivedi budget",
        },
      }),
    );
    score -= 8;
  } else {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "ok",
        motivazione: "Budget settimanale coerente con il CPA Max sostenibile.",
      }),
    );
  }

  const assets = input.creativita ?? [];
  if (!input.haCreativita || assets.length === 0) {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "consiglio",
        motivazione: "Non hai ancora caricato una creatività.",
        azione: {
          tipo: "vai-passo-4",
          etichetta: "Carica creatività",
        },
      }),
    );
    score -= 10;
  } else {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "ok",
        motivazione: `${assets.length} asset caricati.`,
      }),
    );
  }

  if (citta && raggio > 0) {
    checks.push(
      itemOperativo({
        id: "targeting",
        titolo: "Targeting",
        severita: "info",
        motivazione: `Targeting locale: ${citta} · ${raggio} km`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "targeting",
        titolo: "Targeting",
        severita: "info",
        motivazione:
          "Targeting locale incompleto — completa città e raggio al Passo 1.",
      }),
    );
  }

  const saturazione = stimaSaturazionePubblico({
    raggioKm: raggio,
    budgetGiornaliero: budgetGiorno,
    cpmStimato: input.cpmStimato,
  });

  score = Math.max(0, Math.min(100, score));
  const riepilogo = riepilogoDaChecks(checks);
  const haErroriBloccanti = riepilogo.errori > 0;

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (haErroriBloccanti) {
    tone = "orange";
    label = "Correggi gli elementi in rosso";
  } else if (score >= 80 && riepilogo.consigli === 0) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Puoi procedere — rivedi i consigli";
  }

  return {
    checks,
    score,
    label,
    tone,
    saturazione,
    stimaAppuntamenti: null,
    stimaOrdini: null,
    stimaCoperturaRetargeting: false,
    objective: "IN_STORE",
    layoutOperativo: true,
    riepilogo,
    haErroriBloccanti,
  };
}

function voceControlloACheck(
  voce: { id: string; label: string; emoji: string; messaggio: string },
  idOverride?: string,
): PreLancioCheckItem {
  return itemOperativo({
    id: idOverride ?? voce.id,
    titolo: voce.label,
    severita: severitaDaEmojiControllo(voce.emoji),
    motivazione: voce.messaggio,
  });
}

/**
 * Diagnosi operativa RETARGETING.
 * Unico blocker: Variante A vuota.
 * Custom Audience / pixel / frequenza: solo box istruzioniMeta (fuori riepilogo).
 */
export function calcolaDiagnosiPreLancioRetargeting(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;

  const testoA = (input.varianteA ?? "").trim();
  if (!testoA) {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "errore",
        motivazione: "Scrivi almeno la Variante A prima di continuare.",
        azione: {
          tipo: "vai-passo-3",
          etichetta: "Compila Variante A",
        },
      }),
    );
    score -= 30;
  } else {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Testo annuncio (Variante A)",
        severita: "ok",
        motivazione: "Copy presente.",
      }),
    );
  }

  const controllo = analizzaControlloMessaggioRetargeting({
    testoVarianteA: input.varianteA ?? "",
    headline: input.titoloAnnuncio ?? "",
    frontEndOffer: input.frontEndOffer ?? "",
    sitoWeb: input.sitoWeb ?? "",
    targetType: input.targetType ?? "B2C",
    nomeCliente: input.nomeCliente ?? "",
    elevatorPitch: input.elevatorPitch ?? "",
  });

  const vocePerId = (id: string) =>
    controllo.voci.find((v) => v.id === id);

  const motivo = vocePerId("motivo");
  if (motivo) checks.push(voceControlloACheck(motivo, "motivo"));

  const offerta = vocePerId("offerta");
  if (offerta) checks.push(voceControlloACheck(offerta, "offerta"));

  const cta = vocePerId("cta");
  if (cta) checks.push(voceControlloACheck(cta, "cta"));

  const sito = (input.sitoWeb ?? "").trim();
  if (sito) {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Destinazione",
        severita: "ok",
        motivazione: "Pagina di destinazione indicata.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Destinazione",
        severita: "consiglio",
        motivazione:
          "Imposta una pagina di destinazione prima di pubblicare la campagna.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Aggiungi destinazione",
        },
      }),
    );
    score -= 8;
  }

  const cpaMax = Number(input.cpaMax) || 0;
  if (cpaMax > 0) {
    checks.push(
      itemOperativo({
        id: "economia",
        titolo: "CPA Max sostenibile",
        severita: "ok",
        motivazione: `CPA Max sostenibile: ${cpaMax}€. È una soglia economica del business, non una previsione del CPA Meta.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "economia",
        titolo: "CPA Max sostenibile",
        severita: "consiglio",
        motivazione: "Completa i dati economici di recupero al Passo 2.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Completa economia",
        },
      }),
    );
    score -= 8;
  }

  const budgetGiorno = Number(input.budgetGiornaliero) || 0;
  const budgetSettimana = budgetGiorno * 7;
  if (budgetGiorno <= 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "consiglio",
        motivazione: "Budget non ancora definito.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Imposta budget",
        },
      }),
    );
    score -= 8;
  } else if (cpaMax > 0 && budgetSettimana < cpaMax) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "consiglio",
        motivazione:
          "Il budget settimanale è inferiore al CPA Max di riferimento.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Rivedi budget",
        },
      }),
    );
    score -= 8;
  } else if (cpaMax <= 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "info",
        motivazione:
          "Budget impostato. Completa l'economia per confrontarlo con il CPA Max.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget",
        severita: "ok",
        motivazione: "Budget settimanale coerente con il CPA Max sostenibile.",
      }),
    );
  }

  const assets = input.creativita ?? [];
  if (!input.haCreativita || assets.length === 0) {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "consiglio",
        motivazione: "Non hai ancora caricato una creatività.",
        azione: {
          tipo: "vai-passo-4",
          etichetta: "Carica creatività",
        },
      }),
    );
    score -= 10;
  } else {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "ok",
        motivazione: `${assets.length} asset caricati.`,
      }),
    );
  }

  const targetType = input.targetType ?? "B2C";
  const eventoExport = targetType === "B2B" ? "Lead" : "Purchase";

  const istruzioniMeta: PreLancioIstruzioniMeta = {
    titolo: "DA COMPLETARE IN META",
    microcopy:
      "Ally non configura automaticamente questi elementi nell'export.",
    voci: [
      "Collega la Custom Audience nell'Ad Set.",
      "Definisci la finestra temporale del pubblico.",
      "Verifica se escludere chi ha già convertito.",
      "Verifica dataset/pixel ed evento di conversione.",
      "Monitora la frequenza dopo il lancio.",
    ],
    notaEvento: `L'export usa ${eventoExport} per ${targetType}. Verifica in Meta che dataset/pixel ed evento siano configurati correttamente.`,
  };

  score = Math.max(0, Math.min(100, score));
  const riepilogo = riepilogoDaChecks(checks);
  const haErroriBloccanti = riepilogo.errori > 0;

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (haErroriBloccanti) {
    tone = "orange";
    label = "Correggi gli elementi in rosso";
  } else if (score >= 80 && riepilogo.consigli === 0) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Puoi procedere — rivedi i consigli";
  }

  return {
    checks,
    score,
    label,
    tone,
    saturazione: null,
    stimaAppuntamenti: null,
    stimaOrdini: null,
    stimaCoperturaRetargeting: false,
    objective: "RETARGETING",
    layoutOperativo: true,
    riepilogo,
    haErroriBloccanti,
    istruzioniMeta,
  };
}

/**
 * Diagnosi operativa AWARENESS (apertura / lancio locale).
 * Unico blocker: Variante A vuota.
 * Nessuna saturazione / densità 900; stime solo in stimaModelloAwareness.
 */
export function calcolaDiagnosiPreLancioAwareness(
  input: PreLancioInput,
): PreLancioDiagnosi {
  const checks: PreLancioCheckItem[] = [];
  let score = 100;

  const testoA = (input.varianteA ?? "").trim();
  if (!testoA) {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Copy Variante A",
        severita: "errore",
        motivazione: "Scrivi almeno la Variante A prima di continuare.",
        azione: {
          tipo: "vai-passo-3",
          etichetta: "Compila Variante A",
        },
      }),
    );
    score -= 30;
  } else {
    checks.push(
      itemOperativo({
        id: "copy",
        titolo: "Copy Variante A",
        severita: "ok",
        motivazione: "Copy presente.",
      }),
    );
  }

  const controllo = analizzaControlloMessaggioAwareness({
    testoVarianteA: input.varianteA ?? "",
    headline: input.titoloAnnuncio ?? "",
    nomeCliente: input.nomeCliente ?? "",
    settore: input.settore ?? "",
    elevatorPitch: input.elevatorPitch ?? "",
    citta: input.citta ?? "",
    frontEndOffer: input.frontEndOffer ?? "",
    sitoWeb: input.sitoWeb ?? "",
  });

  const vocePerId = (id: string) => controllo.voci.find((v) => v.id === id);
  const vociMessaggio = ["cosa", "messaggio", "cta"]
    .map((id) => vocePerId(id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  if (vociMessaggio.length > 0) {
    const haGiallo = vociMessaggio.some((v) => v.emoji === "🟡");
    const haInfo = vociMessaggio.some((v) => v.emoji === "ℹ️");
    const severita: PreLancioSeverita = haGiallo
      ? "consiglio"
      : haInfo
        ? "info"
        : "ok";
    const dettaglio = vociMessaggio
      .map((v) => `${v.label}: ${v.messaggio}`)
      .join(" · ");
    checks.push(
      itemOperativo({
        id: "messaggio",
        titolo: "Messaggio chiaro",
        severita,
        motivazione: dettaglio,
        azione: haGiallo
          ? { tipo: "vai-passo-3", etichetta: "Rivedi messaggio" }
          : undefined,
      }),
    );
    if (haGiallo) score -= 8;
  }

  const citta = (input.citta ?? "").trim();
  if (citta) {
    checks.push(
      itemOperativo({
        id: "localita",
        titolo: "Località",
        severita: "ok",
        motivazione: `Città / zona impostata: ${citta}.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "localita",
        titolo: "Località",
        severita: "consiglio",
        motivazione: "Manca la città / zona al Passo 1.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Aggiungi località",
        },
      }),
    );
    score -= 8;
  }

  const sito = (input.sitoWeb ?? "").trim();
  if (sito) {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Destinazione",
        severita: "ok",
        motivazione:
          "È presente una destinazione: l'export utilizza il link della campagna.",
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "destinazione",
        titolo: "Destinazione",
        severita: "info",
        motivazione:
          "Senza destinazione la campagna lavora sulla copertura.",
      }),
    );
  }

  const budgetLancio = Number(input.launchBudget) || 0;
  if (budgetLancio > 0) {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget di lancio",
        severita: "ok",
        motivazione: `Budget di lancio: ${budgetLancio}€.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "budget",
        titolo: "Budget di lancio",
        severita: "consiglio",
        motivazione: "Inserisci un budget di lancio valido al Passo 2.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Imposta budget",
        },
      }),
    );
    score -= 8;
  }

  const cpm = Number(input.cpmStimato) || 0;
  if (cpm > 0) {
    checks.push(
      itemOperativo({
        id: "cpm",
        titolo: "CPM di riferimento",
        severita: "info",
        motivazione: `Il modello usa un CPM di riferimento di ${cpm} € per calcolare le stime di esposizione. È un parametro del modello Ally, non una previsione del CPM Meta.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "cpm",
        titolo: "CPM di riferimento",
        severita: "consiglio",
        motivazione: "Inserisci un CPM di riferimento valido al Passo 2.",
        azione: {
          tipo: "vai-passo-2",
          etichetta: "Imposta CPM",
        },
      }),
    );
    score -= 8;
  }

  const raggio = Number(input.raggioKm) || 0;
  if (raggio > 0) {
    checks.push(
      itemOperativo({
        id: "raggio",
        titolo: "Raggio",
        severita: "ok",
        motivazione: `Raggio impostato: ${raggio} km.`,
      }),
    );
  } else {
    checks.push(
      itemOperativo({
        id: "raggio",
        titolo: "Raggio",
        severita: "consiglio",
        motivazione: "Imposta un raggio locale valido al Passo 1.",
        azione: {
          tipo: "vai-passo-1",
          etichetta: "Imposta raggio",
        },
      }),
    );
    score -= 8;
  }

  const assets = input.creativita ?? [];
  if (!input.haCreativita || assets.length === 0) {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "consiglio",
        motivazione: "Non hai ancora caricato una creatività.",
        azione: {
          tipo: "vai-passo-4",
          etichetta: "Carica creatività",
        },
      }),
    );
    score -= 10;
  } else {
    checks.push(
      itemOperativo({
        id: "creativita",
        titolo: "Creatività",
        severita: "ok",
        motivazione: `${assets.length} asset caricati.`,
      }),
    );
  }

  const impressions =
    budgetLancio > 0 && cpm > 0
      ? calculateImpressionsAwareness(budgetLancio, cpm)
      : 0;
  const coperturaIndicativa =
    budgetLancio > 0 && cpm > 0
      ? calculatePersoneUnicheAwareness(budgetLancio, cpm)
      : 0;

  const stimaModelloAwareness =
    impressions > 0
      ? { impressions, coperturaIndicativa }
      : null;

  const istruzioniMeta: PreLancioIstruzioniMeta = {
    titolo: "DA VERIFICARE IN META",
    microcopy:
      "Ally prepara la struttura della campagna, ma questi elementi vanno verificati direttamente in Meta Ads Manager.",
    voci: [
      "Controlla città e raggio dopo l'import",
      "Verifica la destinazione / link, se presente",
      "Verifica la Pagina collegata",
      "Controlla i placements",
      "Monitora reach e frequenza dopo il lancio",
    ],
  };

  score = Math.max(0, Math.min(100, score));
  const riepilogo = riepilogoDaChecks(checks);
  const haErroriBloccanti = riepilogo.errori > 0;

  let tone: PreLancioDiagnosi["tone"] = "orange";
  let label = "Da completare prima del lancio";
  if (haErroriBloccanti) {
    tone = "orange";
    label = "Correggi gli elementi in rosso";
  } else if (score >= 80 && riepilogo.consigli === 0) {
    tone = "green";
    label = "Pronta al lancio";
  } else if (score >= 60) {
    tone = "yellow";
    label = "Puoi procedere — rivedi i consigli";
  }

  return {
    checks,
    score,
    label,
    tone,
    saturazione: null,
    stimaAppuntamenti: null,
    stimaOrdini: null,
    stimaCoperturaRetargeting: false,
    objective: "AWARENESS",
    layoutOperativo: true,
    riepilogo,
    haErroriBloccanti,
    istruzioniMeta,
    stimaModelloAwareness,
  };
}

export function etichettaObiettivo(
  objective: CampagnaObjective | undefined,
): string {
  switch (objective) {
    case "BOOKINGS":
      return "Prenotazioni";
    case "ECOMMERCE":
      return "Vendite online";
    case "IN_STORE":
      return "Traffico in negozio";
    case "RETARGETING":
      return "Retargeting / Recupero";
    case "AWARENESS":
      return "Awareness / Apertura";
    default:
      return "Lead Generation";
  }
}
