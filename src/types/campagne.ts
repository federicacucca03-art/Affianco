import type { ConversionRateSource } from "@/lib/conversion-rate";
import type { CreativitaMeta } from "@/lib/creativita";

export type Giudizio =
  | "Va bene"
  | "Ancora presto"
  | "Da monitorare"
  | "Da controllare";

export type SituazioneId =
  | "contatti"
  | "prenotazioni"
  | "vendite"
  | "negozio"
  | "recupero"
  | "apertura";

export type Situazione = {
  id: SituazioneId;
  titolo: string;
  esempio: string;
};

export type CampagnaStatus =
  | "DRAFT"
  | "APPROVED"
  | "REVISION_REQUESTED"
  | "ACTIVE"
  | "RUNNING"
  | string;

export type BadgeReviewCliente =
  | "In Attesa"
  | "Approvata"
  | "Revisione Richiesta";

export type CampagnaObjective =
  | "LEADS"
  | "BOOKINGS"
  | "ECOMMERCE"
  | "IN_STORE"
  | "RETARGETING"
  | "AWARENESS";

/** Canale con cui il cliente gestisce le prenotazioni. */
export type BookingChannel =
  | "WHATSAPP"
  | "BOOKING_LINK"
  | "PHONE_CALL"
  | "INSTAGRAM_DM"
  /** Legacy: modulo lead Meta (ancora letto da campagne vecchie). */
  | "LEAD_FORM";

/** Modalità di conferma appuntamento (BOOKINGS). */
export type BookingConfirmationPolicy =
  | "FREE_SMS_WHATSAPP"
  | "DEPOSIT_ONLINE"
  | "PAY_ON_SITE";

/** Tipo cliente target (Step 1 Wizard). */
export type TargetType = "B2C" | "B2B";

/** Fascia d'età prevalente (Step 1 Wizard). */
export type TargetAgeBand = "18-35" | "25-50" | "35-65+" | "all";

/** Origine pubblico caldo (RETARGETING — Passo 1). */
export type RetargetingAudienceSource =
  | "CART"
  | "WEBSITE"
  | "SOCIAL"
  | "LEADS_CRM";

/** Mercato geografico di spedizione (ECOMMERCE). */
export type EcommerceShippingMarket =
  | "ITALY"
  | "EUROPE"
  | "GLOBAL";

export function normalizzaShippingMarket(
  raw: string | null | undefined,
): EcommerceShippingMarket | undefined {
  const s = (raw ?? "").toUpperCase();
  if (s === "ITALY" || s === "ITALIA") return "ITALY";
  if (s === "EUROPE" || s === "EUROPA") return "EUROPE";
  if (
    s === "GLOBAL" ||
    s === "GLOBALE" ||
    s === "INTERNATIONAL" ||
    s === "REGIONAL" ||
    s === "WORLD"
  ) {
    return "GLOBAL";
  }
  return undefined;
}

export function etaDaTargetAgeBand(band: TargetAgeBand): {
  etaMin: number;
  etaMax: number;
} {
  switch (band) {
    case "18-35":
      return { etaMin: 18, etaMax: 35 };
    case "25-50":
      return { etaMin: 25, etaMax: 50 };
    case "35-65+":
      return { etaMin: 35, etaMax: 65 };
    default:
      return { etaMin: 18, etaMax: 65 };
  }
}

export function normalizzaTargetType(
  raw: string | null | undefined,
): TargetType | undefined {
  const s = (raw ?? "").toUpperCase();
  if (s === "B2B") return "B2B";
  if (s === "B2C") return "B2C";
  return undefined;
}

export function normalizzaTargetAgeBand(
  raw: string | null | undefined,
): TargetAgeBand | undefined {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "18-35") return "18-35";
  if (s === "25-50") return "25-50";
  if (s === "35-65+" || s === "35-65") return "35-65+";
  if (s === "all" || s === "tutte" || s === "tutte le età") return "all";
  return undefined;
}

/** Normalizza objective DB (LEAD_GEN legacy → LEADS). */
export function normalizzaObjective(
  raw: string | null | undefined,
): CampagnaObjective {
  const s = (raw ?? "").toUpperCase();
  if (s === "BOOKINGS") return "BOOKINGS";
  if (s === "ECOMMERCE" || s === "SALES" || s === "PURCHASE") return "ECOMMERCE";
  if (
    s === "IN_STORE" ||
    s === "DRIVE_TO_STORE" ||
    s === "STORE_TRAFFIC" ||
    s === "FOOT_TRAFFIC"
  ) {
    return "IN_STORE";
  }
  if (
    s === "RETARGETING" ||
    s === "REMARKETING" ||
    s === "CART_RECOVERY" ||
    s === "RECOVERY"
  ) {
    return "RETARGETING";
  }
  if (
    s === "AWARENESS" ||
    s === "LAUNCH" ||
    s === "EVENT" ||
    s === "INAUGURATION" ||
    s === "REACH"
  ) {
    return "AWARENESS";
  }
  return "LEADS";
}

