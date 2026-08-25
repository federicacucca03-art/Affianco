import type { CampagnaObjective } from "@/types/campagne";

/** Slug allineati alle rotte `/campagne/nuova/...`. */
export type WizardStep1Slug =
  | "richieste-contatto"
  | "prenotazioni"
  | "vendite-online"
  | "instore"
  | "retargeting"
  | "apertura";

export type WizardStep1Texts = {
  stepTitle: string;
  stepSubtitle: string;
  briefIntro: string;
  clientLabel: string;
  clientPlaceholder: string;
  nicheLabel: string;
  nichePlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  offerLabel: string;
  offerPlaceholder: string;
  briefLabel: string;
  briefPlaceholder: string;
  siteLabel: string;
  sitePlaceholder: string;
  briefHint: string;
  headlinePlaceholder: string;
};

export const WIZARD_CONFIG: Record<WizardStep1Slug, WizardStep1Texts> = {
  "richieste-contatto": {
    stepTitle: "Partiamo dal cliente",
    stepSubtitle:
      "Raccontami chi è il cliente e cosa vuole ottenere. Affianco organizza il resto.",
    briefIntro:
      "Raccontami il cliente come lo racconteresti a un collega.",
    clientLabel: "Nome cliente",
    clientPlaceholder: "Es. Nome attività",
    nicheLabel: "Settore / nicchia",
    nichePlaceholder: "Es. Settore",
    locationLabel: "Città",
    locationPlaceholder: "Es. Milano",
    offerLabel: "Offerta d'Ingresso / Gancio (Front-End Offer) *",
    offerPlaceholder: "Es. Prima visita con igiene inclusa a 39€",
    briefLabel: "Brief cliente",
    briefPlaceholder:
      "Es. Studio dentistico a Roma che vuole più richieste per implantologia. Il servizio medio vale circa 2.000€ e vuole rivolgersi soprattutto a persone tra 35 e 60 anni.",
    siteLabel: "Sito Web del cliente (opzionale)",
    sitePlaceholder: "es. https://www.abatecs.com",
    briefHint:
      "Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo più avanti.",
    headlinePlaceholder: "Es. Prima consulenza a Milano",
  },
  prenotazioni: {
    stepTitle: "Partiamo dal servizio da prenotare",
    stepSubtitle:
      "Raccontami cosa deve prenotare il cliente e come avviene oggi la prenotazione.",
    briefIntro:
      "Raccontami servizio, offerta e come prenota oggi il cliente.",
    clientLabel: "Nome struttura / locale",
    clientPlaceholder: "Es. Salone Beauty Parrucchieri",
    nicheLabel: "Settore / nicchia",
    nichePlaceholder: "Es. Salone di Bellezza / Ristorante",
    locationLabel: "Città",
    locationPlaceholder: "Es. Torino",
    offerLabel: "Offerta d'Ingresso / Gancio (Front-End Offer) *",
    offerPlaceholder:
      "Es. Taglio + Piega + Trattamento a 29€ per nuovi clienti",
    briefLabel: "Brief cliente",
    briefPlaceholder:
      "Es. Salone specializzato in schiariture naturali in centro città, target donne 25–45.",
    siteLabel: "Sito Web del cliente (opzionale)",
    sitePlaceholder: "es. https://www.abatecs.com",
    briefHint:
      "Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo più avanti.",
    headlinePlaceholder: "Es. Prenota il tuo appuntamento a Torino",
  },
  "vendite-online": {
    stepTitle: "Partiamo dal prodotto da vendere",
    stepSubtitle:
      "Raccontami cosa vende il brand, a chi e con quale offerta.",
    briefIntro:
      "Descrivi il prodotto che vuoi promuovere, il beneficio principale e perché dovrebbe interessare al cliente.",
    clientLabel: "Nome Store / Brand",
    clientPlaceholder: "Es. Boutique Rossi Online",
    nicheLabel: "Settore / nicchia",
    nichePlaceholder: "Es. Cosmetica / Abbigliamento",
    locationLabel: "Dove vendi?",
    locationPlaceholder: "Es. Italia Intera / Europa",
    offerLabel: "Offerta o leva commerciale",
    offerPlaceholder:
      "20% sul primo ordine, spedizione gratuita sopra 50€, bundle 2+1…",
    briefLabel: "Prodotto o collezione principale",
    briefPlaceholder:
      "Es. Siero viso anti-age 50ml con ingredienti naturali, idratazione 24h, reso entro 30 giorni.",
    siteLabel: "Pagina di destinazione",
    sitePlaceholder: "Es. https://www.tuostore.it/prodotto-hero",
    briefHint:
      "Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo più avanti.",
    headlinePlaceholder: "Es. Siero Anti-Age — spedizione gratuita",
  },
  instore: {
    stepTitle: "Partiamo dal punto vendita",
    stepSubtitle:
      "Raccontami l'attività, l'offerta e l'area da raggiungere.",
    briefIntro:
      "Descrivi l'attività locale: cosa offrite, dove siete e perché vale la pena venirvi a trovare.",
    clientLabel: "Nome Negozio / Attività Locale",
    clientPlaceholder: "Es. Ristorante Pizzeria da Mario",
    nicheLabel: "Settore / nicchia",
    nichePlaceholder: "Es. Ristorazione / Abbigliamento / Ottica / Fitness",
    locationLabel: "Città e Quartiere / Zona",
    locationPlaceholder: "Es. Roma (Zona EUR) oppure Firenze Centro",
    offerLabel: "Offerta / promozione locale *",
    offerPlaceholder:
      "Es. Mostra questo annuncio in cassa per il 20% di sconto oppure Drink di benvenuto omaggio",
    briefLabel: "Brief attività",
    briefPlaceholder:
      "Es. Pizzeria con forno a legna e parcheggio gratuito riservato ai clienti.",
    siteLabel: "URL Maps / sito del punto vendita",
    sitePlaceholder:
      "Es. https://maps.google.com/... oppure https://www.ristorante.it",
    briefHint:
      "Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo più avanti.",
    headlinePlaceholder: "Es. Vieni a trovarci in negozio",
  },
  retargeting: {
    stepTitle: "Partiamo dal pubblico da recuperare",
    stepSubtitle:
      "Definiamo cosa vuoi recuperare, cosa stai offrendo e dove deve tornare l'utente.",
    briefIntro:
      "Raccontami il recupero come lo spiegheresti a un collega.",
    clientLabel: "Nome cliente / brand",
    clientPlaceholder: "Es. Boutique Rossi Online",
    nicheLabel: "Settore / nicchia",
    nichePlaceholder: "Es. E-commerce / Servizi",
    locationLabel: "Città / mercato",
    locationPlaceholder: "Es. Italia",
    offerLabel: "Offerta di recupero",
    offerPlaceholder:
      "Es. Spedizione gratuita sul prossimo ordine, oppure perché vale la pena tornare",
    briefLabel: "Brief cliente",
    briefPlaceholder:
      "Es. Brand di abbigliamento online: recuperare chi ha visitato o iniziato un ordine senza completarlo.",
    siteLabel: "Pagina di destinazione",
    sitePlaceholder:
      "Es. https://www.tuostore.it/prodotto oppure /checkout oppure landing",
    briefHint:
      "Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo più avanti.",
    headlinePlaceholder: "Es. Completa il tuo ordine — offerta riservata",
  },
  apertura: {
    stepTitle: "Partiamo dalla nuova apertura",
    stepSubtitle:
      "Definiamo cosa vuoi far conoscere, dove si trova e quale messaggio deve ricordare il pubblico.",
    briefIntro:
      "Raccontami l'apertura o il lancio come lo racconteresti a un collega.",
    clientLabel: "Nome attività",
    clientPlaceholder: "Es. Studio Rossi — Nuova apertura",
    nicheLabel: "Settore / nicchia",
    nichePlaceholder: "Es. Retail / Locale / Servizi",
    locationLabel: "Città",
    locationPlaceholder: "Es. Milano",
    offerLabel: "Messaggio di apertura",
    offerPlaceholder:
      "Es. Nuovo studio in zona Isola — vieni a scoprire lo spazio",
    briefLabel: "Brief attività",
    briefPlaceholder:
      "Es. Nuovo studio in zona Isola: spazio rinnovato e servizi per la zona.",
    siteLabel: "Pagina o mappa di destinazione",
    sitePlaceholder:
      "Es. https://maps.google.com/... oppure https://www.sito.it/apertura",
    briefHint:
      "Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo più avanti.",
    headlinePlaceholder: "Es. Nuova apertura a Milano — scopri di più",
  },
};

