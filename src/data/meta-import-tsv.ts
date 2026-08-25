import type {
  BookingChannel,
  CampagnaObjective,
  ConfigurazioneContatti,
  TargetType,
} from "@/types/campagne";
import type { CreativitaMeta } from "@/lib/creativita";
import { etichetteCreativitaPerObiettivo } from "@/lib/creativita";
import { nomeCampagnaRetargeting } from "@/data/defaults-contatti";
import { isUrlMapsIndicazioni } from "@/lib/url-maps";

const LINK_ATTRAGGIO = "https://www.google.com";

/**
 * CSV Anti-Fuffa per Importa file in blocco (Meta Ads Manager).
 * Una riga = un annuncio. Tre righe = Variante A / B / C sullo stesso Ad Set.
 */
const INTESTAZIONI = [
  "Campaign Name",
  "Campaign Status",
  "Campaign Objective",
  "Buying Type",
  "Special Ad Categories",
  "Campaign Daily Budget",
  "Budget Type",
  "Ad Set Name",
  "Ad Set Run Status",
  "Destination Type",
  "Optimization Goal",
  "Conversion Event",
  "Billing Event",
  "Age Min",
  "Age Max",
  "Gender",
  "Countries",
  "Cities",
  "Location Types",
  "Radius",
  "Distance Unit",
  "Publisher Platforms",
  "Facebook Positions",
  "Instagram Positions",
  "Device Platforms",
  "Advantage Audience",
  "Advantage+ Placement",
  "Ad Name",
  "Ad Status",
  "Creative Type",
  "Image File Name",
  "Link Object ID",
  "Lead Form ID",
  "Body",
  "Title",
  "Link",
  "Call to Action",
  "Display Link",
  "Use Advantage+ Creative",
  "Standard Enhancements",
  "Add Music Automatically",
  "Video Auto Crop",
  "Text Optimizations",
  "Image Touchups",
  "Enhance CTA",
  "Inline Comment",
  "Image Templates",
  "Creative Automation Features",
] as const;

export type OpzioniExportMetaCsv = {
  citta?: string;
  pageId?: string;
  formId?: string;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  creativitaMeta?: CreativitaMeta[];
  /** URL destinazione (sito / calendario prenotazioni). */
  destinationUrl?: string;
  /** Numero WhatsApp Business (solo nota / display). */
  whatsappNumber?: string;
  /** RETARGETING: B2B → LEARN_MORE, altrimenti SHOP_NOW. */
  targetType?: TargetType;
};

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function genereMeta(genere: ConfigurazioneContatti["genere"]): string {
  if (genere === "Donne") return "Women";
  if (genere === "Uomini") return "Men";
  return "All";
}

function cittaMeta(citta?: string): string {
  const c = citta?.trim();
  if (!c) return "Italy";
  if (/italy|italia/i.test(c)) return c;
  return `${c}, Italy`;
}

type VarianteRiga = {
  id: "A" | "B" | "C";
  etichetta: string;
  testo: string;
};

