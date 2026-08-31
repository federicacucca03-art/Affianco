/**
 * Qualità deterministica Step 1 (offerta / brief / coerenza).
 * Calcolata al volo, non persistita. Nessuna AI, nessuna tassonomia di mercato.
 */

import {
  DOMAIN_ANCHORS_REGEX,
  stripAccents,
} from "@/lib/validate-elevator-pitch";

export type OfferQuality = "GOOD" | "GENERIC" | "TOO_SHORT" | "UNCLEAR";
export type BriefQuality = "GOOD" | "INCOMPLETE" | "TOO_SHORT";

/** Formule vaghe: match sul testo normalizzato (spazi conservati). */
export const FORMULE_OFFERTA_VAGHE = [
  "servizi di qualita",
  "soluzioni personalizzate",
  "migliora il tuo business",
  "scopri i nostri servizi",
  "i nostri servizi",
  "consulenza di qualita",
  "offerte su misura",
] as const;

/**
 * Stopword corte: tolte prima di contare i token concreti.
 * Lista volutamente breve.
 */
export const STOPWORD_STEP1 = new Set([
  "servizi",
  "servizio",
  "qualita",
  "soluzioni",
  "soluzione",
  "personalizzato",
  "personalizzata",
  "personalizzati",
  "personalizzate",
  "scopri",
  "nostri",
  "nostre",
  "migliore",
  "migliori",
  "business",
  "clienti",
  "professionale",
  "professionali",
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "una",
  "di",
  "da",
  "in",
  "per",
  "con",
  "su",
  "a",
  "ad",
  "al",
  "del",
  "della",
  "dei",
  "delle",
  "tuo",
  "tua",
  "tuoi",
  "e",
  "che",
  "piu",
]);

/** Azioni / risultati comprensibili nell'offerta. */
export const AZIONI_OFFERTA = [
  "visita",
  "valutazione",
  "piano",
  "preventivo",
  "trattamento",
  "consulenza",
  "checkup",
  "check-up",
  "prenotazione",
  "analisi",
] as const;

const TOKEN_CONCRETO_MIN = 5;
const STEM_MIN = 6;

