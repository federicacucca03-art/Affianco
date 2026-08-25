import { HOOK_MOBILE_CHARS } from "@/data/varianti-copy";
import type {
  ControlloMessaggioRisultato,
  ControlloMessaggioVoce,
} from "@/lib/controllo-messaggio";

const CTA_ACQUISTO =
  /\b(acquista(?:\s+ora)?|ordina(?:\s+ora)?|compra(?:\s+ora)?|shop|vai\s+allo\s+shop|scopri(?:\s+(?:di\s+più|ora|il\s+prodotto))?)\b/i;

const BENEFICIO_KEYWORDS =
  /\b(benefici[oa]|risparm|senza\s+\w+|per\s+(?:chi|pelle|capelli|te|voi)|idrat|rassod|illumin|anti[- ]?age|qualit|comod|facil|gratis|gratuit|spedizion[ei]\s+gratis|consegna|risultat|miglior|natural|efficace|durat)\w*\b/i;

const SCARSITA_CLAIM =
  /ultim[io]\s+pezz|solo\s+oggi|scade|fino\s+a\b|disponibilit[àa]\s+limitat|countdown|solo\s+per\s+oggi|ultim[ie]\s+(?:unit|disponibil)|esaurit|affrettati|non\s+perdere|scorte\s+limitat|pochi\s+pezzi|offerta\s+a\s+tempo/i;

/** Token prezzo/promo espliciti (es. 20%, 19,90€, 2x1, 3 per 2). */
const TOKEN_PREZZO_PROMO =
  /\d+\s*%|\d+[.,]\d+\s*€|\d+\s*€|€\s*\d+|2\s*[x×]\s*1|3\s*[x×]\s*2|3\s+per\s+2|\d+\s+per\s+\d+|sconto\s+\d+/gi;

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

/** Nome/prodotto corto dal brief (prima frase, max 6 parole). */
function snippetProdotto(heroProduct: string, elevatorPitch: string): string {
  const grezzo = heroProduct.trim() || elevatorPitch.trim();
  if (!grezzo) return "";
  if (grezzo.length <= 48) return grezzo;
  const prima = grezzo.split(/[.|;]/)[0]?.trim() || grezzo;
  return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
}

function testoCombinato(varianteA: string, headline: string): string {
  return `${headline}\n${varianteA}`.trim();
}

function analizzaCopyPresente(testo: string): ControlloMessaggioVoce {
  if (!testo.trim()) {
    return {
      id: "copy",
      label: "Testo annuncio",
      emoji: "⚪",
      messaggio: "Da verificare — inserisci la Variante A",
    };
  }
  return {
    id: "copy",
    label: "Testo annuncio",
    emoji: "🟢",
    messaggio: "Copy presente",
  };
}