function profiloObiettivo(
  objective: CampagnaObjective,
  bookingChannel?: BookingChannel,
  targetType?: TargetType,
  destinationUrl?: string,
) {
  if (objective === "ECOMMERCE") {
    return {
      campaignNameFallback: "Vendite Online",
      campaignObjective: "Outcome Sales",
      destinationType: "WEBSITE",
      optimizationGoal: "OFFSITE_CONVERSIONS",
      callToAction: "SHOP_NOW",
      titleDefault: "Acquista ora",
      includeLeadForm: false,
      conversionEvent: "PURCHASE",
      adSetNamePrefix: "AdSet",
    };
  }
  if (objective === "IN_STORE") {
    return {
      campaignNameFallback: "Traffico Negozio",
      campaignObjective: "Outcome Traffic",
      destinationType: "WEBSITE",
      optimizationGoal: "LINK_CLICKS",
      callToAction: "GET_DIRECTIONS",
      titleDefault: "Ottieni indicazioni",
      includeLeadForm: false,
      conversionEvent: "",
      adSetNamePrefix: "AdSet Locale",
    };
  }
  if (objective === "RETARGETING") {
    const isB2bLead = targetType === "B2B";
    return {
      campaignNameFallback: "Retargeting / Recupero",
      campaignObjective: isB2bLead ? "Outcome Leads" : "Outcome Sales",
      destinationType: "WEBSITE",
      optimizationGoal: "OFFSITE_CONVERSIONS",
      callToAction: isB2bLead ? "LEARN_MORE" : "SHOP_NOW",
      titleDefault: isB2bLead ? "Scopri di più" : "Completa l'ordine",
      includeLeadForm: false,
      conversionEvent: isB2bLead ? "LEAD" : "PURCHASE",
      adSetNamePrefix: "AdSet Retargeting",
    };
  }
  if (objective === "AWARENESS") {
    const url = (destinationUrl ?? "").trim();
    const hasUrl = Boolean(url);
    const isMaps = hasUrl && isUrlMapsIndicazioni(url);
    return {
      campaignNameFallback: "Apertura / Lancio Locale",
      campaignObjective: "Outcome Awareness",
      destinationType: "WEBSITE",
      optimizationGoal: hasUrl ? "LINK_CLICKS" : "REACH",
      callToAction: isMaps ? "GET_DIRECTIONS" : "LEARN_MORE",
      titleDefault: isMaps ? "Ottieni indicazioni" : "Scopri di più",
      includeLeadForm: false,
      conversionEvent: "",
      adSetNamePrefix: "AdSet Awareness Locale - Raggio Stretto",
    };
  }
  if (objective === "BOOKINGS") {
    const channel = bookingChannel ?? "WHATSAPP";
    if (channel === "WHATSAPP") {
      return {
        campaignNameFallback: "Prenotazioni",
        campaignObjective: "Outcome Engagement",
        destinationType: "MESSAGING",
        optimizationGoal: "CONVERSATIONS",
        callToAction: "SEND_WHATSAPP_MESSAGE",
        titleDefault: "Invia un messaggio su WhatsApp",
        includeLeadForm: false,
        conversionEvent: "",
        adSetNamePrefix: "AdSet Locale",
      };
    }
    if (channel === "BOOKING_LINK") {
      return {
        campaignNameFallback: "Prenotazioni",
        campaignObjective: "Outcome Traffic",
        destinationType: "WEBSITE",
        optimizationGoal: "LINK_CLICKS",
        callToAction: "BOOK_NOW",
        titleDefault: "Prenota subito",
        includeLeadForm: false,
        conversionEvent: "",
        adSetNamePrefix: "AdSet Locale",
      };
    }
    if (channel === "PHONE_CALL") {
      return {
        campaignNameFallback: "Prenotazioni",
        campaignObjective: "Outcome Leads",
        destinationType: "PHONE_CALL",
        optimizationGoal: "QUALITY_CALL",
        callToAction: "CALL_NOW",
        titleDefault: "Chiama ora",
        includeLeadForm: false,
        conversionEvent: "",
        adSetNamePrefix: "AdSet Locale",
      };
    }
    if (channel === "INSTAGRAM_DM") {
      return {
        campaignNameFallback: "Prenotazioni",
        campaignObjective: "Outcome Engagement",
        destinationType: "MESSAGING",
        optimizationGoal: "CONVERSATIONS",
        callToAction: "MESSAGE_PAGE",
        titleDefault: "Invia un messaggio",
        includeLeadForm: false,
        conversionEvent: "",
        adSetNamePrefix: "AdSet Locale",
      };
    }
    // LEAD_FORM (legacy)
    return {
      campaignNameFallback: "Prenotazioni",
      campaignObjective: "Outcome Leads",
      destinationType: "ON_AD",
      optimizationGoal: "LEAD_GENERATION",
      callToAction: "SIGN_UP",
      titleDefault: "Richiedi Appuntamento",
      includeLeadForm: true,
      conversionEvent: "",
      adSetNamePrefix: "AdSet Locale",
    };
  }

  return {
    campaignNameFallback: "Richieste Contatto",
    campaignObjective: "Outcome Leads",
    destinationType: "ON_AD",
    optimizationGoal: "LEAD_GENERATION",
    callToAction: "SIGN_UP",
    titleDefault: "Richiedi informazioni",
    includeLeadForm: true,
    conversionEvent: "",
    adSetNamePrefix: "AdSet Locale",
  };
}

function assetPerVariante(
  varianteId: "A" | "B" | "C",
  creativitaMeta?: CreativitaMeta[],
): CreativitaMeta | undefined {
  if (!creativitaMeta?.length) return undefined;
  const indice = varianteId === "A" ? 0 : varianteId === "B" ? 1 : 2;
  return creativitaMeta[indice] ?? creativitaMeta[0];
}

