"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type {
  BookingChannel,
  BookingConfirmationPolicy,
  CampagnaObjective,
  ConfigurazioneContatti,
  EcommerceShippingMarket,
  RetargetingAudienceSource,
  TargetAgeBand,
  TargetType,
} from "@/types/campagne";
import type { VarianteCopy } from "@/data/varianti-copy";
import { hookMobileCompleto, metaVarianti, type TonoVoce } from "@/data/varianti-copy";
import { analizzaControlloMessaggioLeads } from "@/lib/controllo-messaggio";
import { analizzaControlloMessaggioBookings } from "@/lib/controllo-messaggio-bookings";
import { analizzaControlloMessaggioEcommerce } from "@/lib/controllo-messaggio-ecommerce";
import { analizzaControlloMessaggioInstore } from "@/lib/controllo-messaggio-instore";
import { analizzaControlloMessaggioRetargeting } from "@/lib/controllo-messaggio-retargeting";
import { analizzaControlloMessaggioAwareness } from "@/lib/controllo-messaggio-awareness";
import {
  type ConversionRateSource,
  tassoConversioneLeadsValido,
} from "@/lib/conversion-rate";
import { ControlloMessaggio } from "@/components/nuova-contatti/ControlloMessaggio";
import {
  BadgeCopyVariant,
  CopyRecommendationCard,
} from "@/components/nuova-contatti/CopyRecommendationCard";
import { raccomandaCopy, scambiaVariantePrimaria, statusCopyVariant } from "@/lib/raccomanda-copy";
import { ChevronDown, CircleCheck, Info, ShieldAlert } from "lucide-react";
import { MetaAdsImportCode } from "@/components/nuova-contatti/MetaAdsImportCode";
import type { StatoApprovazioneLeads } from "@/components/nuova-contatti/StatoApprovazioneLeads";
import {
  creativitaToMeta,
  type CreativitaAsset,
  type EcommerceCreativoFormato,
} from "@/lib/creativita";
import { validateElevatorPitch } from "@/lib/validate-elevator-pitch";
import {
  calculateBreakEvenPerBooking,
  calculateBreakEvenPerLead,
  calculateEcommerceBreakEvenRoas,
  calculateEcommerceCpaMax,
  calculateEcommerceMargineNetto,
  calculateEcommerceTargetRoas,
  calculateImpressionsAwareness,
  calculateLtvEconomics,
  calculateMaxSustainableBookingCpa,
  calculateMaxSustainableCpl,
  calculateMaxSustainableInStoreCpa,
  calculateMaxSustainableRecoveryCpa,
  calculatePersoneUnicheAwareness,
  calculateUtilePerScontrino,
  calculateValoreNettoRecupero,
} from "@/lib/benchmarks";
import { Interruttore } from "@/components/nuova-contatti/Interruttore";
import { StudioCreativo } from "@/components/nuova-contatti/StudioCreativo";
import { BarraBreakEven } from "@/components/nuova-contatti/BarraBreakEven";
import { BarraRoasEcommerce } from "@/components/nuova-contatti/BarraRoasEcommerce";
import { alertFattibilitaNicchia } from "@/lib/fattibilita-nicchia";
import {
  etichettaObiettivo,
  type WizardStep,
} from "@/lib/pre-lancio-check";
import { SelettoreClienteEsistente } from "@/components/nuova-contatti/SelettoreClienteEsistente";
import { SelettoreSettore } from "@/components/nuova-contatti/SelettoreSettore";
import type { Cliente } from "@/types/clienti";
import type { DeconstructAdResult } from "@/types/deconstruct-ad";
import { BottoneCompilaAffianco } from "@/components/nuova-contatti/BottoneCompilaAffianco";
import { AffiancoSuggerisce } from "@/components/nuova-contatti/AffiancoSuggerisce";
import {
  InlineGuidance,
  guidanceInlineBrief,
  guidanceInlineBudgetRaggio,
  guidanceInlineCitta,
  guidanceInlineEta,
  guidanceInlineOfferta,
  guidanceInlineRaggio,
  guidanceInlineTargetType,
  guidanceStep1NonInline,
} from "@/components/nuova-contatti/InlineGuidance";
import { LegendaCplDidattica } from "@/components/nuova-contatti/LegendaCplDidattica";
import { SpiegazioneCalcoloCpl } from "@/components/nuova-contatti/SpiegazioneCalcoloCpl";
import {
  generaGuidanceEconomica,
  generaGuidanceStep1,
  generaGuidanceTargeting,
  type RaccomandazioneLancioStato,
} from "@/lib/guidance";
import { consiglioStrategicoNicchia } from "@/lib/consiglio-nicchia";
import { testiPasso1Wizard } from "@/data/wizard-step1-config";
import {
  riferimentoAstaMeta,
  type SettoreIntel,
  type SuggerimentoSettore,
} from "@/lib/sector-intel";

type Props = {
  config: ConfigurazioneContatti;
  onCambia: (prossimo: ConfigurazioneContatti) => void;
  varianti?: VarianteCopy[];
  citta?: string;
  settore?: string;
  onCambiaCitta?: (valore: string) => void;
  onCambiaSettore?: (valore: string) => void;
  creativita: CreativitaAsset[];
  indiceAnteprimaCreativita: number;
  onCambiaCreativita: (lista: CreativitaAsset[]) => void;
  onCambiaIndiceAnteprimaCreativita: (indice: number) => void;
  pageId: string;
  formId: string;
  onCambiaPageId: (valore: string) => void;
  onCambiaFormId: (valore: string) => void;
  /** Formato creativo E-commerce (Passo 4). */
  formatoEcommerce?: EcommerceCreativoFormato;
  onCambiaFormatoEcommerce?: (formato: EcommerceCreativoFormato) => void;
  /** Numero WhatsApp Business (BOOKINGS + WHATSAPP). */
  whatsappNumber?: string;
  onCambiaWhatsappNumber?: (valore: string) => void;
  /** ID campagna già salvata (per log export Meta). */
  campaignId?: string | null;
  scontrinoMedio: number | string;
  tassoConversione: number | string;
  onCambiaScontrinoMedio: (valore: number | string) => void;
  onCambiaTassoConversione: (valore: number | string) => void;
  conversionRateSource?: ConversionRateSource;
  onCambiaConversionRateSource?: (valore: ConversionRateSource) => void;
  elevatorPitch: string;
  onCambiaElevatorPitch: (valore: string) => void;
  sitoWeb: string;
  onCambiaSitoWeb: (valore: string) => void;
  frontEndOffer?: string;
  onCambiaFrontEndOffer?: (valore: string) => void;
  shippingMarket?: EcommerceShippingMarket;
  onCambiaShippingMarket?: (valore: EcommerceShippingMarket) => void;
  heroProduct?: string;
  onCambiaHeroProduct?: (valore: string) => void;
  targetType?: TargetType;
  onCambiaTargetType?: (valore: TargetType) => void;
  targetAge?: TargetAgeBand;
  onCambiaTargetAge?: (valore: TargetAgeBand) => void;
  /** RETARGETING: origine pubblico caldo. */
  retargetingAudienceSource?: RetargetingAudienceSource;
  onCambiaRetargetingAudienceSource?: (
    valore: RetargetingAudienceSource,
  ) => void;
  /** AWARENESS: data inaugurazione / evento (opzionale). */
  dataEventoApertura?: string;
  onCambiaDataEventoApertura?: (valore: string) => void;
  tonoVoce?: TonoVoce;
  onCambiaTonoVoce?: (valore: TonoVoce) => void;
  onRigeneraVarianti?: () => void;
  /** Dopo swap B/C → A: reset preview tab (solo LEADS). */
  onDopoSwapVariante?: () => void;
  copyAiLoading?: boolean;
  targetMargin: 30 | 50 | 70;
  onCambiaTargetMargin: (valore: 30 | 50 | 70) => void;
  objective?: CampagnaObjective;
  bookingChannel?: BookingChannel;
  onCambiaBookingChannel?: (valore: BookingChannel) => void;
  bookingConfirmationPolicy?: BookingConfirmationPolicy;
  onCambiaBookingConfirmationPolicy?: (
    valore: BookingConfirmationPolicy,
  ) => void;
  productMargin?: number | string;
  onCambiaProductMargin?: (valore: number | string) => void;
  /** Costo spedizione & fulfillment a carico dello store (€). */
  fulfillmentCost?: number | string;
  onCambiaFulfillmentCost?: (valore: number | string) => void;
  /** Boost LTV / riacquisto 60 giorni (+20% al margine di acquisizione). */
  ecommerceLtvAttivo?: boolean;
  onCambiaEcommerceLtvAttivo?: (attivo: boolean) => void;
  recoveryDiscount?: number | string;
  onCambiaRecoveryDiscount?: (valore: number | string) => void;
  launchBudget?: number | string;
  onCambiaLaunchBudget?: (valore: number | string) => void;
  estimatedCpm?: number | string;
  onCambiaEstimatedCpm?: (valore: number | string) => void;
  /** Analisi Avanzata LTV (Modello Business Ricorrente). */
  ltvAttivo?: boolean;
  onCambiaLtvAttivo?: (attivo: boolean) => void;
  frequenzaAnnuale?: number | string;
  onCambiaFrequenzaAnnuale?: (valore: number | string) => void;
  anniPermanenza?: number | string;
  onCambiaAnniPermanenza?: (valore: number | string) => void;
  loyaltyPercent?: number | string;
  onCambiaLoyaltyPercent?: (valore: number | string) => void;
  margineLordoLtv?: number | string;
  onCambiaMargineLordoLtv?: (valore: number | string) => void;
  /** Se impostato, mostra solo le sezioni del passo wizard. */
  wizardStep?: WizardStep;
  /** Evidenzia campi obbligatori falliti al Passo 1. */
  erroriPasso1?: {
    nomeCliente?: boolean;
    frontEndOffer?: boolean;
    elevatorPitch?: boolean;
  };
  settoreIntel?: SettoreIntel | null;
  sectorIntelLoading?: boolean;
  onSelezionaSettore?: (suggerimento: SuggerimentoSettore) => void;
  onCaricaClienteEsistente?: (cliente: Cliente) => void;
  clienteCaricatoId?: string | null;
  salvaClientePreferito?: boolean;
  onCambiaSalvaClientePreferito?: (valore: boolean) => void;
  formatoCuratoId?: string | null;
  onSelezionaFormatoCurato?: (id: string | null) => void;
  deconstructResult?: DeconstructAdResult | null;
  onDeconstructResult?: (risultato: DeconstructAdResult | null) => void;
  /** LEADS richieste-contatto: bozza copy in preparazione (solo presentazione). */
  copyInPreparazione?: boolean;
  copyPreparazioneNota?: string | null;
  /** LEADS step 6: stato approvazione cliente per export Meta. */
  statoApprovazioneLeads?: StatoApprovazioneLeads;
  revisionNotesCliente?: string | null;
  /** Decisione di lancio: solo copy/CTA export, non blocca l'approval. */
  statoLancio?: RaccomandazioneLancioStato;
  /** BOOKINGS prenotazioni: posti settimana (solo UI, non persistito). */
  postiDisponibiliSettimana?: string;
  onCambiaPostiDisponibiliSettimana?: (valore: string) => void;
};

const CANALI_PRENOTAZIONE: {
  value: BookingChannel;
  label: string;
  hint?: string;
}[] = [
  {
    value: "WHATSAPP",
    label: "💬 WhatsApp Diretto",
    hint: "Consigliato per saloni, estetisti e personal trainer",
  },
  {
    value: "BOOKING_LINK",
    label: "📅 Software di Prenotazione / Sito Web",
    hint: "Es. Calendly, Treatwell, Widget interno",
  },
  {
    value: "PHONE_CALL",
    label: "📞 Chiamata Telefonica Diretta",
  },
  {
    value: "INSTAGRAM_DM",
    label: "📩 Messaggio Direct Instagram / Facebook",
  },
];

const POLITICHE_CONFERMA: {
  value: BookingConfirmationPolicy;
  label: string;
}[] = [
  {
    value: "FREE_SMS_WHATSAPP",
    label: "Gratuito con conferma via SMS/WhatsApp",
  },
  {
    value: "DEPOSIT_ONLINE",
    label: "Caparra confirmatoria online (€)",
  },
  {
    value: "PAY_ON_SITE",
    label: "Pagamento completo in sede",
  },
];

const MERCATI_SPEDIZIONE: {
  value: EcommerceShippingMarket;
  label: string;
}[] = [
  { value: "ITALY", label: "🇮🇹 Italia Intera" },
  { value: "EUROPE", label: "🇪🇺 Europa" },
  { value: "GLOBAL", label: "🌍 Globale" },
];

const AUDIENZE_RETARGETING: {
  value: RetargetingAudienceSource;
  label: string;
  hint: string;
}[] = [
  {
    value: "CART",
    label: "🛒 Carrelli Abbandonati / Checkout Iniziato",
    hint: "Finestra ideale: 7-14 giorni",
  },
  {
    value: "WEBSITE",
    label: "🌐 Visitatori del Sito / Schede Prodotto",
    hint: "Finestra ideale: 30-60 giorni",
  },
  {
    value: "SOCIAL",
    label: "📲 Interazioni Social (IG / FB Page)",
    hint: "Finestra ideale: 30-90 giorni",
  },
  {
    value: "LEADS_CRM",
    label: "📋 Contatti / Lead Caldi non ancora convertiti",
    hint: "Database / CRM",
  },
];

function Passo1Sezione({
  titolo,
  children,
}: {
  titolo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="aff-panel-white space-y-[22px] p-5 sm:p-6">
      <div>
        <p className="text-[13px] font-medium text-[var(--primary)]">{titolo}</p>
        <div className="mt-3 h-px bg-[rgba(80,70,130,0.1)]" />
      </div>
      <div className="space-y-[22px]">{children}</div>
    </div>
  );
}

function Campo({
  etichetta,
  children,
}: {
  etichetta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-[var(--ink)]">
        {etichetta}
      </span>
      {children}
    </label>
  );
}

function RigaSolaLettura({
  etichetta,
  valore,
}: {
  etichetta: string;
  valore: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-0">
      <dt className="text-xs text-[var(--ink-muted)]">{etichetta}</dt>
      <dd className="text-right text-sm font-medium text-[var(--ink)]">
        {valore}
      </dd>
    </div>
  );
}

const inputClass = "aff-input";

const inputErroreClass = "aff-input-error";

function segClass(attivo: boolean, extra = "") {
  return `rounded-full px-4 py-2.5 text-sm font-medium transition-all ${
    attivo
      ? "bg-white text-[var(--primary)] shadow-[var(--shadow-card)] ring-1 ring-[var(--primary)]/25"
      : "text-[var(--ink-muted)] hover:bg-white/60 hover:text-[var(--ink)]"
  } ${extra}`;
}

const GANCI_PILL = [
  "bg-[var(--pink-soft)] text-[#7a3d58]",
  "bg-[var(--green-soft)] text-[#2d6a4a]",
  "bg-[var(--yellow-soft)] text-[#6b5420]",
  "bg-[var(--lavender-muted)] text-[#5b4fa8]",
];