function analizzaProdottoChiaro(
  testo: string,
  headline: string,
  heroProduct: string,
  elevatorPitch: string,
): ControlloMessaggioVoce {
  const prodotto = snippetProdotto(heroProduct, elevatorPitch);
  const combined = testoCombinato(testo, headline).toLowerCase();

  if (!testo.trim() && !headline.trim()) {
    return {
      id: "prodotto",
      label: "Prodotto chiaro",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (!prodotto) {
    return {
      id: "prodotto",
      label: "Prodotto chiaro",
      emoji: "⚪",
      messaggio: "Da verificare — manca un brief prodotto al Passo 1",
    };
  }

  if (snippetPresente(combined, prodotto)) {
    return {
      id: "prodotto",
      label: "Prodotto chiaro",
      emoji: "🟢",
      messaggio: "Riferimento al prodotto riconoscibile nel copy",
    };
  }

  return {
    id: "prodotto",
    label: "Prodotto chiaro",
    emoji: "⚪",
    messaggio: "Da verificare — il prodotto del brief non è evidente nel copy",
  };
}

function analizzaBeneficio(testo: string, headline: string): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "beneficio",
      label: "Beneficio",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (BENEFICIO_KEYWORDS.test(combined)) {
    return {
      id: "beneficio",
      label: "Beneficio",
      emoji: "🟢",
      messaggio: "Proposta di valore riconoscibile",
    };
  }

  return {
    id: "beneficio",
    label: "Beneficio",
    emoji: "🟡",
    messaggio: "Aggiungi un beneficio concreto per il cliente",
  };
}

function analizzaOfferta(
  testo: string,
  headline: string,
  frontEndOffer: string,
): ControlloMessaggioVoce | null {
  const offerta = frontEndOffer.trim();
  if (!offerta) return null;

  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "offerta",
      label: "Offerta",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (snippetPresente(combined, offerta)) {
    return {
      id: "offerta",
      label: "Offerta",
      emoji: "🟢",
      messaggio: "Offerta richiamata nel copy",
    };
  }

  return {
    id: "offerta",
    label: "Offerta",
    emoji: "🟡",
    messaggio: "L'offerta del Passo 1 non compare nel copy",
  };
}

function analizzaCtaAcquisto(
  testo: string,
  headline: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "cta",
      label: "CTA acquisto",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (CTA_ACQUISTO.test(combined)) {
    return {
      id: "cta",
      label: "CTA acquisto",
      emoji: "🟢",
      messaggio: "Invito all'acquisto riconoscibile",
    };
  }

  if (/\b(clicca|scopri\s+di\s+più|maggiori\s+info|saperne\s+di\s+più)\b/i.test(combined)) {
    return {
      id: "cta",
      label: "CTA acquisto",
      emoji: "🟡",
      messaggio: "CTA generica — preferisci un invito ad acquistare o ordinare",
    };
  }

  return {
    id: "cta",
    label: "CTA acquisto",
    emoji: "🟡",
    messaggio: "Manca un invito chiaro ad acquistare",
  };
}

function analizzaHookMobile(
  testo: string,
  frontEndOffer: string,
  heroProduct: string,
  elevatorPitch: string,
): ControlloMessaggioVoce {
  const t = testo.trim();
  if (!t) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const hook = t.slice(0, HOOK_MOBILE_CHARS).toLowerCase();
  const prodotto = snippetProdotto(heroProduct, elevatorPitch);
  const offerta = frontEndOffer.trim();
  const prodottoOk = prodotto ? snippetPresente(hook, prodotto) : false;
  const offertaOk = offerta ? snippetPresente(hook, offerta) : false;
  const beneficioOk = BENEFICIO_KEYWORDS.test(hook);

  if (prodottoOk || offertaOk || beneficioOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟢",
      messaggio: `Prodotto, beneficio o offerta nelle prime ${HOOK_MOBILE_CHARS} battute`,
    };
  }

  if (offerta && !offertaOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio: "Offerta poco visibile prima del «Mostra altro»",
    };
  }

  if (prodotto && !prodottoOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio: "Prodotto poco visibile nelle prime righe",
    };
  }

  return {
    id: "hook",
    label: "Hook mobile",
    emoji: "⚪",
    messaggio: "Da verificare — metti prodotto o beneficio in apertura",
  };
}

function normalizzaTokenPrezzo(token: string): string {
  return token.toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

function estraiTokenPrezzo(...fonti: string[]): string[] {
  const trovati = new Set<string>();
  for (const fonte of fonti) {
    const matches = fonte.match(TOKEN_PREZZO_PROMO);
    if (!matches) continue;
    for (const m of matches) {
      const n = normalizzaTokenPrezzo(m);
      if (n) trovati.add(n);
    }
  }
  return [...trovati];
}

/**
 * Solo se esistono token espliciti in offerta/brief.
 * Omette il controllo se non c'è nulla di verificabile.
 */
function analizzaPrezzoPromo(
  testo: string,
  headline: string,
  frontEndOffer: string,
  elevatorPitch: string,
): ControlloMessaggioVoce | null {
  const tokenDati = estraiTokenPrezzo(frontEndOffer, elevatorPitch);
  if (tokenDati.length === 0) return null;

  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "prezzo",
      label: "Prezzo / promo",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const tokenCopy = estraiTokenPrezzo(combined);
  const datiNelCopy = tokenDati.some((t) =>
    tokenCopy.some(
      (c) => c === t || c.includes(t) || t.includes(c),
    ),
  );

  if (datiNelCopy) {
    return {
      id: "prezzo",
      label: "Prezzo / promo",
      emoji: "🟢",
      messaggio: "Prezzo o promo allineati ai dati inseriti",
    };
  }

  if (tokenCopy.length > 0) {
    const conflitto = tokenCopy.some(
      (c) => !tokenDati.some((t) => c === t || c.includes(t) || t.includes(c)),
    );
    if (conflitto) {
      return {
        id: "prezzo",
        label: "Prezzo / promo",
        emoji: "🟡",
        messaggio: "Il copy indica un prezzo/promo diverso da quello del Passo 1",
      };
    }
  }

  return {
    id: "prezzo",
    label: "Prezzo / promo",
    emoji: "🟡",
    messaggio: "Il prezzo/promo del Passo 1 non compare nel copy",
  };
}

/**
 * Solo difensivo: appare solo se il copy contiene claim di scarsità/urgenza.
 */
function analizzaUrgenzaScarsita(
  testo: string,
  headline: string,
  frontEndOffer: string,
  elevatorPitch: string,
): ControlloMessaggioVoce | null {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) return null;
  if (!SCARSITA_CLAIM.test(combined)) return null;

  const fonti = `${frontEndOffer}\n${elevatorPitch}`.toLowerCase();
  const supportata = SCARSITA_CLAIM.test(fonti);

  if (supportata) {
    return {
      id: "scarsita",
      label: "Urgenza / scarsità",
      emoji: "🟢",
      messaggio: "Claim di scarsità coerente con i dati inseriti",
    };
  }

  return {
    id: "scarsita",
    label: "Urgenza / scarsità",
    emoji: "🟡",
    messaggio:
      "La scarsità indicata nel copy non risulta supportata dai dati inseriti.",
  };
}

