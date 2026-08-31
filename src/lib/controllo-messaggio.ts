import {
  dettaglioHookMobileLeads,
  HOOK_MOBILE_CHARS,
} from "@/data/varianti-copy";
import { stripAccents } from "@/lib/validate-elevator-pitch";

export type ControlloMessaggioVoce = {
  id: string;
  label: string;
  emoji: "🟢" | "🟡" | "⚪" | "ℹ️";
  messaggio: string;
};

export type ControlloMessaggioRisultato = {
  voci: ControlloMessaggioVoce[];
  /** Suggerimento non bloccante sulla struttura del testo. */
  notaLunghezza?: string;
};

const CTA_VERBO =
  /prenota|richiedi|iscriviti|contatt|scopri|tocca|compila|modulo|visita|check-?up|chiam|whatsapp|info|consul/i;

const CTA_GENERICO =
  /(?:^|[.!?]\s*)(?:scopri di più|clicca qui|maggiori info|saperne di più|clicca per)(?:\s|$|[.!?])/i;

const PAROLE_BENEFICIO_NEUTRE =
  /beneficio|subito|concret|risolv|aiut|visibil|agevolat/i;

const TERMINI_RISCHIO_INVENTATI = [
  { pattern: /allineator/i, label: "allineatori" },
  { pattern: /ferrett/i, label: "ferretti" },
  { pattern: /scansione\s*3\s*d/i, label: "scansione 3D" },
  { pattern: /\bgratuit/i, label: "gratuità" },
  { pattern: /\bpromo\b/i, label: "promo" },
  { pattern: /\bsconto/i, label: "sconti" },
  { pattern: /tasso\s*zero/i, label: "tasso zero" },
  { pattern: /invisibil/i, label: "invisibili" },
];

const STOP_CONCETTO = new Set([
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "uno",
  "una",
  "di",
  "del",
  "dello",
  "della",
  "dei",
  "degli",
  "delle",
  "a",
  "ad",
  "al",
  "allo",
  "alla",
  "ai",
  "agli",
  "alle",
  "da",
  "dal",
  "dallo",
  "dalla",
  "dai",
  "dagli",
  "dalle",
  "in",
  "nel",
  "nello",
  "nella",
  "nei",
  "negli",
  "nelle",
  "su",
  "sul",
  "sullo",
  "sulla",
  "sui",
  "sugli",
  "sulle",
  "con",
  "per",
  "tra",
  "fra",
  "e",
  "ed",
  "o",
  "od",
  "che",
  "chi",
  "cui",
  "non",
  "piu",
  "come",
  "anche",
  "ma",
  "se",
  "gia",
  "molto",
  "poco",
  "ogni",
  "tua",
  "tuo",
  "suo",
  "sua",
  "loro",
  "questo",
  "questa",
  "questi",
  "queste",
  "quello",
  "quella",
  "quelli",
  "quelle",
  "caso",
  "nella",
  "tua",
  "zona",
]);

const MESSAGGIO_MISMATCH_OFFERTA =
  "Il messaggio non sembra parlare dell'offerta indicata.";

function normalizzaPerMatch(testo: string): string {
  return stripAccents(testo.toLowerCase()).replace(/\s+/g, " ").trim();
}

function tokenizzaConcetti(testo: string): string[] {
  return normalizzaPerMatch(testo)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP_CONCETTO.has(t));
}

function stemConcetto(token: string): string {
  return token.replace(
    /(ologiche|ologici|ologica|ologico|iche|ici|ica|ico|azione|azioni|mente|amenti|amento|enze|enza|anti|ente|ento)$/i,
    "",
  );
}

/** Concetti chiave deterministici da offerta/brief (niente AI). */
function estraiConcettiChiave(fonte: string): string[] {
  const tokens = tokenizzaConcetti(fonte);
  if (tokens.length === 0) return [];

  const concetti = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? "";
    if (token.length >= 5) concetti.add(token);
    const stem = stemConcetto(token);
    if (stem.length >= 6) concetti.add(stem);
    const next = tokens[i + 1];
    if (next && token.length >= 4 && next.length >= 4) {
      concetti.add(`${token} ${next}`);
    }
  }

  return [...concetti];
}

function copyContieneConcetto(copyNorm: string, concetto: string): boolean {
  if (concetto.includes(" ")) {
    return copyNorm.includes(concetto);
  }
  return copyNorm.includes(concetto);
}

function offertaGenerica(offerta: string): boolean {
  const o = normalizzaPerMatch(offerta);
  if (!o) return true;
  if (/servizi\s+locali/.test(o)) return true;
  return o.length < 8;
}

