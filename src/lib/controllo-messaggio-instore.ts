import { HOOK_MOBILE_CHARS } from "@/data/varianti-copy";
import type {
  ControlloMessaggioRisultato,
  ControlloMessaggioVoce,
} from "@/lib/controllo-messaggio";

/** CTA orientate a visita / indicazioni / cassa (flessibili, non frase unica). */
const CTA_LOCALE =
  /\b(?:ottieni\s+indicazioni|indicazioni|vieni\s+a\s+trovar(?:ci|mi)|vieni\s+in\s+negozio|vieni\s+in\s+sede|passa\s+(?:da\s+noi|in\s+negozio)|raggiung(?:ici|imi)|scopri\s+come\s+arrivare|mostra\s+(?:questo\s+annuncio\s+)?in\s+cassa|navigatore|mappa)\b/i;

const CTA_GENERICA =
  /(?:^|[.!?]\s*)(?:scopri\s+di\s+più|clicca\s+qui|maggiori\s+info|saperne\s+di\s+più|clicca\s+per)(?:\s|$|[.!?])/i;

const MOTIVO_VENIRE =
  /\b(?:vieni|passa|trova(?:r)?(?:ci|mi)|visita(?:r)?(?:ci)?|raggiung|in\s+negozio|in\s+sede|punto\s+vendita|locale|aperit|assaggia|prova|scopri)\w*\b/i;

const COUPON_CASSA =
  /mostra\s+questo\s+annuncio|mostra\s+in\s+cassa|coupon|\bcodice\b|sconto\s+in\s+cassa|in\s+cassa\s+per/i;

const SCARSITA_CLAIM =
  /ultim[io]\s+pezz|solo\s+oggi|scade|fino\s+a\b|disponibilit[àa]\s+limitat|countdown|solo\s+per\s+oggi|ultim[ie]\s+(?:unit|disponibil)|esaurit|affrettati|non\s+perdere|scorte\s+limitat|pochi\s+pezzi|offerta\s+a\s+tempo|posti\s+limitat/i;

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

/** Token significativi del brief (max 6 parole dalla prima frase), non l'intero pitch. */
function tokenBriefSignificativi(elevatorPitch: string): string {
  const grezzo = elevatorPitch.trim();
  if (!grezzo) return "";
  if (grezzo.length <= 48) return grezzo;
  const prima = grezzo.split(/[.|;]/)[0]?.trim() || grezzo;
  return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
}

function analizzaCopyPresente(testo: string): ControlloMessaggioVoce {
  if (!testo.trim()) {
    return {
      id: "copy",
      label: "Testo annuncio",
      emoji: "ℹ️",
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

/**
 * Attività / punto vendita: priorità nomeCliente, headline, Variante A, token brief.
 * Mai 🟡 per mismatch letterale del brief intero.
 */
function analizzaAttivitaChiaro(
  testo: string,
  headline: string,
  nomeCliente: string,
  elevatorPitch: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "attivita",
      label: "Attività / punto vendita",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const nome = nomeCliente.trim();
  const tokenBrief = tokenBriefSignificativi(elevatorPitch);
  const nomeOk = nome.length >= 3 && snippetPresente(combined, nome);
  const briefOk =
    tokenBrief.length >= 3 && snippetPresente(combined, tokenBrief);

  if (nomeOk || briefOk) {
    return {
      id: "attivita",
      label: "Attività / punto vendita",
      emoji: "🟢",
      messaggio: "L'attività o il punto vendita è riconoscibile nel messaggio",
    };
  }

  return {
    id: "attivita",
    label: "Attività / punto vendita",
    emoji: "ℹ️",
    messaggio:
      "Da verificare — non è chiaro cosa offre l'attività nel messaggio",
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

  // Usa il primo token significativo (città) e eventuale pezzo dopo parentesi/virgola.
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
    messaggio:
      "Il messaggio non richiama chiaramente la zona del punto vendita.",
  };
}

function analizzaOffertaLocale(
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
      label: "Offerta locale",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (snippetPresente(combined, offerta)) {
    return {
      id: "offerta",
      label: "Offerta locale",
      emoji: "🟢",
      messaggio: "Offerta locale richiamata nel copy",
    };
  }

  return {
    id: "offerta",
    label: "Offerta locale",
    emoji: "🟡",
    messaggio: "Hai un'offerta al Passo 1 che non compare nel messaggio",
  };
}

function haCtaLocale(combined: string): boolean {
  return CTA_LOCALE.test(combined);
}

function analizzaCtaLocale(
  testo: string,
  headline: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "cta",
      label: "CTA locale",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  if (haCtaLocale(combined)) {
    return {
      id: "cta",
      label: "CTA locale",
      emoji: "🟢",
      messaggio: "Invito chiaro a raggiungere o visitare il punto vendita",
    };
  }

  if (CTA_GENERICA.test(combined)) {
    return {
      id: "cta",
      label: "CTA locale",
      emoji: "🟡",
      messaggio:
        "CTA generica — preferisci indicazioni, «vieni a trovarci» o mostra in cassa",
    };
  }

  return {
    id: "cta",
    label: "CTA locale",
    emoji: "🟡",
    messaggio:
      "Manca un invito chiaro a raggiungere il punto vendita o a usare l'offerta in cassa",
  };
}

/**
 * Solo se CTA visita/indicazioni e manca destinazione URL.
 * Nessuna riga verde se URL presente (evita duplicazione).
 */
function analizzaDestinazioneMancante(
  testo: string,
  headline: string,
  sitoWeb: string,
): ControlloMessaggioVoce | null {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim() || !haCtaLocale(combined)) return null;
  if (sitoWeb.trim()) return null;

  return {
    id: "destinazione",
    label: "Destinazione",
    emoji: "🟡",
    messaggio:
      "Il messaggio invita a raggiungere il punto vendita, ma non è stata indicata una destinazione.",
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

  const hook = t.slice(0, HOOK_MOBILE_CHARS).toLowerCase();
  const attivitaOk =
    (nomeCliente.trim().length >= 3 &&
      snippetPresente(hook, nomeCliente)) ||
    (tokenBriefSignificativi(elevatorPitch).length >= 3 &&
      snippetPresente(hook, tokenBriefSignificativi(elevatorPitch)));
  const cittaOk =
    citta.trim().length >= 3 && snippetPresente(hook, citta.trim());
  const offertaOk =
    frontEndOffer.trim().length >= 3 &&
    snippetPresente(hook, frontEndOffer);
  const motivoOk = MOTIVO_VENIRE.test(hook) || haCtaLocale(hook);

  if (attivitaOk || cittaOk || offertaOk || motivoOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟢",
      messaggio: `Attività, zona, offerta o motivo per venire nelle prime ${HOOK_MOBILE_CHARS} battute`,
    };
  }

  if (citta.trim() && !cittaOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio: "Zona poco visibile prima del «Mostra altro»",
    };
  }

  if (frontEndOffer.trim() && !offertaOk) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio: "Offerta poco visibile nelle prime righe",
    };
  }

  return {
    id: "hook",
    label: "Hook mobile",
    emoji: "ℹ️",
    messaggio:
      "Da verificare — metti attività, zona o offerta in apertura",
  };
}

