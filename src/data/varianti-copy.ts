import { cittaPrepLocale, pulisciNomeAttivitaPubblico } from "@/lib/copy-pubblico";
import { estraiServizioPrincipale } from "@/lib/extract-service";
import { isUrlMapsIndicazioni } from "@/lib/url-maps";
import type {
  BookingChannel,
  CampagnaObjective,
  TargetType,
} from "@/types/campagne";

export type AngoloCopy = "razionale" | "emotivo" | "prossimita";

export type TonoVoce = "diretto" | "autorevole" | "empatico";

export type VarianteCopy = {
  id: "A" | "B" | "C";
  etichetta: string;
  angolo: AngoloCopy;
  testo: string;
};

export type OpzioniGeneraCopy = {
  settore?: string | null;
  nomeCliente?: string;
  citta?: string;
  elevatorPitch?: string;
  objective?: CampagnaObjective;
  frontEndOffer?: string;
  targetType?: TargetType;
  tono?: TonoVoce;
  bookingChannel?: BookingChannel;
  heroProduct?: string;
  /** BOOKINGS: posti settimana (solo UI). Se vuoto, nessuna scarsità numerica nel copy. */
  postiDisponibiliSettimana?: string;
  /** AWARENESS: destinazione (sito/mappa) per CTA template. */
  sitoWeb?: string;
};

type ContestoCopy = {
  nome: string;
  citta: string;
  /** Per AWARENESS: "a Milano" oppure "in città" (senza doppia prep.). */
  cittaPrep: string;
  servizio: string;
  settore: string;
  offerta: string;
  target: string;
  cta: string;
  posti: string;
  chiusura: string;
  /** Brief / punto di forza (IN_STORE variante C). */
  puntoForza: string;
  /** Codice promo (RETARGETING variante A). */
  codice: string;
  /** Social proof numerico (RETARGETING variante C). */
  socialProof: string;
};

function riempi(template: string, ctx: ContestoCopy): string {
  return template
    .replaceAll("{nome}", ctx.nome)
    .replaceAll("{citta}", ctx.citta)
    .replaceAll("{cittaPrep}", ctx.cittaPrep)
    .replaceAll("{servizio}", ctx.servizio)
    .replaceAll("{settore}", ctx.settore)
    .replaceAll("{offerta}", ctx.offerta)
    .replaceAll("{target}", ctx.target)
    .replaceAll("{cta}", ctx.cta)
    .replaceAll("{posti}", ctx.posti)
    .replaceAll("{chiusura}", ctx.chiusura)
    .replaceAll("{puntoForza}", ctx.puntoForza)
    .replaceAll("{codice}", ctx.codice)
    .replaceAll("{socialProof}", ctx.socialProof);
}

/** Città in frase AWARENESS: evita "a in città" / "a a Milano". */
function cittaPrepAwareness(citta: string): string {
  const c = citta.trim();
  if (!c || c === "in città") return "in città";
  if (/^(in|a|da|di|nel|nella|presso)\b/i.test(c)) return c;
  return `a ${c}`;
}