export function normalizzaTestoStep1(raw: string): string {
  return stripAccents(raw.toLowerCase().trim()).replace(/['’]/g, " ");
}

export function tokenizzaStep1(raw: string): string[] {
  const n = normalizzaTestoStep1(raw).replace(/[^a-z0-9]+/g, " ");
  return n.split(/\s+/).filter(Boolean);
}

function isStopword(token: string): boolean {
  return STOPWORD_STEP1.has(token);
}

export function tokenConcreti(raw: string): string[] {
  return tokenizzaStep1(raw).filter(
    (t) => t.length >= TOKEN_CONCRETO_MIN && !isStopword(t),
  );
}

export function haAncoraDominio(raw: string): boolean {
  const n = normalizzaTestoStep1(raw);
  return DOMAIN_ANCHORS_REGEX.some((pattern) => pattern.test(n));
}

function haAzioneOfferta(raw: string): boolean {
  const n = normalizzaTestoStep1(raw).replace(/-/g, "");
  const tokens = new Set(tokenizzaStep1(raw).map((t) => t.replace(/-/g, "")));
  return AZIONI_OFFERTA.some(
    (azione) => n.includes(azione.replace(/-/g, "")) || tokens.has(azione.replace(/-/g, "")),
  );
}

function contieneFormulaVaga(raw: string): boolean {
  const n = normalizzaTestoStep1(raw).replace(/\s+/g, " ");
  return FORMULE_OFFERTA_VAGHE.some((frase) => n.includes(frase));
}

/**
 * Stemming minimo locale (non modifica il checker Step 3).
 * Suffissi italiani frequenti, solo se resta uno stem abbastanza lungo.
 */
export function stemPrudente(token: string): string {
  const t = token.replace(/-/g, "");
  const tagliato = t.replace(
    /(ologiche|ologici|ologica|ologico|ologia|ologie|iche|ici|ica|ico|azione|azioni|mente|amenti|amento|enze|enza)$/i,
    "",
  );
  return tagliato.length >= STEM_MIN ? tagliato : t;
}

export function valutaQualitaOfferta(offerta: string): OfferQuality {
  const testo = offerta.trim();
  const parole = tokenizzaStep1(testo);
  const concreti = tokenConcreti(testo);
  const caratteriUtili = parole.join("").length;

  // TOO_SHORT: < 12 caratteri utili, oppure < 3 parole senza almeno 2 token concreti.
  // Così "Sbiancamento dentale" (2 parole, 2 concreti) non è penalizzato solo perché corto.
  const troppoCortoPerLunghezza = caratteriUtili < 12;
  const troppoPocheParole = parole.length < 3 && concreti.length < 2;
  if (testo.length === 0 || troppoCortoPerLunghezza || troppoPocheParole) {
    return "TOO_SHORT";
  }

  if (contieneFormulaVaga(testo) || concreti.length === 0) {
    return "GENERIC";
  }

  if (
    concreti.length >= 2 ||
    (haAncoraDominio(testo) && haAzioneOfferta(testo))
  ) {
    return "GOOD";
  }

  // 1 token concreto, senza ancora di dominio + azione: poco chiaro, non formula vaga.
  return "UNCLEAR";
}

function haSegnaleCosa(brief: string): boolean {
  return haAncoraDominio(brief) || tokenConcreti(brief).length > 0;
}

function haSegnaleChi(brief: string): boolean {
  const n = normalizzaTestoStep1(brief);
  return (
    /\badulti\b/.test(n) ||
    /\bfamigli[ae]\b/.test(n) ||
    /\bazien[de]\b/.test(n) ||
    /\bpazient[ei]\b/.test(n) ||
    /\bprofessionist[ai]\b/.test(n) ||
    /\btarget\b/.test(n) ||
    /\bb2b\b/.test(n) ||
    /\bb2c\b/.test(n) ||
    /\bchi ha\b/.test(n)
  );
}

function haSegnaleObiettivo(brief: string): boolean {
  const n = normalizzaTestoStep1(brief);
  return (
    /\baumentare\b/.test(n) ||
    /\bgenerare\b/.test(n) ||
    /\brichiest[ae]\b/.test(n) ||
    /\bcontatt[oi]\b/.test(n) ||
    /\bprenotazion[ei]\b/.test(n) ||
    /\bvisit[ae]\b/.test(n) ||
    /\bvendit[ae]\b/.test(n)
  );
}

function haSegnaleTono(brief: string): boolean {
  const n = normalizzaTestoStep1(brief);
  return (
    /\brassicurante\b/.test(n) ||
    /\bprofessionale\b/.test(n) ||
    /\bdiretto\b/.test(n) ||
    /\binformativo\b/.test(n) ||
    /\bevitando\b/.test(n) ||
    /\bsenza promesse\b/.test(n) ||
    /\baggressiv[oaie]\b/.test(n)
  );
}

export function valutaQualitaBrief(brief: string): BriefQuality {
  const testo = brief.trim();
  const parole = tokenizzaStep1(testo);
  if (parole.length < 8) return "TOO_SHORT";

  const cosa = haSegnaleCosa(testo);
  const chi = haSegnaleChi(testo);
  const obiettivo = haSegnaleObiettivo(testo);
  const tono = haSegnaleTono(testo);
  const altri = [chi, obiettivo, tono].filter(Boolean).length;

  if (!cosa || altri === 0) return "INCOMPLETE";
  return "GOOD";
}

export function concettiDistintivi(raw: string): string[] {
  const visti = new Set<string>();
  const out: string[] = [];
  for (const token of tokenConcreti(raw)) {
    if (token.length < STEM_MIN) continue;
    if (!visti.has(token)) {
      visti.add(token);
      out.push(token);
    }
    const stem = stemPrudente(token);
    if (stem !== token && stem.length >= STEM_MIN && !visti.has(stem)) {
      visti.add(stem);
      out.push(stem);
    }
  }
  return out;
}

function concettoCompareNelTesto(
  concetto: string,
  testoNorm: string,
  concettiDestinazione: string[],
): boolean {
  if (concetto.length < STEM_MIN && concetto.length < TOKEN_CONCRETO_MIN) {
    return false;
  }
  if (testoNorm.includes(concetto)) return true;
  return concettiDestinazione.some(
    (c) => c === concetto || c.includes(concetto) || concetto.includes(c),
  );
}

/**
 * Mismatch solo se l'offerta ha sostanza e entrambi hanno concetti distintivi
 * senza overlap. Il brief può essere TOO_SHORT per qualità (es. 4 parole)
 * e comunque mismatchare se ha concetti propri.
 * Non risolve sinonimi (impianto vs vite): accettato in V1.
 * B2C/B2B non è in questo slice.
 */
export function rilevaMismatchOffertaBrief(
  offerta: string,
  brief: string,
): boolean {
  const qOfferta = valutaQualitaOfferta(offerta);
  if (qOfferta === "TOO_SHORT") return false;

  const concettiOfferta = concettiDistintivi(offerta);
  const concettiBrief = concettiDistintivi(brief);
  if (concettiOfferta.length === 0 || concettiBrief.length < 2) return false;

  const briefNorm = normalizzaTestoStep1(brief);
  const overlap = concettiOfferta.some((c) =>
    concettoCompareNelTesto(c, briefNorm, concettiBrief),
  );
  return !overlap;
}