function beneficioAperturaRiconosciuto(
  hookSlice: string,
  brief: string,
  offerta: string,
): boolean {
  if (PAROLE_BENEFICIO_NEUTRE.test(hookSlice)) return true;
  const fonte = `${brief} ${offerta}`;
  if (/promo/i.test(hookSlice) && /promo/i.test(fonte)) return true;
  if (/(gratis|gratuit)/i.test(hookSlice) && /(gratis|gratuit)/i.test(fonte)) {
    return true;
  }
  if (/sconto/i.test(hookSlice) && /sconto/i.test(fonte)) return true;
  if (/check-?up/i.test(hookSlice) && /check-?up/i.test(fonte)) return true;
  return false;
}

function analizzaCoerenzaOfferta(
  testo: string,
  brief: string,
  offerta: string,
  settore: string,
): ControlloMessaggioVoce | null {
  const t = testo.trim();
  if (!t) return null;

  const lower = t.toLowerCase();
  const copyNorm = normalizzaPerMatch(t);

  if (/servizi\s+locali/i.test(lower) && !offertaGenerica(offerta)) {
    return {
      id: "coerenza",
      label: "Coerenza offerta",
      emoji: "🟡",
      messaggio: MESSAGGIO_MISMATCH_OFFERTA,
    };
  }

  for (const termine of TERMINI_RISCHIO_INVENTATI) {
    if (!termine.pattern.test(lower)) continue;
    const inSorgente =
      termine.pattern.test(brief) ||
      termine.pattern.test(offerta) ||
      termine.pattern.test(settore);
    if (!inSorgente) {
      return {
        id: "coerenza",
        label: "Coerenza offerta",
        emoji: "🟡",
        messaggio: "Contenuto non coerente con l'offerta",
      };
    }
  }

  const concettiOfferta = estraiConcettiChiave(offerta);
  if (concettiOfferta.length > 0) {
    const haConcetto = concettiOfferta.some((c) =>
      copyContieneConcetto(copyNorm, c),
    );
    if (!haConcetto) {
      return {
        id: "coerenza",
        label: "Coerenza offerta",
        emoji: "🟡",
        messaggio: MESSAGGIO_MISMATCH_OFFERTA,
      };
    }
    return {
      id: "coerenza",
      label: "Coerenza offerta",
      emoji: "🟢",
      messaggio: "Allineato a brief e offerta forniti",
    };
  }

  const concettiBrief = estraiConcettiChiave(brief);
  if (concettiBrief.length > 0) {
    const haConcetto = concettiBrief.some((c) =>
      copyContieneConcetto(copyNorm, c),
    );
    if (!haConcetto) {
      return {
        id: "coerenza",
        label: "Coerenza offerta",
        emoji: "🟡",
        messaggio: MESSAGGIO_MISMATCH_OFFERTA,
      };
    }
    return {
      id: "coerenza",
      label: "Coerenza offerta",
      emoji: "🟢",
      messaggio: "Allineato a brief e offerta forniti",
    };
  }

  return {
    id: "coerenza",
    label: "Coerenza offerta",
    emoji: "⚪",
    messaggio: "Da verificare — manca un'offerta di riferimento al Passo 1",
  };
}

function contaFrasi(testo: string): number {
  const pulito = testo.trim();
  if (!pulito) return 0;
  const frasi = pulito
    .split(/[.!?]+/)
    .map((f) => f.trim())
    .filter(Boolean);
  return frasi.length > 0 ? frasi.length : 1;
}

function analizzaCtaLeads(
  testo: string,
  offerta: string,
  citta: string,
): ControlloMessaggioVoce {
  const t = testo.trim();
  if (!t) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "⚪",
      messaggio: "Da verificare — inserisci il testo della Variante A",
    };
  }

  const lower = t.toLowerCase();
  const haVerbo = CTA_VERBO.test(lower);
  const generica = CTA_GENERICO.test(t);

  const riferimenti = [offerta, citta]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 4);
  const haContesto =
    riferimenti.length === 0 ||
    riferimenti.some((r) => lower.includes(r.slice(0, Math.min(24, r.length))));

  if (!haVerbo) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "⚪",
      messaggio: "Da verificare — nessun invito all'azione riconoscibile",
    };
  }

  if (generica && !haContesto) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "🟡",
      messaggio: "Poco specifica — aggiungi offerta o azione concreta",
    };
  }

  if (haVerbo && haContesto) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "🟢",
      messaggio: "Esplicita e collegata a offerta o zona",
    };
  }

  return {
    id: "cta",
    label: "CTA",
    emoji: "🟡",
    messaggio: "Poco specifica — rendi l'invito più concreto",
  };
}

