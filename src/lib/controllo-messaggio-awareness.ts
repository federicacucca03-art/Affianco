import { HOOK_MOBILE_CHARS } from "@/data/varianti-copy";
import type {
  ControlloMessaggioRisultato,
  ControlloMessaggioVoce,
} from "@/lib/controllo-messaggio";

const CTA_APERTURA =
  /\b(?:scopri(?:\s+di\s+più)?|ottieni\s+indicazioni|approfondisci|tieni(?:la)?\s+d['']occhio|conosci(?:la|ci)?|passa\s+a\s+trovar(?:ci|mi)|vieni\s+a\s+(?:scoprire|trovar))\b/i;

const CTA_NON_SUPPORTATA =
  /\b(?:prenota(?:\s+ora)?|registrati|conferma\s+(?:la\s+)?presenza|acquista(?:\s+ora)?|ordina(?:\s+ora)?|rsvp|conferma\s+partecipazione)\b/i;

const CTA_SOFFICE =
  /\b(?:scopri(?:\s+di\s+più)?|tieni(?:la)?\s+d['']occhio|conosci(?:la)?|novit[àa]|apertura)\b/i;

const APERTURA_SEGNALE =
  /\b(?:apre|apertura|nuova?\s+apertura|novit[àa]|inaugur|scopri|conoscer|spazio|sede|studio|negozio|locale|attivit)\w*\b/i;

const PROMO_CLAIM =
  /\d+\s*%|sconto|regalo|omaggio|bonus|gratuit[oaie]|gratis|prim[io]\s+\d+/gi;

const SCARSITA_CLAIM =
  /solo\s+oggi|solo\s+questa\s+settimana|solo\s+per\s+(?:oggi|questa\s+settimana)|questo\s+weekend|domani|ultim[ieo]\s+post[io]|prim[io]\s+\d+|affrettati|fino\s+a\s+esaurimento|non\s+perdere\s+(?:l['']occasione|l['']offerta)|scorte\s+limitat|disponibilit[àa]\s+limitat|grande\s+inaugurazione|evento\s+d['']apertura|open\s+day|vien[ei]\s+sabato/i;

function testoCombinato(varianteA: string, headline: string): string {
  return `${headline}\n${varianteA}`.trim();
}

function snippetPresente(haystack: string, termine: string): boolean {
  const t = termine.trim().toLowerCase();
  if (!t || t.length < 3) return false;
  const h = haystack.toLowerCase();
  if (t.length <= 12) return h.includes(t);
  if (h.includes(t.slice(0, Math.min(40, t.length)))) return true;
  const parole = t
    .split(/[^a-zàèéìòù0-9-]+/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);
  if (parole.length === 0) return h.includes(t.slice(0, 12));
  const presenti = parole.filter((p) => h.includes(p)).length;
  return presenti >= Math.min(2, parole.length);
}

function tokenBriefSignificativi(elevatorPitch: string): string {
  const grezzo = elevatorPitch.trim();
  if (!grezzo) return "";
  if (grezzo.length <= 48) return grezzo;
  const prima = grezzo.split(/[.|;]/)[0]?.trim() || grezzo;
  return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
}

function tokenPromoNelTesto(testo: string): string[] {
  const matches = testo.match(PROMO_CLAIM) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase().trim()))];
}

function promoSupportataDaOfferta(
  token: string,
  frontEndOffer: string,
): boolean {
  const o = frontEndOffer.trim().toLowerCase();
  if (!o) return false;
  const t = token.toLowerCase();
  if (o.includes(t)) return true;
  if (/%/.test(t) && /%|sconto|percent/.test(o)) {
    const numT = t.replace(/[^\d.,]/g, "");
    if (numT && o.includes(numT)) return true;
  }
  if (/sconto/.test(t) && /sconto|%|promo/.test(o)) return true;
  if (/regalo|omaggio/.test(t) && /regalo|omaggio/.test(o)) return true;
  if (/bonus/.test(t) && /bonus/.test(o)) return true;
  if (/gratis|gratuit/.test(t) && /gratis|gratuit/.test(o)) return true;
  if (/prim[io]\s+\d+/.test(t) && /prim[io]|primi/.test(o)) return true;
  return snippetPresente(o, t);
}

function scarsitaSupportataDaOfferta(frontEndOffer: string): boolean {
  const o = frontEndOffer.trim().toLowerCase();
  if (!o) return false;
  return /scad|fino\s+a|solo\s+(?:oggi|per)|limitat|ultim|esaur|weekend|settimana|inaugur|prim[io]|affrett/i.test(
    o,
  );
}

function analizzaCopyPresente(testo: string): ControlloMessaggioVoce {
  if (!testo.trim()) {
    return {
      id: "copy",
      label: "Testo annuncio",
      emoji: "🟡",
      messaggio: "Testo ancora vuoto — inserisci la Variante A",
    };
  }
  return {
    id: "copy",
    label: "Testo annuncio",
    emoji: "🟢",
    messaggio: "Copy presente",
  };
}