export function FormConfigurazione({
  config,
  onCambia,
  varianti,
  citta,
  settore,
  onCambiaCitta,
  onCambiaSettore,
  creativita,
  indiceAnteprimaCreativita,
  onCambiaCreativita,
  onCambiaIndiceAnteprimaCreativita,
  pageId = "",
  formId = "",
  onCambiaPageId,
  onCambiaFormId,
  formatoEcommerce = "SINGLE",
  onCambiaFormatoEcommerce,
  whatsappNumber = "",
  onCambiaWhatsappNumber,
  campaignId = null,
  scontrinoMedio,
  tassoConversione,
  onCambiaScontrinoMedio,
  onCambiaTassoConversione,
  conversionRateSource = "ESTIMATED",
  onCambiaConversionRateSource,
  elevatorPitch,
  onCambiaElevatorPitch,
  sitoWeb,
  onCambiaSitoWeb,
  frontEndOffer = "",
  onCambiaFrontEndOffer,
  shippingMarket = "ITALY",
  onCambiaShippingMarket,
  heroProduct = "",
  onCambiaHeroProduct,
  targetType = "B2C",
  onCambiaTargetType,
  targetAge = "25-50",
  onCambiaTargetAge,
  retargetingAudienceSource = "CART",
  onCambiaRetargetingAudienceSource,
  dataEventoApertura = "",
  onCambiaDataEventoApertura,
  tonoVoce = "diretto",
  onCambiaTonoVoce,
  onRigeneraVarianti,
  onDopoSwapVariante,
  copyAiLoading = false,
  targetMargin,
  onCambiaTargetMargin,
  objective = "LEADS",
  bookingChannel = "WHATSAPP",
  onCambiaBookingChannel,
  bookingConfirmationPolicy = "FREE_SMS_WHATSAPP",
  onCambiaBookingConfirmationPolicy,
  productMargin = 50,
  onCambiaProductMargin,
  fulfillmentCost = 5,
  onCambiaFulfillmentCost,
  ecommerceLtvAttivo = false,
  onCambiaEcommerceLtvAttivo,
  recoveryDiscount = 0,
  onCambiaRecoveryDiscount,
  launchBudget = 300,
  onCambiaLaunchBudget,
  estimatedCpm = 7,
  onCambiaEstimatedCpm,
  ltvAttivo = false,
  onCambiaLtvAttivo,
  frequenzaAnnuale = 1,
  onCambiaFrequenzaAnnuale,
  anniPermanenza = 1,
  onCambiaAnniPermanenza,
  loyaltyPercent = 0,
  onCambiaLoyaltyPercent,
  margineLordoLtv = 50,
  onCambiaMargineLordoLtv,
  wizardStep,
  erroriPasso1,
  settoreIntel = null,
  sectorIntelLoading = false,
  onSelezionaSettore,
  onCaricaClienteEsistente,
  clienteCaricatoId = null,
  salvaClientePreferito = true,
  onCambiaSalvaClientePreferito,
  formatoCuratoId = null,
  onSelezionaFormatoCurato,
  deconstructResult = null,
  onDeconstructResult,
  copyInPreparazione = false,
  copyPreparazioneNota = null,
  statoApprovazioneLeads,
  revisionNotesCliente = null,
  statoLancio,
  postiDisponibiliSettimana = "",
  onCambiaPostiDisponibiliSettimana,
}: Props) {
  const [leadRicevuti, setLeadRicevuti] = useState<number | string>("");
  const [clientiAcquisiti, setClientiAcquisiti] = useState<number | string>("");

  function selezionaConversionRateSource(source: ConversionRateSource) {
    onCambiaConversionRateSource?.(source);
    if (source === "UNKNOWN") {
      onCambiaTassoConversione("");
      setLeadRicevuti("");
      setClientiAcquisiti("");
    }
  }

  function aggiornaCalcolatoreConversione(
    lead: number | string,
    clienti: number | string,
  ) {
    const l = Number(lead);
    const c = Number(clienti);
    if (
      Number.isFinite(l) &&
      l > 0 &&
      Number.isFinite(c) &&
      c >= 0 &&
      c <= l
    ) {
      const pct = Math.round((c / l) * 1000) / 10;
      onCambiaTassoConversione(pct);
    }
  }

  function aggiorna<K extends keyof ConfigurazioneContatti>(
    chiave: K,
    valore: ConfigurazioneContatti[K],
  ) {
    onCambia({ ...config, [chiave]: valore });
  }

  function usaVarianteComePrimaria(scelta: "B" | "C") {
    const scambiati = scambiaVariantePrimaria(
      {
        varianteA: config.varianteA ?? "",
        varianteB: config.varianteB ?? "",
        varianteC: config.varianteC ?? "",
      },
      scelta,
    );
    onCambia({
      ...config,
      varianteA: scambiati.varianteA,
      varianteB: scambiati.varianteB,
      varianteC: scambiati.varianteC,
    });
    onDopoSwapVariante?.();
  }

  const pathname = usePathname() ?? "";
  // Pathname = fonte primaria; objective dalla pagina come rete di sicurezza.
  const isEcommerce =
    pathname.includes("vendite-online") || objective === "ECOMMERCE";
  const isInStore =
    pathname.includes("instore") ||
    pathname.includes("negozio") ||
    objective === "IN_STORE";
  const isBookings =
    pathname.includes("prenotazioni") || objective === "BOOKINGS";
  const isRetargeting =
    pathname.includes("retargeting") ||
    pathname.includes("recupero") ||
    objective === "RETARGETING";
  const isAwareness =
    pathname.includes("apertura") ||
    pathname.includes("lancio") ||
    objective === "AWARENESS";
  const isPercorsoLeads =
    pathname.includes("richieste-contatto") &&
    !isEcommerce &&
    !isInStore &&
    !isBookings &&
    !isRetargeting &&
    !isAwareness;
  const isPercorsoBookings =
    pathname.includes("prenotazioni") &&
    !isEcommerce &&
    !isInStore &&
    !isRetargeting &&
    !isAwareness &&
    !isPercorsoLeads;
  const isPercorsoEcommerce =
    pathname.includes("vendite-online") &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isInStore &&
    !isRetargeting &&
    !isAwareness;
  const isPercorsoInstore =
    (pathname.includes("instore") || pathname.includes("negozio")) &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isPercorsoEcommerce &&
    !isRetargeting &&
    !isAwareness;
  const isPercorsoRetargeting =
    (pathname.includes("retargeting") || pathname.includes("recupero")) &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isPercorsoEcommerce &&
    !isPercorsoInstore &&
    !isAwareness;
  const isPercorsoAwareness =
    (pathname.includes("apertura") || pathname.includes("lancio")) &&
    isAwareness &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isPercorsoEcommerce &&
    !isPercorsoInstore &&
    !isPercorsoRetargeting;
  const objectiveEffettivo: CampagnaObjective = isEcommerce
    ? "ECOMMERCE"
    : isInStore
      ? "IN_STORE"
      : isBookings
        ? "BOOKINGS"
        : isRetargeting
          ? "RETARGETING"
          : isAwareness
            ? "AWARENESS"
            : objective;
  const step1 = testiPasso1Wizard(pathname, objectiveEffettivo);
  const riferimentoMercato = riferimentoAstaMeta(
    settoreIntel,
    isEcommerce || isBookings || isInStore || isRetargeting,
  );
  const validazioneBrief = validateElevatorPitch(elevatorPitch, {
    objective: objectiveEffettivo,
  });
  const valoreVisita = Number(scontrinoMedio) || 0;
  const tassoLeads = isPercorsoLeads
    ? tassoConversioneLeadsValido(conversionRateSource, tassoConversione)
    : null;
  const showUp = isPercorsoLeads
    ? (tassoLeads ?? 0)
    : Number(tassoConversione) || (isBookings ? 75 : 10);
  const margineProdotto =
    Number(productMargin) ||
    (isEcommerce ? 60 : isInStore ? 40 : isRetargeting ? 50 : 50);
  const costoFulfillment = Number(fulfillmentCost) || 0;
  const scontoRecupero = Number(recoveryDiscount) || 0;
  const budgetLancio = Math.abs(Number(launchBudget) || 0);
  const cpmLocale = Math.abs(Number(estimatedCpm) || 7);
  const raggioAwareness = config.raggioKm || 10;
  const impressionsAwareness = isAwareness
    ? calculateImpressionsAwareness(budgetLancio, cpmLocale)
    : 0;
  const personeUnicheAwareness = isAwareness
    ? calculatePersoneUnicheAwareness(budgetLancio, cpmLocale)
    : 0;
  const cpaSostenibile = isBookings
    ? calculateMaxSustainableBookingCpa(valoreVisita, showUp, targetMargin)
    : 0;
  const valoreRealePrenotazione =
    valoreVisita > 0
      ? Math.round(valoreVisita * (showUp / 100) * 100) / 100
      : 0;
  const margineNettoEcommerce = isEcommerce
    ? calculateEcommerceMargineNetto(
        valoreVisita,
        margineProdotto,
        costoFulfillment,
        ecommerceLtvAttivo,
      )
    : 0;
  const cpaMaxAcquisto = isEcommerce
    ? calculateEcommerceCpaMax(
        valoreVisita,
        margineProdotto,
        costoFulfillment,
        ecommerceLtvAttivo,
      )
    : 0;
  const roasBreakEven = isEcommerce
    ? calculateEcommerceBreakEvenRoas(valoreVisita, cpaMaxAcquisto)
    : 0;
  const roasTarget = isEcommerce
    ? calculateEcommerceTargetRoas(valoreVisita, cpaMaxAcquisto)
    : 0;
  const utilePerScontrino = isInStore
    ? calculateUtilePerScontrino(valoreVisita, margineProdotto)
    : 0;
  const cpaInStore = isInStore
    ? calculateMaxSustainableInStoreCpa(
        valoreVisita,
        margineProdotto,
        targetMargin,
      )
    : 0;
  const valoreNettoRecupero = isRetargeting
    ? calculateValoreNettoRecupero(valoreVisita, scontoRecupero)
    : 0;
  const cpaRecupero = isRetargeting
    ? calculateMaxSustainableRecoveryCpa(
        valoreVisita,
        margineProdotto,
        scontoRecupero,
      )
    : 0;

  const mostraLtv =
    !isAwareness && !isRetargeting && !isEcommerce && !isInStore;
  const freqLtv = Number(frequenzaAnnuale) || 1;
  const anniLtv = Number(anniPermanenza) || 1;
  const loyaltyLtv = Number(loyaltyPercent) || 0;
  const margineLordoPerLtv = isEcommerce || isInStore
    ? margineProdotto
    : Number(margineLordoLtv) || 50;
  const tassoPerLtv = isBookings
    ? showUp
    : isPercorsoLeads
      ? (tassoLeads ?? 0)
      : Number(tassoConversione) || 10;
  const ltvEconomics =
    mostraLtv && ltvAttivo && valoreVisita > 0
      ? calculateLtvEconomics({
          scontrinoMedio: valoreVisita,
          frequenzaAnnuale: freqLtv,
          anniPermanenza: anniLtv,
          loyaltyPercent: loyaltyLtv,
          margineLordoPercent: margineLordoPerLtv,
          tassoConversionePercent: tassoPerLtv,
          targetMarginPercent: targetMargin,
        })
      : null;
  const cplPrimoAcquistoLeads =
    isPercorsoLeads &&
    valoreVisita > 0 &&
    tassoLeads != null &&
    tassoLeads > 0
      ? calculateMaxSustainableCpl(valoreVisita, tassoLeads, targetMargin)
      : !isPercorsoLeads &&
          !isBookings &&
          !isEcommerce &&
          !isInStore &&
          !isRetargeting &&
          !isAwareness &&
          valoreVisita > 0
        ? calculateMaxSustainableCpl(valoreVisita, showUp, targetMargin)
        : 0;
  const breakEvenLeads =
    isPercorsoLeads &&
    valoreVisita > 0 &&
    tassoLeads != null &&
    tassoLeads > 0
      ? calculateBreakEvenPerLead(valoreVisita, tassoLeads)
      : !isPercorsoLeads &&
          !isBookings &&
          !isEcommerce &&
          !isInStore &&
          !isRetargeting &&
          !isAwareness &&
          valoreVisita > 0
        ? calculateBreakEvenPerLead(valoreVisita, showUp)
        : 0;
  const breakEvenBookings =
    isBookings && valoreVisita > 0
      ? calculateBreakEvenPerBooking(valoreVisita, showUp)
      : 0;

  const cplPerAlert = ltvEconomics
    ? ltvEconomics.cplSostenibileLtv
    : isBookings
      ? cpaSostenibile
      : cplPrimoAcquistoLeads;
  const breakEvenPerBarra = ltvEconomics
    ? ltvEconomics.breakEvenCpl
    : isBookings
      ? breakEvenBookings
      : breakEvenLeads;
  const targetPerBarra = ltvEconomics
    ? ltvEconomics.cplSostenibileLtv
    : isBookings
      ? cpaSostenibile
      : cplPrimoAcquistoLeads;
  const targetCplStudio = isEcommerce
    ? cpaMaxAcquisto
    : isRetargeting
      ? cpaRecupero
      : isInStore
        ? cpaInStore
        : isBookings
          ? cpaSostenibile
          : cplPrimoAcquistoLeads;
  const alertFattibilita =
    (isBookings ||
      (!isEcommerce &&
        !isInStore &&
        !isRetargeting &&
        !isAwareness)) &&
    cplPerAlert > 0
      ? alertFattibilitaNicchia({
          cplSostenibile: cplPerAlert,
          settore,
          targetType,
        })
      : null;

  const guidanceStep1 = useMemo(
    () =>
      generaGuidanceStep1({
        frontEndOffer,
        elevatorPitch,
        targetAge,
        etaMin: config.etaMin,
        etaMax: config.etaMax,
      }),
    [frontEndOffer, elevatorPitch, targetAge, config.etaMin, config.etaMax],
  );
  const guidanceTargeting = useMemo(
    () =>
      generaGuidanceTargeting({
        objective: objectiveEffettivo,
        citta,
        raggioKm: config.raggioKm,
        budgetGiornaliero: config.budgetGiornaliero,
        targetType,
        elevatorPitch,
      }),
    [
      objectiveEffettivo,
      citta,
      config.raggioKm,
      config.budgetGiornaliero,
      targetType,
      elevatorPitch,
    ],
  );
  const guidanceOfferta = guidanceInlineOfferta(guidanceStep1);
  const guidanceBrief = guidanceInlineBrief(guidanceStep1);
  const guidanceEta = guidanceInlineEta(guidanceStep1);
  const guidanceCitta = guidanceInlineCitta(guidanceTargeting);
  const guidanceTipoCliente = guidanceInlineTargetType(guidanceTargeting);
  const guidanceRaggio = guidanceInlineRaggio(guidanceTargeting);
  const guidanceBudgetRaggio = guidanceInlineBudgetRaggio(guidanceTargeting);
  const guidanceStep1Residua = guidanceStep1NonInline([
    ...guidanceStep1,
    ...guidanceTargeting,
  ]);

  const sogliaGuidance =
    targetCplStudio > 0 ? targetCplStudio : null;
  const guidanceEconomica = useMemo(
    () =>
      generaGuidanceEconomica({
        ticket: valoreVisita > 0 ? valoreVisita : null,
        conversionRate: showUp > 0 ? showUp : null,
        conversionRateSource: isPercorsoLeads
          ? conversionRateSource
          : undefined,
        margine: targetMargin,
        budgetGiornaliero: config.budgetGiornaliero,
        maxSustainableCpl: sogliaGuidance,
        objective: objectiveEffettivo,
      }),
    [
      valoreVisita,
      showUp,
      isPercorsoLeads,
      conversionRateSource,
      targetMargin,
      config.budgetGiornaliero,
      sogliaGuidance,
      objectiveEffettivo,
    ],
  );

  const boxes =
    varianti ??
    metaVarianti(
      config.varianteA,
      config.varianteB,
      config.varianteC,
      objective,
    );

  const valoriVarianti = [
    config.varianteA ?? "",
    config.varianteB ?? "",
    config.varianteC ?? "",
  ];

  const heroPerHook = (() => {
    const grezzo = (heroProduct ?? "").trim() || elevatorPitch.trim() || "";
    if (!isEcommerce || grezzo.length <= 48) return grezzo;
    // Per il check hook: usa nome prodotto corto, non l'intero brief.
    const prima = grezzo.split(/[.|;]/)[0]?.trim() || grezzo;
    return prima.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  })();
  const hookOk = hookMobileCompleto(
    valoriVarianti[0],
    citta ?? "",
    frontEndOffer,
    isEcommerce
      ? { objective: "ECOMMERCE", heroProduct: heroPerHook }
      : { objective: objectiveEffettivo },
  );
  const cittaHook =
    (citta ?? "").trim() ||
    (isAwareness ? "in città" : "la città");

  const controlloMessaggioLeads = useMemo(
    () =>
      isPercorsoLeads
        ? analizzaControlloMessaggioLeads({
            testoVarianteA: valoriVarianti[0],
            headline: config.titoloAnnuncio,
            citta: citta ?? "",
            frontEndOffer: frontEndOffer ?? "",
            brief: elevatorPitch,
            settore: settore ?? "",
          })
        : null,
    [
      isPercorsoLeads,
      valoriVarianti,
      config.titoloAnnuncio,
      citta,
      frontEndOffer,
      elevatorPitch,
      settore,
    ],
  );

  const copyRecommendation = useMemo(
    () =>
      isPercorsoLeads
        ? raccomandaCopy({
            varianteA: valoriVarianti[0],
            varianteB: valoriVarianti[1],
            varianteC: valoriVarianti[2],
            titoloAnnuncio: config.titoloAnnuncio,
            offerta: frontEndOffer,
            brief: elevatorPitch,
            citta: citta ?? "",
            settore: settore ?? "",
            objective: "LEADS",
          })
        : null,
    [
      isPercorsoLeads,
      valoriVarianti,
      config.titoloAnnuncio,
      frontEndOffer,
      elevatorPitch,
      citta,
      settore,
    ],
  );

  const controlloMessaggioBookings = useMemo(
    () =>
      isPercorsoBookings
        ? analizzaControlloMessaggioBookings({
            testoVarianteA: valoriVarianti[0],
            headline: config.titoloAnnuncio,
            citta: citta ?? "",
            frontEndOffer: frontEndOffer ?? "",
            bookingChannel: bookingChannel ?? "WHATSAPP",
            postiSettimana: postiDisponibiliSettimana,
          })
        : null,
    [
      isPercorsoBookings,
      valoriVarianti,
      config.titoloAnnuncio,
      citta,
      frontEndOffer,
      bookingChannel,
      postiDisponibiliSettimana,
    ],
  );

  const controlloMessaggioEcommerce = useMemo(
    () =>
      isPercorsoEcommerce
        ? analizzaControlloMessaggioEcommerce({
            testoVarianteA: valoriVarianti[0],
            headline: config.titoloAnnuncio,
            frontEndOffer: frontEndOffer ?? "",
            elevatorPitch: elevatorPitch ?? "",
            heroProduct: heroProduct ?? "",
            sitoWeb: sitoWeb ?? "",
          })
        : null,
    [
      isPercorsoEcommerce,
      valoriVarianti,
      config.titoloAnnuncio,
      frontEndOffer,
      elevatorPitch,
      heroProduct,
      sitoWeb,
    ],
  );

  const controlloMessaggioInstore = useMemo(
    () =>
      isPercorsoInstore
        ? analizzaControlloMessaggioInstore({
            testoVarianteA: valoriVarianti[0],
            headline: config.titoloAnnuncio,
            nomeCliente: config.nomeCliente ?? "",
            elevatorPitch: elevatorPitch ?? "",
            citta: citta ?? "",
            frontEndOffer: frontEndOffer ?? "",
            sitoWeb: sitoWeb ?? "",
          })
        : null,
    [
      isPercorsoInstore,
      valoriVarianti,
      config.titoloAnnuncio,
      config.nomeCliente,
      elevatorPitch,
      citta,
      frontEndOffer,
      sitoWeb,
    ],
  );

  const controlloMessaggioRetargeting = useMemo(
    () =>
      isPercorsoRetargeting
        ? analizzaControlloMessaggioRetargeting({
            testoVarianteA: valoriVarianti[0],
            headline: config.titoloAnnuncio,
            frontEndOffer: frontEndOffer ?? "",
            sitoWeb: sitoWeb ?? "",
            targetType,
            nomeCliente: config.nomeCliente ?? "",
            elevatorPitch: elevatorPitch ?? "",
          })
        : null,
    [
      isPercorsoRetargeting,
      valoriVarianti,
      config.titoloAnnuncio,
      frontEndOffer,
      sitoWeb,
      targetType,
      config.nomeCliente,
      elevatorPitch,
    ],
  );

  const controlloMessaggioAwareness = useMemo(
    () =>
      isPercorsoAwareness
        ? analizzaControlloMessaggioAwareness({
            testoVarianteA: valoriVarianti[0],
            headline: config.titoloAnnuncio,
            nomeCliente: config.nomeCliente ?? "",
            settore: settore ?? "",
            elevatorPitch: elevatorPitch ?? "",
            citta: citta ?? "",
            frontEndOffer: frontEndOffer ?? "",
            sitoWeb: sitoWeb ?? "",
          })
        : null,
    [
      isPercorsoAwareness,
      valoriVarianti,
      config.titoloAnnuncio,
      config.nomeCliente,
      settore,
      elevatorPitch,
      citta,
      frontEndOffer,
      sitoWeb,
    ],
  );

  const mostra = (passi: WizardStep[]) =>
    wizardStep == null || passi.includes(wizardStep);

  return (
    <div className="min-w-0 space-y-8">
      {mostra([1]) ? (
      <>
      <section
        key={
          isEcommerce
            ? "passo-1-ecommerce"
            : isInStore
              ? "passo-1-instore"
              : isPercorsoRetargeting
                ? "passo-1-retargeting"
              : isPercorsoBookings
                ? "passo-1-prenotazioni"
                : "passo-1-default"
        }
        className="aff-panel-lilac p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <header className="aff-panel-white p-6 sm:p-7">
          <h2 className="text-[20px] font-medium tracking-tight text-[var(--ink)] sm:text-[22px]">
            {step1.stepTitle}
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
            {step1.stepSubtitle}
          </p>
          <p className="mt-4 inline-flex rounded-full bg-[var(--pink-soft)] px-3 py-1 text-[13px] font-medium text-[#7a3d58]">
            Obiettivo: {etichettaObiettivo(objectiveEffettivo)}
          </p>
        </header>

        <div className="mt-5 space-y-5">
          {onCaricaClienteEsistente ? (
            <SelettoreClienteEsistente
              onSeleziona={onCaricaClienteEsistente}
              clienteCaricatoId={clienteCaricatoId}
            />
          ) : null}

          <Passo1Sezione
            titolo={
              isPercorsoEcommerce
                ? "A · Brand e prodotto"
                : isPercorsoInstore || isPercorsoAwareness
                  ? "A · Attività"
                  : isPercorsoRetargeting
                    ? "A · Cliente e obiettivo"
                  : "A · Cliente"
            }
          >
          <Campo etichetta={step1.clientLabel}>
            <input
              key={`nome-${objectiveEffettivo}`}
              type="text"
              value={config.nomeCliente ?? ""}
              onChange={(e) => aggiorna("nomeCliente", e.target.value)}
              placeholder={step1.clientPlaceholder}
              className={
                erroriPasso1?.nomeCliente ? inputErroreClass : inputClass
              }
              aria-invalid={erroriPasso1?.nomeCliente ? true : undefined}
            />
          </Campo>
          {erroriPasso1?.nomeCliente ? (
            <p className="-mt-2 text-xs text-[#C45C5C]">
              Campo obbligatorio: inserisci il nome dello store / attività.
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-2.5 py-1">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              checked={salvaClientePreferito}
              onChange={(e) =>
                onCambiaSalvaClientePreferito?.(e.target.checked)
              }
            />
            <span className="text-sm leading-relaxed text-[var(--ink-muted)]">
              Salva cliente nei preferiti per riutilizzarlo
            </span>
          </label>
          <div
            className={
              isPercorsoEcommerce ||
              isPercorsoInstore ||
              isPercorsoRetargeting ||
              isPercorsoAwareness
                ? "grid grid-cols-1 gap-5"
                : "grid grid-cols-1 gap-5 sm:grid-cols-2"
            }
          >
            <div>
              <span className="mb-2 block text-[13px] font-medium text-[var(--ink)]">
                {step1.nicheLabel}
              </span>
              <SelettoreSettore
                value={settore ?? ""}
                onChange={(valore) => onCambiaSettore?.(valore)}
                onSeleziona={(item) => {
                  if (onSelezionaSettore) onSelezionaSettore(item);
                  else onCambiaSettore?.(item.nome);
                }}
                placeholder={step1.nichePlaceholder}
                inputClassName={inputClass}
              />
              {sectorIntelLoading ? (
                <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                  Stiamo stimando benchmark e offerte per questa nicchia…
                </p>
              ) : settoreIntel &&
                !isPercorsoEcommerce &&
                !isPercorsoInstore &&
                !isPercorsoRetargeting &&
                !isPercorsoAwareness ? (
                <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                  {settoreIntel.macroCategoria}
                  {" · "}
                  scontrino tipico {settoreIntel.aovDefault}€
                  {" · "}
                  CPL {settoreIntel.benchmarkCPL.min}–
                  {settoreIntel.benchmarkCPL.max}€
                  {settoreIntel.source === "ai" ? " · stima AI" : ""}
                </p>
              ) : settoreIntel &&
                (isPercorsoEcommerce ||
                  isPercorsoInstore ||
                  isPercorsoRetargeting ||
                  isPercorsoAwareness) ? (
                <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                  {settoreIntel.macroCategoria}
                  {" · "}
                  scontrino tipico {settoreIntel.aovDefault}€
                  {settoreIntel.source === "ai" ? " · stima AI" : ""}
                </p>
              ) : null}
            </div>
            {!isPercorsoEcommerce &&
            !isPercorsoInstore &&
            !isPercorsoRetargeting &&
            !isPercorsoAwareness ? (
              <Campo etichetta={step1.locationLabel}>
                <input
                  key={`citta-${objectiveEffettivo}`}
                  type="text"
                  value={citta ?? ""}
                  onChange={(e) => onCambiaCitta?.(e.target.value)}
                  placeholder={step1.locationPlaceholder}
                  className={inputClass}
                />
                <InlineGuidance item={guidanceCitta} />
              </Campo>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
            Non sai cosa inserire? Scrivi quello che sai: potrai correggerlo
            più avanti.
          </p>
          {isEcommerce && !isPercorsoEcommerce ? (
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                Oppure scegli il mercato *
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {MERCATI_SPEDIZIONE.map((m) => {
                  const attivo = shippingMarket === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onCambiaShippingMarket?.(m.value)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        attivo
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent-muted)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {settore?.trim() ? (
            <div className="flex gap-3 rounded-[16px] bg-[var(--primary-soft)] px-4 py-3">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-[13px] font-medium text-[var(--primary)]">
                  Consiglio di nicchia
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink)]">
                  {consiglioStrategicoNicchia(settore, objectiveEffettivo)}
                </p>
              </div>
            </div>
          ) : null}
          {settoreIntel?.policyAlert ? (
            <div className="flex gap-3 rounded-[16px] bg-[var(--yellow-soft)]/80 px-4 py-3">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[#6b5420]"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-[13px] font-medium text-[#6b5420]">
                  Policy Meta
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink)]">
                  {settoreIntel.policyAlert}
                </p>
              </div>
            </div>
          ) : null}

          {isPercorsoEcommerce ||
          isPercorsoInstore ||
          isPercorsoRetargeting ||
          isPercorsoAwareness ? (
            <div className="rounded-[20px] bg-[var(--lavender-muted)]/55 p-5 sm:p-6">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--ink)]">
                  {step1.briefLabel}
                </p>
                <BottoneCompilaAffianco />
              </div>
              <p className="mb-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                {step1.briefIntro}
              </p>
              <textarea
                key={`brief-${objectiveEffettivo}`}
                value={elevatorPitch}
                onChange={(e) => {
                  onCambiaElevatorPitch(e.target.value);
                  if (isPercorsoEcommerce) onCambiaHeroProduct?.(e.target.value);
                }}
                rows={4}
                placeholder={step1.briefPlaceholder}
                className={`${erroriPasso1?.elevatorPitch ? inputErroreClass : inputClass} resize-y`}
                aria-invalid={erroriPasso1?.elevatorPitch ? true : undefined}
              />
              <InlineGuidance item={guidanceBrief} />
              {erroriPasso1?.elevatorPitch ? (
                <p className="mt-2 text-xs text-[#C45C5C]">
                  Campo obbligatorio:{" "}
                  {isPercorsoInstore || isPercorsoAwareness
                    ? "compila il brief attività."
                    : isPercorsoRetargeting
                      ? "compila il brief cliente."
                    : "descrivi il prodotto o la collezione principale."}
                </p>
              ) : elevatorPitch.trim() ? (
                validazioneBrief.isValid ? (
                  <div className="mt-2 flex gap-3 rounded-[16px] bg-[var(--green-soft)]/80 px-4 py-3">
                    <CircleCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#2d6a4a]"
                      strokeWidth={1.75}
                    />
                    <p className="text-[13px] font-medium text-[#2d6a4a]">
                      Brief specifico e utilizzabile
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#C26A0A]">
                    {validazioneBrief.reason}
                  </p>
                )
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                  {step1.briefHint}
                </p>
              )}
            </div>
          ) : null}

          {isPercorsoRetargeting ? (
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                Tipo Cliente
              </p>
              <div className="aff-seg-track flex-col sm:flex-row">
                {(
                  [
                    {
                      value: "B2C" as const,
                      label: "B2C — Privati / Famiglie",
                    },
                    {
                      value: "B2B" as const,
                      label: "B2B — Aziende / Professionisti",
                    },
                  ] as const
                ).map((opzione) => {
                  const attivo = targetType === opzione.value;
                  return (
                    <button
                      key={opzione.value}
                      type="button"
                      onClick={() => onCambiaTargetType?.(opzione.value)}
                      className={segClass(attivo, "flex-1 text-left")}
                    >
                      {opzione.label}
                    </button>
                  );
                })}
              </div>
              <InlineGuidance item={guidanceTipoCliente} />
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                {targetType === "B2B"
                  ? "Export Meta: obiettivo Leads, evento Lead, CTA Scopri di più."
                  : "Export Meta: obiettivo Sales, evento Purchase, CTA Acquista ora."}
              </p>
            </div>
          ) : null}
          </Passo1Sezione>

          {isPercorsoRetargeting ? (
            <Passo1Sezione titolo="B · Recupero">
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                Affianco prepara struttura, messaggio ed economia della
                campagna. Il pubblico di retargeting va collegato in Meta Ads
                Manager prima della pubblicazione.
              </p>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  Da configurare in Meta
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--ink)]">
                  <li>Custom Audience</li>
                  <li>Finestra del pubblico</li>
                  <li>Eventuali esclusioni</li>
                </ul>
              </div>
            </Passo1Sezione>
          ) : null}

          <Passo1Sezione
            titolo={
              isPercorsoAwareness
                ? "B · Cosa vuoi far conoscere"
                : isPercorsoInstore
                ? "B · Offerta locale"
                : isPercorsoRetargeting
                  ? "C · Offerta di recupero"
                  : "B · Offerta"
            }
          >
          <Campo
            etichetta={
              isPercorsoAwareness ? "Messaggio di apertura" : step1.offerLabel
            }
          >
            <textarea
              key={`offerta-${objectiveEffettivo}`}
              value={frontEndOffer}
              onChange={(e) => onCambiaFrontEndOffer?.(e.target.value)}
              rows={4}
              placeholder={
                isPercorsoAwareness
                  ? step1.offerPlaceholder
                  : (settoreIntel?.ganciConsigliati[0] ?? step1.offerPlaceholder)
              }
              className={`${erroriPasso1?.frontEndOffer ? inputErroreClass : inputClass} resize-y`}
              aria-invalid={erroriPasso1?.frontEndOffer ? true : undefined}
            />
            <InlineGuidance item={guidanceOfferta} />
          </Campo>
          {settoreIntel?.ganciConsigliati?.length && !isPercorsoAwareness ? (
            <div className="-mt-1 space-y-2">
              <p className="text-xs font-medium text-[var(--ink-muted)]">
                Ganci consigliati per {settoreIntel.nome}
              </p>
              <div className="flex flex-wrap gap-2">
                {settoreIntel.ganciConsigliati.slice(0, 3).map((offerta, i) => (
                  <button
                    key={offerta}
                    type="button"
                    onClick={() => onCambiaFrontEndOffer?.(offerta)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-shadow ${
                      GANCI_PILL[i % GANCI_PILL.length]
                    } ${
                      frontEndOffer.trim() === offerta
                        ? "ring-2 ring-[var(--primary)] ring-offset-2"
                        : "hover:shadow-[var(--shadow-card)]"
                    }`}
                  >
                    {offerta}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {erroriPasso1?.frontEndOffer ? (
            <p className="-mt-2 text-xs text-[#C45C5C]">
              Campo obbligatorio: inserisci l&apos;offerta / gancio
              d&apos;ingresso.
            </p>
          ) : (
            <p className="-mt-2 text-xs text-[var(--ink-muted)]">
              {isPercorsoAwareness
                ? "Descrivi cosa vuoi far conoscere: apertura, nuovo spazio, servizio o vantaggio reale. Solo informazioni davvero disponibili."
                : isPercorsoEcommerce
                ? "Scrivi solo condizioni realmente disponibili."
                : isPercorsoRetargeting
                  ? "Indica solo un incentivo o un vantaggio realmente disponibile. Se non esiste una promozione, descrivi semplicemente il motivo per tornare."
                : "L'offerta che useremo nei testi dell'annuncio."}
            </p>
          )}

          {isRetargeting && !isPercorsoRetargeting ? (
            <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
              Chi ha già aggiunto un prodotto al carrello negli ultimi 14 giorni
              converte meglio: l&apos;offerta deve rimuovere l&apos;ultimo
              ostacolo (es. spedizione gratis o piccolo sconto).
            </p>
          ) : null}

          {isAwareness && !isPercorsoAwareness ? (
            <Campo etichetta="Data dell'Inaugurazione / Evento (Opzionale)">
              <input
                key="data-evento-apertura"
                type="text"
                value={dataEventoApertura}
                onChange={(e) =>
                  onCambiaDataEventoApertura?.(e.target.value)
                }
                placeholder="Es. 15 Settembre 2026"
                className={inputClass}
                autoComplete="off"
              />
            </Campo>
          ) : null}

          {!isPercorsoRetargeting && !isPercorsoAwareness ? (
            <>
              <Campo etichetta={step1.siteLabel}>
                <input
                  key={`sito-${objectiveEffettivo}`}
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder={step1.sitePlaceholder}
                  className={inputClass}
                />
              </Campo>
              {isPercorsoEcommerce ? (
                <p className="-mt-1.5 text-xs text-[var(--ink-muted)]">
                  Link al prodotto, alla collezione o allo store dove vuoi
                  portare l&apos;utente.
                </p>
              ) : isPercorsoInstore ? (
                <p className="-mt-1.5 text-xs text-[var(--ink-muted)]">
                  Link Maps o pagina del negozio usato come destinazione della
                  CTA «Ottieni indicazioni».
                </p>
              ) : null}
            </>
          ) : null}
          </Passo1Sezione>

          {isPercorsoRetargeting ? (
            <Passo1Sezione titolo="D · Destinazione">
              <Campo etichetta={step1.siteLabel}>
                <input
                  key={`sito-${objectiveEffettivo}`}
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder={step1.sitePlaceholder}
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-1.5 text-xs text-[var(--ink-muted)]">
                Dove deve tornare l&apos;utente dopo aver cliccato
                sull&apos;annuncio.
              </p>
            </Passo1Sezione>
          ) : null}

          {isPercorsoAwareness ? (
            <Passo1Sezione titolo="C · Area locale">
              <Campo etichetta={step1.locationLabel}>
                <input
                  key={`citta-${objectiveEffettivo}`}
                  type="text"
                  value={citta ?? ""}
                  onChange={(e) => onCambiaCitta?.(e.target.value)}
                  placeholder={step1.locationPlaceholder}
                  className={inputClass}
                />
                <InlineGuidance item={guidanceCitta} />
              </Campo>
              <Campo etichetta="Raggio locale (km)">
                <div className="flex gap-2">
                  {([5, 10, 15] as const).map((km) => {
                    const attivo = raggioAwareness === km;
                    return (
                      <button
                        key={km}
                        type="button"
                        onClick={() => aggiorna("raggioKm", km)}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          attivo
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent-muted)]"
                        }`}
                      >
                        {km} km
                      </button>
                    );
                  })}
                </div>
                <InlineGuidance item={guidanceRaggio} />
              </Campo>
              <p className="-mt-1.5 text-xs text-[var(--ink-muted)]">
                {citta?.trim()
                  ? `${raggioAwareness} km intorno a ${citta.trim()}`
                  : "Raggio di targeting locale intorno alla città dell'apertura."}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                Targeting di base dell&apos;export: adulti 18–65 · tutti i
                generi.
              </p>
            </Passo1Sezione>
          ) : null}

          {isPercorsoAwareness ? (
            <Passo1Sezione titolo="D · Destinazione">
              <Campo etichetta="Pagina o mappa di destinazione">
                <input
                  key={`sito-${objectiveEffettivo}`}
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder={step1.sitePlaceholder}
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-1.5 text-xs text-[var(--ink-muted)]">
                Dove vuoi portare chi decide di approfondire o raggiungere
                l&apos;attività (sito, landing, pagina apertura o Google Maps).
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                Con una destinazione la campagna viene impostata per generare
                click verso il link; senza destinazione lavora sulla copertura.
                Non misura le visite fisiche.
              </p>
            </Passo1Sezione>
          ) : null}

          {isPercorsoInstore ? (
            <Passo1Sezione titolo="C · Area da raggiungere">
              <Campo etichetta={step1.locationLabel}>
                <input
                  key={`citta-${objectiveEffettivo}`}
                  type="text"
                  value={citta ?? ""}
                  onChange={(e) => onCambiaCitta?.(e.target.value)}
                  placeholder={step1.locationPlaceholder}
                  className={inputClass}
                />
                <InlineGuidance item={guidanceCitta} />
              </Campo>
              <Campo etichetta="Raggio locale (km)">
                <input
                  type="number"
                  min={1}
                  max={80}
                  step={1}
                  value={config.raggioKm ?? 15}
                  onChange={(e) =>
                    aggiorna("raggioKm", Number(e.target.value) || 0)
                  }
                  className={inputClass}
                />
                <InlineGuidance item={guidanceRaggio} />
              </Campo>
              <p className="-mt-1.5 text-xs text-[var(--ink-muted)]">
                Stesso raggio usato per targeting Meta intorno al punto vendita.
              </p>
            </Passo1Sezione>
          ) : null}

          {isPercorsoEcommerce ? (
            <Passo1Sezione titolo="C · Mercato">
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                  Dove vendi?
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {MERCATI_SPEDIZIONE.map((m) => {
                    const attivo = shippingMarket === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => onCambiaShippingMarket?.(m.value)}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                          attivo
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent-muted)]"
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  Italia / Europa / Globale
                </p>
              </div>
            </Passo1Sezione>
          ) : null}

          {!isEcommerce && !isPercorsoRetargeting && !isPercorsoAwareness ? (
          <Passo1Sezione
            titolo={
              isPercorsoInstore
                  ? "D · Pubblico"
                  : "C · Pubblico"
            }
          >
          {isRetargeting ? (
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                Origine del Pubblico Caldo *
              </p>
              <div className="flex flex-col gap-2">
                {AUDIENZE_RETARGETING.map((opzione) => {
                  const attivo =
                    retargetingAudienceSource === opzione.value;
                  return (
                    <button
                      key={opzione.value}
                      type="button"
                      onClick={() =>
                        onCambiaRetargetingAudienceSource?.(opzione.value)
                      }
                      className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                        attivo
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-white hover:border-[var(--accent-muted)]"
                      }`}
                    >
                      <span
                        className={`block text-sm font-medium ${
                          attivo
                            ? "text-[var(--accent)]"
                            : "text-[var(--ink)]"
                        }`}
                      >
                        {opzione.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                        {opzione.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isBookings ? (
            <Passo1Sezione
              titolo={
                isPercorsoBookings
                  ? "B · Come prenota il cliente"
                  : "B · Prenotazione"
              }
            >
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                  {isPercorsoBookings
                    ? "Modalità di prenotazione *"
                    : "Dove preferisci ricevere le prenotazioni? *"}
                </p>
                <div className="flex flex-col gap-2">
                  {CANALI_PRENOTAZIONE.map((c) => {
                    const attivo = bookingChannel === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onCambiaBookingChannel?.(c.value)}
                        className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                          attivo
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-white hover:border-[var(--accent-muted)]"
                        }`}
                      >
                        <span
                          className={`block text-sm font-medium ${
                            attivo
                              ? "text-[var(--accent)]"
                              : "text-[var(--ink)]"
                          }`}
                        >
                          {c.label}
                        </span>
                        {c.hint ? (
                          <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                            {c.hint}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isPercorsoBookings && bookingChannel === "WHATSAPP" ? (
                <div>
                  <Campo etichetta="Numero WhatsApp Business (opzionale)">
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => onCambiaWhatsappNumber?.(e.target.value)}
                      placeholder="Es. +39 333 1234567"
                      className={inputClass}
                      autoComplete="tel"
                    />
                  </Campo>
                  <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                    Utile per l&apos;export Meta. Se già collegato alla Pagina
                    Facebook, puoi lasciare vuoto.
                  </p>
                </div>
              ) : null}

              {isPercorsoBookings && bookingChannel === "BOOKING_LINK" ? (
                <div>
                  <Campo etichetta="Link calendario / pagina prenotazioni (opzionale)">
                    <input
                      type="url"
                      value={sitoWeb}
                      onChange={(e) => onCambiaSitoWeb(e.target.value)}
                      placeholder="Es. https://calendly.com/studio-rossi"
                      className={inputClass}
                      autoComplete="url"
                    />
                  </Campo>
                  <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                    URL del software di prenotazione o pagina con slot
                    disponibili.
                  </p>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                  Modalità di conferma appuntamento
                </p>
                <div className="flex flex-col gap-2">
                  {POLITICHE_CONFERMA.map((p) => {
                    const attivo = bookingConfirmationPolicy === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() =>
                          onCambiaBookingConfirmationPolicy?.(p.value)
                        }
                        className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                          attivo
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--border)] bg-white text-[var(--ink)] hover:border-[var(--accent-muted)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isPercorsoBookings ? (
                <div>
                  <Campo etichetta="Posti disponibili questa settimana (opzionale)">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={postiDisponibiliSettimana}
                      onChange={(e) =>
                        onCambiaPostiDisponibiliSettimana?.(e.target.value)
                      }
                      placeholder="Es. 8 — lascia vuoto se non vuoi indicare disponibilità"
                      className={inputClass}
                      inputMode="numeric"
                    />
                  </Campo>
                  <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                    Solo per personalizzare il copy: se lasci vuoto, non
                    inseriamo numeri di posti nell&apos;annuncio.
                  </p>
                </div>
              ) : null}
            </Passo1Sezione>
          ) : null}

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                Tipo Cliente
              </p>
              <div className="aff-seg-track flex-col sm:flex-row">
                {(
                  [
                    {
                      value: "B2C" as const,
                      label: "B2C — Privati / Famiglie",
                    },
                    {
                      value: "B2B" as const,
                      label: "B2B — Aziende / Professionisti",
                    },
                  ] as const
                ).map((opzione) => {
                  const attivo = targetType === opzione.value;
                  return (
                    <button
                      key={opzione.value}
                      type="button"
                      onClick={() => onCambiaTargetType?.(opzione.value)}
                      className={segClass(attivo, "flex-1 text-left")}
                    >
                      {opzione.label}
                    </button>
                  );
                })}
              </div>
              <InlineGuidance item={guidanceTipoCliente} />
            </div>
            <div>
              {isRetargeting ? (
                <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
                  Target: pubblico Custom Meta (audience caricata o tracciata
                  da Pixel/CAPI).
                </p>
              ) : (
                <>
                  <p className="mb-2 text-[13px] font-medium text-[var(--ink)]">
                    Fascia d&apos;Età prevalente
                  </p>
                  <div className="flex flex-wrap gap-1.5 rounded-[22px] bg-[var(--lavender-muted)] p-1.5 sm:flex-nowrap">
                    {(
                      [
                        { value: "18-35" as const, label: "18–35" },
                        { value: "25-50" as const, label: "25–50" },
                        { value: "35-65+" as const, label: "35–65+" },
                        { value: "all" as const, label: "Tutte le età" },
                      ] as const
                    ).map((opzione) => {
                      const attivo = targetAge === opzione.value;
                      return (
                        <button
                          key={opzione.value}
                          type="button"
                          onClick={() => onCambiaTargetAge?.(opzione.value)}
                          className={segClass(attivo)}
                        >
                          {opzione.label}
                        </button>
                      );
                    })}
                  </div>
                  <InlineGuidance item={guidanceEta} />
                </>
              )}
            </div>
          </Passo1Sezione>
          ) : null}

          <div className="space-y-4 rounded-[20px] bg-[rgba(122,116,168,0.28)] p-5 sm:p-6">
            <Campo etichetta="Nome campagna">
              <input
                type="text"
                value={config.nomeCampagna ?? ""}
                onChange={(e) => aggiorna("nomeCampagna", e.target.value)}
                className={inputClass}
              />
            </Campo>
            <p className="-mt-2 text-xs text-[var(--ink-muted)]">
              Lo usiamo per organizzare la campagna in Affianco — puoi
              lasciarlo com&apos;è se va bene.
            </p>

            {!isPercorsoEcommerce &&
            !isPercorsoInstore &&
            !isPercorsoRetargeting &&
            !isPercorsoAwareness ? (
            <div className="rounded-[20px] bg-[var(--lavender-muted)]/55 p-5 sm:p-6">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--ink)]">
                  {step1.briefLabel}
                </p>
                <BottoneCompilaAffianco />
              </div>
              <p className="mb-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                {step1.briefIntro}
              </p>
              <textarea
                key={`brief-${objectiveEffettivo}`}
                value={elevatorPitch}
                onChange={(e) => {
                  onCambiaElevatorPitch(e.target.value);
                  if (isEcommerce) onCambiaHeroProduct?.(e.target.value);
                }}
                rows={4}
                placeholder={step1.briefPlaceholder}
                className={`${erroriPasso1?.elevatorPitch ? inputErroreClass : inputClass} resize-y`}
                aria-invalid={erroriPasso1?.elevatorPitch ? true : undefined}
              />
              <InlineGuidance item={guidanceBrief} />
              {erroriPasso1?.elevatorPitch ? (
                <p className="mt-2 text-xs text-[#C45C5C]">
                  Campo obbligatorio: compila il brief prodotto / collezione.
                </p>
              ) : elevatorPitch.trim() ? (
                validazioneBrief.isValid ? (
                  <div className="mt-2 flex gap-3 rounded-[16px] bg-[var(--green-soft)]/80 px-4 py-3">
                    <CircleCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#2d6a4a]"
                      strokeWidth={1.75}
                    />
                    <p className="text-[13px] font-medium text-[#2d6a4a]">
                      Brief specifico e utilizzabile
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#C26A0A]">
                    {validazioneBrief.reason}
                  </p>
                )
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                  {step1.briefHint}
                </p>
              )}
            </div>
            ) : null}
          </div>
        </div>
      </section>
      <AffiancoSuggerisce items={guidanceStep1Residua} />
      </>
      ) : null}

      {mostra([2]) ? (
      <>
      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          {isPercorsoAwareness
            ? "Copertura del lancio"
            : isPercorsoEcommerce
            ? "Economia dell'acquisto"
            : isPercorsoInstore
              ? "Economia del punto vendita"
              : isPercorsoRetargeting
                ? "Economia del recupero"
              : isPercorsoBookings
                ? "Economia dell'appuntamento"
                : "Economia del Business"}
        </h2>
        {isPercorsoAwareness ? (
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
            Usa budget e CPM come riferimento per stimare l&apos;esposizione
            della campagna nell&apos;area scelta.
          </p>
        ) : isPercorsoEcommerce ? (
          <>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
              Calcola quanto può costarti un acquisto e quale ROAS serve per
              restare sostenibile.
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink)]">
              Prima di spendere, capisci qual è il limite economico della
              campagna.
            </p>
          </>
        ) : isPercorsoInstore ? (
          <>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
              Calcola quanto puoi permetterti di spendere per acquisire un nuovo
              cliente senza erodere il margine desiderato.
            </p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
              Questa campagna usa indicazioni/click come segnale operativo. Le
              visite fisiche in negozio non sono certificate direttamente da
              questo flusso.
            </p>
          </>
        ) : isPercorsoRetargeting ? (
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
            Calcola quanto puoi permetterti di spendere per recuperare una
            conversione senza compromettere il margine.
          </p>
        ) : isPercorsoBookings ? (
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
            Quanto può costare una prenotazione? Imposta valore appuntamento,
            tasso di presenza e margine per calcolare CPA target e break-even.
          </p>
        ) : null}
        <div className="mt-4 space-y-3.5">
          {isAwareness ? (
            <>
              <Campo etichetta="Budget Totale di Lancio (€)">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={launchBudget}
                  onChange={(e) =>
                    onCambiaLaunchBudget?.(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="300"
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                {isPercorsoAwareness
                  ? "Default del modello (modificabile). Budget complessivo usato per le stime di esposizione."
                  : "Es. 300€ — budget complessivo per inaugurazione, lancio o evento locale."}
              </p>
              {isPercorsoAwareness ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    Area locale (dal Passo 1)
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
                    Raggio: {raggioAwareness} km
                    {citta?.trim()
                      ? ` intorno a ${citta.trim()}`
                      : " — inserisci la città al Passo 1"}
                  </p>
                </div>
              ) : (
                <>
                  <Campo etichetta="Raggio Geografico dal Punto Vendita (km)">
                    <div className="flex gap-2">
                      {([5, 10, 15] as const).map((km) => {
                        const attivo = raggioAwareness === km;
                        return (
                          <button
                            key={km}
                            type="button"
                            onClick={() => aggiorna("raggioKm", km)}
                            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                              attivo
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent-muted)]"
                            }`}
                          >
                            {km} km
                          </button>
                        );
                      })}
                    </div>
                  </Campo>
                  <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                    {citta?.trim()
                      ? `${raggioAwareness} km intorno a ${citta.trim()}`
                      : "Raggio stretto intorno al punto vendita (inserisci la città al Passo 1)."}
                  </p>
                </>
              )}
              <Campo
                etichetta={
                  isPercorsoAwareness
                    ? "CPM di riferimento (€)"
                    : "CPM Stimato Area Locale (€)"
                }
              >
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={estimatedCpm}
                  onChange={(e) =>
                    onCambiaEstimatedCpm?.(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="7"
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                {isPercorsoAwareness
                  ? "Usato per il calcolo delle stime. Non è il CPM che Meta genererà necessariamente."
                  : "Default 7€ per 1.000 visualizzazioni in area locale."}
              </p>
              {budgetLancio > 0 &&
              cpmLocale > 0 &&
              impressionsAwareness > 0 ? (
                isPercorsoAwareness ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        STIMA · Impression
                      </p>
                      <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                        ~
                        {Math.abs(impressionsAwareness).toLocaleString("it-IT")}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                        Stima basata sul CPM impostato. Non utilizza dati live
                        Meta.
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        STIMA · Copertura indicativa
                      </p>
                      <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                        ≈{" "}
                        {Math.abs(personeUnicheAwareness).toLocaleString(
                          "it-IT",
                        )}{" "}
                        persone · stima indicativa
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                        Stima interna ottenuta dividendo le impression per una
                        frequenza media di riferimento pari a 2,5. Non utilizza
                        reach o frequenza live di Meta.
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                        Frequenza media di riferimento del modello: 2,5
                      </p>
                    </div>
                  </div>
                ) : (
                <div className="aff-panel-lilac p-4">
                  <p className="text-[13px] font-medium text-[var(--primary)]">
                    Copertura e Frequenza Locale
                  </p>
                  <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                    ~
                    {Math.abs(personeUnicheAwareness).toLocaleString("it-IT")}{" "}
                    residenti
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                    Impatto Stimato nel Raggio di {raggioAwareness} km
                    {citta?.trim() ? ` intorno a ${citta.trim()}` : ""}: ~
                    {Math.abs(impressionsAwareness).toLocaleString("it-IT")}{" "}
                    visualizzazioni totali per raggiungere circa{" "}
                    {Math.abs(personeUnicheAwareness).toLocaleString("it-IT")}{" "}
                    residenti unici.
                  </p>
                </div>
                )
              ) : null}
            </>
          ) : isEcommerce ? (
            <>
              <Campo
                etichetta={
                  isPercorsoEcommerce
                    ? "Valore medio ordine / AOV (€)"
                    : "Carrello Medio / AOV (€)"
                }
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={scontrinoMedio}
                  onChange={(e) =>
                    onCambiaScontrinoMedio(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="Es. 65"
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                Valore medio di un ordine completato sul tuo store.
              </p>

              <Campo
                etichetta={
                  isPercorsoEcommerce
                    ? "Margine prodotto (%)"
                    : "Margine Lordo Prodotto (%)"
                }
              >
                <div className="space-y-2">
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={1}
                    value={Math.min(
                      90,
                      Math.max(10, Number(productMargin) || 60),
                    )}
                    onChange={(e) =>
                      onCambiaProductMargin?.(Number(e.target.value))
                    }
                    className="w-full accent-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--ink-muted)]">10%</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={productMargin}
                      onChange={(e) =>
                        onCambiaProductMargin?.(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="60"
                      className={`${inputClass} max-w-[7rem]`}
                    />
                    <span className="text-xs text-[var(--ink-muted)]">90%</span>
                  </div>
                </div>
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                Default 60%. Percentuale di guadagno lordo sul prodotto prima
                delle spese di spedizione.
              </p>

              <Campo
                etichetta={
                  isPercorsoEcommerce
                    ? "Costo fulfillment (€)"
                    : "Costo Spedizione & Fulfillment a carico dello store (€)"
                }
              >
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={fulfillmentCost}
                  onChange={(e) =>
                    onCambiaFulfillmentCost?.(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="Es. 5"
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                Costo medio per ordine che resta a carico tuo (spedizione,
                packaging, fulfillment).
              </p>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3.5">
                <Interruttore
                  attivo={ecommerceLtvAttivo}
                  onCambia={(v) => onCambiaEcommerceLtvAttivo?.(v)}
                  etichetta="Fattore LTV / Riacquisto 60 giorni"
                  descrizione="Se attivo, mostra un uplift informativo (+20% sulla CPA Max). Il break-even resta AOV × margine − spedizione."
                />
              </div>

              {valoreVisita > 0 &&
              margineProdotto > 0 &&
              cpaMaxAcquisto > 0 ? (
                <div className="aff-panel-lilac p-4">
                  <p className="text-[13px] font-medium text-[var(--primary)]">
                    {isPercorsoEcommerce
                      ? "Limiti economici della campagna"
                      : "ROAS & CPA Max in tempo reale"}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {!isPercorsoEcommerce ? (
                      <div>
                        <p className="text-xs text-[var(--ink-muted)]">
                          Margine Netto per Ordine
                        </p>
                        <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                          {margineNettoEcommerce}€
                        </p>
                      </div>
                    ) : null}
                    <div className={isPercorsoEcommerce ? "sm:col-span-2" : undefined}>
                      <p className="text-xs text-[var(--ink-muted)]">
                        CPA Max (Break-Even)
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                        {cpaMaxAcquisto}€
                      </p>
                      {isPercorsoEcommerce ? (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                          Il costo massimo per acquisto prima di erodere
                          completamente il margine disponibile.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">
                        Break-Even ROAS
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                        {roasBreakEven}x
                      </p>
                      {isPercorsoEcommerce ? (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                          Sotto questa soglia la campagna non copre il margine
                          disponibile.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">
                        {isPercorsoEcommerce
                          ? "Target ROAS"
                          : "Target ROAS (profitto 30%)"}
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                        {roasTarget}x
                      </p>
                      {isPercorsoEcommerce ? (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                          Obiettivo di riferimento con margine di sicurezza del
                          30%.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <BarraRoasEcommerce
                    breakEvenRoas={roasBreakEven}
                    targetRoas={roasTarget}
                    roasRiferimento={roasTarget}
                  />
                  {riferimentoMercato ? (
                    <p className="mt-2 rounded-lg border border-[#c6d8f0] bg-[#f3f7fc] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
                      Asta Meta · {riferimentoMercato.etichetta}: CPA tipico{" "}
                      <span className="font-medium">
                        {riferimentoMercato.min}–{riferimentoMercato.max}€
                      </span>
                      . Confronta il tuo CPA Max con questo range.
                    </p>
                  ) : null}
                  <p className="mt-4 rounded-lg border border-[#c6d8f0] bg-white/80 px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)]">
                    💡 Regola E-commerce: CPA Max ={" "}
                    <span className="font-medium">{valoreVisita}€</span> ×{" "}
                    <span className="font-medium">{margineProdotto}%</span>
                    {costoFulfillment > 0
                      ? ` − ${costoFulfillment}€ spedizione`
                      : ""}{" "}
                    = <span className="font-medium">{cpaMaxAcquisto}€</span>.
                    Break-Even ROAS = {valoreVisita} / {cpaMaxAcquisto} ={" "}
                    <span className="font-medium">{roasBreakEven}x</span>.
                    {ecommerceLtvAttivo ? (
                      <>
                        {" "}
                        Con LTV (+20%): CPA fino a{" "}
                        <span className="font-medium">
                          {Math.round(cpaMaxAcquisto * 1.2 * 100) / 100}€
                        </span>
                        .
                      </>
                    ) : null}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--ink-muted)]">
                  Inserisci AOV e margine per calcolare CPA Max e ROAS.
                </p>
              )}
            </>
          ) : (
            <>
          <Campo
            etichetta={
              isRetargeting
                ? "Valore medio del contatto o carrello da recuperare (€)"
                : isInStore
                  ? "Scontrino Medio alla Cassa (€)"
                  : isPercorsoBookings
                    ? "Valore medio appuntamento (€)"
                    : isBookings
                      ? "Valore medio della prima visita/servizio (€)"
                      : "Scontrino medio / Valore vendita cliente (€)"
            }
          >
            <input
              type="number"
              min={0}
              step={
                isBookings || isInStore || isRetargeting
                  ? 10
                  : 50
              }
              value={scontrinoMedio}
              onChange={(e) =>
                onCambiaScontrinoMedio(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              placeholder={
                isRetargeting
                  ? "100"
                  : isInStore
                    ? "40"
                    : isBookings
                      ? "60"
                      : "1500"
              }
              className={inputClass}
            />
          </Campo>
          <p className="-mt-2 text-xs text-[var(--ink-muted)]">
            {isRetargeting
              ? "Es. 100€ — valore medio del carrello o del contatto da ripescare."
              : isInStore
                ? "Es. 40€ — scontrino medio di chi compra in negozio."
                : isBookings
                    ? isPercorsoBookings
                      ? "Es. 60€ — base per calcolare il costo target per prenotazione (CPA)."
                      : "Es. 60€ — base per il CPA massimo per appuntamento confermato."
                    : isPercorsoLeads
                      ? "Valore medio di una vendita al cliente. Usato per calcolare il CPL di riferimento."
                      : "Base per calcolare il CPL target di riferimento e il break-even."}
          </p>
          {isPercorsoLeads ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Proviene dal Passo 1 (brief/offerta) o da dati che inserisci qui:
              non è un dato automatico di Meta.
            </p>
          ) : null}
          {isInStore || isRetargeting ? (
            <>
              <Campo
                etichetta={
                  isRetargeting
                    ? "Margine Lordo (%)"
                    : "Margine Medio Lordo in Negozio (%)"
                }
              >
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={productMargin}
                  onChange={(e) =>
                    onCambiaProductMargin?.(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="40"
                  className={inputClass}
                />
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                {isPercorsoRetargeting
                  ? "Valore iniziale del form (modificabile). Non è un dato di mercato."
                  : isRetargeting
                  ? "Percentuale di margine lordo sul valore recuperato (es. 50%)."
                  : "Percentuale di margine lordo medio sui prodotti fisici (es. 40%)."}
              </p>
              {isRetargeting ? (
                <>
                  <Campo etichetta="Incentivo/Sconto offerto per chi chiude oggi (%)">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={recoveryDiscount}
                      onChange={(e) =>
                        onCambiaRecoveryDiscount?.(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </Campo>
                  <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                    {isPercorsoRetargeting
                      ? "Opzionale. Lascia 0% se non stai offrendo uno sconto reale."
                      : "Opzionale — es. 10%. Riduce il valore netto su cui calcoli il CPA di recupero."}
                  </p>
                </>
              ) : null}
            </>
          ) : isBookings ? (
            <>
              <Campo
                etichetta={
                  isPercorsoBookings
                    ? "Tasso di presenza (show-up) %"
                    : "Tasso di presenza in agenda stimato / Show-Up Rate (%)"
                }
              >
                <div className="space-y-2">
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={1}
                    value={Math.min(100, Math.max(50, showUp))}
                    onChange={(e) =>
                      onCambiaTassoConversione(Number(e.target.value))
                    }
                    className="w-full accent-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--ink-muted)]">50%</span>
                    <input
                      type="number"
                      min={50}
                      max={100}
                      step={1}
                      value={tassoConversione}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (e.target.value === "") {
                          onCambiaTassoConversione("");
                          return;
                        }
                        onCambiaTassoConversione(
                          Math.min(100, Math.max(50, n)),
                        );
                      }}
                      className={`${inputClass} max-w-[100px] text-center`}
                    />
                    <span className="text-xs text-[var(--ink-muted)]">100%</span>
                  </div>
                </div>
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                {isPercorsoBookings
                  ? "Percentuale di persone prenotate che si presentano davvero (default 75%). Usata per il break-even reale."
                  : "Quante persone prenotate si presentano davvero (default 75%)."}
              </p>
            </>
          ) : isPercorsoLeads ? (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--ink)]">
                  Conosci il tasso di conversione?
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "REAL" as const, label: "Dato reale" },
                      { value: "ESTIMATED" as const, label: "Stima" },
                      { value: "UNKNOWN" as const, label: "Non lo so" },
                    ] as const
                  ).map((opzione) => (
                    <button
                      key={opzione.value}
                      type="button"
                      onClick={() =>
                        selezionaConversionRateSource(opzione.value)
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        conversionRateSource === opzione.value
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-white text-[var(--ink-muted)]"
                      }`}
                    >
                      {opzione.label}
                    </button>
                  ))}
                </div>
              </div>

              {conversionRateSource === "REAL" ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
                  <p className="text-xs text-[var(--ink-muted)]">
                    Usa dati storici del cliente.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etichetta="Lead ricevuti">
                      <input
                        type="number"
                        min={1}
                        value={leadRicevuti}
                        onChange={(e) => {
                          const valore =
                            e.target.value === "" ? "" : Number(e.target.value);
                          setLeadRicevuti(valore);
                          aggiornaCalcolatoreConversione(valore, clientiAcquisiti);
                        }}
                        placeholder="60"
                        className={inputClass}
                      />
                    </Campo>
                    <Campo etichetta="Clienti acquisiti">
                      <input
                        type="number"
                        min={0}
                        value={clientiAcquisiti}
                        onChange={(e) => {
                          const valore =
                            e.target.value === "" ? "" : Number(e.target.value);
                          setClientiAcquisiti(valore);
                          aggiornaCalcolatoreConversione(leadRicevuti, valore);
                        }}
                        placeholder="9"
                        className={inputClass}
                      />
                    </Campo>
                  </div>
                  <Campo etichetta="Tasso di conversione calcolato (%)">
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={tassoConversione}
                      onChange={(e) =>
                        onCambiaTassoConversione(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="15"
                      className={inputClass}
                    />
                  </Campo>
                </div>
              ) : null}

              {conversionRateSource === "ESTIMATED" ? (
                <div className="space-y-3">
                  <Campo etichetta="Tasso di conversione stimato (%)">
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={tassoConversione}
                      onChange={(e) =>
                        onCambiaTassoConversione(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="Inserisci una stima"
                      className={inputClass}
                    />
                  </Campo>
                  <p className="text-xs text-[var(--ink-muted)]">
                    <span className="font-medium text-[var(--ink)]">
                      Dato stimato.
                    </span>{" "}
                    È un valore indicativo. Sostituiscilo con il dato reale
                    appena disponibile.
                  </p>
                </div>
              ) : null}

              {conversionRateSource === "UNKNOWN" ? (
                <div className="rounded-xl border border-[#f5e0c8] bg-[#fffaf3] p-4">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    Soglia economica non ancora disponibile
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-muted)]">
                    Per calcolarla serve sapere quante richieste diventano
                    mediamente clienti.
                  </p>
                  <p className="mt-3 text-sm text-[var(--ink)]">
                    Chiedi al cliente:
                  </p>
                  <p className="mt-1 text-sm italic text-[var(--ink-muted)]">
                    &quot;Negli ultimi 30/60/90 giorni quante richieste avete
                    ricevuto e quante sono diventate clienti?&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => selezionaConversionRateSource("ESTIMATED")}
                    className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--accent)] bg-white px-4 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
                  >
                    Inserisco una stima temporanea
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <Campo etichetta="Tasso di conversione stimato da lead a cliente (%)">
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={tassoConversione}
                onChange={(e) =>
                  onCambiaTassoConversione(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="10"
                className={inputClass}
              />
            </Campo>
          )}
          {!isRetargeting ? (
            <>
              <Campo
                etichetta={
                  isEcommerce || isInStore
                    ? "Margine di Profitto Desiderato sulla campagna"
                    : isPercorsoBookings
                      ? "Margine di profitto target per appuntamento"
                      : "Margine di Profitto Target"
                }
              >
                <div className="flex gap-2">
                  {([30, 50, 70] as const).map((opzione) => {
                    const attivo = targetMargin === opzione;
                    return (
                      <button
                        key={opzione}
                        type="button"
                        onClick={() => onCambiaTargetMargin(opzione)}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          attivo
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent-muted)]"
                        }`}
                      >
                        {opzione}%
                      </button>
                    );
                  })}
                </div>
              </Campo>
              <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                Percentuale di guadagno da preservare su ogni{" "}
                {isInStore
                  ? "acquisto in negozio"
                  : isEcommerce
                    ? "ordine"
                    : isBookings
                      ? isPercorsoBookings
                        ? "appuntamento"
                        : "appuntamento/visita"
                      : "vendita"}
                . Default 50%.
              </p>
            </>
          ) : null}

          {mostraLtv ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3.5">
              <Interruttore
                attivo={ltvAttivo}
                onCambia={(v) => onCambiaLtvAttivo?.(v)}
                etichetta="Modello Business Ricorrente / LTV"
                descrizione="Analisi Avanzata LTV: stima il valore sul ciclo di vita del cliente, non solo sul primo acquisto."
              />
              {ltvAttivo ? (
                <div className="mt-4 space-y-3.5 border-t border-[var(--border)] pt-4">
                  <Campo etichetta="Frequenza d'acquisto annuale per cliente">
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={frequenzaAnnuale}
                      onChange={(e) =>
                        onCambiaFrequenzaAnnuale?.(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                      placeholder="1"
                      className={inputClass}
                    />
                  </Campo>
                  <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                    Quante volte all&apos;anno un cliente tipico compra o
                    rinnova. Default 1.
                  </p>
                  <Campo etichetta="Anni di permanenza media del cliente">
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={anniPermanenza}
                      onChange={(e) =>
                        onCambiaAnniPermanenza?.(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                      placeholder="1"
                      className={inputClass}
                    />
                  </Campo>
                  <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                    Quanti anni resta mediamente un cliente. Default 1.
                  </p>
                  <Campo etichetta="Tasso di Riacquisto / Loyalty (%)">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={loyaltyPercent}
                      onChange={(e) =>
                        onCambiaLoyaltyPercent?.(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </Campo>
                  <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                    Uplift opzionale sull&apos;LTV (es. 20% → LTV × 1,2).
                    Default 0%.
                  </p>
                  <Campo etichetta="Margine Lordo (%)">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={margineLordoLtv}
                      onChange={(e) =>
                        onCambiaMargineLordoLtv?.(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                      placeholder="50"
                      className={inputClass}
                    />
                  </Campo>
                  <p className="-mt-2 text-xs text-[var(--ink-muted)]">
                    Margine lordo sul fatturato LTV, per calcolare il valore
                    netto cliente. Default 50%.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {isRetargeting &&
          valoreVisita > 0 &&
          cpaRecupero > 0 ? (
            <div className="aff-panel-lilac p-4">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                {isPercorsoRetargeting
                  ? "CPA Max sostenibile"
                  : "CPA Massima Sostenibile di Recupero"}
              </p>
              <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                {cpaRecupero}€
              </p>
              {isPercorsoRetargeting ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                    È una soglia economica di riferimento per il recupero, non
                    una previsione del CPA che Meta genererà.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                    Il calcolo applica il buffer operativo previsto dal modello
                    Affianco (×0,6). Non è un benchmark Meta.
                  </p>
                  <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--ink)]">
                    Valore netto:{" "}
                    <span className="font-medium">{valoreNettoRecupero}€</span>
                    {" · "}
                    CPA max:{" "}
                    <span className="font-medium">{cpaRecupero}€</span>
                  </p>
                </>
              ) : (
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                Costo Max Sostenibile per Recupero:{" "}
                <span className="font-medium">{cpaRecupero}€</span> per ogni
                cliente ripescato
                {valoreNettoRecupero > 0
                  ? ` (valore netto ${valoreNettoRecupero}€ × margine ${margineProdotto}% × 0,6).`
                  : "."}
              </p>
              )}
            </div>
          ) : null}
          {isInStore &&
          valoreVisita > 0 &&
          utilePerScontrino > 0 &&
          cpaInStore > 0 ? (
            <div className="aff-panel-lilac p-4">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                {isPercorsoInstore
                  ? "CPA Max sostenibile"
                  : "CPA In-Store Sostenibile"}
              </p>
              <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                {cpaInStore}€
              </p>
              {isPercorsoInstore ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                    È la soglia economica massima che puoi permetterti per un
                    nuovo cliente in negozio mantenendo il margine desiderato.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                    Non è una previsione del costo che Meta genererà.
                  </p>
                  <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--ink)]">
                    Utile per scontrino:{" "}
                    <span className="font-medium">{utilePerScontrino}€</span>
                    {" · "}
                    CPA max:{" "}
                    <span className="font-medium">{cpaInStore}€</span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                  Utile per Scontrino:{" "}
                  <span className="font-medium">{utilePerScontrino}€</span> | Costo
                  Max Sostenibile:{" "}
                  <span className="font-medium">{cpaInStore}€</span> per ogni
                  persona che compra in negozio grazie all&apos;annuncio.
                </p>
              )}
            </div>
          ) : null}
          {isBookings && valoreVisita > 0 && cpaSostenibile > 0 ? (
            <div className="aff-panel-lilac p-4">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                {ltvEconomics
                  ? "CPA e LTV — Prenotazioni"
                  : isPercorsoBookings
                    ? "Costo target per prenotazione (CPA max)"
                    : "CPA Massimo Sostenibile per Appuntamento Confermato"}
              </p>
              {ltvEconomics ? (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">
                        CPA Limite sul Primo Appuntamento
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                        {ltvEconomics.cplPrimoAcquisto}€
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">
                        CPA Limite Sostenibile su LTV a{" "}
                        {ltvEconomics.anniPermanenza}{" "}
                        {ltvEconomics.anniPermanenza === 1 ? "Anno" : "Anni"}
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                        {ltvEconomics.cplSostenibileLtv}€
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
                    LTV {ltvEconomics.ltv}€ · Valore netto{" "}
                    {ltvEconomics.valoreNettoCliente}€ · Break-even LTV{" "}
                    {ltvEconomics.breakEvenCpl}€
                  </p>
                  <p className="mt-2 rounded-[16px] bg-white px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)]">
                    Un acquisito al CPA limite di{" "}
                    <span className="font-medium">
                      {ltvEconomics.cplSostenibileLtv}€
                    </span>{" "}
                    genera un valore complessivo di{" "}
                    <span className="font-medium">{ltvEconomics.ltv}€</span> nel
                    ciclo di vita del cliente.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ink)]">
                    {cpaSostenibile}€
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                    {isPercorsoBookings ? (
                      <>
                        Break-even prenotazione:{" "}
                        <span className="font-medium">
                          {valoreRealePrenotazione}€
                        </span>{" "}
                        ({valoreVisita}€ × {showUp}% show-up) · CPA target:{" "}
                        <span className="font-medium">{cpaSostenibile}€</span>{" "}
                        per ogni cliente che si presenta in struttura.
                      </>
                    ) : (
                      <>
                        Valore Reale della Prenotazione:{" "}
                        <span className="font-medium">
                          {valoreRealePrenotazione}€
                        </span>{" "}
                        ({valoreVisita}€ × {showUp}%) | Target di Sicurezza:{" "}
                        <span className="font-medium">{cpaSostenibile}€</span>{" "}
                        per ogni persona che si presenta in cassa.
                      </>
                    )}
                  </p>
                </>
              )}
              {breakEvenPerBarra > 0 && targetPerBarra > 0 ? (
                <BarraBreakEven
                  breakEven={breakEvenPerBarra}
                  targetProfitto={targetPerBarra}
                  etichettaCosto="CPA"
                  alert={alertFattibilita}
                  riferimentoMercato={riferimentoMercato}
                />
              ) : null}
            </div>
          ) : null}
          {!isBookings &&
          !isEcommerce &&
          !isInStore &&
          !isRetargeting &&
          !isAwareness &&
          valoreVisita > 0 &&
          (cplPrimoAcquistoLeads > 0 || ltvEconomics) ? (
            <div className="aff-panel-lilac p-4 sm:p-5">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                {ltvEconomics
                  ? "CPL e LTV — Sostenibilità acquisizione"
                  : "CPL target di riferimento"}
              </p>
              {conversionRateSource === "ESTIMATED" && !ltvEconomics ? (
                <p className="mt-2 inline-flex rounded-full bg-[var(--yellow-soft)] px-2.5 py-0.5 text-xs font-medium text-[#6b5420]">
                  Calcolo basato su una stima
                </p>
              ) : null}
              {conversionRateSource === "REAL" && !ltvEconomics ? (
                <p className="mt-2 inline-flex rounded-full bg-[var(--green-soft)] px-2.5 py-0.5 text-xs font-medium text-[#2d6a4a]">
                  Dato reale
                </p>
              ) : null}
              {!ltvEconomics ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                  È la soglia economica stimata sulla base dei dati inseriti.
                  Non è una previsione del costo reale che otterrai su Meta.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Soglie calcolate sul modello LTV attivo. Non sono previsioni
                  del costo reale su Meta.
                </p>
              )}
              {ltvEconomics ? (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/80 px-3 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        CPL target · primo acquisto
                      </p>
                      <p className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)]">
                        {ltvEconomics.cplPrimoAcquisto}€
                      </p>
                    </div>
                    <div className="rounded-[16px] bg-white px-3 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        CPL target · LTV ({ltvEconomics.anniPermanenza}{" "}
                        {ltvEconomics.anniPermanenza === 1 ? "anno" : "anni"})
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-tight text-[var(--ink)]">
                        {ltvEconomics.cplSostenibileLtv}€
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--border)] pt-3">
                    <p className="text-xs text-[var(--ink-muted)]">
                      Break-even teorico (LTV)
                    </p>
                    <p className="text-sm font-medium text-[var(--ink-muted)]">
                      {ltvEconomics.breakEvenCpl}€
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
                    LTV {ltvEconomics.ltv}€ · Valore netto{" "}
                    {ltvEconomics.valoreNettoCliente}€
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                    Un acquisito al CPL target di{" "}
                    <span className="font-medium text-[var(--ink)]">
                      {ltvEconomics.cplSostenibileLtv}€
                    </span>{" "}
                    genera un valore complessivo di{" "}
                    <span className="font-medium text-[var(--ink)]">
                      {ltvEconomics.ltv}€
                    </span>{" "}
                    nel ciclo di vita del cliente.
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">
                        CPL target
                      </p>
                      <p className="mt-1 text-3xl font-medium tracking-tight text-[var(--ink)]">
                        {cplPrimoAcquistoLeads}€
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--ink-muted)]">
                        Break-even teorico
                      </p>
                      <p className="mt-1 text-lg font-medium tracking-tight text-[var(--ink-muted)]">
                        {breakEvenLeads}€
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
                    Con margine target {targetMargin}% e tasso di chiusura{" "}
                    {showUp}%, sotto {cplPrimoAcquistoLeads}€ di CPL resti
                    entro la soglia economica definita.
                  </p>
                </>
              )}
              <LegendaCplDidattica />
              <SpiegazioneCalcoloCpl
                scontrinoMedio={valoreVisita}
                tassoConversione={showUp}
                targetMargin={targetMargin}
                breakEven={breakEvenPerBarra}
                cplTarget={targetPerBarra}
                etichettaCosto="CPL"
              />
              {breakEvenPerBarra > 0 && targetPerBarra > 0 ? (
                <BarraBreakEven
                  breakEven={breakEvenPerBarra}
                  targetProfitto={targetPerBarra}
                  etichettaCosto="CPL"
                  alert={alertFattibilita}
                  riferimentoMercato={riferimentoMercato}
                />
              ) : null}
            </div>
          ) : null}
            </>
          )}
        </div>
      </section>

      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Budget e strategia
        </h2>
        <dl className="mt-4">
          <Campo etichetta="Budget giornaliero (€)">
            <input
              type="number"
              min={1}
              step={1}
              value={config.budgetGiornaliero ?? 20}
              onChange={(e) =>
                aggiorna("budgetGiornaliero", Number(e.target.value) || 0)
              }
              className={inputClass}
            />
            <InlineGuidance item={guidanceBudgetRaggio} />
          </Campo>
          <div className="mt-3">
            <RigaSolaLettura
              etichetta="Budget della campagna (Advantage+ Budget / CBO)"
              valore={config.cboAttivo ? "Attivo" : "Disattivo"}
            />
          </div>
        </dl>
      </section>

      <AffiancoSuggerisce items={guidanceEconomica} />

      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Pubblico e targeting
        </h2>
        <dl className="mt-4">
          {isRetargeting ? (
            isPercorsoRetargeting ? (
              <>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    Da configurare in Meta
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--ink)]">
                    <li>Custom Audience</li>
                    <li>Finestra del pubblico</li>
                    <li>Eventuali esclusioni</li>
                  </ul>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                    Affianco non configura automaticamente questi elementi
                    nell&apos;export.
                  </p>
                </div>
                <RigaSolaLettura
                  etichetta="Genere (export)"
                  valore={config.genere}
                />
              </>
            ) : (
            <>
              <RigaSolaLettura
                etichetta="Zona"
                valore="Nazionale / Global (In base ai visitatori del sito/social)"
              />
              <RigaSolaLettura
                etichetta="Età"
                valore="Tutte le età (Senza filtri anagrafici)"
              />
              <RigaSolaLettura etichetta="Genere" valore={config.genere} />
              <RigaSolaLettura
                etichetta="Targeting"
                valore="Custom Audience (Carrelli 14gg / Visitatori Sito 30gg / Interazioni IG & FB)"
              />
            </>
            )
          ) : (
            <>
              {isEcommerce || isPercorsoInstore || isPercorsoAwareness ? null : (
                <Campo etichetta="Raggio locale (km)">
                  <input
                    type="number"
                    min={1}
                    max={80}
                    step={1}
                    value={config.raggioKm ?? 15}
                    onChange={(e) =>
                      aggiorna("raggioKm", Number(e.target.value) || 0)
                    }
                    className={inputClass}
                  />
                  <InlineGuidance item={guidanceRaggio} />
                </Campo>
              )}
              <RigaSolaLettura
                etichetta={isEcommerce ? "Zona di Spedizione" : "Zona"}
                valore={
                  isEcommerce
                    ? shippingMarket === "EUROPE"
                      ? "Europa (Copertura Broad)"
                      : shippingMarket === "GLOBAL"
                        ? "Globale (Copertura Broad)"
                        : "Italia Intera (Copertura Nazionale Broad)"
                    : citta?.trim()
                      ? `${config.raggioKm} km intorno a ${citta.trim()}`
                      : `${config.raggioKm} km (inserisci Città / Quartiere al Passo 1)`
                }
              />
              <RigaSolaLettura
                etichetta="Età"
                valore={`${config.etaMin}–${config.etaMax} anni`}
              />
              <RigaSolaLettura etichetta="Genere" valore={config.genere} />
              <RigaSolaLettura
                etichetta="Targeting"
                valore={
                  config.targetingBroad
                    ? "Broad (senza interessi)"
                    : "Con interessi"
                }
              />
            </>
          )}
          <RigaSolaLettura
            etichetta="Posizionamenti automatici (Advantage+ Placements)"
            valore={
              config.posizionamentiAdvantage ? "Attivi" : "Manuali"
            }
          />
        </dl>
      </section>
      </>
      ) : null}

      {mostra([3]) ? (
      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
        {isPercorsoLeads ? (
          <header>
            <h2 className="text-base font-medium text-[var(--ink)]">
              Troviamo il messaggio
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
              Affianco controlla che il messaggio sia chiaro, leggibile su
              mobile e coerente con l&apos;offerta.
            </p>
            {copyInPreparazione ? (
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                Affianco sta preparando una bozza di partenza — rivedi e
                correggi prima del lancio.
              </p>
            ) : copyPreparazioneNota ? (
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                {copyPreparazioneNota}
              </p>
            ) : (
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                Parti dalla Variante A, modifica liberamente e usa il controllo
                sotto per verificare hook, beneficio e CTA.
              </p>
            )}
          </header>
        ) : isPercorsoBookings ? (
          <header>
            <h2 className="text-base font-medium text-[var(--ink)]">
              Rendiamo facile prenotare
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
              Affianco controlla che l&apos;annuncio abbia un motivo chiaro per
              prenotare ora e un invito coerente con il canale scelto.
            </p>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Parti dalla Variante A, modifica liberamente e usa il controllo
              sotto prima del lancio.
            </p>
          </header>
        ) : isPercorsoEcommerce ? (
          <header>
            <h2 className="text-base font-medium text-[var(--ink)]">
              Rendiamo l&apos;offerta acquistabile
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
              Controlla che prodotto, beneficio, offerta e CTA siano chiari
              prima di passare alla creatività.
            </p>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Parti dalla Variante A, modifica liberamente e usa il controllo
              sotto prima del lancio.
            </p>
          </header>
        ) : isPercorsoInstore ? (
          <header>
            <h2 className="text-base font-medium text-[var(--ink)]">
              Portiamo le persone verso il punto vendita
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
              Controlla che il messaggio dica chiaramente dove trovarti, perché
              vale la pena venire e cosa deve fare l&apos;utente.
            </p>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Parti dalla Variante A, modifica liberamente e usa il controllo
              sotto prima del lancio.
            </p>
          </header>
        ) : isPercorsoRetargeting ? (
          <header>
            <h2 className="text-base font-medium text-[var(--ink)]">
              Diamo un motivo per tornare
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
              Controlla che il messaggio ricordi il valore dell&apos;offerta
              senza sembrare invasivo o inventare urgenza.
            </p>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Parti dalla Variante A, modifica liberamente e usa il controllo
              sotto prima del lancio.
            </p>
          </header>
        ) : isPercorsoAwareness ? (
          <header>
            <h2 className="text-base font-medium text-[var(--ink)]">
              Facciamo conoscere l&apos;apertura
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
              Controlla che il messaggio spieghi cosa sta aprendo, dove e
              perché vale la pena scoprirlo.
            </p>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Parti dalla Variante A, modifica liberamente e usa il controllo
              sotto prima del lancio.
            </p>
          </header>
        ) : (
          <>
            <h2 className="text-sm font-medium text-[var(--ink)]">
              Messaggio &amp; Copywriting
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Usa la Variante A per il lancio. È quella che finisce nel file di
              importazione. I testi incorporano{" "}
              {isEcommerce
                ? "prodotto hero, offerta promo e CTA Acquista ora"
                : isInStore
                  ? "offerta in cassa, zona e CTA Ottieni indicazioni"
                  : isRetargeting
                    ? "incentivo di recupero e CTA Completa l'ordine"
                    : "offerta, città, settore e target"}
              .
            </p>
          </>
        )}
        <div className="mt-4">
          <Campo etichetta="Headline / Titolo annuncio">
            <input
              type="text"
              value={config.titoloAnnuncio ?? ""}
              onChange={(e) => aggiorna("titoloAnnuncio", e.target.value)}
              placeholder={
                isEcommerce
                  ? "Es. Siero Anti-Age — spedizione gratuita"
                  : "Es. Prima consulenza a Milano"
              }
              className={inputClass}
              maxLength={80}
            />
          </Campo>
          <p className="-mt-1 mb-3 text-xs text-[var(--ink-muted)]">
            Consigliato sotto i 50 caratteri per evitare tagli su mobile.
          </p>
        </div>

        <div className="mt-2">
          <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
            Tono di voce
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                {
                  value: "diretto" as const,
                  label: "⚡ Diretto & Promozionale",
                },
                {
                  value: "autorevole" as const,
                  label: "🛡️ Autorevole & Professionale",
                },
                {
                  value: "empatico" as const,
                  label: "🤝 Empatico & Risoluzione Problema",
                },
              ] as const
            ).map((opzione) => {
              const attivo = tonoVoce === opzione.value;
              return (
                <button
                  key={opzione.value}
                  type="button"
                  onClick={() => onCambiaTonoVoce?.(opzione.value)}
                  disabled={copyAiLoading}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    attivo
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent-muted)]"
                  }`}
                >
                  {opzione.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
            Seleziona il tono: Affianco adatterà le varianti mantenendo
            invariati offerta e contenuti.
          </p>
        </div>

        {onRigeneraVarianti ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={onRigeneraVarianti}
              disabled={copyAiLoading}
              className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copyAiLoading ? "Rigenerazione in corso…" : "Rigenera varianti"}
            </button>
          </div>
        ) : null}

        {isPercorsoLeads ? (
          <div className="mt-4">
            <CopyRecommendationCard
              recommendation={copyRecommendation}
              onUsaVariante={usaVarianteComePrimaria}
            />
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border-2 border-[var(--accent)]/30 bg-[var(--surface-hover)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--ink)]">
              {boxes[0]?.etichetta ?? "Variante A"}
            </p>
            <span className="rounded-full bg-[#fff6e5] px-2.5 py-0.5 text-xs font-medium text-[#9a6700]">
              {isPercorsoLeads ||
              isPercorsoBookings ||
              isPercorsoEcommerce ||
              isPercorsoInstore ||
              isPercorsoRetargeting ||
              isPercorsoAwareness
                ? "Usata per il lancio"
                : "Consigliato da Affianco per il lancio"}
            </span>
            {isPercorsoLeads ? (
              <BadgeCopyVariant
                status={statusCopyVariant(copyRecommendation, "A")}
              />
            ) : null}
          </div>
          <textarea
            value={valoriVarianti[0]}
            onChange={(e) => aggiorna("varianteA", e.target.value)}
            rows={4}
            className={`${inputClass} mt-2 resize-y`}
          />
          {isPercorsoLeads && controlloMessaggioLeads ? (
            <ControlloMessaggio
              risultato={controlloMessaggioLeads}
              variant="leads"
            />
          ) : isPercorsoBookings && controlloMessaggioBookings ? (
            <ControlloMessaggio
              risultato={controlloMessaggioBookings}
              variant="bookings"
            />
          ) : isPercorsoEcommerce && controlloMessaggioEcommerce ? (
            <ControlloMessaggio
              risultato={controlloMessaggioEcommerce}
              variant="ecommerce"
            />
          ) : isPercorsoInstore && controlloMessaggioInstore ? (
            <ControlloMessaggio
              risultato={controlloMessaggioInstore}
              variant="instore"
            />
          ) : isPercorsoRetargeting && controlloMessaggioRetargeting ? (
            <ControlloMessaggio
              risultato={controlloMessaggioRetargeting}
              variant="retargeting"
            />
          ) : isPercorsoAwareness && controlloMessaggioAwareness ? (
            <ControlloMessaggio
              risultato={controlloMessaggioAwareness}
              variant="awareness"
            />
          ) : !isPercorsoEcommerce &&
            !isPercorsoBookings &&
            !isPercorsoInstore &&
            !isPercorsoRetargeting &&
            !isPercorsoAwareness &&
            !hookOk ? (
            <div className="mt-3 rounded-xl border border-[#f5c9b8] bg-[#fff4f0] px-3.5 py-3 text-sm leading-relaxed text-[var(--ink)]">
              {isEcommerce ? (
                <>
                  ⚠️ Gancio incompleto su Mobile: assicurati che il Prodotto
                  Hero e/o l&apos;Offerta Promo compaiano nelle prime ~120
                  battute (prime due righe), prima del tasto &apos;Mostra
                  altro&apos;.
                </>
              ) : isRetargeting ? (
                <>
                  ⚠️ Gancio incompleto su Mobile: assicurati che l&apos;invito
                  a completare l&apos;ordine o la promo di recupero compaiano
                  nelle prime ~120 battute (prime due righe).
                </>
              ) : (
                <>
                  ⚠️ Gancio incompleto visibile su Mobile: Assicurati che la
                  città ({cittaHook}) e l&apos;offerta siano scritte nelle
                  prime due righe per catturare l&apos;attenzione prima del
                  tasto &apos;Mostra altro&apos;.
                </>
              )}
            </div>
          ) : !isPercorsoEcommerce &&
            !isPercorsoBookings &&
            !isPercorsoInstore &&
            !isPercorsoRetargeting &&
            hookOk ? (
            <p className="mt-2 text-xs text-[#2d6a4a]">
              {isEcommerce
                ? "✅ Hook mobile ok: Prodotto e Offerta visibili prima del 'Altro'."
                : isRetargeting
                  ? "✅ Hook mobile ok: Urgenza e incentivo di recupero ben visibili."
                  : "✅ Hook mobile ok: città e offerta nelle prime ~120 battute."}
            </p>
          ) : null}
        </div>

        {isBookings ? (
          <div className="mt-3 rounded-xl border border-[#c6d8f0] bg-[#f3f7fc] px-4 py-3">
            <p className="text-sm leading-relaxed text-[var(--ink)]">
              💡 Consiglio Anti No-Show: Per ridurre i clienti che non si
              presentano, invia un promemoria automatico via WhatsApp 24 ore
              prima dell&apos;appuntamento con la posizione Google Maps della
              struttura.
            </p>
          </div>
        ) : null}

        <details className="group mt-3 rounded-xl border border-[var(--border)] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            Hai esigenze particolari? Guarda le 2 varianti di testo alternative
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-[var(--border)] p-4">
            {boxes.slice(1).map((variante, indice) => (
              <div
                key={variante.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {variante.etichetta}
                  </p>
                  {isPercorsoLeads ? (
                    <BadgeCopyVariant
                      status={statusCopyVariant(
                        copyRecommendation,
                        indice === 0 ? "B" : "C",
                      )}
                    />
                  ) : null}
                </div>
                <textarea
                  value={valoriVarianti[indice + 1]}
                  onChange={(e) =>
                    aggiorna(
                      indice === 0 ? "varianteB" : "varianteC",
                      e.target.value,
                    )
                  }
                  rows={3}
                  className={`${inputClass} mt-2 resize-y`}
                />
              </div>
            ))}
          </div>
        </details>
      </section>
      ) : null}

      {mostra([4]) ? (
      <StudioCreativo
        settore={settore}
        nomeAzienda={config.nomeCliente}
        offerta={frontEndOffer}
        targetCpl={targetCplStudio}
        formatoCuratoId={formatoCuratoId}
        onSelezionaFormato={onSelezionaFormatoCurato}
        deconstructResult={deconstructResult}
        onDeconstructResult={onDeconstructResult}
        creativita={creativita}
        indiceAnteprima={indiceAnteprimaCreativita}
        onCambiaCreativita={onCambiaCreativita}
        onCambiaIndiceAnteprima={onCambiaIndiceAnteprimaCreativita}
        objective={objectiveEffettivo}
        formatoEcommerce={formatoEcommerce}
        onCambiaFormatoEcommerce={onCambiaFormatoEcommerce}
        creativeGuidelines={settoreIntel?.formatoVisualConsigliato}
        prioritaCampagna={
          isPercorsoLeads ||
          isPercorsoBookings ||
          isPercorsoEcommerce ||
          isPercorsoInstore
        }
        percorsoBookings={isPercorsoBookings}
        percorsoEcommerce={isPercorsoEcommerce}
        percorsoInstore={isPercorsoInstore}
        percorsoRetargeting={isPercorsoRetargeting}
        percorsoAwareness={isPercorsoAwareness}
        heroProduct={isPercorsoEcommerce ? heroProduct : undefined}
        elevatorPitch={elevatorPitch}
        targetType={isPercorsoRetargeting ? targetType : undefined}
        sitoWeb={
          isPercorsoRetargeting || isPercorsoAwareness ? sitoWeb : undefined
        }
        citta={
          isPercorsoInstore || isPercorsoAwareness ? citta : undefined
        }
        raggioKm={isPercorsoInstore ? config.raggioKm : undefined}
        postiDisponibiliSettimana={
          isPercorsoBookings ? postiDisponibiliSettimana : undefined
        }
        haCopy={(config.varianteA ?? "").trim().length > 0}
      />
      ) : null}

      {mostra([6]) ? (
      <>
      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          {isPercorsoLeads ||
          isPercorsoBookings ||
          isPercorsoEcommerce ||
          isPercorsoInstore ||
          isPercorsoRetargeting ||
          isPercorsoAwareness
            ? "2. Porta la campagna su Meta Ads Manager"
            : "2. Esporta per Meta Ads Manager"}
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          {isPercorsoRetargeting
            ? "Esporta il file strutturato per importare la campagna senza ricopiare manualmente le impostazioni."
            : isPercorsoAwareness
            ? "Esporta il file strutturato per importare la campagna in Meta Ads Manager senza ricopiare manualmente le impostazioni."
            : isPercorsoEcommerce || isPercorsoInstore
            ? "Esporta il file strutturato per importare la campagna in Meta Ads Manager senza ricopiare manualmente le impostazioni."
            : isPercorsoLeads || isPercorsoBookings
            ? "Affianco prepara il file strutturato per importare la campagna in bozza su Meta Ads Manager senza ricopiare manualmente testi e impostazioni."
            : "Inserisci gli ID account Meta, poi esporta il CSV Anti-Fuffa pronto per l'importazione in blocco."}
        </p>
        {isPercorsoInstore ? (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
            Meta ottimizza questa campagna per click e indicazioni verso il
            punto vendita. Le visite fisiche non vengono certificate
            direttamente da questo flusso.
          </p>
        ) : null}
        {isPercorsoAwareness ? (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
            {sitoWeb.trim()
              ? "La campagna viene impostata per generare click verso la destinazione indicata."
              : "La campagna viene impostata sulla copertura per aumentare l'esposizione del messaggio."}
          </p>
        ) : null}
        <div className="mt-4 space-y-3.5">
          <div>
            <Campo etichetta="ID Pagina Facebook del Cliente">
              <input
                type="text"
                value={pageId ?? ""}
                onChange={(e) => onCambiaPageId(e.target.value)}
                placeholder="Es. 102938475610293"
                className={inputClass}
                inputMode="numeric"
                autoComplete="off"
              />
            </Campo>
            <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
              Lo trovi nelle informazioni della pagina Facebook su Meta.
            </p>
          </div>

          {isBookings && bookingChannel === "WHATSAPP" && !isPercorsoBookings ? (
            <div>
              <Campo etichetta="Numero WhatsApp Business del Cliente (opzionale se già collegato alla Pagina FB)">
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => onCambiaWhatsappNumber?.(e.target.value)}
                  placeholder="Es. +39 333 1234567"
                  className={inputClass}
                  autoComplete="tel"
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Usato nel CSV come riferimento display. Se il numero è già
                collegato alla Pagina Facebook, puoi lasciare vuoto.
              </p>
            </div>
          ) : null}

          {isEcommerce ? (
            <div>
              <Campo etichetta="URL Pagina Prodotto / Store (Destination URL) *">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder="https://www.tuostore.it/prodotto-hero"
                  className={inputClass}
                  autoComplete="url"
                  required
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Link di destinazione dell&apos;annuncio (pagina prodotto o
                store). Obbligatorio per l&apos;export Meta.
              </p>
            </div>
          ) : null}

          {isInStore ? (
            <div>
              <Campo etichetta="URL Mappa Google / Pagina del Negozio (Destination URL) *">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder="Es. https://maps.google.com/... oppure https://www.ristorante.it"
                  className={inputClass}
                  autoComplete="url"
                  required
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Link di destinazione per la CTA «Ottieni indicazioni» (Maps o
                sito del negozio).
              </p>
            </div>
          ) : null}

          {isPercorsoRetargeting ? (
            <div>
              <Campo etichetta="Pagina di destinazione">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder="Es. https://www.tuostore.it/prodotto oppure landing"
                  className={inputClass}
                  autoComplete="url"
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Dove deve arrivare l&apos;utente dopo aver cliccato
                sull&apos;annuncio.
              </p>
            </div>
          ) : isRetargeting ? (
            <div>
              <Campo etichetta="URL Pagina di Destinazione / Checkout (Destination URL)*">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder="Es. https://www.tuostore.it/checkout oppure https://www.sito.it/offerta-riservata"
                  className={inputClass}
                  autoComplete="url"
                  required
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Link di destinazione per la CTA «Completa l&apos;ordine»
                (checkout o landing di recupero).
              </p>
            </div>
          ) : null}

          {isPercorsoAwareness ? (
            <div>
              <Campo etichetta="Pagina o mappa di destinazione">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder={
                    step1.sitePlaceholder ||
                    "Es. https://maps.google.com/... oppure https://www.sito.it/apertura"
                  }
                  className={inputClass}
                  autoComplete="url"
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Dove vuoi portare chi decide di approfondire o raggiungere
                l&apos;attività (sito, landing, pagina apertura o Google Maps).
              </p>
            </div>
          ) : isAwareness ? (
            <div>
              <Campo etichetta="URL Pagina Evento / Mappa Google / Sito Web (Destination URL)">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder="Es. https://maps.google.com/... oppure https://www.sito.it/inaugurazione"
                  className={inputClass}
                  autoComplete="url"
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Link di destinazione per «Scopri di più» o «Ottieni
                indicazioni» (evento, Maps o sito).
              </p>
            </div>
          ) : null}

          {isBookings && bookingChannel === "BOOKING_LINK" && !isPercorsoBookings ? (
            <div>
              <Campo etichetta="URL Pagina di Prenotazione / Calendario (Link di destinazione)">
                <input
                  type="url"
                  value={sitoWeb}
                  onChange={(e) => onCambiaSitoWeb(e.target.value)}
                  placeholder="Es. https://calendly.com/studio-rossi"
                  className={inputClass}
                  autoComplete="url"
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Finisce nel campo Link del CSV Meta (CTA Prenota subito).
              </p>
            </div>
          ) : null}

          {!isEcommerce &&
          !isInStore &&
          !isRetargeting &&
          !isAwareness &&
          (!isBookings || bookingChannel === "LEAD_FORM") ? (
            <div>
              <Campo etichetta="ID Modulo Contatti (Lead Form)">
                <input
                  type="text"
                  value={formId ?? ""}
                  onChange={(e) => onCambiaFormId(e.target.value)}
                  placeholder="Es. 987654321098765"
                  className={inputClass}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Campo>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Lo trovi nella sezione Moduli istantanei del Business Suite.
              </p>
            </div>
          ) : null}

          <div
            className={`rounded-xl border px-4 py-3.5 ${
              isPercorsoLeads ||
              isPercorsoBookings ||
              isPercorsoEcommerce ||
              isPercorsoInstore ||
              isPercorsoRetargeting ||
              isPercorsoAwareness
                ? "border-[var(--border)] bg-[var(--surface-hover)]"
                : "border-[#f5c9b8] bg-[#fff4f0]"
            }`}
          >
            <p className="text-sm font-medium text-[var(--ink)]">
              Controlli importazione Meta
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink)]">
              {isPercorsoLeads ||
              isPercorsoBookings ||
              isPercorsoEcommerce ||
              isPercorsoInstore ||
              isPercorsoRetargeting ||
              isPercorsoAwareness ? (
                <>
                  Verifica le impostazioni dopo l&apos;importazione prima di
                  pubblicare la campagna. Mantieni{" "}
                  <span className="font-medium">DISATTIVATE</span> le
                  impostazioni &quot;Miglioramenti Automatici Advantage+&quot;
                  durante l&apos;importazione.
                </>
              ) : (
                <>
                  Ricordati di mantenere{" "}
                  <span className="font-medium">DISATTIVATE</span> le
                  impostazioni &quot;Miglioramenti Automatici Advantage+&quot;
                  durante l&apos;importazione.
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      <MetaAdsImportCode
        config={config}
        citta={citta}
        pageId={pageId ?? ""}
        formId={formId ?? ""}
        objective={objectiveEffettivo}
        bookingChannel={bookingChannel}
        creativitaMeta={creativitaToMeta(creativita)}
        destinationUrl={
          isEcommerce ||
          isInStore ||
          isRetargeting ||
          isAwareness ||
          (isBookings && bookingChannel === "BOOKING_LINK")
            ? sitoWeb
            : undefined
        }
        whatsappNumber={
          isBookings && bookingChannel === "WHATSAPP"
            ? whatsappNumber
            : undefined
        }
        targetType={targetType}
        campaignId={campaignId ?? undefined}
        layoutLeads={isPercorsoLeads}
        layoutCampagnaPronta={
          isPercorsoBookings ||
          isPercorsoEcommerce ||
          isPercorsoInstore ||
          isPercorsoRetargeting ||
          isPercorsoAwareness
        }
        statoApprovazione={statoApprovazioneLeads}
        revisionNotesCliente={revisionNotesCliente}
        statoLancio={statoLancio}
      />
      {isPercorsoAwareness ? (
        <section className="mt-6 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-medium text-[var(--ink)]">
            3. Verifica le impostazioni in Meta
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
            Controlla manualmente questi punti in Ads Manager prima della
            pubblicazione.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            <li>Controlla città e raggio</li>
            <li>Verifica la destinazione / link, se presente</li>
            <li>Verifica la Pagina collegata</li>
            <li>Controlla i placements</li>
            <li>Controlla budget e calendario prima della pubblicazione</li>
            <li>Monitora reach e frequenza dopo il lancio</li>
          </ul>
        </section>
      ) : null}
      {isPercorsoRetargeting ? (
        <section className="mt-6 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-medium text-[var(--ink)]">
            3. Completa il pubblico in Meta
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
            Questi elementi non vengono configurati automaticamente dal file di
            importazione.
          </p>
          <p className="mt-3 text-xs font-medium text-[var(--ink)]">
            Custom Audience da collegare in Meta
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--ink)]">
            <li>Collega la Custom Audience nell&apos;Ad Set.</li>
            <li>
              Definisci la finestra della Custom Audience direttamente in Meta.
            </li>
            <li>
              Verifica se escludere chi ha già completato l&apos;acquisto o la
              conversione.
            </li>
            <li>Verifica dataset/pixel.</li>
            <li>Verifica l&apos;evento di conversione.</li>
            <li>Monitora la frequenza dopo il lancio.</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink)]">
            {targetType === "B2B"
              ? "L'export utilizza Lead come evento di conversione."
              : "L'export utilizza Purchase come evento di conversione."}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-muted)]">
            Verifica in Meta che dataset/pixel ed evento siano configurati
            correttamente.
          </p>
        </section>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