const OBJECTIVE_TO_SLUG: Record<CampagnaObjective, WizardStep1Slug> = {
  LEADS: "richieste-contatto",
  BOOKINGS: "prenotazioni",
  ECOMMERCE: "vendite-online",
  IN_STORE: "instore",
  RETARGETING: "retargeting",
  AWARENESS: "apertura",
};

/** Alias rotte corte → slug canonico in WIZARD_CONFIG. */
const SLUG_ALIASES: Record<string, WizardStep1Slug> = {
  ecommerce: "vendite-online",
  vendite: "vendite-online",
  negozio: "instore",
  recupero: "retargeting",
  lancio: "apertura",
  contatti: "richieste-contatto",
};

function normalizzaSlugWizard(grezzo: string): WizardStep1Slug | null {
  const raw = grezzo.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  if (!raw) return null;
  const canonico = SLUG_ALIASES[raw] ?? raw;
  if (canonico in WIZARD_CONFIG) {
    return canonico as WizardStep1Slug;
  }
  return null;
}

/** Risolve lo slug wizard da URL (prioritario) o da `CampagnaObjective`. */
export function risolviSlugWizardStep1(
  pathnameOrSlug: string,
  objective: CampagnaObjective = "LEADS",
): WizardStep1Slug {
  return (
    normalizzaSlugWizard(pathnameOrSlug) ??
    OBJECTIVE_TO_SLUG[objective] ??
    "richieste-contatto"
  );
}

/**
 * Testi Passo 1. Preferisci passare lo slug URL (`vendite-online`)
 * ottenuto con `pathname.split("/").pop()`.
 */
export function testiPasso1Wizard(
  pathnameOrSlug: string,
  objective: CampagnaObjective = "LEADS",
): WizardStep1Texts {
  const slug = risolviSlugWizardStep1(pathnameOrSlug, objective);
  return WIZARD_CONFIG[slug];
}