function analizzaCouponCassa(
  testo: string,
  headline: string,
  frontEndOffer: string,
  elevatorPitch: string,
): ControlloMessaggioVoce | null {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim() || !COUPON_CASSA.test(combined)) return null;

  const fonti = `${frontEndOffer}\n${elevatorPitch}`.toLowerCase();
  const supportato =
    COUPON_CASSA.test(fonti) ||
    /\bsconto\b|\bpromo\b|\bomaggio\b|\bcoupon\b|\bcodice\b|in\s+cassa/i.test(
      fonti,
    );

  if (supportato) {
    return {
      id: "coupon",
      label: "Coupon / cassa",
      emoji: "🟢",
      messaggio: "Riferimento a coupon / cassa coerente con i dati inseriti",
    };
  }

  return {
    id: "coupon",
    label: "Coupon / cassa",
    emoji: "🟡",
    messaggio:
      "Il copy parla di coupon o cassa, ma non risulta supportato dai dati inseriti",
  };
}

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

function analizzaChiarezzaAzione(
  testo: string,
  headline: string,
  citta: string,
  sitoWeb: string,
): ControlloMessaggioVoce {
  const combined = testoCombinato(testo, headline);
  if (!combined.trim()) {
    return {
      id: "chiarezza",
      label: "Chiarezza azione",
      emoji: "ℹ️",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const ctaOk = haCtaLocale(combined);
  const localitaOk =
    citta.trim().length >= 3 && snippetPresente(combined, citta.trim());
  const destinazioneOk = Boolean(sitoWeb.trim());

  if (ctaOk && (localitaOk || destinazioneOk)) {
    return {
      id: "chiarezza",
      label: "Chiarezza azione",
      emoji: "🟢",
      messaggio:
        "È chiaro cosa deve fare l'utente (venire, indicazioni o offerta in cassa)",
    };
  }

  if (ctaOk) {
    return {
      id: "chiarezza",
      label: "Chiarezza azione",
      emoji: "🟡",
      messaggio:
        "CTA presente — rafforza zona o destinazione per chiarire l'azione",
    };
  }

  return {
    id: "chiarezza",
    label: "Chiarezza azione",
    emoji: "ℹ️",
    messaggio:
      "Da verificare — chiarisci se l'utente deve venire in negozio o ottenere indicazioni",
  };
}

/**
 * Controlli deterministici sul copy INSTORE (Variante A).
 * Coupon/cassa, scarsità e destinazione mancante solo se applicabili.
 * Nessun score, nessuna previsione di visite.
 */
export function analizzaControlloMessaggioInstore(input: {
  testoVarianteA: string;
  headline?: string;
  nomeCliente: string;
  elevatorPitch: string;
  citta: string;
  frontEndOffer: string;
  sitoWeb?: string;
}): ControlloMessaggioRisultato {
  const testo = input.testoVarianteA ?? "";
  const headline = input.headline ?? "";
  const nome = input.nomeCliente ?? "";
  const pitch = input.elevatorPitch ?? "";
  const citta = input.citta ?? "";
  const offerta = input.frontEndOffer ?? "";
  const sito = input.sitoWeb ?? "";

  const voci: ControlloMessaggioVoce[] = [
    analizzaCopyPresente(testo),
    analizzaAttivitaChiaro(testo, headline, nome, pitch),
    analizzaLocalita(testo, headline, citta),
  ];

  const offertaVoce = analizzaOffertaLocale(testo, headline, offerta);
  if (offertaVoce) voci.push(offertaVoce);

  voci.push(analizzaCtaLocale(testo, headline));

  const destinazioneVoce = analizzaDestinazioneMancante(testo, headline, sito);
  if (destinazioneVoce) voci.push(destinazioneVoce);

  voci.push(
    analizzaHookMobile(testo, nome, citta, offerta, pitch),
  );

  const couponVoce = analizzaCouponCassa(testo, headline, offerta, pitch);
  if (couponVoce) voci.push(couponVoce);

  const scarsitaVoce = analizzaUrgenzaScarsita(testo, headline, offerta, pitch);
  if (scarsitaVoce) voci.push(scarsitaVoce);

  voci.push(analizzaChiarezzaAzione(testo, headline, citta, sito));

  return { voci };
}
