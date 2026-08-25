/**
 * Utilità per copy rivolto al pubblico Meta Ads:
 * solo nome attività (clientName), mai metadati di campagna interni.
 */

const MESI_IT =
  "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre";

/** Sufissi interni tipo " - Lead Gen - Agosto 2026". */
const SUFFISSO_CAMPAGNA = new RegExp(
  `\\s*[-–—]\\s*(?:Lead\\s*Gen(?:eration)?|Richieste\\s*Contatto|Retargeting(?:\\s*/\\s*Recupero)?|Awareness|Apertura(?:\\s*/\\s*Lancio)?|Bookings?|Prenotazioni|E-?commerce|Vendite\\s*Online|In[\\s-]?Store|Traffico\\s*Negozio|Contatti)\\b.*$`,
  "i",
);

const SUFFISSO_MESE_ANNO = new RegExp(
  `\\s*[-–—]\\s*(?:${MESI_IT})\\s+\\d{4}\\s*$`,
  "i",
);

/** Termini tecnici / tag interni da non mostrare al pubblico. */
const METADATI_TECNICI =
  /\b(?:Lead\s*Gen(?:eration)?|Richieste\s*Contatto|Retargeting|Recupero\s*carrelli?|Advantage\+?|CPL|CPA|ROAS|Broad|Lookalike|Ad\s*Set|Campaign\s*Name|Outcome\s*Leads?)\b/gi;

/** Prefissi da brief/prompt finiti per sbaglio nel copy pubblicato. */
const PREFISSI_PROMPT =
  /^(?:Hook\s+immediato|Variante\s*[ABC]?|Testo|Offerta|Angolo|Copy|Headline|CTA|Body)\s*[:：\-–—]\s*/i;

/**
 * Estrae il solo nome attività da un eventuale nome campagna interno.
 * Es. "Studio Dentistico Rossi - Lead Gen - Agosto 2026" → "Studio Dentistico Rossi"
 */
export function pulisciNomeAttivitaPubblico(raw: string): string {
  let t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  // Ripeti: può esserci "Nome - Lead Gen - Agosto 2026"
  for (let i = 0; i < 3; i++) {
    const prima = t;
    t = t.replace(SUFFISSO_CAMPAGNA, "").replace(SUFFISSO_MESE_ANNO, "").trim();
    if (t === prima) break;
  }
  return t;
}

/**
 * Locuzione locale per copy: "a Milano" oppure "nella tua zona" (mai "a la tua zona").
 */
export function cittaPrepLocale(cittaRaw: string): {
  citta: string;
  cittaPrep: string;
} {
  const c = (cittaRaw ?? "").replace(/\s+/g, " ").trim();
  if (
    !c ||
    /^la tua zona$/i.test(c) ||
    /^nella tua zona$/i.test(c) ||
    /^in zona$/i.test(c)
  ) {
    return { citta: "", cittaPrep: "nella tua zona" };
  }
  if (/^(in|a|da|di|nel|nella|presso)\b/i.test(c)) {
    return { citta: c, cittaPrep: c };
  }
  return { citta: c, cittaPrep: `a ${c}` };
}

/** Rimuove tag interni e pattern da nome campagna dal testo annuncio. */
export function sanificaCopyDaMetadati(
  testo: string,
  clientName?: string,
): string {
  let t = (testo ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";

  const nomePulito = pulisciNomeAttivitaPubblico(clientName ?? "");
  if (clientName?.trim() && nomePulito && clientName.trim() !== nomePulito) {
    t = t.split(clientName.trim()).join(nomePulito);
  }

  // Pattern "Nome - Lead Gen - Mese Anno" residui nel body
  t = t.replace(SUFFISSO_CAMPAGNA, "").replace(SUFFISSO_MESE_ANNO, "");
  t = t.replace(METADATI_TECNICI, "");
  // Etichette da prompt finite nel body
  for (let i = 0; i < 3; i++) {
    const prima = t;
    t = t.replace(PREFISSI_PROMPT, "").trim();
    if (t === prima) break;
  }
  t = t.replace(/\bOfferta\s*:\s*/gi, "");
  t = t.replace(/\ba la tua zona\b/gi, "nella tua zona");
  t = t.replace(/\s{2,}/g, " ").trim();
  t = t.replace(/\s+([.,!?;:…])/g, "$1").replace(/\(\s*\)/g, "").trim();
  return t;
}