export type Campagna = {
  id: string;
  nomeCliente: string;
  iniziali: string;
  stato: string;
  giudizio: Giudizio;
  /** Obiettivo Meta / Ally (LEADS | BOOKINGS | ECOMMERCE | IN_STORE | RETARGETING | AWARENESS). */
  objective?: CampagnaObjective;
  /** Nome campagna Meta / Ally. */
  nomeCampagna?: string;
  settore?: string;
  citta?: string;
  budgetGiornaliero?: number;
  /** ISO date di lancio. */
  dataLancio?: string;
  scontrinoMedio?: number;
  tassoConversionePercent?: number;
  /** BOOKINGS: valore medio prima visita/servizio (€). */
  bookingServiceValue?: number;
  /** BOOKINGS: show-up rate % (default 75). */
  showUpRate?: number;
  /** BOOKINGS: canale prenotazione. */
  bookingChannel?: BookingChannel;
  /** BOOKINGS: politica di conferma / caparra. */
  bookingConfirmationPolicy?: BookingConfirmationPolicy;
  /** ECOMMERCE: scontrino medio carrello AOV (€). */
  averageOrderValue?: number;
  /** ECOMMERCE: margine lordo prodotto (%). */
  productMargin?: number;
  /** IN_STORE: scontrino medio in cassa (€). */
  averageReceipt?: number;
  /** IN_STORE: margine lordo medio prodotti fisici (%). */
  storeMargin?: number;
  /** RETARGETING: valore medio contatto/carrello da recuperare (€). */
  recoveryValue?: number;
  /** RETARGETING: margine lordo (%). */
  recoveryMargin?: number;
  /** RETARGETING: incentivo/sconto offerto (%), opzionale. */
  recoveryDiscount?: number;
  /** AWARENESS: budget totale di lancio (€). */
  launchBudget?: number;
  /** AWARENESS: raggio geografico dal punto vendita (km). */
  awarenessRadiusKm?: number;
  /** AWARENESS: CPM stimato area locale (€ / 1.000 impressions). */
  estimatedCpm?: number;
  /** Brief / elevator pitch cliente. */
  elevatorPitch?: string;
  website?: string;
  varianteA?: string;
  varianteB?: string;
  varianteC?: string;
  pageId?: string;
  formId?: string;
  raggioKm?: number;
  etaMin?: number;
  etaMax?: number;
  titoloAnnuncio?: string;
  /** Stato grezzo Supabase (DRAFT, APPROVED, REVISION_REQUESTED, …). */
  status?: CampagnaStatus;
  /** Margine di profitto target % (30 | 50 | 70). */
  targetMargin?: number;
  /** ISO timestamp approvazione cliente. */
  approvedAt?: string;
  /** Note di revisione richieste dal cliente. */
  revisionNotes?: string;
  /**
   * Token pubblico approval (owner-only in select app).
   * NON è la capability esposta dalle RPC pubbliche (non restituito).
   */
  approvalToken?: string;
  /** Offerta d'ingresso / gancio (front-end offer). */
  frontEndOffer?: string;
  /** Tipo cliente: B2C o B2B. */
  targetType?: TargetType;
  /** Fascia d'età prevalente. */
  targetAge?: TargetAgeBand;
  /** RETARGETING: origine del pubblico caldo. */
  retargetingAudienceSource?: RetargetingAudienceSource;
  /** ECOMMERCE: mercato di spedizione. */
  shippingMarket?: EcommerceShippingMarket;
  /** ECOMMERCE: prodotto hero / collezione promossa. */
  heroProduct?: string;
  /**
   * CPA/CPL massimo sostenibile salvato al lancio (colonna DB max_sustainable_cpa).
   * Per ECOMMERCE = CPA Max break-even da famiglia W del wizard.
   */
  maxSustainableCpa?: number;
  /**
   * Provenienza del tasso di conversione LEADS (colonna conversion_rate_source).
   * REAL | ESTIMATED | UNKNOWN. Non è un giudizio di qualità.
   */
  conversionRateSource?: ConversionRateSource;
  /** Metadata creatività A/B (fino a 3 immagini). */
  creativitaMeta?: CreativitaMeta[];
};

/** Badge review per lista / dashboard. */
export function badgeReviewDaStatus(
  status: string | undefined | null,
): BadgeReviewCliente {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED") return "Approvata";
  if (s === "REVISION_REQUESTED") return "Revisione Richiesta";
  return "In Attesa";
}

/** Etichetta breve per lista campagne (data · obiettivo · status). */
export function etichettaStatusCampagna(
  status: string | undefined | null,
): string {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED") return "Approvata";
  if (s === "REVISION_REQUESTED") return "Revisione richiesta";
  if (s === "ACTIVE" || s === "RUNNING") return "Attiva";
  if (s === "DRAFT" || !s) return "Bozza";
  return s;
}

export function formatDataBreve(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDataApprovazione(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type ConfigurazioneContatti = {
  nomeCliente: string;
  nomeCampagna: string;
  budgetGiornaliero: number;
  cboAttivo: boolean;
  raggioKm: number;
  etaMin: number;
  etaMax: number;
  genere: "Tutti" | "Donne" | "Uomini";
  targetingBroad: boolean;
  posizionamentiAdvantage: boolean;
  varianteA: string;
  varianteB: string;
  varianteC: string;
  titoloAnnuncio: string;
  /** Scontrino medio / valore vendita cliente (€). Opzionale. */
  scontrinoMedio: number;
  /** Tasso di conversione stimato lead → cliente (%). Default 10. */
  tassoConversionePercent: number;
};