/** Prima lettera maiuscola, spazi normalizzati, niente tagli su trattini (anti-age). */
export function normalizzaTestoCopy(testo: string): string {
  const pulito = (testo ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:…])/g, "$1")
    .replace(/([«"])\s+/g, "$1")
    .trim();
  if (!pulito) return "";
  return pulito.charAt(0).toUpperCase() + pulito.slice(1);
}

/**
 * Headline e-commerce pulita: "[Prodotto Hero] — [Offerta Promo]".
 * Evita reiterazioni e tagli su parole con trattino.
 */
export function titoloAnnuncioEcommerce(
  heroProduct: string,
  frontEndOffer: string,
): string {
  const hero = normalizzaTestoCopy(heroProduct.trim() || "Prodotto in evidenza");
  const offer = frontEndOffer.trim();
  let titolo: string;
  if (!offer) {
    titolo = hero;
  } else {
    const offerNorm = normalizzaTestoCopy(offer);
    // Evita "Siero — Siero con sconto…"
    if (hero.toLowerCase().includes(offerNorm.toLowerCase().slice(0, 24))) {
      titolo = hero;
    } else {
      titolo = `${hero} — ${offerNorm}`;
    }
  }
  // Headline Meta: se troppo lunga, preferisci prodotto corto (max 45).
  if (titolo.length > 50) {
    const paroleHero = hero.split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
    titolo = paroleHero.length <= 45 ? paroleHero : hero.slice(0, 45).trim();
  }
  if (titolo.length > 45) {
    const taglio = titolo.slice(0, 45);
    const spazio = taglio.lastIndexOf(" ");
    titolo =
      spazio >= 20 ? taglio.slice(0, spazio).trimEnd() : taglio.trimEnd();
  }
  return titolo;
}

/** Headline LEADS: max 5 parole d'impatto (niente nome campagna). */
export function titoloAnnuncioLeads(
  servizio: string,
  citta: string,
  settore: string = "",
  offerta: string = "",
  pitch: string = "",
): string {
  if (isNichiaDentaleLead(settore, servizio, offerta, pitch)) {
    return "Sorriso Perfetto Senza Ferretti ✨";
  }
  const base = normalizzaTestoCopy(
    (servizio || settore || offerta || "Contattaci ora").trim(),
  );
  const parole = base.split(/\s+/).filter(Boolean).slice(0, 5);
  let titolo = parole.join(" ");
  if (citta.trim() && parole.length <= 3) {
    const conCitta = `${titolo} a ${citta.trim()}`;
    if (conCitta.split(/\s+/).length <= 5 && conCitta.length <= 45) {
      titolo = conCitta;
    }
  }
  if (titolo.length > 45) {
    const taglio = titolo.slice(0, 45);
    const spazio = taglio.lastIndexOf(" ");
    titolo =
      spazio >= 20 ? taglio.slice(0, spazio).trimEnd() : taglio.trimEnd();
  }
  return titolo;
}

function etichettaTarget(targetType: TargetType | undefined): string {
  return targetType === "B2B"
    ? "aziende e professionisti"
    : "privati e famiglie";
}

function offertaEffettiva(
  frontEndOffer: string | undefined,
  servizio: string,
  cittaPrep: string,
  settore: string,
  objective: CampagnaObjective = "LEADS",
): string {
  const o = (frontEndOffer ?? "").trim();
  if (o) return o;
  if (objective === "ECOMMERCE") {
    return "spedizione gratuita sul primo ordine";
  }
  if (objective === "IN_STORE") {
    return "uno sconto esclusivo mostrando questo annuncio in cassa";
  }
  if (objective === "RETARGETING") {
    // Nessuna promo inventata: se l'utente non ha dichiarato un'offerta, resta vuota.
    return "";
  }
  if (objective === "AWARENESS") {
    // Nessun regalo/promo inventati: solo frontEndOffer reale.
    return "";
  }
  const base = (settore ?? "").trim() || servizio;
  return `${base} ${cittaPrep}`;
}

/** Estrae un codice promo dall'offerta; nessun fallback inventato. */
function codicePromoDaOfferta(offerta: string): string {
  const o = offerta.trim();
  const codice =
    o.match(/\b([A-ZÀÈÉÌÒÙ]{3,}[0-9]{1,4})\b/) ??
    o.match(/\bcodice\s+([A-Za-z0-9_-]{4,})\b/i);
  if (codice?.[1]) return codice[1].toUpperCase();
  return "";
}

/** Punto di forza da brief (IN_STORE), altrimenti servizio. */
function puntoForzaInStore(
  elevatorPitch: string,
  servizio: string,
): string {
  const pitch = elevatorPitch.trim();
  if (pitch) {
    const prima = pitch.split(/[.!?;|]/)[0]?.trim() ?? pitch;
    return prima.split(/\s+/).slice(0, 14).join(" ");
  }
  return servizio || "qualità e accoglienza sul territorio";
}

/** Preferisce prodotto hero grezzo (senza estrazioni aggressive). */
function prodottoHeroEcommerce(
  heroProduct: string | undefined,
  elevatorPitch: string,
  settore: string,
): string {
  const hero = (heroProduct ?? "").trim();
  if (hero) return hero;
  const pitch = elevatorPitch.trim();
  if (pitch) {
    // Prima frase, max ~10 parole, conserva i trattini (anti-age).
    const prima = pitch.split(/[.!?;|]/)[0]?.trim() ?? pitch;
    const parole = prima.split(/\s+/).filter(Boolean);
    return parole.slice(0, 10).join(" ") || "il prodotto in evidenza";
  }
  if (settore.trim() && settore.trim() !== "e-commerce") {
    return settore.trim();
  }
  return "il prodotto in evidenza";
}

/** Frase finale copy BOOKINGS sincronizzata con la CTA del canale. */
function chiusuraCtaPrenotazione(channel?: BookingChannel): string {
  if (channel === "WHATSAPP") {
    return "Tocca «Invia un messaggio» e invia il tuo testo per riservare l'offerta.";
  }
  if (channel === "PHONE_CALL") {
    return "Tocca «Chiama ora» e parla direttamente con la reception.";
  }
  if (channel === "INSTAGRAM_DM") {
    return "Tocca «Invia un messaggio» e scrivi per riservare l'offerta.";
  }
  // BOOKING_LINK (default) e LEAD_FORM
  return "Tocca «Prenota subito» e scegli giorno e ora in agenda.";
}

function etichettaCtaPrenotazione(channel?: BookingChannel): string {
  if (channel === "WHATSAPP") return "Invia un messaggio";
  if (channel === "PHONE_CALL") return "Chiama ora";
  if (channel === "INSTAGRAM_DM") return "Invia un messaggio";
  if (channel === "LEAD_FORM") return "Richiedi Appuntamento";
  return "Prenota subito";
}

/** Preferisce offerta / settore al posto di fallback generici. */
function servizioEffettivo(
  pitch: string,
  settore: string,
  frontEndOffer: string | undefined,
  objective: CampagnaObjective = "LEADS",
  heroProduct?: string,
): string {
  if (objective === "ECOMMERCE") {
    return prodottoHeroEcommerce(heroProduct, pitch, settore);
  }
  const offer = (frontEndOffer ?? "").trim();
  const estratto = estraiServizioPrincipale(pitch, settore);
  const fallback = "servizi locali";
  if (
    estratto &&
    estratto !== "servizi locali" &&
    estratto !== "prodotti online" &&
    estratto !== "il tuo servizio specifico"
  ) {
    return estratto;
  }
  if (offer) return offer;
  if (settore.trim()) return settore.trim();
  return fallback;
}

/** CTA finale tipica lead-gen locale. */
function chiusuraLeadGen(
  offerta: string,
  cittaPrep: string,
  settore: string,
  servizio: string,
  pitch: string,
): string {
  const corpus = `${offerta} ${cittaPrep} ${settore} ${servizio} ${pitch}`.toLowerCase();
  const dentale =
    /dent|ortodon|allineator|sorriso|ferrett|invisalign|check-?up|scansione\s*3d/.test(
      corpus,
    );
  if (dentale) {
    return `Prenota il tuo check-up gratuito in clinica ${cittaPrep}.`;
  }
  return `Tocca «Iscriviti» e richiedi info su ${offerta} ${cittaPrep}.`;
}

function isNichiaDentaleLead(
  settore: string,
  servizio: string,
  offerta: string,
  pitch: string,
): boolean {
  return /dent|ortodon|allineator|sorriso|ferrett|invisalign|check-?up|scansione\s*3d/.test(
    `${settore} ${servizio} ${offerta} ${pitch}`.toLowerCase(),
  );
}

/**
 * Template LEADS: solo copy pubblicabile (niente etichette tipo "Hook immediato:").
 * Usa {cittaPrep} = "a Milano" | "nella tua zona".
 */
const LEAD_TONI: Record<
  TonoVoce,
  { a: string; b: string; c: string; ea: string; eb: string; ec: string }
> = {
  diretto: {
    ea: "Variante A - Beneficio Diretto & Promo",
    eb: "Variante B - Autorevolezza & Garanzia",
    ec: "Variante C - Empatico & Risoluzione Problema",
    a: "{offerta} {cittaPrep}! Con {nome} il beneficio su {servizio} è subito chiaro: promo concreta, zero giri di parole. {chiusura}",
    b: "{cittaPrep}, {nome} unisce metodo professionale e percorsi rassicuranti. Approfitta di {offerta}, con pagamenti agevolati a tasso zero quando previsti. {chiusura}",
    c: "Se qualcosa ti frena — un disagio, un dubbio — non sei solo. {nome} {cittaPrep} propone {servizio} in modo comodo e discreto, con {offerta}. {chiusura}",
  },
  autorevole: {
    ea: "Variante A - Beneficio Diretto & Promo",
    eb: "Variante B - Autorevolezza & Garanzia",
    ec: "Variante C - Empatico & Risoluzione Problema",
    a: "{offerta} su {servizio} con {nome} {cittaPrep}: beneficio diretto e promo in evidenza fin dalla prima riga. {chiusura}",
    b: "{nome} {cittaPrep} lavora con tecnologia digitale, risultati chiari e garanzie concrete. {offerta}, con pagamenti semplificati a tasso zero dove disponibili. {chiusura}",
    c: "Rimandare non risolve. {cittaPrep}, {nome} ascolta il tuo caso su {servizio} e propone {offerta} con un percorso trasparente. {chiusura}",
  },
  empatico: {
    ea: "Variante A - Beneficio Diretto & Promo",
    eb: "Variante B - Autorevolezza & Garanzia",
    ec: "Variante C - Empatico & Risoluzione Problema",
    a: "Vuoi un cambiamento concreto? {offerta} {cittaPrep} con {nome}: {servizio} con beneficio immediato e una promo pensata per te. {chiusura}",
    b: "Ti accompagniamo con metodo digitale, trasparenza e soluzioni discrete. {cittaPrep}, {nome} rende semplice anche il pagamento a tasso zero. Scopri {offerta}. {chiusura}",
    c: "Capita di non sentirsi a proprio agio. {cittaPrep}, {nome} propone un percorso comodo su {servizio}, partendo da {offerta}. {chiusura}",
  },
};

/** Varianti dentali: copy fluido, senza prefissi da prompt. */
const LEAD_TONI_DENTALE: Record<
  TonoVoce,
  { a: string; b: string; c: string; ea: string; eb: string; ec: string }
> = {
  diretto: {
    ea: "Variante A - Beneficio Diretto & Promo",
    eb: "Variante B - Autorevolezza & Garanzia",
    ec: "Variante C - Empatico & Risoluzione Problema",
    a: "{offerta} {cittaPrep}! Con {nome} parti dalla scansione 3D e dalla promo sugli allineatori invisibili: beneficio immediato, zero giri di parole. {chiusura}",
    b: "{cittaPrep}, {nome} usa tecnologia digitale: niente ferretti metallici visibili e pagamenti agevolati a tasso zero. Scopri {offerta}. {chiusura}",
    c: "Se non ti senti a tuo agio a sorridere, non sei solo. {nome} {cittaPrep} ti aiuta ad allineare i denti in modo invisibile e comodo, con {offerta}. {chiusura}",
  },
  autorevole: {
    ea: "Variante A - Beneficio Diretto & Promo",
    eb: "Variante B - Autorevolezza & Garanzia",
    ec: "Variante C - Empatico & Risoluzione Problema",
    a: "{offerta}: scansione 3D e promo allineatori invisibili con {nome} {cittaPrep}. Beneficio chiaro fin dalla prima riga. {chiusura}",
    b: "{nome} {cittaPrep} propone un percorso digitale senza ferretti metallici visibili, risultati chiari e rate a tasso zero. {offerta}. {chiusura}",
    c: "Il disagio di nascondere il sorriso ha una via d'uscita discreta. {cittaPrep}, {nome} propone allineatori invisibili con {offerta}. {chiusura}",
  },
  empatico: {
    ea: "Variante A - Beneficio Diretto & Promo",
    eb: "Variante B - Autorevolezza & Garanzia",
    ec: "Variante C - Empatico & Risoluzione Problema",
    a: "Vuoi un sorriso più sereno? {offerta} {cittaPrep} con {nome}: scansione 3D e promo sugli allineatori invisibili. {chiusura}",
    b: "Tecnologia digitale, assenza di ferretti metallici visibili e pagamenti a tasso zero. {cittaPrep}, {nome} rende tutto più semplice. Scopri {offerta}. {chiusura}",
    c: "Capita di non sorridere nelle foto. {cittaPrep}, {nome} ti ascolta e propone un percorso invisibile e confortevole, partendo da {offerta}. {chiusura}",
  },
};

const BOOK_TONI_A_SENZA_POSTI: Record<TonoVoce, { testo: string; etichetta: string }> =
  {
    diretto: {
      etichetta: "Variante A - Invito a prenotare",
      testo:
        "{offerta} {cittaPrep}! Con {nome} prenotare {servizio} è semplice e veloce. {chiusura}",
    },
    autorevole: {
      etichetta: "Variante A - Invito a prenotare",
      testo:
        "{nome} {cittaPrep}: prenota {servizio} con {offerta}. Agenda chiara e conferma rapida. {chiusura}",
    },
    empatico: {
      etichetta: "Variante A - Invito a prenotare",
      testo:
        "Cerchi {servizio} {cittaPrep}? Con {nome} prenoti in pochi passaggi. {offerta}. {chiusura}",
    },
  };

const BOOK_TONI: Record<
  TonoVoce,
  { a: string; b: string; c: string; ea: string; eb: string; ec: string }
> = {
  diretto: {
    ea: "Variante A - Scarsità Agenda",
    eb: "Variante B - Promo Primo Ingresso",
    ec: "Variante C - Garanzia Zero Anticipo",
    a: "📅 Solo {posti} posti disponibili per questa settimana {cittaPrep}! Riserva ora {offerta} prima del tutto esaurito. {chiusura}",
    b: "👋 Nuova apertura / Benvenuto {cittaPrep}! Per i primi nuovi clienti riserviamo {offerta} a prezzo speciale. {chiusura}",
    c: "Cerchi {servizio} {cittaPrep}? Prenota il tuo appuntamento senza anticipare nulla online: paghi comodamente in struttura. {chiusura}",
  },
  autorevole: {
    ea: "Variante A - Scarsità Agenda",
    eb: "Variante B - Promo Primo Ingresso",
    ec: "Variante C - Garanzia Zero Anticipo",
    a: "📅 Agenda {nome}: solo {posti} slot liberi questa settimana {cittaPrep}. Riserva {offerta} prima del tutto esaurito. {chiusura}",
    b: "👋 Benvenuto {cittaPrep}. {nome} apre le prenotazioni per {offerta} a condizioni dedicate. {chiusura}",
    c: "Cerchi {servizio} {cittaPrep} con {nome}? Prenota senza anticipo online: saldi in struttura. {chiusura}",
  },
  empatico: {
    ea: "Variante A - Scarsità Agenda",
    eb: "Variante B - Promo Primo Ingresso",
    ec: "Variante C - Garanzia Zero Anticipo",
    a: "📅 {cittaPrep} restano circa {posti} posti questa settimana. Non perdere {offerta}. {chiusura}",
    b: "👋 Nuovo {cittaPrep}? Ti diamo il benvenuto con {offerta} a prezzo speciale per i primi clienti. {chiusura}",
    c: "Cerchi {servizio} {cittaPrep}? Prenota senza anticipare nulla online: paghi comodamente in struttura quando vieni. {chiusura}",
  },
};

/** Fallback generici (altri obiettivi) con offerta + città in apertura. */
function templateGenerici(
  objective: CampagnaObjective,
  tono: TonoVoce,
): { a: string; b: string; c: string; ea: string; eb: string; ec: string } {
  if (objective === "ECOMMERCE") {
    return {
      ea: "Variante A - Offerta Lancio / Bundle",
      eb: "Variante B - Urgenza & Scarsità",
      ec: "Variante C - Social Proof & Testimonial",
      a: "Prenditi cura della tua pelle con {servizio}! Solo per questa settimana ricevi {offerta} su tutto il carrello. Spedizione rapida 24/48h e reso facile. Tocca «Acquista ora» e ordina il tuo.",
      b: "Ultimi pezzi di {servizio}: {offerta}. Ordina da {nome} prima che finisca — spedizione 24/48h.",
      c: "Chi sceglie {servizio} da {nome} torna a ordinare. Approfitta di {offerta} e tocca «Acquista ora».",
    };
  }

  if (objective === "IN_STORE") {
    return {
      ea: "Variante A - Coupon Cassa",
      eb: "Variante B - Riprova Sociale Locale",
      ec: "Variante C - Vicinanza & Evento",
      a: "📍 {citta}: {offerta}. Passa da noi {cittaPrep}, mostra questo post alla cassa di {nome} e sblocca la promo! Tocca «Ottieni indicazioni» per la mappa.",
      b: "⭐️ Cerchi il miglior {settore} {cittaPrep}? Scopri {nome}! Mostra l'annuncio in cassa per ricevere {offerta}. Clicca «Ottieni indicazioni» per raggiungerci.",
      c: "Aperti {cittaPrep}! Cerchi {settore}? {nome} è la soluzione con {puntoForza}. Tocca «Ottieni indicazioni» per attivare il navigatore e venire a trovarci.",
    };
  }

  if (objective === "RETARGETING") {
    // Template legacy sostituiti da templateRetargeting() in generaVariantiCopy.
    return {
      ea: "Variante A - Reminder del valore",
      eb: "Variante B - Risoluzione obiezione",
      ec: "Variante C - Motivo per tornare",
      a: "Vale la pena tornare a dare un'occhiata. Tocca «Scopri di più».",
      b: "Se hai ancora qualche dubbio, torna a rivedere le informazioni e valuta se è la soluzione giusta per te. Tocca «Scopri di più».",
      c: "Se l'argomento ti interessa ancora, torna e approfondisci. Tocca «Scopri di più».",
    };
  }

  // AWARENESS: template legacy sostituiti da templateAwareness() in generaVariantiCopy.
  return LEAD_TONI[tono];
}

type PackCopyTemplate = {
  a: string;
  b: string;
  c: string;
  ea: string;
  eb: string;
  ec: string;
};

/**
 * Template RETARGETING sobri (B2C / B2B).
 * Offerta solo se reale; nessun codice/FOMO/social proof inventati.
 */
function templateRetargeting(
  targetType: TargetType | undefined,
  opts: {
    haNome: boolean;
    haOfferta: boolean;
    haServizio: boolean;
    haBrief: boolean;
  },
): PackCopyTemplate {
  const isB2b = targetType === "B2B";
  const nomeRef = opts.haNome ? "{nome}" : "";
  const servizioRef = opts.haServizio ? "{servizio}" : "";
  const briefRef = opts.haBrief ? "{puntoForza}" : "";

  if (isB2b) {
    const aConOfferta = opts.haOfferta
      ? opts.haNome
        ? `Hai già valutato ${nomeRef}. In evidenza: {offerta}. Riprendi da dove avevi lasciato. Tocca «Scopri di più».`
        : `In evidenza: {offerta}. Riprendi da dove avevi lasciato. Tocca «Scopri di più».`
      : opts.haNome
        ? `Hai già valutato ${nomeRef}. Riprendi da dove avevi lasciato. Tocca «Scopri di più».`
        : `Riprendi da dove avevi lasciato. Tocca «Scopri di più».`;

    const b = opts.haServizio
      ? `Se hai ancora qualche dubbio su ${servizioRef}, torna a rivedere le informazioni e valuta se è la soluzione giusta. Tocca «Richiedi informazioni».`
      : `Se hai ancora qualche dubbio, torna a rivedere le informazioni e valuta se è la soluzione giusta. Tocca «Richiedi informazioni».`;

    const c = opts.haBrief
      ? opts.haNome
        ? `Se l'argomento è ancora rilevante, riprendi il contatto con ${nomeRef}: ${briefRef}. Tocca «Riprendi il contatto».`
        : `Se l'argomento è ancora rilevante, riprendi il contatto: ${briefRef}. Tocca «Riprendi il contatto».`
      : opts.haNome
        ? `Se l'argomento è ancora rilevante, riprendi il contatto con ${nomeRef}. Tocca «Riprendi il contatto».`
        : `Se l'argomento è ancora rilevante, riprendi il contatto. Tocca «Riprendi il contatto».`;

    return {
      ea: "Variante A - Reminder",
      eb: "Variante B - Chiarezza / obiezione",
      ec: "Variante C - Motivo per riprendere il contatto",
      a: aConOfferta,
      b,
      c,
    };
  }

  const a = opts.haOfferta
    ? opts.haNome
      ? `Hai già scoperto ${nomeRef}. Approfitta di {offerta} e torna a dare un'occhiata. Tocca «Scopri di più».`
      : `Approfitta di {offerta} e torna a dare un'occhiata. Tocca «Scopri di più».`
    : opts.haNome
      ? `Hai già scoperto ${nomeRef}. Vale la pena tornare e rivedere le informazioni. Tocca «Scopri di più».`
      : `Vale la pena tornare e rivedere le informazioni. Tocca «Scopri di più».`;

  const b = opts.haServizio
    ? `Se hai ancora qualche dubbio su ${servizioRef}, torna a rivedere le informazioni e valuta se è la soluzione giusta per te. Tocca «Scopri di più».`
    : `Se hai ancora qualche dubbio, torna a rivedere le informazioni e valuta se è la soluzione giusta per te. Tocca «Scopri di più».`;

  const c = opts.haBrief
    ? opts.haNome
      ? `Se ${servizioRef || "l'argomento"} ti interessa ancora, torna su ${nomeRef}: ${briefRef}. Tocca «Scopri di più».`
      : `Se ${servizioRef || "l'argomento"} ti interessa ancora: ${briefRef}. Tocca «Scopri di più».`
    : opts.haNome
      ? `Se l'argomento ti interessa ancora, torna su ${nomeRef} e approfondisci. Tocca «Scopri di più».`
      : `Se l'argomento ti interessa ancora, torna e approfondisci. Tocca «Scopri di più».`;

  return {
    ea: "Variante A - Reminder del valore",
    eb: "Variante B - Risoluzione obiezione",
    ec: "Variante C - Motivo per tornare",
    a,
    b,
    c,
  };
}

/**
 * Template AWARENESS sobri (apertura locale).
 * Solo dati reali: nome, città, brief, messaggio, destinazione.
 * Nessun regalo/evento/urgenza/navigatore inventati.
 */
function templateAwareness(opts: {
  haNome: boolean;
  haOfferta: boolean;
  haCitta: boolean;
  haBrief: boolean;
  haDestinazione: boolean;
  haMaps: boolean;
}): PackCopyTemplate {
  const ctaScopri = opts.haDestinazione
    ? "Tocca «Scopri di più»."
    : "Scopri di più quando vuoi approfondire.";
  const ctaZona = opts.haMaps
    ? "Tocca «Ottieni indicazioni»."
    : opts.haDestinazione
      ? "Tocca «Scopri di più»."
      : "Tienila d'occhio: una novità da conoscere.";

  // A · Novità / apertura
  let a: string;
  if (opts.haNome && opts.haCitta && opts.haOfferta) {
    a = `{nome} apre {cittaPrep}: {offerta}. ${ctaScopri}`;
  } else if (opts.haNome && opts.haCitta && opts.haBrief) {
    a = `{nome} apre {cittaPrep}. {puntoForza}. ${ctaScopri}`;
  } else if (opts.haNome && opts.haCitta) {
    a = `{nome} apre {cittaPrep}. Una novità da conoscere da vicino. ${ctaScopri}`;
  } else if (opts.haNome && opts.haOfferta) {
    a = `{nome}: novità in arrivo. {offerta}. ${ctaScopri}`;
  } else if (opts.haNome && opts.haBrief) {
    a = `{nome}: {puntoForza}. ${ctaScopri}`;
  } else if (opts.haNome) {
    a = `{nome}: una nuova apertura da scoprire. ${ctaScopri}`;
  } else if (opts.haCitta && opts.haOfferta) {
    a = `Nuova apertura {cittaPrep}: {offerta}. ${ctaScopri}`;
  } else if (opts.haCitta && opts.haBrief) {
    a = `Nuova apertura {cittaPrep}. {puntoForza}. ${ctaScopri}`;
  } else if (opts.haCitta) {
    a = `Nuova apertura {cittaPrep}. Una novità da conoscere da vicino. ${ctaScopri}`;
  } else if (opts.haOfferta) {
    a = `Novità: {offerta}. ${ctaScopri}`;
  } else if (opts.haBrief) {
    a = `{puntoForza}. ${ctaScopri}`;
  } else {
    a = `Una nuova apertura da conoscere. ${ctaScopri}`;
  }

  // B · Motivo per scoprirci
  let b: string;
  if (opts.haOfferta && opts.haNome && opts.haCitta) {
    b = `Perché scoprirlo: {offerta}. {nome} {cittaPrep}. ${ctaScopri}`;
  } else if (opts.haOfferta && opts.haNome) {
    b = `Perché scoprirlo: {offerta}. Scopri {nome}. ${ctaScopri}`;
  } else if (opts.haOfferta && opts.haCitta) {
    b = `Perché scoprirlo: {offerta}. Novità {cittaPrep}. ${ctaScopri}`;
  } else if (opts.haOfferta) {
    b = `Perché scoprirlo: {offerta}. ${ctaScopri}`;
  } else if (opts.haBrief && opts.haNome && opts.haCitta) {
    b = `{puntoForza}. Scopri {nome} {cittaPrep}. ${ctaScopri}`;
  } else if (opts.haBrief && opts.haNome) {
    b = `{puntoForza}. Scopri {nome}. ${ctaScopri}`;
  } else if (opts.haBrief) {
    b = `{puntoForza}. ${ctaScopri}`;
  } else if (opts.haNome && opts.haCitta) {
    b = `Vale la pena scoprire {nome} {cittaPrep}. ${ctaScopri}`;
  } else if (opts.haNome) {
    b = `Vale la pena scoprire {nome}. ${ctaScopri}`;
  } else if (opts.haCitta) {
    b = `Vale la pena scoprire questa novità {cittaPrep}. ${ctaScopri}`;
  } else {
    b = `Vale la pena scoprire questa novità. ${ctaScopri}`;
  }

  // C · Zona e destinazione
  let c: string;
  if (opts.haDestinazione && opts.haCitta && opts.haNome) {
    c = `{citta}: scopri dove siamo e approfondisci su {nome}. ${ctaZona}`;
  } else if (opts.haDestinazione && opts.haCitta) {
    c = `{citta}: scopri dove siamo e approfondisci. ${ctaZona}`;
  } else if (opts.haDestinazione && opts.haNome) {
    c = `Scopri dove trovare {nome} e approfondisci. ${ctaZona}`;
  } else if (opts.haDestinazione) {
    c = `Approfondisci la novità e scopri dove siamo. ${ctaZona}`;
  } else if (opts.haCitta && opts.haNome) {
    c = `Novità locale: {nome} {cittaPrep}. Tienila d'occhio.`;
  } else if (opts.haCitta) {
    c = `Novità locale {cittaPrep}. Tienila d'occhio.`;
  } else if (opts.haNome) {
    c = `{nome}: una novità da conoscere. Tienila d'occhio.`;
  } else {
    c = `Una novità locale da conoscere. Tienila d'occhio.`;
  }

  return {
    ea: "Variante A - Novità / apertura",
    eb: "Variante B - Motivo per scoprirci",
    ec: "Variante C - Zona e destinazione",
    a,
    b,
    c,
  };
}

/**
 * Genera 3 varianti copy iniettando offerta, città, settore, target e tono.
 */
export function generaVariantiCopy(
  settoreOrOpts: string | null | undefined | OpzioniGeneraCopy,
  nomeCliente: string = "",
  citta: string = "",
  elevatorPitch: string = "",
  objective: CampagnaObjective = "LEADS",
): VarianteCopy[] {
  const opts: OpzioniGeneraCopy =
    settoreOrOpts !== null &&
    typeof settoreOrOpts === "object" &&
    !Array.isArray(settoreOrOpts)
      ? settoreOrOpts
      : {
          settore: settoreOrOpts as string | null | undefined,
          nomeCliente,
          citta,
          elevatorPitch,
          objective,
        };

  const obj = opts.objective ?? "LEADS";
  const isRetargetingObj = obj === "RETARGETING";
  const isAwarenessObj = obj === "AWARENESS";
  const settore =
    (opts.settore ?? "").trim() ||
    (obj === "ECOMMERCE"
      ? "e-commerce"
      : isRetargetingObj || isAwarenessObj
        ? ""
        : "servizi locali");
  const nome =
    pulisciNomeAttivitaPubblico(opts.nomeCliente ?? "") ||
    (isAwarenessObj
      ? ""
      : obj === "ECOMMERCE"
        ? "il tuo store online"
        : obj === "IN_STORE"
          ? "il tuo negozio"
          : isRetargetingObj
            ? ""
            : "il tuo brand di fiducia");
  const cittaInput = (opts.citta ?? "").trim();
  const locale = cittaPrepLocale(
    cittaInput ||
      (isAwarenessObj
        ? ""
        : obj === "ECOMMERCE" || isRetargetingObj
          ? "Italia"
          : ""),
  );
  const luogo =
    locale.citta ||
    (isAwarenessObj
      ? ""
      : obj === "ECOMMERCE" || isRetargetingObj
        ? "Italia"
        : "");
  const cittaPrep =
    isAwarenessObj
      ? cittaInput
        ? cittaPrepAwareness(cittaInput)
        : ""
      : locale.cittaPrep;
  const pitch = opts.elevatorPitch ?? "";
  const tono = opts.tono ?? "diretto";
  const pitchConHero = [opts.elevatorPitch ?? "", opts.heroProduct ?? ""]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" · ");
  const servizioRaw = servizioEffettivo(
    pitchConHero || pitch,
    settore,
    isRetargetingObj || isAwarenessObj
      ? opts.frontEndOffer
      : opts.heroProduct?.trim() || opts.frontEndOffer,
    obj,
    isRetargetingObj || isAwarenessObj ? undefined : opts.heroProduct,
  );
  const servizioFallbackGenerico =
    !servizioRaw ||
    servizioRaw === "servizi locali" ||
    servizioRaw === "prodotti online";
  const servizio =
    (isRetargetingObj || isAwarenessObj) && servizioFallbackGenerico
      ? ""
      : servizioRaw;
  const offerta = offertaEffettiva(
    opts.frontEndOffer,
    servizio,
    cittaPrep,
    settore,
    obj,
  );
  const target = etichettaTarget(opts.targetType);
  const cta = etichettaCtaPrenotazione(opts.bookingChannel);
  const chiusura =
    obj === "LEADS"
      ? chiusuraLeadGen(offerta, cittaPrep, settore, servizio, pitch)
      : chiusuraCtaPrenotazione(opts.bookingChannel);
  const puntoForza =
    obj === "IN_STORE"
      ? puntoForzaInStore(pitch, servizio)
      : isRetargetingObj || isAwarenessObj
        ? (() => {
            const p = pitch.trim();
            if (!p) return "";
            const prima = p.split(/[.!?;|]/)[0]?.trim() ?? p;
            return prima.split(/\s+/).slice(0, 14).join(" ");
          })()
        : servizio;
  const codice = codicePromoDaOfferta(offerta);

  const postiRaw = (opts.postiDisponibiliSettimana ?? "").trim();
  const haPostiNumerici =
    postiRaw.length > 0 && /^\d+$/.test(postiRaw);

  const ctx: ContestoCopy = {
    nome,
    citta:
      luogo ||
      (cittaPrep === "nella tua zona" ? "la tua zona" : luogo) ||
      (isAwarenessObj ? "" : "la tua zona"),
    cittaPrep,
    servizio,
    settore,
    offerta,
    target,
    cta,
    posti: haPostiNumerici ? postiRaw : "",
    chiusura,
    puntoForza,
    codice,
    socialProof: "",
  };

  type PackCopy = {
    a: string;
    b: string;
    c: string;
    ea: string;
    eb: string;
    ec: string;
  };

  let pack: PackCopy;
  if (obj === "LEADS") {
    pack = isNichiaDentaleLead(settore, servizio, offerta, pitch)
      ? LEAD_TONI_DENTALE[tono]
      : LEAD_TONI[tono];
  } else if (obj === "BOOKINGS") {
    pack = { ...BOOK_TONI[tono] };
    if (!haPostiNumerici) {
      pack.a = BOOK_TONI_A_SENZA_POSTI[tono].testo;
      pack.ea = BOOK_TONI_A_SENZA_POSTI[tono].etichetta;
    }
  } else if (isRetargetingObj) {
    pack = templateRetargeting(opts.targetType, {
      haNome: Boolean(nome.trim()),
      haOfferta: Boolean(offerta.trim()),
      haServizio: Boolean(servizio.trim()),
      haBrief: Boolean(puntoForza.trim()),
    });
  } else if (isAwarenessObj) {
    pack = templateAwareness({
      haNome: Boolean(nome.trim()),
      haOfferta: Boolean(offerta.trim()),
      haCitta: Boolean(cittaInput),
      haBrief: Boolean(puntoForza.trim()),
      haDestinazione: Boolean((opts.sitoWeb ?? "").trim()),
      haMaps: isUrlMapsIndicazioni(opts.sitoWeb),
    });
  } else {
    pack = templateGenerici(obj, tono);
  }

  return [
    {
      id: "A",
      etichetta: pack.ea,
      angolo: "razionale",
      testo: normalizzaTestoCopy(riempi(pack.a, ctx)),
    },
    {
      id: "B",
      etichetta: pack.eb,
      angolo: "emotivo",
      testo: normalizzaTestoCopy(riempi(pack.b, ctx)),
    },
    {
      id: "C",
      etichetta: pack.ec,
      angolo: "prossimita",
      testo: normalizzaTestoCopy(riempi(pack.c, ctx)),
    },
  ];
}

export const HOOK_MOBILE_CHARS = 120;

const HOOK_CHARS = HOOK_MOBILE_CHARS;

function snippetPresenteNellHook(hook: string, grezzo: string): boolean {
  const o = grezzo.trim().toLowerCase();
  if (!o) return true;
  if (o.length <= 12) return hook.includes(o);
  if (hook.includes(o.slice(0, Math.min(40, o.length)))) return true;
  // Parole ≥4 lettere; conserva pezzi con trattino (anti-age → anti-age intero).
  const parole = o
    .split(/[^a-zàèéìòù0-9-]+/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);
  if (parole.length === 0) return hook.includes(o.slice(0, 12));
  const presenti = parole.filter((p) => hook.includes(p)).length;
  return presenti >= Math.min(2, parole.length);
}

/**
 * Hook check mobile: nelle prime 120 battute.
 * LEADS/locali: città + offerta.
 * ECOMMERCE: prodotto hero e/o offerta promo (niente check città).
 * RETARGETING: invito a completare / promo (niente check città).
 */
export function hookMobileCompleto(
  testo: string,
  citta: string,
  frontEndOffer: string,
  options?: {
    objective?: CampagnaObjective;
    heroProduct?: string;
  },
): boolean {
  const hook = (testo ?? "").slice(0, HOOK_CHARS).toLowerCase();
  const isEcommerce = options?.objective === "ECOMMERCE";
  const isRetargeting = options?.objective === "RETARGETING";

  if (isEcommerce) {
    const hero = (options?.heroProduct ?? "").trim();
    const offer = frontEndOffer.trim();
    if (!hero && !offer) return true;
    const heroOk = !hero || snippetPresenteNellHook(hook, hero);
    const offerOk = !offer || snippetPresenteNellHook(hook, offer);
    if (hero && offer) return heroOk && offerOk;
    return hero ? heroOk : offerOk;
  }

  if (isRetargeting) {
    const offer = frontEndOffer.trim();
    const offerOk = offer ? snippetPresenteNellHook(hook, offer) : false;
    const invitoCompletare =
      /completa|carrello|ordine|acquist|sconto|offerta|codice|scad|scorte|recupera|dimenticat/.test(
        hook,
      );
    return offerOk || invitoCompletare;
  }

  if (options?.objective === "AWARENESS") {
    const c = citta.trim().toLowerCase();
    const cittaOk =
      !c ||
      c === "la tua zona" ||
      c === "nella tua zona" ||
      c === "in città"
        ? true
        : hook.includes(c);
    const offer = frontEndOffer.trim();
    const offerOk = !offer || snippetPresenteNellHook(hook, offer);
    const segnale =
      /apre|apertura|novit|scopri|conoscer|zona|locale|vicino/.test(hook);
    return cittaOk && offerOk && (Boolean(offer) || segnale || hook.length > 0);
  }

  const cittaOk = (() => {
    const c = citta.trim().toLowerCase();
    if (
      !c ||
      c === "la tua zona" ||
      c === "nella tua zona" ||
      c === "in città"
    ) {
      return true;
    }
    return hook.includes(c);
  })();
  const offertaPerHook = frontEndOffer.trim();
  const offertaOk = snippetPresenteNellHook(hook, offertaPerHook);
  return cittaOk && offertaOk;
}

/** Dettaglio hook mobile per LEADS (prime 120 battute). */
export function dettaglioHookMobileLeads(
  testo: string,
  citta: string,
  frontEndOffer: string,
): { hookOk: boolean; cittaOk: boolean; offertaOk: boolean } {
  const hook = (testo ?? "").slice(0, HOOK_CHARS).toLowerCase();
  const c = citta.trim().toLowerCase();
  const cittaOk =
    !c || c === "la tua zona" || c === "nella tua zona" || c === "in città"
      ? true
      : hook.includes(c);
  const offerta = frontEndOffer.trim();
  const offertaOk = offerta
    ? snippetPresenteNellHook(hook, offerta)
    : true;
  return {
    hookOk: cittaOk && offertaOk,
    cittaOk,
    offertaOk: offerta ? offertaOk : false,
  };
}

export function metaVarianti(
  varianteA: string,
  varianteB: string,
  varianteC: string,
  objective: CampagnaObjective = "LEADS",
): VarianteCopy[] {
  const base = generaVariantiCopy({
    settore: "",
    nomeCliente: "",
    citta: "",
    objective,
  });
  return [
    { ...base[0], testo: varianteA },
    { ...base[1], testo: varianteB },
    { ...base[2], testo: varianteC },
  ];
}