function analizzaLunghezza(testo: string): {
  voce: ControlloMessaggioVoce;
  nota?: string;
} {
  const t = testo.trim();
  if (!t) {
    return {
      voce: {
        id: "lunghezza",
        label: "Lunghezza",
        emoji: "⚪",
        messaggio: "Da verificare — testo ancora vuoto",
      },
    };
  }

  const frasi = contaFrasi(t);
  const caratteri = t.length;

  if (caratteri < 60 || frasi < 2) {
    return {
      voce: {
        id: "lunghezza",
        label: "Lunghezza",
        emoji: "🟡",
        messaggio: "Troppo breve per il feed",
      },
      nota: "2–4 frasi consigliate — puoi espandere con beneficio e invito",
    };
  }

  if (caratteri > 480 || frasi > 5) {
    return {
      voce: {
        id: "lunghezza",
        label: "Lunghezza",
        emoji: "🟡",
        messaggio: "Troppo lunga — rischia di perdere attenzione",
      },
      nota: "2–4 frasi consigliate — accorcia mantenendo hook e CTA",
    };
  }

  const frasiOk = frasi >= 2 && frasi <= 4;
  return {
    voce: {
      id: "lunghezza",
      label: "Lunghezza",
      emoji: "🟢",
      messaggio: frasiOk ? "Adatta al feed" : "Accettabile — 2–4 frasi consigliate",
    },
    nota: frasiOk ? undefined : "2–4 frasi consigliate per equilibrio hook + CTA",
  };
}

function analizzaHeadlineMobile(headline: string): ControlloMessaggioVoce | null {
  const h = headline.trim();
  if (!h) return null;

  if (h.length > 50) {
    return {
      id: "headline",
      label: "Titolo annuncio",
      emoji: "🟡",
      messaggio: "Rischio troncamento su mobile oltre ~50 caratteri",
    };
  }

  return {
    id: "headline",
    label: "Titolo annuncio",
    emoji: "🟢",
    messaggio: "Lunghezza ok per il feed mobile",
  };
}

/**
 * Controlli deterministici sul copy LEADS (Variante A + headline).
 * Nessuna analisi AI — solo regole misurabili.
 */
export function analizzaControlloMessaggioLeads(input: {
  testoVarianteA: string;
  headline?: string;
  citta: string;
  frontEndOffer: string;
  brief?: string;
  settore?: string;
}): ControlloMessaggioRisultato {
  const testo = input.testoVarianteA ?? "";
  const { hookOk, cittaOk, offertaOk } = dettaglioHookMobileLeads(
    testo,
    input.citta,
    input.frontEndOffer,
  );

  const hookVoce: ControlloMessaggioVoce = !testo.trim()
    ? {
        id: "hook",
        label: "Hook mobile",
        emoji: "⚪",
        messaggio: "Da verificare — testo ancora vuoto",
      }
    : hookOk
      ? {
          id: "hook",
          label: "Hook mobile",
          emoji: "🟢",
          messaggio: `Visibile nelle prime ${HOOK_MOBILE_CHARS} battute`,
        }
      : {
          id: "hook",
          label: "Hook mobile",
          emoji: "🟡",
          messaggio: !cittaOk
            ? "Città poco visibile prima del «Mostra altro»"
            : !offertaOk
              ? "Offerta poco visibile nelle prime righe"
              : "Da rivedere per la lettura mobile",
        };

  const hookSlice = testo.slice(0, HOOK_MOBILE_CHARS).toLowerCase();
  let beneficioVoce: ControlloMessaggioVoce;

  if (!testo.trim()) {
    beneficioVoce = {
      id: "beneficio",
      label: "Beneficio",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  } else if (offertaOk) {
    beneficioVoce = {
      id: "beneficio",
      label: "Beneficio",
      emoji: "🟢",
      messaggio: "Presente nelle prime righe",
    };
  } else if (
    beneficioAperturaRiconosciuto(
      hookSlice,
      input.brief ?? "",
      input.frontEndOffer,
    )
  ) {
    beneficioVoce = {
      id: "beneficio",
      label: "Beneficio",
      emoji: "🟢",
      messaggio: "Beneficio riconoscibile in apertura",
    };
  } else if (input.frontEndOffer.trim()) {
    beneficioVoce = {
      id: "beneficio",
      label: "Beneficio",
      emoji: "🟡",
      messaggio: "Offerta poco leggibile nelle prime righe",
    };
  } else {
    beneficioVoce = {
      id: "beneficio",
      label: "Beneficio",
      emoji: "⚪",
      messaggio: "Da verificare — manca un'offerta di riferimento al Passo 1",
    };
  }

  const ctaVoce = analizzaCtaLeads(
    testo,
    input.frontEndOffer,
    input.citta,
  );
  const { voce: lunghezzaVoce, nota } = analizzaLunghezza(testo);
  const headlineVoce = analizzaHeadlineMobile(input.headline ?? "");
  const coerenzaVoce = analizzaCoerenzaOfferta(
    testo,
    input.brief ?? "",
    input.frontEndOffer,
    input.settore ?? "",
  );

  const voci = [hookVoce, beneficioVoce, ctaVoce, lunghezzaVoce];
  if (coerenzaVoce) voci.push(coerenzaVoce);
  if (headlineVoce) voci.push(headlineVoce);

  return { voci, notaLunghezza: nota };
}
