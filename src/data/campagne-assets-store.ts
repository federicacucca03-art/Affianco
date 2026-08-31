import type {
  BookingChannel,
  BookingConfirmationPolicy,
  Campagna,
  CampagnaObjective,
  EcommerceShippingMarket,
} from "@/types/campagne";
import type { ConversionRateSource } from "@/lib/conversion-rate";
import type { CreativitaMeta } from "@/lib/creativita";

const STORAGE_KEY = "affianco-campagne-assets";

/** Asset creativi / targeting salvati insieme alla campagna. */
export type CampagnaAssets = {
  elevatorPitch?: string;
  website?: string;
  varianteA?: string;
  varianteB?: string;
  varianteC?: string;
  pageId?: string;
  formId?: string;
  settore?: string;
  citta?: string;
  raggioKm?: number;
  etaMin?: number;
  etaMax?: number;
  titoloAnnuncio?: string;
  /** Margine di profitto target % (30/50/70). */
  targetMargin?: number;
  objective?: CampagnaObjective;
  bookingServiceValue?: number;
  showUpRate?: number;
  bookingChannel?: BookingChannel;
  bookingConfirmationPolicy?: BookingConfirmationPolicy;
  averageOrderValue?: number;
  productMargin?: number;
  /** CPA/CPL max salvato al lancio (stessa soglia del wizard). */
  maxSustainableCpa?: number;
  averageReceipt?: number;
  storeMargin?: number;
  recoveryValue?: number;
  recoveryMargin?: number;
  recoveryDiscount?: number;
  launchBudget?: number;
  awarenessRadiusKm?: number;
  estimatedCpm?: number;
  shippingMarket?: EcommerceShippingMarket;
  heroProduct?: string;
  /** Note di revisione richieste dal cliente. */
  revisionNotes?: string;
  /** Stato review (DRAFT / APPROVED / REVISION_REQUESTED). */
  reviewStatus?: string;
  /** Metadata creatività A/B (fino a 3), senza blob. */
  creativitaMeta?: CreativitaMeta[];
  /** LEADS: provenienza tasso di conversione. */
  conversionRateSource?: ConversionRateSource;
};

function leggiMappa(): Record<string, CampagnaAssets> {
  if (typeof window === "undefined") return {};
  try {
    const grezzo = window.localStorage.getItem(STORAGE_KEY);
    if (!grezzo) return {};
    const parsed = JSON.parse(grezzo) as Record<string, CampagnaAssets>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function salvaAssetCampagnaLocale(
  campagnaId: string,
  assets: CampagnaAssets,
): void {
  if (typeof window === "undefined") return;
  try {
    const mappa = leggiMappa();
    mappa[campagnaId] = { ...mappa[campagnaId], ...assets };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mappa));
  } catch {
    // Ignora quota / private mode.
  }
}

export function leggiAssetCampagnaLocale(
  campagnaId: string,
): CampagnaAssets | null {
  const assets = leggiMappa()[campagnaId];
  return assets ?? null;
}

/** Unisce campi campagna + asset locali (priorità ai valori già presenti). */
export function fondiCampagnaConAssetLocali(campagna: Campagna): Campagna {
  const locali = leggiAssetCampagnaLocale(campagna.id);
  if (!locali) return campagna;

  const noteDb = campagna.revisionNotes?.trim();
  const noteLocali = locali.revisionNotes?.trim();
  const notaValida = (n?: string) =>
    n && n !== "Nessuna nota aggiuntiva fornita." ? n : undefined;

  const revisionNotes =
    notaValida(noteDb) || notaValida(noteLocali) || undefined;

  const statusDb = (campagna.status ?? "").toUpperCase();
  const statusLocal = (locali.reviewStatus ?? "").toUpperCase();
  let status = campagna.status;
  if (statusDb === "REVISION_REQUESTED") {
    status = campagna.status;
  } else if (statusLocal === "REVISION_REQUESTED" && revisionNotes) {
    status = "REVISION_REQUESTED";
  } else if (!campagna.status && locali.reviewStatus) {
    status = locali.reviewStatus as Campagna["status"];
  }

  return {
    ...campagna,
    elevatorPitch: campagna.elevatorPitch || locali.elevatorPitch,
    website: campagna.website || locali.website,
    varianteA: campagna.varianteA || locali.varianteA,
    varianteB: campagna.varianteB || locali.varianteB,
    varianteC: campagna.varianteC || locali.varianteC,
    pageId: campagna.pageId || locali.pageId,
    formId: campagna.formId || locali.formId,
    settore: campagna.settore || locali.settore,
    citta: campagna.citta || locali.citta,
    raggioKm: campagna.raggioKm ?? locali.raggioKm,
    etaMin: campagna.etaMin ?? locali.etaMin,
    etaMax: campagna.etaMax ?? locali.etaMax,
    titoloAnnuncio: campagna.titoloAnnuncio || locali.titoloAnnuncio,
    targetMargin: campagna.targetMargin ?? locali.targetMargin,
    objective: campagna.objective ?? locali.objective,
    bookingServiceValue:
      campagna.bookingServiceValue ?? locali.bookingServiceValue,
    showUpRate: campagna.showUpRate ?? locali.showUpRate,
    bookingChannel: campagna.bookingChannel ?? locali.bookingChannel,
    bookingConfirmationPolicy:
      campagna.bookingConfirmationPolicy ?? locali.bookingConfirmationPolicy,
    averageOrderValue:
      campagna.averageOrderValue ?? locali.averageOrderValue,
    productMargin: campagna.productMargin ?? locali.productMargin,
    maxSustainableCpa:
      campagna.maxSustainableCpa ?? locali.maxSustainableCpa,
    averageReceipt: campagna.averageReceipt ?? locali.averageReceipt,
    storeMargin: campagna.storeMargin ?? locali.storeMargin,
    recoveryValue: campagna.recoveryValue ?? locali.recoveryValue,
    recoveryMargin: campagna.recoveryMargin ?? locali.recoveryMargin,
    recoveryDiscount: campagna.recoveryDiscount ?? locali.recoveryDiscount,
    launchBudget: campagna.launchBudget ?? locali.launchBudget,
    awarenessRadiusKm:
      campagna.awarenessRadiusKm ?? locali.awarenessRadiusKm,
    estimatedCpm: campagna.estimatedCpm ?? locali.estimatedCpm,
    shippingMarket: campagna.shippingMarket ?? locali.shippingMarket,
    heroProduct: campagna.heroProduct || locali.heroProduct,
    creativitaMeta:
      campagna.creativitaMeta?.some((c) => c.storagePath)
        ? campagna.creativitaMeta
        : locali.creativitaMeta?.length
          ? locali.creativitaMeta
          : campagna.creativitaMeta,
    conversionRateSource:
      campagna.conversionRateSource ?? locali.conversionRateSource,
    revisionNotes,
    status,
  };
}