function analizzaCosaStaAprendo(
  testo: string,
  headline: string,
  nomeCliente: string,
  settore: string,
  elevatorPitch: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  const nome = nomeCliente.trim();
  const sett = settore.trim();
  const tokenBrief = tokenBriefSignificativi(elevatorPitch);
  const offerta = frontEndOffer.trim();
  const haSegnaliDati =
    nome.length >= 3 ||
    sett.length >= 3 ||
    tokenBrief.length >= 3 ||
    offerta.length >= 3;

  if (!combined.trim()) {
    return {
      id: "cosa",
      label: "Cosa sta aprendo",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (!haSegnaliDati) {
    return {
      id: "cosa",
      label: "Cosa sta aprendo",
      emoji: "ℹ️",
      messaggio:
        "Da verificare — pochi dati su nome, settore, brief o messaggio",
    };
  }

  const nomeOk = nome.length >= 3 && snippetPresente(combined, nome);
  const settOk = sett.length >= 3 && snippetPresente(combined, sett);
  const briefOk =
    tokenBrief.length >= 3 && snippetPresente(combined, tokenBrief);
  const offertaOk =
    offerta.length >= 3 && snippetPresente(combined, offerta);
  const aperturaOk = APERTURA_SEGNALE.test(combined);

  if (nomeOk || settOk || briefOk || offertaOk) {
    return {
      id: "cosa",
      label: "Cosa sta aprendo",
      emoji: "🟢",
      messaggio: "Il messaggio rende riconoscibile cosa si sta facendo conoscere",
    };
  }

  if (aperturaOk) {
    return {
      id: "cosa",
      label: "Cosa sta aprendo",
      emoji: "🟡",
      messaggio:
        "Copy generico sull'apertura — specifica nome, messaggio o brief",
    };
  }

  return {
    id: "cosa",
    label: "Cosa sta aprendo",
    emoji: "🟡",
    messaggio: "Non è chiaro cosa si sta facendo conoscere",
  };
}

function analizzaLocalita(
  testo: string,
  headline: string,
  citta: string,
): ControlloMessaggioVoce {
  const zona = citta.trim();
  const combined = testoCombinato(testo, headline);

  if (!zona) {
    return {
      id: "localita",
      label: "Località",
      emoji: "ℹ️",
      messaggio: "Da verificare — manca città / zona al Passo 1",
    };
  }

  if (!combined.trim()) {
    return {
      id: "localita",
      label: "Località",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const pezzi = zona
    .split(/[(),/–—-]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  const match =
    snippetPresente(combined, zona) ||
    pezzi.some((p) => snippetPresente(combined, p));

  if (match) {
    return {
      id: "localita",
      label: "Località",
      emoji: "🟢",
      messaggio: "Città / zona richiamata nel messaggio",
    };
  }

  return {
    id: "localita",
    label: "Località",
    emoji: "🟡",
    messaggio: "Città impostata ma non richiamata nel copy",
  };
}

function analizzaMessaggioReale(
  testo: string,
  headline: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  const offerta = frontEndOffer.trim();

  if (!combined.trim()) {
    return {
      id: "messaggio",
      label: "Messaggio reale",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const tokenPromo = tokenPromoNelTesto(combined);
  const nonSupportati = tokenPromo.filter(
    (t) => !promoSupportataDaOfferta(t, offerta),
  );

  if (nonSupportati.length > 0) {
    return {
      id: "messaggio",
      label: "Messaggio reale",
      emoji: "🟡",
      messaggio:
        "Promo o vantaggio nel copy non presenti nel messaggio di apertura",
    };
  }

  if (offerta) {
    if (snippetPresente(combined, offerta)) {
      return {
        id: "messaggio",
        label: "Messaggio reale",
        emoji: "🟢",
        messaggio: "Messaggio di apertura riflesso nel copy",
      };
    }
    return {
      id: "messaggio",
      label: "Messaggio reale",
      emoji: "ℹ️",
      messaggio:
        "Messaggio di apertura dichiarato ma poco visibile nel copy",
    };
  }

  return {
    id: "messaggio",
    label: "Messaggio reale",
    emoji: "🟢",
    messaggio: "Nessuna promo inventata rilevata",
  };
}

function analizzaCta(
  testo: string,
  headline: string,
  sitoWeb: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (CTA_NON_SUPPORTATA.test(combined)) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "🟡",
      messaggio:
        "CTA non supportata (prenota / registrati / acquista / ecc.)",
    };
  }

  const haSito = Boolean(sitoWeb.trim());
  if (haSito) {
    if (CTA_APERTURA.test(combined)) {
      return {
        id: "cta",
        label: "CTA",
        emoji: "🟢",
        messaggio: "CTA coerente con approfondimento / indicazioni",
      };
    }
    return {
      id: "cta",
      label: "CTA",
      emoji: "ℹ️",
      messaggio:
        "Da verificare — con destinazione puoi invitare a scoprire o ottenere indicazioni",
    };
  }

  if (CTA_SOFFICE.test(combined) || CTA_APERTURA.test(combined)) {
    return {
      id: "cta",
      label: "CTA",
      emoji: "🟢",
      messaggio: "CTA awareness morbida, coerente senza destinazione",
    };
  }

  return {
    id: "cta",
    label: "CTA",
    emoji: "ℹ️",
    messaggio: "Da verificare — CTA poco chiara",
  };
}

function analizzaDestinazione(sitoWeb: string): ControlloMessaggioVoce {
  if (sitoWeb.trim()) {
    return {
      id: "destinazione",
      label: "Destinazione",
      emoji: "🟢",
      messaggio: "Pagina o mappa indicata — la campagna può portare al link",
    };
  }
  return {
    id: "destinazione",
    label: "Destinazione",
    emoji: "ℹ️",
    messaggio:
      "Nessuna destinazione: la campagna lavora sulla copertura (REACH)",
  };
}

function analizzaUrgenzaScarsita(
  testo: string,
  headline: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "urgenza",
      label: "Urgenza / scarsità",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (!SCARSITA_CLAIM.test(combined)) {
    return {
      id: "urgenza",
      label: "Urgenza / scarsità",
      emoji: "🟢",
      messaggio: "Nessuna urgenza o scarsità non supportata",
    };
  }

  if (scarsitaSupportataDaOfferta(frontEndOffer)) {
    return {
      id: "urgenza",
      label: "Urgenza / scarsità",
      emoji: "🟢",
      messaggio: "Urgenza allineata al messaggio di apertura dichiarato",
    };
  }

  return {
    id: "urgenza",
    label: "Urgenza / scarsità",
    emoji: "🟡",
    messaggio:
      "Urgenza, scarsità o claim evento non supportati dal messaggio dichiarato",
  };
}

function analizzaHookMobile(
  testo: string,
  nomeCliente: string,
  citta: string,
  frontEndOffer: string,
  elevatorPitch: string,
): ControlloMessaggioVoce {
  const t = testo.trim();
  if (!t) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const hook = t.slice(0, HOOK_MOBILE_CHARS);
  const resto = t.slice(HOOK_MOBILE_CHARS);
  const offerta = frontEndOffer.trim();
  const nome = nomeCliente.trim();
  const tokenBrief = tokenBriefSignificativi(elevatorPitch);
  const cittaOk =
    !citta.trim() ||
    snippetPresente(hook, citta) ||
    citta
      .split(/[(),/–—-]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 3)
      .some((p) => snippetPresente(hook, p));

  const segnaleHook =
    (nome.length >= 3 && snippetPresente(hook, nome)) ||
    (offerta.length >= 3 && snippetPresente(hook, offerta)) ||
    (tokenBrief.length >= 3 && snippetPresente(hook, tokenBrief)) ||
    APERTURA_SEGNALE.test(hook) ||
    CTA_APERTURA.test(hook) ||
    CTA_SOFFICE.test(hook);

  if (segnaleHook && cittaOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟢",
      messaggio: `Messaggio utile nelle prime ${HOOK_MOBILE_CHARS} battute`,
    };
  }

  const segnaleTardi =
    resto.length > 0 &&
    ((offerta.length >= 3 && snippetPresente(resto, offerta)) ||
      (nome.length >= 3 && snippetPresente(resto, nome)) ||
      (tokenBrief.length >= 3 && snippetPresente(resto, tokenBrief)));

  if (segnaleTardi || !segnaleHook) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio:
        "Il messaggio utile arriva tardi — antedatalo prima del «Mostra altro»",
    };
  }

  return {
    id: "hook",
    label: "Hook mobile",
    emoji: "ℹ️",
    messaggio: "Da verificare — metti apertura o messaggio in evidenza",
  };
}

/**
 * Controlli deterministici sul copy AWARENESS (Variante A).
 * Nessun score, nessun 🔴, Step 3 non bloccante.
 */
export function analizzaControlloMessaggioAwareness(input: {
  testoVarianteA: string;
  headline?: string;
  nomeCliente: string;
  settore?: string;
  elevatorPitch: string;
  citta: string;
  frontEndOffer: string;
  sitoWeb?: string;
}): ControlloMessaggioRisultato {
  const testo = input.testoVarianteA ?? "";
  const headline = input.headline ?? "";
  const nome = input.nomeCliente ?? "";
  const settore = input.settore ?? "";
  const pitch = input.elevatorPitch ?? "";
  const citta = input.citta ?? "";
  const offerta = input.frontEndOffer ?? "";
  const sito = input.sitoWeb ?? "";

  const voci: ControlloMessaggioVoce[] = [
    analizzaCopyPresente(testo),
    analizzaCosaStaAprendo(testo, headline, nome, settore, pitch, offerta),
    analizzaLocalita(testo, headline, citta),
    analizzaMessaggioReale(testo, headline, offerta),
    analizzaCta(testo, headline, sito),
    analizzaDestinazione(sito),
    analizzaUrgenzaScarsita(testo, headline, offerta),
    analizzaHookMobile(testo, nome, citta, offerta, pitch),
  ];

  return { voci };
}
