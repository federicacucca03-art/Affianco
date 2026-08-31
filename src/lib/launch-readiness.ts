import type { BookingChannel, CampagnaObjective } from "@/types/campagne";

/** Lead Form ID obbligatorio solo per LEADS o BOOKINGS su LEAD_FORM. */
export function richiedeModuloContatti(
  objective?: CampagnaObjective,
  bookingChannel?: BookingChannel,
): boolean {
  if (objective === "BOOKINGS") {
    return bookingChannel === "LEAD_FORM";
  }
  if (
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING" ||
    objective === "AWARENESS"
  ) {
    return false;
  }
  return true;
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
  /** Copy pronto per il CSV di import Meta. */
  haCopySelezionato: boolean;
  /** Headline / nome campagna presenti per l'export. */
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
  return "ID Modulo Contatti mancante";
}

/**
 * Completezza operativa/tecnica per esportare o lanciare su Meta.
 * Non valuta qualità strategica né sostenibilità economica.
 */
export function calculateLaunchReadiness(
  input: LaunchReadinessInput,
): LaunchReadinessResult {
  const pageOk = input.paginaFacebookId.trim() !== "";
  const formRichiesto = richiedeModuloContatti(
    input.objective,
    input.bookingChannel,
  );
  const storeUrlRichiesto = richiedeDestinationUrl(input.objective);
  const formOk = !formRichiesto || input.moduloContattiId.trim() !== "";
  const storeOk =
    !storeUrlRichiesto || (input.destinationUrl ?? "").trim() !== "";
  const destinazioneOk = formOk && storeOk;
  const exportOk = input.haCopySelezionato && input.haTitoloAnnuncio;

  const etichettaDestinazione = storeUrlRichiesto
    ? "URL di destinazione"
    : formRichiesto
      ? "ID Modulo Contatti / destinazione"
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
      label: "ID Pagina Facebook",
      ok: pageOk,
      mancante: "ID Pagina Facebook mancante",
    },
    {
      id: "destinazione",
      label: etichettaDestinazione,
      ok: destinazioneOk,
      mancante: !destinazioneOk
        ? formRichiesto && !formOk
          ? "ID Modulo Contatti mancante"
          : storeUrlRichiesto && !storeOk
            ? testoDestinazioneMancante(input.objective)
            : "Destinazione mancante"
        : undefined,
    },
    {
      id: "export",
      label: "Requisiti export",
      ok: exportOk,
      mancante: !exportOk
        ? !input.haCopySelezionato
          ? "Copy mancante per l'export"
          : "Titolo annuncio mancante per l'export"
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