function commentoCreativita(
  asset?: CreativitaMeta,
  objective?: CampagnaObjective,
): string {
  if (!asset) return "OPT_OUT";
  const dims = `${asset.width}x${asset.height}`;
  const etichette = etichetteCreativitaPerObiettivo(objective);
  const etichetta = etichette[asset.ruolo];
  const avviso = asset.formatoOrizzontale
    ? " · formato orizzontale"
    : asset.avvisoFormato
      ? " · formato da ottimizzare"
      : "";
  return `${etichetta}: ${asset.nomeFile} (${dims})${avviso}`;
}

function rigaAnnuncio(
  config: ConfigurazioneContatti,
  variante: VarianteRiga,
  opzioni: OpzioniExportMetaCsv,
): string[] {
  const citta = opzioni.citta?.trim() || "";
  const pageId = opzioni.pageId?.trim() || "";
  const formId = opzioni.formId?.trim() || "";
  const budget = config.budgetGiornaliero || 20;
  const raggio = config.raggioKm || 20;
  const profilo = profiloObiettivo(
    opzioni.objective ?? "LEADS",
    opzioni.bookingChannel,
    opzioni.targetType,
    opzioni.destinationUrl,
  );
  const asset = assetPerVariante(variante.id, opzioni.creativitaMeta);
  const destUrl = (() => {
    const custom = (opzioni.destinationUrl ?? "").trim();
    if (custom) return custom;
    if (
      opzioni.objective === "BOOKINGS" &&
      opzioni.bookingChannel === "WHATSAPP"
    ) {
      return "";
    }
    // AWARENESS senza destinazione: mai google.com (placeholder legacy).
    if (opzioni.objective === "AWARENESS") {
      return "";
    }
    return LINK_ATTRAGGIO;
  })();
  const displayLink = (() => {
    const wa = (opzioni.whatsappNumber ?? "").trim();
    if (
      opzioni.objective === "BOOKINGS" &&
      opzioni.bookingChannel === "WHATSAPP" &&
      wa
    ) {
      return wa.startsWith("http") ? wa : `https://wa.me/${wa.replace(/\D/g, "")}`;
    }
    return "";
  })();

  const mercatoAdSet = citta || "Italia";
  const nomeClientePulito = (config.nomeCliente ?? "").trim();
  const campaignName =
    opzioni.objective === "RETARGETING"
      ? nomeCampagnaRetargeting(nomeClientePulito)
      : config.nomeCampagna?.trim() || profilo.campaignNameFallback;
  const adSetName =
    opzioni.objective === "ECOMMERCE"
      ? `${profilo.adSetNamePrefix} - ${mercatoAdSet}`
      : opzioni.objective === "RETARGETING"
        ? nomeClientePulito
          ? `AdSet Retargeting - ${nomeClientePulito}`
          : "AdSet Retargeting - Custom Audience"
        : `${profilo.adSetNamePrefix} - ${mercatoAdSet} (${raggio} km)`;

  return [
    campaignName,
    "PAUSED",
    profilo.campaignObjective,
    "AUCTION",
    "",
    String(budget),
    "Daily",
    adSetName,
    "PAUSED",
    profilo.destinationType,
    profilo.optimizationGoal,
    profilo.conversionEvent,
    "IMPRESSIONS",
    String(config.etaMin ?? 25),
    String(config.etaMax ?? 65),
    genereMeta(config.genere),
    "IT",
    cittaMeta(citta),
    "home",
    String(raggio),
    "kilometer",
    "facebook,instagram",
    "feed,facebook_reels,story",
    "stream,story,reels",
    "mobile,desktop",
    "0",
    config.posizionamentiAdvantage ? "1" : "0",
    `Annuncio ${variante.etichetta}${asset ? ` · ${asset.nomeFile}` : ""}`,
    "PAUSED",
    "Link Page Post Ad",
    asset?.nomeFile ?? "",
    pageId,
    profilo.includeLeadForm ? formId : "",
    variante.testo,
    config.titoloAnnuncio?.trim() || profilo.titleDefault,
    destUrl,
    profilo.callToAction,
    displayLink,
    "0",
    "OPT_OUT",
    "OPT_OUT",
    "OPT_OUT",
    "OPT_OUT",
    "OPT_OUT",
    "OPT_OUT",
    commentoCreativita(asset, opzioni.objective),
    "OPT_OUT",
    "OPT_OUT",
  ];
}