function analizzaChiarezzaAcquisto(
  testo: string,
  headline: string,
  sitoWeb: string,
  frontEndOffer: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "chiarezza",
      label: "Chiarezza acquisto",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const ctaOk = CTA_ACQUISTO.test(combined);
  const haDestinazione = Boolean(sitoWeb.trim());
  const haOfferta = Boolean(frontEndOffer.trim());

  if (ctaOk && (haDestinazione || haOfferta)) {
    return {
      id: "chiarezza",
      label: "Chiarezza acquisto",
      emoji: "🟢",
      messaggio: "È chiaro cosa fare dopo aver visto l'annuncio",
    };
  }

  if (ctaOk && !haDestinazione && !haOfferta) {
    return {
      id: "chiarezza",
      label: "Chiarezza acquisto",
      emoji: "🟡",
      messaggio: "CTA presente — aggiungi pagina di destinazione o offerta",
    };
  }

  return {
    id: "chiarezza",
    label: "Chiarezza acquisto",
    emoji: "⚪",
    messaggio: "Da verificare — chiarisci l'azione che deve fare l'utente",
  };
}

function analizzaHeadline(headline: string): ControlloMessaggioVoce | null {
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
 * Controlli deterministici sul copy ECOMMERCE (Variante A).
 * F (prezzo) e G (scarsità) compaiono solo quando applicabili.
 */
export function analizzaControlloMessaggioEcommerce(input: {
  testoVarianteA: string;
  headline?: string;
  frontEndOffer: string;
  elevatorPitch: string;
  heroProduct?: string;
  sitoWeb?: string;
}): ControlloMessaggioRisultato {
  const testo = input.testoVarianteA ?? "";
  const headline = input.headline ?? "";
  const offerta = input.frontEndOffer ?? "";
  const pitch = input.elevatorPitch ?? "";
  const hero = input.heroProduct ?? "";
  const sito = input.sitoWeb ?? "";

  const voci: ControlloMessaggioVoce[] = [
    analizzaCopyPresente(testo),
    analizzaProdottoChiaro(testo, headline, hero, pitch),
    analizzaBeneficio(testo, headline),
  ];

  const offertaVoce = analizzaOfferta(testo, headline, offerta);
  if (offertaVoce) voci.push(offertaVoce);

  voci.push(
    analizzaCtaAcquisto(testo, headline),
    analizzaHookMobile(testo, offerta, hero, pitch),
  );

  const prezzoVoce = analizzaPrezzoPromo(testo, headline, offerta, pitch);
  if (prezzoVoce) voci.push(prezzoVoce);

  const scarsitaVoce = analizzaUrgenzaScarsita(testo, headline, offerta, pitch);
  if (scarsitaVoce) voci.push(scarsitaVoce);

  voci.push(analizzaChiarezzaAcquisto(testo, headline, sito, offerta));

  const headlineVoce = analizzaHeadline(headline);
  if (headlineVoce) voci.push(headlineVoce);

  return { voci };
}
