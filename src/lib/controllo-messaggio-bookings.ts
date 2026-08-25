import { HOOK_MOBILE_CHARS } from "@/data/varianti-copy";
import type {
  ControlloMessaggioRisultato,
  ControlloMessaggioVoce,
} from "@/lib/controllo-messaggio";
import type { BookingChannel } from "@/types/campagne";

const PRENOTAZIONE_VERBI =
  /prenota|riserv|appuntament|agenda|slot|calend|visita/i;

const URGENZA_KEYWORDS =
  /subito|ultim|esaurit|limitat|oggi|questa settimana|affrett|non perdere|solo per|posti|slot liber/i;

const FACILITA_KEYWORDS =
  /semplic|facile|pochi passagg|in pochi click|tocca|clicca|senza anticip|comod/i;

function patternCtaCanale(channel: BookingChannel): RegExp {
  switch (channel) {
    case "WHATSAPP":
      return /whatsapp|messagg|scriv/i;
    case "BOOKING_LINK":
      return /prenota|agenda|calend|prenot|book/i;
    case "PHONE_CALL":
      return /chiama|telefon|call/i;
    case "INSTAGRAM_DM":
      return /messagg|scriv|direct|\bdm\b/i;
    case "LEAD_FORM":
      return /richied|modulo|iscriv|compila/i;
    default:
      return /prenota|prenot/i;
  }
}

function etichettaCanale(channel: BookingChannel): string {
  switch (channel) {
    case "WHATSAPP":
      return "WhatsApp";
    case "BOOKING_LINK":
      return "link prenotazione";
    case "PHONE_CALL":
      return "telefono";
    case "INSTAGRAM_DM":
      return "messaggio Direct";
    case "LEAD_FORM":
      return "modulo lead";
    default:
      return "canale scelto";
  }
}

function snippetPresente(hook: string, termine: string): boolean {
  const t = termine.trim().toLowerCase();
  if (!t || t.length < 3) return false;
  const slice = t.length > 24 ? t.slice(0, 24) : t;
  return hook.includes(slice);
}

function analizzaHookMobile(
  testo: string,
  offerta: string,
  citta: string,
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
  const offertaOk = offerta.trim()
    ? snippetPresente(hook, offerta)
    : false;
  const cittaOk = citta.trim() ? snippetPresente(hook, citta) : false;
  const prenotazioneOk = PRENOTAZIONE_VERBI.test(hook) || offertaOk;

  if (prenotazioneOk && (offertaOk || cittaOk || PRENOTAZIONE_VERBI.test(hook))) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟢",
      messaggio: `Invito o offerta visibili nelle prime ${HOOK_MOBILE_CHARS} battute`,
    };
  }

  if (!offertaOk && offerta.trim()) {
    return {
      id: "hook",
      label: "Hook mobile",
      emoji: "🟡",
      messaggio: "Offerta poco visibile prima del «Mostra altro»",
    };
  }

  return {
    id: "hook",
    label: "Hook mobile",
    emoji: "⚪",
    messaggio: "Da verificare — rendi chiaro subito cosa si prenota",
  };
}

function analizzaCtaCanale(
  testo: string,
  channel: BookingChannel,
): ControlloMessaggioVoce {
  const t = testo.trim();
  if (!t) {
    return {
      id: "cta-canale",
      label: "CTA e canale",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const lower = t.toLowerCase();
  const pattern = patternCtaCanale(channel);
  const canale = etichettaCanale(channel);

  if (pattern.test(lower)) {
    return {
      id: "cta-canale",
      label: "CTA e canale",
      emoji: "🟢",
      messaggio: `Coerente con ${canale}`,
    };
  }

  if (PRENOTAZIONE_VERBI.test(lower)) {
    return {
      id: "cta-canale",
      label: "CTA e canale",
      emoji: "🟡",
      messaggio: `Invito a prenotare presente — verifica allineamento con ${canale}`,
    };
  }

  return {
    id: "cta-canale",
    label: "CTA e canale",
    emoji: "⚪",
    messaggio: `Da verificare — manca un invito chiaro per ${canale}`,
  };
}

function analizzaFacilitaPrenotazione(testo: string): ControlloMessaggioVoce {
  const t = testo.trim();
  if (!t) {
    return {
      id: "facilita",
      label: "Facilità di prenotazione",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const lower = t.toLowerCase();
  if (FACILITA_KEYWORDS.test(lower) && PRENOTAZIONE_VERBI.test(lower)) {
    return {
      id: "facilita",
      label: "Facilità di prenotazione",
      emoji: "🟢",
      messaggio: "Il percorso suona semplice da completare",
    };
  }

  if (PRENOTAZIONE_VERBI.test(lower)) {
    return {
      id: "facilita",
      label: "Facilità di prenotazione",
      emoji: "🟡",
      messaggio: "Aggiungi un dettaglio su quanto è facile prenotare",
    };
  }

  return {
    id: "facilita",
    label: "Facilità di prenotazione",
    emoji: "⚪",
    messaggio: "Da verificare — spiega come prenotare in concreto",
  };
}

function analizzaUrgenzaDisponibilita(
  testo: string,
  postiSettimana: string,
): ControlloMessaggioVoce {
  const t = testo.trim();
  const posti = postiSettimana.trim();

  if (!t) {
    return {
      id: "urgenza",
      label: "Urgenza / disponibilità",
      emoji: "⚪",
      messaggio: "Da verificare — testo ancora vuoto",
    };
  }

  const lower = t.toLowerCase();
  const haUrgenzaTesto = URGENZA_KEYWORDS.test(lower);
  const postiInTesto = posti ? lower.includes(posti) : false;

  if (posti) {
    if (postiInTesto || haUrgenzaTesto) {
      return {
        id: "urgenza",
        label: "Urgenza / disponibilità",
        emoji: "🟢",
        messaggio: postiInTesto
          ? "Disponibilità indicata nel copy"
          : "Tono di urgenza presente nel testo",
      };
    }
    return {
      id: "urgenza",
      label: "Urgenza / disponibilità",
      emoji: "🟡",
      messaggio: `Hai indicato ${posti} posti al Passo 1 — valuta se menzionarli`,
    };
  }

  if (haUrgenzaTesto) {
    return {
      id: "urgenza",
      label: "Urgenza / disponibilità",
      emoji: "🟢",
      messaggio: "Urgenza o disponibilità citate nel testo",
    };
  }

  return {
    id: "urgenza",
    label: "Urgenza / disponibilità",
    emoji: "⚪",
    messaggio: "Non richiesta — ok per un invito standard",
  };
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
 * Controlli deterministici sul copy BOOKINGS (Variante A).
 */
export function analizzaControlloMessaggioBookings(input: {
  testoVarianteA: string;
  headline?: string;
  frontEndOffer: string;
  citta: string;
  bookingChannel: BookingChannel;
  postiSettimana?: string;
}): ControlloMessaggioRisultato {
  const testo = input.testoVarianteA ?? "";
  const channel = input.bookingChannel ?? "WHATSAPP";
  const posti = (input.postiSettimana ?? "").trim();

  const voci: ControlloMessaggioVoce[] = [
    analizzaCopyPresente(testo),
    analizzaHookMobile(testo, input.frontEndOffer, input.citta),
    analizzaCtaCanale(testo, channel),
    analizzaFacilitaPrenotazione(testo),
    analizzaUrgenzaDisponibilita(testo, posti),
  ];

  const headlineVoce = analizzaHeadline(input.headline ?? "");
  if (headlineVoce) voci.push(headlineVoce);

  return { voci };
}