export function generaCodiceImportMeta(
  config: ConfigurazioneContatti,
  citta?: string,
  pageId = "",
  formId = "",
  objective: CampagnaObjective = "LEADS",
  bookingChannel?: BookingChannel,
  creativitaMeta?: CreativitaMeta[],
  destinationUrl?: string,
  whatsappNumber?: string,
  targetType?: TargetType,
): string {
  const opzioni: OpzioniExportMetaCsv = {
    citta,
    pageId,
    formId,
    objective,
    bookingChannel,
    creativitaMeta,
    destinationUrl,
    whatsappNumber,
    targetType,
  };

  const etichette =
    objective === "ECOMMERCE"
      ? ([
          "Variante A - Offerta Lancio",
          "Variante B - Urgenza",
          "Variante C - Social Proof",
        ] as const)
      : objective === "IN_STORE"
        ? ([
            "Variante A - Coupon Cassa",
            "Variante B - Evento / Nuovi Arrivi",
            "Variante C - Esclusività Locale",
          ] as const)
        : objective === "RETARGETING"
          ? ([
              "Variante A - Incentivo Carrello",
              "Variante B - Obiezioni & Garanzia",
              "Variante C - Social Proof & Fomo",
            ] as const)
          : objective === "AWARENESS"
            ? ([
                "Variante A - Inaugurazione",
                "Variante B - Teaser",
                "Variante C - Benvenuto",
              ] as const)
            : objective === "BOOKINGS"
              ? ([
                  "Variante A - Scarsità Agenda",
                  "Variante B - Promo Primo Ingresso",
                  "Variante C - Garanzia Zero Anticipo",
                ] as const)
              : ([
                  "Variante A - Beneficio Diretto & Promo",
                  "Variante B - Autorevolezza & Garanzia",
                  "Variante C - Empatico & Risoluzione Problema",
                ] as const);

  const varianti: VarianteRiga[] = (
    [
      {
        id: "A",
        etichetta: etichette[0],
        testo: (config.varianteA ?? "").trim(),
      },
      {
        id: "B",
        etichetta: etichette[1],
        testo: (config.varianteB ?? "").trim(),
      },
      {
        id: "C",
        etichetta: etichette[2],
        testo: (config.varianteC ?? "").trim(),
      },
    ] as const satisfies readonly VarianteRiga[]
  ).filter((v) => v.testo.length > 0);

  const daEsportare =
    varianti.length > 0
      ? varianti
      : [
          {
            id: "A" as const,
            etichetta: etichette[0],
            testo: "Inserisci il testo della Variante A prima dell'export.",
          },
        ];

  const intestazione = INTESTAZIONI.map(escapeCsv).join(",");
  const righe = daEsportare.map((v) =>
    rigaAnnuncio(config, v, opzioni).map(escapeCsv).join(","),
  );

  return `\uFEFF${intestazione}\n${righe.join("\n")}`;
}

export function scaricaFileMetaCsv(
  csvContent: string,
  nomeFile = "campagna_meta_antifuffa.csv",
): void {
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Label CTA mockup in base a obiettivo / canale. */
export function ctaLabelDaBookingChannel(
  channel?: BookingChannel,
): string {
  if (channel === "WHATSAPP") return "Invia un messaggio su WhatsApp";
  if (channel === "BOOKING_LINK") return "Prenota subito";
  if (channel === "PHONE_CALL") return "Chiama ora";
  if (channel === "INSTAGRAM_DM") return "Invia un messaggio";
  if (channel === "LEAD_FORM") return "Iscriviti / Richiedi Appuntamento";
  return "Prenota subito";
}

export function ctaLabelDaObjective(
  objective?: CampagnaObjective,
  bookingChannel?: BookingChannel,
  options?: { hasSede?: boolean; isMapsUrl?: boolean },
): string {
  if (objective === "ECOMMERCE") return "Acquista ora";
  if (objective === "IN_STORE") return "Ottieni indicazioni";
  if (objective === "RETARGETING") return "Completa l'ordine";
  if (objective === "AWARENESS") {
    return options?.isMapsUrl ? "Ottieni indicazioni" : "Scopri di più";
  }
  if (objective === "BOOKINGS") return ctaLabelDaBookingChannel(bookingChannel);
  return "Iscriviti";
}
