import type { BookingChannel, CampagnaObjective } from "@/types/campagne";

/** Lead Form ID obbligatorio solo con destinazione Modulo Meta (o BOOKINGS su LEAD_FORM). */
export function richiedeModuloContatti(
  objective?: CampagnaObjective,
  bookingChannel?: BookingChannel,
  guidedDestination?: string | null,
): boolean {
  const dest = (guidedDestination ?? "").toUpperCase();
  if (dest === "META_LEAD_FORM") return true;
  if (
    dest === "WEBSITE" ||
    dest === "WHATSAPP" ||
    dest === "PHONE" ||
    dest === "INSTAGRAM_DM" ||
    dest === "MAPS" ||
    dest === "NOT_REQUIRED"
  ) {
    return false;
  }
  if (objective === "BOOKINGS") {
    return bookingChannel === "LEAD_FORM";
  }
  if (
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING" ||
    objective === "AWARENESS" ||
    objective === "LEADS"
  ) {
    // LEADS senza destinazione scelta: non inventare Instant Form.
    return false;
  }
  return false;
}

/** Destination URL obbligatorio per E-commerce, In-Store, Retargeting e Apertura. */
export function richiedeDestinationUrl(
  objective?: CampagnaObjective,
): boolean {
  return (
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING" ||
    objective === "AWARENESS"
  );
}

export type LaunchReadinessItemId =
  | "creativita"
  | "approvazione"
  | "pageId"
  | "destinazione"
  | "export";

export type LaunchReadinessItem = {
  id: LaunchReadinessItemId;
  label: string;
  ok: boolean;
  /** Testo quando manca: solo completezza operativa, mai giudizio economico. */
  mancante?: string;
};

export type LaunchReadinessInput = {
  fotoCaricata: boolean;
  clienteHaApprovato: boolean;
  paginaFacebookId: string;
  moduloContattiId: string;
  destinationUrl?: string;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  /** Guided destination from M10B (gates Lead Form / page requirements). */
  guidedDestination?: string | null;
  /** Copy pronto per pubblicazione / export Meta. */
  haCopySelezionato: boolean;
  /** Headline / nome campagna presenti. */
  haTitoloAnnuncio: boolean;
};

export type LaunchReadinessResult = {
  completati: number;
  totale: number;
  percentuale: number;
  items: LaunchReadinessItem[];
  isReady: boolean;
};

function testoDestinazioneMancante(objective?: CampagnaObjective): string {
  if (objective === "IN_STORE") {
    return "URL Mappa Google / Pagina del Negozio mancante";
  }
  if (objective === "RETARGETING") {
    return "URL Pagina di Destinazione / Checkout mancante";
  }
  if (objective === "AWARENESS") {
    return "URL Pagina Evento / Mappa Google / Sito Web mancante";
  }
  if (objective === "ECOMMERCE") {
    return "URL Pagina Prodotto / Store mancante";
  }
  return "Destinazione da scegliere";
}

/**
 * Completezza operativa/tecnica per esportare o lanciare su Meta.
 * Non valuta qualità strategica né sostenibilità economica.
 */
export function calculateLaunchReadiness(
  input: LaunchReadinessInput,
): LaunchReadinessResult {
  const formRichiesto = richiedeModuloContatti(
    input.objective,
    input.bookingChannel,
    input.guidedDestination,
  );
  const storeUrlRichiesto = richiedeDestinationUrl(input.objective);
  const dest = (input.guidedDestination ?? "").toUpperCase();
  const hasChosenGuidedDest = [
    "META_LEAD_FORM",
    "WEBSITE",
    "WHATSAPP",
    "PHONE",
    "INSTAGRAM_DM",
    "MAPS",
    "NOT_REQUIRED",
  ].includes(dest);
  const pageRichiesto =
    formRichiesto ||
    dest === "WHATSAPP" ||
    dest === "INSTAGRAM_DM" ||
    dest === "PHONE";
  const pageOk = !pageRichiesto || input.paginaFacebookId.trim() !== "";
  const formOk = !formRichiesto || input.moduloContattiId.trim() !== "";
  const storeOk =
    !storeUrlRichiesto || (input.destinationUrl ?? "").trim() !== "";
  // LEADS without guided destination: incomplete Meta config (no Instant Form invent).
  const leadsNeedsDestinationChoice =
    input.objective === "LEADS" && !hasChosenGuidedDest;
  const destinazioneOk =
    formOk && storeOk && !leadsNeedsDestinationChoice;
  const exportOk = input.haCopySelezionato && input.haTitoloAnnuncio;

  const etichettaDestinazione = storeUrlRichiesto
    ? "URL di destinazione"
    : formRichiesto
      ? "Modulo contatti Meta"
      : leadsNeedsDestinationChoice
        ? "Come ricevi i contatti"
        : dest === "WHATSAPP"
          ? "Destinazione messaggi"
          : "Destinazione Meta";

  const items: LaunchReadinessItem[] = [
    {
      id: "creativita",
      label: "Creatività pronta",
      ok: input.fotoCaricata,
      mancante: "Creatività mancante",
    },
    {
      id: "approvazione",
      label: "Cliente ha approvato",
      ok: input.clienteHaApprovato,
      mancante: "Approvazione cliente mancante",
    },
    {
      id: "pageId",
      label: "Pagina Facebook",
      ok: pageOk,
      mancante: pageRichiesto
        ? "Pagina Facebook da collegare"
        : undefined,
    },
    {
      id: "destinazione",
      label: etichettaDestinazione,
      ok: destinazioneOk,
      mancante: !destinazioneOk
        ? leadsNeedsDestinationChoice
          ? "Destinazione da scegliere"
          : formRichiesto && !formOk
            ? "Modulo contatti da scegliere"
            : storeUrlRichiesto && !storeOk
              ? testoDestinazioneMancante(input.objective)
              : "Destinazione da scegliere"
        : undefined,
    },
    {
      id: "export",
      label: "Messaggio e titolo pronti",
      ok: exportOk,
      mancante: !exportOk
        ? !input.haCopySelezionato
          ? "Messaggio / copy mancante"
          : "Titolo annuncio mancante"
        : undefined,
    },
  ];

  const completati = items.filter((item) => item.ok).length;
  const totale = items.length;

  return {
    completati,
    totale,
    percentuale: Math.round((completati / totale) * 100),
    items,
    isReady: completati === totale,
  };
}
