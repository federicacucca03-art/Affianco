"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import {
  defaultConfigurazioneContatti,
  nomeCampagnaAwareness,
  nomeCampagnaContatti,
  nomeCampagnaEcommerce,
  nomeCampagnaInStore,
  nomeCampagnaPrenotazioni,
  nomeCampagnaRetargeting,
} from "@/data/defaults-contatti";
import { generaVariantiCopy, titoloAnnuncioEcommerce, titoloAnnuncioLeads, type TonoVoce } from "@/data/varianti-copy";
import { pulisciNomeAttivitaPubblico } from "@/lib/copy-pubblico";
import {
  type ConversionRateSource,
  normalizzaConversionRateSource,
  tassoConversioneLeadsValido,
} from "@/lib/conversion-rate";
import { leggiBozzaOnboarding } from "@/data/clienti-store";
import { saveCampaign, saveClient, getClientById, getCampaigns } from "@/utils/clientStorage";
import type { Cliente } from "@/types/clienti";
import type { DeconstructAdResult } from "@/types/deconstruct-ad";
import { FormConfigurazione } from "@/components/nuova-contatti/FormConfigurazione";
import { PannelloPerche } from "@/components/nuova-contatti/PannelloPerche";
import { ChecklistMeta } from "@/components/nuova-contatti/ChecklistMeta";
import { MetaFeedMockup } from "@/components/nuova-contatti/MetaFeedMockup";
import { StrategicScoreCard } from "@/components/nuova-contatti/StrategicScoreCard";
import { ValutazioneEconomicaCard } from "@/components/nuova-contatti/ValutazioneEconomicaCard";
import { LaunchReadinessCard } from "@/components/nuova-contatti/LaunchReadinessCard";
import { WizardStepper } from "@/components/nuova-contatti/WizardStepper";
import { DiagnosiPreLancio } from "@/components/nuova-contatti/DiagnosiPreLancio";
import { CardLinkApprovazione } from "@/components/nuova-contatti/CardLinkApprovazione";
import {
  mappaStatoApprovazioneLeads,
  type StatoApprovazioneLeads,
} from "@/components/nuova-contatti/StatoApprovazioneLeads";
import { useRevocaObjectUrls } from "@/hooks/useRevocaObjectUrls";
import { useSettoreIntel } from "@/hooks/useSettoreIntel";
import { presetDaChiave, type SettoreIntel } from "@/lib/sector-intel";
import {
  creativitaToMeta,
  type CreativitaAsset,
  type EcommerceCreativoFormato,
} from "@/lib/creativita";
import { salvaCampagnaCompleta, leggiCampagnaDaSupabase, assicuratiTokenApprovazione, urlApprovazioneDaToken, completaRevisioneCampagnaSuSupabase, invalidaApprovazioneDopoModificaSostanziale } from "@/lib/campagne-db";
import { messaggioAiUserFacing } from "@/lib/anthropic-messaggi";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import {
  calculateEcommerceBreakEvenRoas,
  calculateEcommerceCpaMax,
  calculateLtvEconomics,
  calculateMaxSustainableBookingCpa,
  calculateMaxSustainableCpl,
  calculateMaxSustainableInStoreCpa,
  calculateMaxSustainableRecoveryCpa,
  getBenchmarkForNiche,
  type TargetMarginPercent,
} from "@/lib/benchmarks";
import {
  calcolaDiagnosiPreLancio,
  calcolaDiagnosiPreLancioLeads,
  calcolaDiagnosiPreLancioBookings,
  calcolaDiagnosiPreLancioEcommerce,
  calcolaDiagnosiPreLancioInstore,
  calcolaDiagnosiPreLancioRetargeting,
  calcolaDiagnosiPreLancioAwareness,
  pulisciHeadlineBreve,
  WIZARD_STEPS,
  type PreLancioAzioneRapida,
  type WizardStep,
} from "@/lib/pre-lancio-check";
import { calculateStrategicScore } from "@/lib/strategic-score";
import { raccomandaLancio, copyHeaderStep6, etichettaStepperStep6 } from "@/lib/guidance";
import { RaccomandazioneLancio } from "@/components/nuova-contatti/AffiancoSuggerisce";
import { calculateLaunchReadiness } from "@/lib/launch-readiness";
import { estraiServizioPrincipale } from "@/lib/extract-service";
import { etaDaTargetAgeBand } from "@/types/campagne";
import {
  firmaSostanziale,
  haModificaSostanziale,
  deveInvalidareApprovazione,
  ticketDaCampagna,
  margineDaCampagna,
  creaSnapshotConfigurazione,
  diffConfigurazione,
  testoLogAggiornamento,
  type SnapshotConfigurazione,
  type SnapshotConfigurazioneInput,
} from "@/lib/campagna-edit";
import { anteprimeDaCreativitaMeta } from "@/lib/creativita-storage";
import { logCampagnaAggiornata } from "@/lib/campaign-logs";

const CRS_SESSION_PREFIX = "affianco-conversion-rate-source:";

function chiaveCrsSessione(search: string): string {
  return `${CRS_SESSION_PREFIX}${search || "nuova"}`;
}

function persistiCrsSessione(search: string, source: ConversionRateSource) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(chiaveCrsSessione(search), source);
  } catch {
    // quota / private mode
  }
}

function leggiCrsSessione(search: string): ConversionRateSource | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return normalizzaConversionRateSource(
      window.sessionStorage.getItem(chiaveCrsSessione(search)),
    );
  } catch {
    return undefined;
  }
}

function nomeCampagnaPerObiettivo(
  objective: CampagnaObjective,
  nomeCliente: string,
): string {
  if (objective === "BOOKINGS") return nomeCampagnaPrenotazioni(nomeCliente);
  if (objective === "ECOMMERCE") return nomeCampagnaEcommerce(nomeCliente);
  if (objective === "IN_STORE") return nomeCampagnaInStore(nomeCliente);
  if (objective === "RETARGETING") return nomeCampagnaRetargeting(nomeCliente);
  if (objective === "AWARENESS") return nomeCampagnaAwareness(nomeCliente);
  return nomeCampagnaContatti(nomeCliente);
}

function configDaParametri(
  objective: CampagnaObjective,
  cliente: string | null,
  campagna: string | null,
  citta: string | null,
  settore: string | null,
  _elevatorPitch: string = "",
): ConfigurazioneContatti {
  const nomeCliente = pulisciNomeAttivitaPubblico(cliente?.trim() || "");
  const cittaTesto = citta?.trim() || "";
  const settoreTesto = settore?.trim() || "";
  const nomeCampagna =
    campagna?.trim() ||
    nomeCampagnaPerObiettivo(objective, nomeCliente || "Nome cliente");
  const settorePerCopy =
    settoreTesto ||
    (objective === "ECOMMERCE" ? "e-commerce" : "");
  const cittaPerCopy =
    cittaTesto || (objective === "ECOMMERCE" ? "Italia" : "");
  const benchmark = getBenchmarkForNiche(settorePerCopy, cittaPerCopy);
  const budgetGiornaliero = benchmark.recommendedDailyBudgetMin;
  const titoloAnnuncio = "";

  return {
    ...defaultConfigurazioneContatti,
    ...(objective === "AWARENESS"
      ? { etaMin: 18, etaMax: 65, genere: "Tutti" as const }
      : {}),
    nomeCliente,
    nomeCampagna,
    budgetGiornaliero:
      objective === "AWARENESS"
        ? Math.max(10, Math.round(300 / 7))
        : budgetGiornaliero,
    raggioKm:
      objective === "AWARENESS" ? 10 : benchmark.recommendedRadiusKm,
    varianteA: "",
    varianteB: "",
    varianteC: "",
    titoloAnnuncio,
    tassoConversionePercent:
      objective === "BOOKINGS"
        ? 75
        : objective === "ECOMMERCE" ||
            objective === "IN_STORE" ||
            objective === "RETARGETING" ||
            objective === "AWARENESS"
          ? 50
          : 10,
  };
}

function leggiContestoIniziale(
  searchParams: URLSearchParams,
  objective: CampagnaObjective,
) {
  const bozza = leggiBozzaOnboarding();
  const nomeCliente =
    searchParams.get("nomeCliente") ||
    searchParams.get("cliente") ||
    bozza?.nomeCliente ||
    null;
  const campagna = bozza?.nomeCampagna || null;
  const settoreGrezzo = searchParams.get("settore") || bozza?.settore || null;
  const cittaDaUrlOBozza = searchParams.get("citta") || bozza?.citta || null;
  // E-commerce / in-store: ignora bozze locali/dentali (valori, non solo placeholder).
  const settoreLocaleDentale = (s: string | null) =>
    Boolean(
      s &&
        /dentist|dent\b|studio|visita|igiene|odonto|milano/i.test(s),
    );
  const ignoraBozzaDentale =
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING";
  const settore =
    ignoraBozzaDentale && settoreLocaleDentale(settoreGrezzo)
      ? null
      : settoreGrezzo;
  const nomeClientePulito =
    ignoraBozzaDentale && settoreLocaleDentale(nomeCliente)
      ? null
      : nomeCliente;
  const citta =
    objective === "ECOMMERCE"
      ? searchParams.get("citta") || "Italia"
      : cittaDaUrlOBozza;

  return {
    config: configDaParametri(
      objective,
      nomeClientePulito,
      campagna,
      citta,
      settore,
    ),
    contesto: {
      settore: settore ?? undefined,
      citta: citta ?? undefined,
    },
    nomeCampagnaManuale: Boolean(campagna || nomeClientePulito),
  };
}

type Props = {
  objective?: CampagnaObjective;
  /** Slug rotta `/campagne/nuova/...` (es. "vendite-online"). */
  wizardSlug?: string;
};

export function PercorsoContatti({
  objective = "LEADS",
  wizardSlug,
}: Props) {
  const pathname = usePathname() ?? "";
  const currentSlug =
    (wizardSlug?.trim() ||
      pathname.split("/").filter(Boolean).pop() ||
      "") ?? "";
  const isBookings =
    currentSlug === "prenotazioni" || objective === "BOOKINGS";
  const isEcommerce =
    pathname.includes("vendite-online") ||
    currentSlug === "vendite-online" ||
    currentSlug === "ecommerce" ||
    currentSlug === "vendite" ||
    objective === "ECOMMERCE";
  const isInStore =
    pathname.includes("instore") ||
    pathname.includes("negozio") ||
    currentSlug === "instore" ||
    currentSlug === "negozio" ||
    objective === "IN_STORE";
  const isRetargeting =
    pathname.includes("retargeting") ||
    pathname.includes("recupero") ||
    currentSlug === "retargeting" ||
    currentSlug === "recupero" ||
    objective === "RETARGETING";
  const isAwareness =
    pathname.includes("apertura") ||
    pathname.includes("lancio") ||
    currentSlug === "apertura" ||
    currentSlug === "lancio" ||
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
    (pathname.includes("vendite-online") || currentSlug === "vendite-online") &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isInStore &&
    !isRetargeting &&
    !isAwareness;
  const isPercorsoInstore =
    (pathname.includes("instore") ||
      pathname.includes("negozio") ||
      currentSlug === "instore" ||
      currentSlug === "negozio") &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isPercorsoEcommerce &&
    !isRetargeting &&
    !isAwareness;
  const isPercorsoRetargeting =
    (pathname.includes("retargeting") ||
      pathname.includes("recupero") ||
      currentSlug === "retargeting" ||
      currentSlug === "recupero") &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isPercorsoEcommerce &&
    !isPercorsoInstore &&
    !isAwareness;
  const isPercorsoAwareness =
    (pathname.includes("apertura") ||
      pathname.includes("lancio") ||
      currentSlug === "apertura" ||
      currentSlug === "lancio") &&
    isAwareness &&
    !isPercorsoLeads &&
    !isPercorsoBookings &&
    !isPercorsoEcommerce &&
    !isPercorsoInstore &&
    !isPercorsoRetargeting;
  const objectiveEffettivo: CampagnaObjective = isEcommerce
    ? "ECOMMERCE"
    : isBookings
      ? "BOOKINGS"
      : isInStore
        ? "IN_STORE"
        : isRetargeting
          ? "RETARGETING"
          : isAwareness
            ? "AWARENESS"
            : objective;
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignIdEdit = (searchParams.get("campaignId") ?? "").trim();
  const isEditMode = Boolean(campaignIdEdit);
  const [config, setConfig] = useState<ConfigurazioneContatti>(() =>
    leggiContestoIniziale(searchParams, objectiveEffettivo).config,
  );
  const [nomeCampagnaManuale, setNomeCampagnaManuale] = useState(
    () =>
      leggiContestoIniziale(searchParams, objectiveEffettivo)
        .nomeCampagnaManuale,
  );
  const [variantiManuali, setVariantiManuali] = useState(false);
  const [copyAiLoading, setCopyAiLoading] = useState(false);
  const [copyAiErrore, setCopyAiErrore] = useState<string | null>(null);
  const stepPrecedenteRef = useRef<WizardStep | null>(null);
  const copyAiAbortRef = useRef<AbortController | null>(null);
  const copyAiGiaEseguitoRef = useRef(false);
  const [contesto, setContesto] = useState<{
    settore?: string;
    citta?: string;
  }>(() => leggiContestoIniziale(searchParams, objectiveEffettivo).contesto);
  const [creativita, setCreativita] = useState<CreativitaAsset[]>([]);
  const [indiceAnteprimaCreativita, setIndiceAnteprimaCreativita] =
    useState(0);
  const [formatoEcommerce, setFormatoEcommerce] =
    useState<EcommerceCreativoFormato>("SINGLE");
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [postiDisponibiliSettimana, setPostiDisponibiliSettimana] =
    useState("");
  const [scontrinoMedio, setScontrinoMedio] = useState<number | string>(
    isRetargeting
      ? 100
      : isInStore
        ? 40
        : isEcommerce
          ? 65
          : isBookings
            ? 60
            : 1500,
  );
  const [tassoConversione, setTassoConversione] = useState<number | string>(
    isBookings ? 75 : "",
  );
  const [conversionRateSource, setConversionRateSource] =
    useState<ConversionRateSource>(
      () => leggiCrsSessione(searchParams.toString()) ?? "ESTIMATED",
    );

  function cambiaConversionRateSource(source: ConversionRateSource) {
    setConversionRateSource(source);
    persistiCrsSessione(searchParams.toString(), source);
  }
  const [productMargin, setProductMargin] = useState<number | string>(
    isEcommerce ? 60 : isInStore ? 40 : 50,
  );
  const [fulfillmentCost, setFulfillmentCost] = useState<number | string>(5);
  const [ecommerceLtvAttivo, setEcommerceLtvAttivo] = useState(false);
  const [recoveryDiscount, setRecoveryDiscount] = useState<number | string>(
    isRetargeting ? 0 : 10,
  );
  const [launchBudget, setLaunchBudget] = useState<number | string>(300);
  const [estimatedCpm, setEstimatedCpm] = useState<number | string>(7);
  const [bookingChannel, setBookingChannel] =
    useState<BookingChannel>("WHATSAPP");
  const [bookingConfirmationPolicy, setBookingConfirmationPolicy] =
    useState<BookingConfirmationPolicy>("FREE_SMS_WHATSAPP");
  const [targetMargin, setTargetMargin] = useState<TargetMarginPercent>(50);
  const [elevatorPitch, setElevatorPitch] = useState("");
  const [sitoWeb, setSitoWeb] = useState("");
  const [frontEndOffer, setFrontEndOffer] = useState("");
  const [shippingMarket, setShippingMarket] =
    useState<EcommerceShippingMarket>("ITALY");
  const [heroProduct, setHeroProduct] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("B2C");
  const [targetAge, setTargetAge] = useState<TargetAgeBand>("25-50");
  const [retargetingAudienceSource, setRetargetingAudienceSource] =
    useState<RetargetingAudienceSource>("CART");
  const [dataEventoApertura, setDataEventoApertura] = useState("");
  const [tonoVoce, setTonoVoce] = useState<TonoVoce>("diretto");
  const [previewTabReset, setPreviewTabReset] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [ltvAttivo, setLtvAttivo] = useState(false);
  const [frequenzaAnnuale, setFrequenzaAnnuale] = useState<number | string>(1);
  const [anniPermanenza, setAnniPermanenza] = useState<number | string>(1);
  const [loyaltyPercent, setLoyaltyPercent] = useState<number | string>(0);
  const [margineLordoLtv, setMargineLordoLtv] = useState<number | string>(50);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(
    null,
  );
  const [erroriPasso1, setErroriPasso1] = useState<{
    nomeCliente?: boolean;
    frontEndOffer?: boolean;
    elevatorPitch?: boolean;
  }>({});
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [salvaClientePreferito, setSalvaClientePreferito] = useState(true);
  const [formatoCuratoId, setFormatoCuratoId] = useState<string | null>(null);
  const [deconstructResult, setDeconstructResult] =
    useState<DeconstructAdResult | null>(null);
  const { intel: settoreIntel, loading: sectorIntelLoading } = useSettoreIntel(
    contesto.settore,
  );
  const intelApplicatoRef = useRef<string | null>(null);

  function applicaEconomiaSettore(intel: SettoreIntel) {
    if (isEditMode) return;
    if (intelApplicatoRef.current === intel.id) return;
    intelApplicatoRef.current = intel.id;
    setScontrinoMedio(intel.aovDefault);
    setProductMargin(intel.margineDefault);
    setConfig((prev) => {
      const citta = contesto.citta ?? "";
      const benchmarkCitta = getBenchmarkForNiche(
        intel.nome || intel.id,
        citta,
      );
      return {
        ...prev,
        budgetGiornaliero: benchmarkCitta.recommendedDailyBudgetMin,
        raggioKm:
          isEcommerce || isRetargeting
            ? Math.max(prev.raggioKm, intel.raggioKmConsigliato)
            : intel.raggioKmConsigliato,
      };
    });
  }

  useEffect(() => {
    if (settoreIntel?.source === "ai") {
      applicaEconomiaSettore(settoreIntel);
    }
  }, [settoreIntel]);
  const [campagnaIdSalvata, setCampagnaIdSalvata] = useState<string | null>(
    null,
  );
  /** UUID stabile per create idempotente (anche se la risposta INSERT si perde). */
  const campagnaIdStabileRef = useRef<string | null>(
    campaignIdEdit || null,
  );
  if (isEditMode && campaignIdEdit) {
    campagnaIdStabileRef.current = campaignIdEdit;
  }
  /** Lock: seconde chiamate riusano la stessa Promise (niente doppio INSERT). */
  const saveInFlightRef = useRef<Promise<string> | null>(null);
  const snapshotInizialeRef = useRef<string>("");
  const snapshotConfigInizialeRef = useRef<SnapshotConfigurazione | null>(
    null,
  );
  const statusEditInizialeRef = useRef<string | null>(null);
  const [hydrateEditInCorso, setHydrateEditInCorso] = useState(isEditMode);
  const [erroreHydrateEdit, setErroreHydrateEdit] = useState<string | null>(
    null,
  );
  const [linkApprovazioneCopiato, setLinkApprovazioneCopiato] = useState(false);
  const [linkApprovazioneInCorso, setLinkApprovazioneInCorso] = useState(false);
  const [erroreLinkApprovazione, setErroreLinkApprovazione] = useState<
    string | null
  >(null);
  const [statusApprovazioneGrezzo, setStatusApprovazioneGrezzo] = useState<
    string | null
  >(null);
  const [revisionNotesCliente, setRevisionNotesCliente] = useState<
    string | null
  >(null);
  const [rimandaApprovazioneInCorso, setRimandaApprovazioneInCorso] =
    useState(false);
  const [erroreRimandaApprovazione, setErroreRimandaApprovazione] = useState<
    string | null
  >(null);

  const statoApprovazioneLeads: StatoApprovazioneLeads = useMemo(
    () =>
      mappaStatoApprovazioneLeads(
        campagnaIdSalvata,
        statusApprovazioneGrezzo,
      ),
    [campagnaIdSalvata, statusApprovazioneGrezzo],
  );

  const caricaStatusApprovazione = useCallback(async (id?: string) => {
    const targetId = id ?? campagnaIdSalvata;
    if (!targetId) {
      setStatusApprovazioneGrezzo(null);
      return;
    }
    try {
      const campagna = await leggiCampagnaDaSupabase(targetId);
      if (campagna?.status) {
        setStatusApprovazioneGrezzo(campagna.status);
        setRevisionNotesCliente(campagna.revisionNotes ?? null);
        return;
      }
    } catch {
      // Fallback localStorage.
    }
    const locale = getCampaigns().find((c) => c.id === targetId);
    setStatusApprovazioneGrezzo(locale?.status ?? "DRAFT");
    setRevisionNotesCliente(locale?.revisionNotes ?? null);
  }, [campagnaIdSalvata]);

  useEffect(() => {
    if (
      !(
        isPercorsoLeads ||
        isPercorsoBookings ||
        isPercorsoEcommerce ||
        isPercorsoInstore ||
        isPercorsoRetargeting ||
        isPercorsoAwareness
      ) ||
      wizardStep !== 6
    ) {
      return;
    }
    void caricaStatusApprovazione();
  }, [
    isPercorsoLeads,
    isPercorsoBookings,
    isPercorsoEcommerce,
    isPercorsoInstore,
    isPercorsoRetargeting,
    isPercorsoAwareness,
    wizardStep,
    campagnaIdSalvata,
    caricaStatusApprovazione,
  ]);

  useEffect(() => {
    if (
      !(
        isPercorsoLeads ||
        isPercorsoBookings ||
        isPercorsoEcommerce ||
        isPercorsoInstore ||
        isPercorsoRetargeting ||
        isPercorsoAwareness
      ) ||
      !campagnaIdSalvata
    ) {
      return;
    }
    const onFocus = () => {
      void caricaStatusApprovazione();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [
    isPercorsoLeads,
    isPercorsoBookings,
    isPercorsoEcommerce,
    isPercorsoInstore,
    isPercorsoRetargeting,
    isPercorsoAwareness,
    campagnaIdSalvata,
    caricaStatusApprovazione,
  ]);

  const selectedImage =
    creativita[indiceAnteprimaCreativita]?.url ??
    creativita[0]?.url ??
    null;

  const urlsCreativita = useMemo(
    () => creativita.map((c) => c.url),
    [creativita],
  );
  useRevocaObjectUrls(urlsCreativita);

  useEffect(() => {
    const idEdit = searchParams.get("campaignId")?.trim() || "";
    if (idEdit) return;
    const iniziale = leggiContestoIniziale(searchParams, objectiveEffettivo);
    setConfig(iniziale.config);
    setContesto(iniziale.contesto);
    setVariantiManuali(false);
    setNomeCampagnaManuale(iniziale.nomeCampagnaManuale);
    setElevatorPitch("");
    setSitoWeb("");
    setFrontEndOffer("");
    setShippingMarket("ITALY");
    setHeroProduct("");
    if (isEcommerce) {
      // Azzera bozze/locali dentali: i valori pieni sembrano placeholder bloccati.
      setContesto({
        settore: "",
        citta: "Italia",
      });
      setConfig((prev) => ({
        ...prev,
        nomeCliente: "",
        titoloAnnuncio: "",
      }));
    }
    if (isInStore) {
      setContesto({
        settore: "",
        citta: "",
      });
      setConfig((prev) => ({
        ...prev,
        nomeCliente: "",
        titoloAnnuncio: "",
      }));
    }
    if (isRetargeting) {
      setContesto({
        settore: "",
        citta: "Italia",
      });
      setConfig((prev) => ({
        ...prev,
        nomeCliente: "",
        titoloAnnuncio: "",
        nomeCampagna: nomeCampagnaRetargeting(""),
      }));
    }
    setFormatoEcommerce("SINGLE");
    setCreativita([]);
    setIndiceAnteprimaCreativita(0);
    setTargetType("B2C");
    setTargetAge("25-50");
    setRetargetingAudienceSource("CART");
    setDataEventoApertura("");
    setTonoVoce("diretto");
    setWizardStep(1);
    copyAiGiaEseguitoRef.current = false;
    stepPrecedenteRef.current = null;
    setScontrinoMedio(
      isRetargeting
        ? 100
        : isInStore
          ? 40
          : isEcommerce
            ? 65
            : isBookings
              ? 60
              : 1500,
    );
    setTassoConversione(isBookings ? 75 : "");
    const crsPersistito = leggiCrsSessione(searchParams.toString());
    setConversionRateSource(crsPersistito ?? "ESTIMATED");
    setProductMargin(isEcommerce ? 60 : isInStore ? 40 : 50);
    setFulfillmentCost(5);
    setEcommerceLtvAttivo(false);
    setRecoveryDiscount(isRetargeting ? 0 : 10);
    setLaunchBudget(300);
    setEstimatedCpm(7);
    setBookingChannel("WHATSAPP");
    setBookingConfirmationPolicy("FREE_SMS_WHATSAPP");
    setWhatsappNumber("");
    setPostiDisponibiliSettimana("");
    setWizardStep(1);
    setLtvAttivo(false);
    setFrequenzaAnnuale(1);
    setAnniPermanenza(1);
    setLoyaltyPercent(0);
    setMargineLordoLtv(50);
    setCampagnaIdSalvata(null);
    setLinkApprovazioneCopiato(false);
    setErroreLinkApprovazione(null);
    setFormatoCuratoId(null);
    setDeconstructResult(null);

    const clienteIdUrl = searchParams.get("clienteId")?.trim() || "";
    const bozza = leggiBozzaOnboarding();
    const daMemoria = clienteIdUrl
      ? getClientById(clienteIdUrl)
      : bozza?.clienteId
        ? getClientById(bozza.clienteId)
        : null;
    if (daMemoria) {
      setClienteId(daMemoria.id);
      setSalvaClientePreferito(true);
      const eta = etaDaTargetAgeBand(daMemoria.targetAge ?? "25-50");
      setConfig((prev) => ({
        ...prev,
        nomeCliente: daMemoria.nome,
        etaMin: eta.etaMin,
        etaMax: eta.etaMax,
      }));
      setContesto({
        settore: daMemoria.settore || "",
        citta:
          isEcommerce || isRetargeting
            ? daMemoria.citta || "Italia"
            : daMemoria.citta || "",
      });
      setSitoWeb(daMemoria.sitoWeb ?? "");
      setElevatorPitch(daMemoria.note ?? "");
      setTargetType(daMemoria.targetType ?? "B2C");
      setTargetAge(daMemoria.targetAge ?? "25-50");
    } else {
      setClienteId(bozza?.clienteId || null);
      if (bozza?.sitoWeb) setSitoWeb(bozza.sitoWeb);
      if (bozza?.note) setElevatorPitch(bozza.note);
      if (bozza?.targetType) setTargetType(bozza.targetType);
      if (bozza?.targetAge) setTargetAge(bozza.targetAge);
    }
  }, [searchParams, objectiveEffettivo, currentSlug, isEcommerce, isRetargeting, isInStore, isBookings]);

  useEffect(() => {
    if (!isEditMode || !campaignIdEdit) {
      setHydrateEditInCorso(false);
      return;
    }
    let attivo = true;
    setHydrateEditInCorso(true);
    setErroreHydrateEdit(null);

    (async () => {
      try {
        const trovata = await leggiCampagnaDaSupabase(campaignIdEdit, {
          ignoraCacheLocale: true,
        });
        if (!attivo) return;
        if (!trovata) {
          setErroreHydrateEdit("Campagna non trovata.");
          setHydrateEditInCorso(false);
          return;
        }

        campagnaIdStabileRef.current = trovata.id;
        setCampagnaIdSalvata(trovata.id);
        statusEditInizialeRef.current = trovata.status ?? "DRAFT";
        setStatusApprovazioneGrezzo(trovata.status ?? "DRAFT");
        setRevisionNotesCliente(trovata.revisionNotes ?? null);
        intelApplicatoRef.current = trovata.settore?.trim() || "edit-lock";
        copyAiGiaEseguitoRef.current = true;

        const eta = trovata.targetAge
          ? etaDaTargetAgeBand(trovata.targetAge)
          : {
              etaMin: trovata.etaMin ?? 25,
              etaMax: trovata.etaMax ?? 50,
            };
        const ticket = ticketDaCampagna(trovata);
        const tasso = trovata.showUpRate ?? trovata.tassoConversionePercent;
        const margine = margineDaCampagna(trovata);
        const targetTypeHydrate = trovata.targetType ?? "B2C";
        const targetAgeHydrate = trovata.targetAge ?? "25-50";
        const raggioHydrate =
          trovata.awarenessRadiusKm ?? trovata.raggioKm ?? 15;
        const tm = trovata.targetMargin;
        const targetMarginHydrate =
          tm === 30 || tm === 50 || tm === 70 ? tm : 50;
        const margineWizard =
          trovata.objective === "LEADS" || trovata.objective === "BOOKINGS" || !trovata.objective
            ? targetMarginHydrate
            : (margine ?? 50);
        setConfig({
          ...defaultConfigurazioneContatti,
          nomeCliente: trovata.nomeCliente,
          nomeCampagna: trovata.nomeCampagna || defaultConfigurazioneContatti.nomeCampagna,
          budgetGiornaliero: trovata.budgetGiornaliero ?? 20,
          raggioKm: raggioHydrate,
          etaMin: eta.etaMin,
          etaMax: eta.etaMax,
          varianteA: trovata.varianteA ?? "",
          varianteB: trovata.varianteB ?? "",
          varianteC: trovata.varianteC ?? "",
          titoloAnnuncio: trovata.titoloAnnuncio ?? "",
        });
        setNomeCampagnaManuale(true);
        setVariantiManuali(true);
        setContesto({
          settore: trovata.settore ?? "",
          citta: trovata.citta ?? "",
        });
        setElevatorPitch(trovata.elevatorPitch ?? "");
        setSitoWeb(trovata.website ?? "");
        setFrontEndOffer(trovata.frontEndOffer ?? "");
        setPageId(trovata.pageId ?? "");
        setFormId(trovata.formId ?? "");
        setHeroProduct(trovata.heroProduct ?? "");
        setTargetType(targetTypeHydrate);
        setTargetAge(targetAgeHydrate);
        if (trovata.shippingMarket) setShippingMarket(trovata.shippingMarket);
        if (trovata.bookingChannel) setBookingChannel(trovata.bookingChannel);
        if (trovata.bookingConfirmationPolicy) {
          setBookingConfirmationPolicy(trovata.bookingConfirmationPolicy);
        }
        if (ticket != null) setScontrinoMedio(ticket);
        if (tasso != null) setTassoConversione(tasso);
        if (trovata.conversionRateSource) {
          setConversionRateSource(trovata.conversionRateSource);
        }
        if (margine != null) setProductMargin(margine);
        setTargetMargin(targetMarginHydrate);
        if (trovata.recoveryDiscount != null) {
          setRecoveryDiscount(trovata.recoveryDiscount);
        }
        if (trovata.launchBudget != null) setLaunchBudget(trovata.launchBudget);
        if (trovata.estimatedCpm != null) setEstimatedCpm(trovata.estimatedCpm);

        const meta = trovata.creativitaMeta ?? [];
        const anteprime = await anteprimeDaCreativitaMeta(meta);
        if (!attivo) return;
        setCreativita(anteprime);
        const payloadSnapshot: SnapshotConfigurazioneInput = {
          frontEndOffer: trovata.frontEndOffer ?? "",
          elevatorPitch: trovata.elevatorPitch ?? "",
          varianteA: trovata.varianteA ?? "",
          varianteB: trovata.varianteB ?? "",
          varianteC: trovata.varianteC ?? "",
          titoloAnnuncio: trovata.titoloAnnuncio ?? "",
          creativita: anteprime,
          dailyBudget: trovata.budgetGiornaliero ?? 20,
          launchBudget:
            (trovata.objective ?? "LEADS") === "AWARENESS"
              ? (trovata.launchBudget ?? 0)
              : 0,
          citta: trovata.citta ?? "",
          raggioKm: raggioHydrate,
          etaMin: eta.etaMin,
          etaMax: eta.etaMax,
          targetType: targetTypeHydrate,
          targetAge: targetAgeHydrate,
          ticket: ticket ?? 0,
          conversionRate: tasso ?? 0,
          margine: margineWizard,
          objective: trovata.objective ?? "LEADS",
          destinationUrl: trovata.website ?? "",
          heroProduct: trovata.heroProduct ?? "",
          bookingChannel:
            (trovata.objective ?? "LEADS") === "BOOKINGS"
              ? trovata.bookingChannel
              : undefined,
          pageId: trovata.pageId ?? "",
          formId: trovata.formId ?? "",
          conversionRateSource:
            trovata.conversionRateSource ??
            ((trovata.objective ?? "LEADS") === "LEADS" ? "ESTIMATED" : ""),
          nomeCampagna:
            trovata.nomeCampagna ||
            defaultConfigurazioneContatti.nomeCampagna,
        };
        snapshotInizialeRef.current = firmaSostanziale(payloadSnapshot);
        snapshotConfigInizialeRef.current =
          creaSnapshotConfigurazione(payloadSnapshot);
        const haVideo = anteprime.some((a) => a.isVideo);
        setFormatoEcommerce(
          haVideo ? "VIDEO" : anteprime.length >= 3 ? "CAROUSEL" : "SINGLE",
        );
        setWizardStep(1);
        setHydrateEditInCorso(false);
      } catch (e) {
        if (!attivo) return;
        setErroreHydrateEdit(messaggioErroreSupabase(e, "carica_dettaglio"));
        setHydrateEditInCorso(false);
      }
    })();

    return () => {
      attivo = false;
    };
  }, [isEditMode, campaignIdEdit]);

  const etichetteVarianti = useMemo(
    () =>
      generaVariantiCopy({
        settore: contesto.settore,
        nomeCliente: config.nomeCliente,
        citta: contesto.citta ?? "",
        elevatorPitch,
        objective: objectiveEffettivo,
        frontEndOffer,
        targetType,
        tono: tonoVoce,
        bookingChannel: isBookings ? bookingChannel : undefined,
        postiDisponibiliSettimana: isPercorsoBookings
          ? postiDisponibiliSettimana
          : undefined,
        heroProduct: isEcommerce
        ? heroProduct.trim() || elevatorPitch.trim()
        : undefined,
        sitoWeb: isAwareness ? sitoWeb : undefined,
      }),
    [
      contesto.settore,
      contesto.citta,
      config.nomeCliente,
      elevatorPitch,
      frontEndOffer,
      heroProduct,
      targetType,
      tonoVoce,
      objectiveEffettivo,
      bookingChannel,
      isBookings,
      isPercorsoBookings,
      postiDisponibiliSettimana,
      isEcommerce,
      isAwareness,
      sitoWeb,
    ],
  );

  function cambiaTonoVoce(tono: TonoVoce) {
    if (tono === tonoVoce) return;
    if (variantiManuali) {
      const ok = window.confirm(
        "Cambiando tono sovrascriverai le modifiche manuali al testo. Continuare?",
      );
      if (!ok) return;
    }
    setTonoVoce(tono);
    void generaCopyConAi(tono);
  }

  function rigeneraVariantiCopy() {
    if (variantiManuali) {
      const ok = window.confirm(
        "Rigenerando perderai le modifiche manuali. Continuare?",
      );
      if (!ok) return;
    }
    void generaCopyConAi();
  }

  function applicaCopyFallbackStatico() {
    const rigenerate = generaVariantiCopy({
      settore: contesto.settore,
      nomeCliente: config.nomeCliente,
      citta: contesto.citta ?? "",
      elevatorPitch,
      objective: objectiveEffettivo,
      frontEndOffer,
      targetType,
      tono: tonoVoce,
      bookingChannel: isBookings ? bookingChannel : undefined,
      postiDisponibiliSettimana: isPercorsoBookings
        ? postiDisponibiliSettimana
        : undefined,
      heroProduct: isEcommerce
        ? heroProduct.trim() || elevatorPitch.trim()
        : undefined,
      sitoWeb: isAwareness ? sitoWeb : undefined,
    });
    const servizio = estraiServizioPrincipale(
      [
        elevatorPitch.trim(),
        frontEndOffer.trim(),
        isEcommerce ? heroProduct.trim() || elevatorPitch.trim() : "",
      ]
        .filter(Boolean)
        .join(" · "),
      isEcommerce
        ? contesto.settore?.trim() || "e-commerce"
        : contesto.settore,
    );
    const citta = (contesto.citta ?? "").trim();
    const hero = heroProduct.trim() || elevatorPitch.trim() || "";
    const titoloAnnuncio = isEcommerce
      ? titoloAnnuncioEcommerce(hero, frontEndOffer)
      : objectiveEffettivo === "LEADS"
        ? titoloAnnuncioLeads(
            servizio,
            citta,
            contesto.settore ?? "",
            frontEndOffer,
            elevatorPitch,
          )
        : citta
          ? `${servizio.charAt(0).toUpperCase()}${servizio.slice(1)} a ${citta}`
          : servizio.charAt(0).toUpperCase() + servizio.slice(1);

    setVariantiManuali(true);
    setConfig((prev) => ({
      ...prev,
      varianteA: rigenerate[0].testo,
      varianteB: rigenerate[1].testo,
      varianteC: rigenerate[2].testo,
      titoloAnnuncio,
    }));
  }

  async function generaCopyConAi(tonoOverride?: TonoVoce) {
    copyAiAbortRef.current?.abort();
    const controller = new AbortController();
    copyAiAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45_000);
    const tonoRichiesto = tonoOverride ?? tonoVoce;

    setCopyAiLoading(true);
    setCopyAiErrore(null);

    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          route: currentSlug || "lead-gen",
          clientName: pulisciNomeAttivitaPubblico(config.nomeCliente),
          sector: contesto.settore ?? "",
          city: contesto.citta ?? "",
          offer: frontEndOffer,
          brief: elevatorPitch,
          clientType: targetType,
          tone: tonoRichiesto,
          targetAge,
        }),
      });

      const data = (await res.json()) as {
        headline?: string;
        varianteA?: string;
        varianteB?: string;
        varianteC?: string;
        error?: string;
      };

      if (!res.ok || !data.varianteA || !data.varianteB || !data.varianteC) {
        throw new Error(
          messaggioAiUserFacing(
            data.error,
            "Non siamo riusciti a generare il contenuto. Riprova.",
          ),
        );
      }

      setVariantiManuali(false);
      setConfig((prev) => ({
        ...prev,
        titoloAnnuncio: pulisciHeadlineBreve(
          String(data.headline ?? prev.titoloAnnuncio ?? ""),
          45,
        ),
        varianteA: String(data.varianteA).trim(),
        varianteB: String(data.varianteB).trim(),
        varianteC: String(data.varianteC).trim(),
      }));
      setCopyAiErrore(null);
    } catch (err) {
      if (controller.signal.reason === "navigate") {
        return;
      }
      setCopyAiErrore(
        messaggioAiUserFacing(
          err instanceof Error ? err.message : null,
          "Non siamo riusciti a generare il contenuto. Riprova.",
        ),
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (copyAiAbortRef.current === controller) {
        copyAiAbortRef.current = null;
      }
      setCopyAiLoading(false);
    }
  }

  useEffect(() => {
    const precedente = stepPrecedenteRef.current;
    stepPrecedenteRef.current = wizardStep;
    if (wizardStep !== 3) return;
    if (precedente === 3) return;

    const haCopy = Boolean(
      (config.varianteA ?? "").trim() ||
        (config.varianteB ?? "").trim() ||
        (config.varianteC ?? "").trim(),
    );
    if (copyAiGiaEseguitoRef.current || haCopy) return;

    const haBrief = Boolean(elevatorPitch.trim());
    const haOfferta = Boolean(frontEndOffer.trim());
    const haSettore = Boolean((contesto.settore ?? "").trim());
    const haDati =
      isPercorsoLeads
        ? haBrief && haOfferta && haSettore
        : haOfferta && (haBrief || haSettore);
    if (!haDati) return;

    copyAiGiaEseguitoRef.current = true;
    void generaCopyConAi();
    // Solo all'ingresso nello step 3, una volta per sessione se il copy è vuoto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep === 3) return;
    if (copyAiAbortRef.current) {
      copyAiAbortRef.current.abort("navigate");
    }
  }, [wizardStep]);

  const strategicScore = useMemo(() => {
    const settore = contesto.settore ?? "";
    const citta = contesto.citta ?? "";
    const benchmark = getBenchmarkForNiche(settore, citta);
    const haCopySelezionato = Boolean(
      (config.varianteA ?? "").trim() ||
        (config.varianteB ?? "").trim() ||
        (config.varianteC ?? "").trim(),
    );
    const ticket = Number(scontrinoMedio) || 0;
    const tassoLeads = isPercorsoLeads
      ? tassoConversioneLeadsValido(conversionRateSource, tassoConversione)
      : null;
    const tasso = isPercorsoLeads
      ? tassoLeads
      : Number(tassoConversione) || (isBookings ? 75 : 10);
    const margineProdotto =
      Number(productMargin) || (isEcommerce ? 60 : isInStore ? 40 : 50);
    const costoFulfillment = Number(fulfillmentCost) || 0;
    const sconto = Number(recoveryDiscount) || 0;
    const maxCpl = isAwareness
      ? Number(estimatedCpm) || 7
      : isRetargeting
        ? calculateMaxSustainableRecoveryCpa(ticket, margineProdotto, sconto)
        : isInStore
          ? calculateMaxSustainableInStoreCpa(
              ticket,
              margineProdotto,
              targetMargin,
            )
          : isEcommerce
            ? calculateEcommerceCpaMax(
                ticket,
                margineProdotto,
                costoFulfillment,
                ecommerceLtvAttivo,
              )
            : isPercorsoLeads && tassoLeads == null
              ? null
              : isBookings
                ? calculateMaxSustainableBookingCpa(
                    ticket,
                    tasso ?? 0,
                    targetMargin,
                  )
                : calculateMaxSustainableCpl(
                    ticket,
                    tasso ?? 0,
                    targetMargin,
                  );

    return calculateStrategicScore({
      budgetGiornaliero: config.budgetGiornaliero,
      recommendedDailyBudgetMin: benchmark.recommendedDailyBudgetMin,
      cplMercatoMin: benchmark.cplMin,
      settore,
      citta,
      ticket: ticket > 0 ? ticket : null,
      conversionRate: isPercorsoLeads ? tassoLeads : (tasso ?? null),
      conversionRateSource: isPercorsoLeads ? conversionRateSource : undefined,
      targetMargin,
      maxSustainableCpl:
        maxCpl != null && Number.isFinite(maxCpl) && maxCpl > 0 ? maxCpl : null,
      frontEndOffer,
      elevatorPitch,
      targetType,
      targetAge,
      raggioKm: config.raggioKm,
      haCopySelezionato,
      copyVarianteA: config.varianteA,
      titoloAnnuncio: config.titoloAnnuncio,
      fotoCaricata: creativita.length > 0,
      objective: objectiveEffettivo,
      bookingChannel: isBookings ? bookingChannel : undefined,
      fase: wizardStep < 5 ? "provvisoria" : "completa",
    });
  }, [
    config.budgetGiornaliero,
    config.varianteA,
    config.varianteB,
    config.varianteC,
    config.titoloAnnuncio,
    config.raggioKm,
    contesto.settore,
    contesto.citta,
    creativita.length,
    scontrinoMedio,
    tassoConversione,
    conversionRateSource,
    productMargin,
    fulfillmentCost,
    recoveryDiscount,
    estimatedCpm,
    ecommerceLtvAttivo,
    targetMargin,
    frontEndOffer,
    elevatorPitch,
    targetType,
    targetAge,
    isEcommerce,
    isInStore,
    isRetargeting,
    isAwareness,
    isBookings,
    isPercorsoLeads,
    objectiveEffettivo,
    bookingChannel,
    wizardStep,
  ]);

  const launchReadiness = useMemo(() => {
    const haCopySelezionato = Boolean(
      (config.varianteA ?? "").trim() ||
        (config.varianteB ?? "").trim() ||
        (config.varianteC ?? "").trim(),
    );
    return calculateLaunchReadiness({
      fotoCaricata: creativita.length > 0,
      clienteHaApprovato: statoApprovazioneLeads === "approvata",
      paginaFacebookId: pageId,
      moduloContattiId: formId,
      destinationUrl:
        isEcommerce || isInStore || isRetargeting || isAwareness
          ? sitoWeb
          : undefined,
      objective: objectiveEffettivo,
      bookingChannel: isBookings ? bookingChannel : undefined,
      haCopySelezionato,
      haTitoloAnnuncio: Boolean((config.titoloAnnuncio ?? "").trim()),
    });
  }, [
    creativita.length,
    statoApprovazioneLeads,
    pageId,
    formId,
    sitoWeb,
    isEcommerce,
    isInStore,
    isRetargeting,
    isAwareness,
    objectiveEffettivo,
    isBookings,
    bookingChannel,
    config.varianteA,
    config.varianteB,
    config.varianteC,
    config.titoloAnnuncio,
  ]);

  function aggiornaConfig(prossimo: ConfigurazioneContatti) {
    let aggiornato = { ...prossimo };

    if (
      !nomeCampagnaManuale &&
      prossimo.nomeCliente !== config.nomeCliente
    ) {
      aggiornato.nomeCampagna = nomeCampagnaPerObiettivo(
        objectiveEffettivo,
        prossimo.nomeCliente,
      );
    }

    if (prossimo.nomeCampagna !== config.nomeCampagna) {
      setNomeCampagnaManuale(true);
    }

    const copyCambiato =
      prossimo.varianteA !== config.varianteA ||
      prossimo.varianteB !== config.varianteB ||
      prossimo.varianteC !== config.varianteC ||
      prossimo.titoloAnnuncio !== config.titoloAnnuncio;

    if (copyCambiato) {
      setVariantiManuali(true);
    }

    if (
      prossimo.titoloAnnuncio !== config.titoloAnnuncio &&
      (prossimo.titoloAnnuncio?.length ?? 0) > 50
    ) {
      aggiornato.titoloAnnuncio = pulisciHeadlineBreve(
        prossimo.titoloAnnuncio ?? "",
        45,
      );
    }

    if (erroriPasso1.nomeCliente && prossimo.nomeCliente?.trim()) {
      setErroriPasso1((prev) => ({ ...prev, nomeCliente: false }));
    }

    setConfig(aggiornato);
  }

  const diagnosi = useMemo(
    () => {
      const ticket = Number(scontrinoMedio) || 0;
      const tassoLeadsDiag = isPercorsoLeads
        ? tassoConversioneLeadsValido(conversionRateSource, tassoConversione)
        : null;
      const showUp = isPercorsoLeads
        ? (tassoLeadsDiag ?? 0)
        : Number(tassoConversione) || (isBookings ? 75 : 10);
      const cpaBookings = isBookings
        ? calculateMaxSustainableBookingCpa(ticket, showUp, targetMargin)
        : 0;
      const margineProdotto =
        Number(productMargin) ||
        (isEcommerce ? 60 : isInStore ? 40 : 50);
      const costoFulfillment = Number(fulfillmentCost) || 0;
      const cpaMaxEcommerce = isEcommerce
        ? calculateEcommerceCpaMax(
            ticket,
            margineProdotto,
            costoFulfillment,
            ecommerceLtvAttivo,
          )
        : 0;
      const breakEvenRoasEcommerce = isEcommerce
        ? calculateEcommerceBreakEvenRoas(ticket, cpaMaxEcommerce)
        : 0;
      const cpaMaxInstore = isInStore
        ? calculateMaxSustainableInStoreCpa(
            ticket,
            margineProdotto,
            targetMargin,
          )
        : 0;
      const scontoRecupero = Number(recoveryDiscount) || 0;
      const cpaMaxRetargeting = isRetargeting
        ? calculateMaxSustainableRecoveryCpa(
            ticket,
            margineProdotto,
            scontoRecupero,
          )
        : 0;

      return isPercorsoLeads
        ? calcolaDiagnosiPreLancioLeads({
            raggioKm: config.raggioKm ?? 0,
            titoloAnnuncio: config.titoloAnnuncio ?? "",
            budgetGiornaliero: config.budgetGiornaliero ?? 0,
            settore: contesto.settore,
            citta: contesto.citta,
            haCopy: Boolean((config.varianteA ?? "").trim()),
            haCreativita: creativita.length > 0,
            objective: objectiveEffettivo,
            cpmStimato: Number(estimatedCpm) || 7,
            pageId,
            formId,
            frontEndOffer: frontEndOffer.trim(),
            varianteA: config.varianteA ?? "",
            creativita: creativita.map((c) => ({
              avvisoFormato: c.avvisoFormato,
              formatoOrizzontale: c.formatoOrizzontale,
              width: c.width,
              height: c.height,
              isVideo: c.isVideo,
            })),
          })
        : isPercorsoBookings
          ? calcolaDiagnosiPreLancioBookings({
              raggioKm: config.raggioKm ?? 0,
              titoloAnnuncio: config.titoloAnnuncio ?? "",
              budgetGiornaliero: config.budgetGiornaliero ?? 0,
              settore: contesto.settore,
              citta: contesto.citta,
              haCopy: Boolean((config.varianteA ?? "").trim()),
              haCreativita: creativita.length > 0,
              objective: objectiveEffettivo,
              cpmStimato: Number(estimatedCpm) || 7,
              bookingChannel,
              showUpRate: showUp,
              costoPerContatto:
                cpaBookings > 0 ? cpaBookings : undefined,
              frontEndOffer: frontEndOffer.trim(),
              varianteA: config.varianteA ?? "",
              whatsappNumber,
              bookingLinkUrl:
                bookingChannel === "BOOKING_LINK" ? sitoWeb : undefined,
              creativita: creativita.map((c) => ({
                avvisoFormato: c.avvisoFormato,
                formatoOrizzontale: c.formatoOrizzontale,
                width: c.width,
                height: c.height,
                isVideo: c.isVideo,
              })),
            })
          : isPercorsoEcommerce
            ? calcolaDiagnosiPreLancioEcommerce({
                raggioKm: config.raggioKm ?? 0,
                titoloAnnuncio: config.titoloAnnuncio ?? "",
                budgetGiornaliero: config.budgetGiornaliero ?? 0,
                settore: contesto.settore,
                haCopy: Boolean((config.varianteA ?? "").trim()),
                haCreativita: creativita.length > 0,
                objective: objectiveEffettivo,
                frontEndOffer: frontEndOffer.trim(),
                varianteA: config.varianteA ?? "",
                sitoWeb: sitoWeb.trim(),
                elevatorPitch: elevatorPitch.trim(),
                heroProduct: heroProduct.trim() || elevatorPitch.trim(),
                shippingMarket,
                mercatoLabel: contesto.citta,
                breakEvenRoas: breakEvenRoasEcommerce,
                cpaMax: cpaMaxEcommerce,
                creativita: creativita.map((c) => ({
                  avvisoFormato: c.avvisoFormato,
                  formatoOrizzontale: c.formatoOrizzontale,
                  width: c.width,
                  height: c.height,
                  isVideo: c.isVideo,
                })),
              })
            : isPercorsoInstore
              ? calcolaDiagnosiPreLancioInstore({
                  raggioKm: config.raggioKm ?? 0,
                  titoloAnnuncio: config.titoloAnnuncio ?? "",
                  budgetGiornaliero: config.budgetGiornaliero ?? 0,
                  settore: contesto.settore,
                  citta: contesto.citta,
                  haCopy: Boolean((config.varianteA ?? "").trim()),
                  haCreativita: creativita.length > 0,
                  objective: objectiveEffettivo,
                  cpmStimato: Number(estimatedCpm) || 7,
                  frontEndOffer: frontEndOffer.trim(),
                  varianteA: config.varianteA ?? "",
                  sitoWeb: sitoWeb.trim(),
                  elevatorPitch: elevatorPitch.trim(),
                  nomeCliente: config.nomeCliente ?? "",
                  cpaMax: cpaMaxInstore,
                  creativita: creativita.map((c) => ({
                    avvisoFormato: c.avvisoFormato,
                    formatoOrizzontale: c.formatoOrizzontale,
                    width: c.width,
                    height: c.height,
                    isVideo: c.isVideo,
                  })),
                })
              : isPercorsoRetargeting
                ? calcolaDiagnosiPreLancioRetargeting({
                    raggioKm: config.raggioKm ?? 0,
                    titoloAnnuncio: config.titoloAnnuncio ?? "",
                    budgetGiornaliero: config.budgetGiornaliero ?? 0,
                    settore: contesto.settore,
                    citta: contesto.citta,
                    haCopy: Boolean((config.varianteA ?? "").trim()),
                    haCreativita: creativita.length > 0,
                    objective: objectiveEffettivo,
                    cpmStimato: Number(estimatedCpm) || 7,
                    frontEndOffer: frontEndOffer.trim(),
                    varianteA: config.varianteA ?? "",
                    sitoWeb: sitoWeb.trim(),
                    elevatorPitch: elevatorPitch.trim(),
                    nomeCliente: config.nomeCliente ?? "",
                    targetType,
                    cpaMax: cpaMaxRetargeting,
                    creativita: creativita.map((c) => ({
                      avvisoFormato: c.avvisoFormato,
                      formatoOrizzontale: c.formatoOrizzontale,
                      width: c.width,
                      height: c.height,
                      isVideo: c.isVideo,
                    })),
                  })
              : isPercorsoAwareness
                ? calcolaDiagnosiPreLancioAwareness({
                    raggioKm: config.raggioKm ?? 0,
                    titoloAnnuncio: config.titoloAnnuncio ?? "",
                    budgetGiornaliero: 0,
                    launchBudget: Number(launchBudget) || 0,
                    settore: contesto.settore,
                    citta: contesto.citta,
                    haCopy: Boolean((config.varianteA ?? "").trim()),
                    haCreativita: creativita.length > 0,
                    objective: objectiveEffettivo,
                    cpmStimato: Number(estimatedCpm) || 0,
                    frontEndOffer: frontEndOffer.trim(),
                    varianteA: config.varianteA ?? "",
                    sitoWeb: sitoWeb.trim(),
                    elevatorPitch: elevatorPitch.trim(),
                    nomeCliente: config.nomeCliente ?? "",
                    creativita: creativita.map((c) => ({
                      avvisoFormato: c.avvisoFormato,
                      formatoOrizzontale: c.formatoOrizzontale,
                      width: c.width,
                      height: c.height,
                      isVideo: c.isVideo,
                    })),
                  })
          : calcolaDiagnosiPreLancio({
        raggioKm: config.raggioKm ?? 0,
        titoloAnnuncio: config.titoloAnnuncio ?? "",
        budgetGiornaliero: isAwareness
          ? Math.max(5, Math.round((Number(launchBudget) || 300) / 7))
          : (config.budgetGiornaliero ?? 0),
        settore: contesto.settore,
        haCopy: Boolean((config.varianteA ?? "").trim()),
        haCreativita: creativita.length > 0,
        objective: objectiveEffettivo,
        cpmStimato: Number(estimatedCpm) || 7,
        bookingChannel: isBookings ? bookingChannel : undefined,
        showUpRate: isBookings ? showUp : undefined,
        costoPerContatto:
          isBookings && cpaBookings > 0 ? cpaBookings : undefined,
        shippingMarket: isEcommerce ? shippingMarket : undefined,
        mercatoLabel: isEcommerce ? contesto.citta : undefined,
        breakEvenRoas: isEcommerce ? breakEvenRoasEcommerce : undefined,
        cpaMax: isEcommerce ? cpaMaxEcommerce : undefined,
      });
    },
    [
      config.raggioKm,
      config.titoloAnnuncio,
      config.budgetGiornaliero,
      config.varianteA,
      config.nomeCliente,
      pageId,
      formId,
      frontEndOffer,
      creativita,
      isPercorsoLeads,
      isPercorsoBookings,
      isPercorsoEcommerce,
      isPercorsoInstore,
      isPercorsoRetargeting,
      isPercorsoAwareness,
      isInStore,
      isRetargeting,
      whatsappNumber,
      sitoWeb,
      elevatorPitch,
      heroProduct,
      contesto.settore,
      contesto.citta,
      creativita.length,
      objectiveEffettivo,
      estimatedCpm,
      launchBudget,
      isAwareness,
      isBookings,
      isEcommerce,
      bookingChannel,
      scontrinoMedio,
      tassoConversione,
      conversionRateSource,
      isPercorsoLeads,
      targetMargin,
      productMargin,
      fulfillmentCost,
      ecommerceLtvAttivo,
      shippingMarket,
      recoveryDiscount,
      targetType,
    ],
  );

  const raccomandazioneLancio = useMemo(
    () =>
      raccomandaLancio({
        strategicScore,
        launchReadiness,
        haErroriBloccantiPreLancio: Boolean(diagnosi.haErroriBloccanti),
        objective: objectiveEffettivo,
      }),
    [
      strategicScore,
      launchReadiness,
      diagnosi.haErroriBloccanti,
      objectiveEffettivo,
    ],
  );

  function azioneRapidaDiagnosi(tipo: PreLancioAzioneRapida) {
    if (tipo === "espandi-raggio") {
      setConfig((prev) => ({ ...prev, raggioKm: 15 }));
      return;
    }
    if (tipo === "trunca-headline") {
      setConfig((prev) => ({
        ...prev,
        titoloAnnuncio: pulisciHeadlineBreve(prev.titoloAnnuncio ?? "", 45),
      }));
      setVariantiManuali(true);
      return;
    }
    if (
      tipo === "vai-passo-1" ||
      tipo === "vai-passo-2" ||
      tipo === "vai-passo-3" ||
      tipo === "vai-passo-4"
    ) {
      setErroreSalvataggio(null);
      const passo =
        tipo === "vai-passo-1"
          ? 1
          : tipo === "vai-passo-2"
            ? 2
            : tipo === "vai-passo-3"
              ? 3
              : 4;
      setWizardStep(passo);
    }
  }

  function vaiAvanti() {
    if (wizardStep === 1) {
      const nomeOk = Boolean(config.nomeCliente?.trim());
      const offertaOk = Boolean(frontEndOffer.trim());
      const briefOk = !isEcommerce || Boolean(elevatorPitch.trim());
      const mancanti: string[] = [];
      if (!nomeOk) mancanti.push("Nome Store / Cliente (nomeCliente)");
      if (!offertaOk) mancanti.push("Offerta / Gancio (frontEndOffer)");
      if (!briefOk) mancanti.push("Brief Prodotto (elevatorPitch)");

      if (mancanti.length > 0) {
        console.warn(
          "[Wizard Passo 1] Validazione fallita — campi mancanti:",
          mancanti,
        );
        setErroriPasso1({
          nomeCliente: !nomeOk,
          frontEndOffer: !offertaOk,
          elevatorPitch: !briefOk,
        });
        setErroreSalvataggio(
          `Compila i campi obbligatori: ${mancanti
            .map((c) => c.split(" (")[0])
            .join(", ")}.`,
        );
        return;
      }

      setErroriPasso1({});
      setErroreSalvataggio(null);
      persistiClienteSeRichiesto();
      setWizardStep(2);
      console.log("Avanzamento a Step 2 eseguito");
      return;
    }

    if (
      wizardStep === 4 &&
      (isEcommerce || isInStore || isRetargeting || isAwareness) &&
      formatoEcommerce === "CAROUSEL" &&
      creativita.length < 3
    ) {
      console.warn(
        "[Wizard Passo 4] Carosello incompleto: schede=",
        creativita.length,
      );
      setErroreSalvataggio(
        isInStore || isRetargeting || isAwareness
          ? "Per il carosello carica almeno 3 contenuti (massimo 5)."
          : "Per il carosello carica almeno 3 schede prodotto (massimo 5).",
      );
      return;
    }
    if (
      wizardStep === 4 &&
      (isEcommerce || isInStore || isRetargeting || isAwareness) &&
      formatoEcommerce === "VIDEO" &&
      creativita.length < 1
    ) {
      console.warn("[Wizard Passo 4] Video mancante");
      setErroreSalvataggio(
        isInStore || isRetargeting || isAwareness
          ? "Carica un video (o un frame) prima di continuare."
          : "Carica un video UGC / unboxing (o un frame) prima di continuare.",
      );
      return;
    }
    if (
      wizardStep === 5 &&
      (isPercorsoLeads ||
        isPercorsoBookings ||
        isPercorsoEcommerce ||
        isPercorsoInstore ||
        isPercorsoRetargeting ||
        isPercorsoAwareness) &&
      diagnosi.haErroriBloccanti
    ) {
      setErroreSalvataggio(
        "Correggi gli elementi segnati in rosso prima di continuare.",
      );
      return;
    }
    setErroreSalvataggio(null);
    setWizardStep((s) => (s < 6 ? ((s + 1) as WizardStep) : s));
  }

  function applicaClienteEsistente(cliente: Cliente) {
    const eta = etaDaTargetAgeBand(cliente.targetAge ?? "25-50");
    setClienteId(cliente.id);
    setSalvaClientePreferito(true);
    setConfig((prev) => ({
      ...prev,
      nomeCliente: cliente.nome,
      etaMin: eta.etaMin,
      etaMax: eta.etaMax,
    }));
    setContesto({
      settore: cliente.settore || "",
      citta: cliente.citta || (isEcommerce || isRetargeting ? "Italia" : ""),
    });
    setSitoWeb(cliente.sitoWeb ?? "");
    setElevatorPitch(cliente.note ?? "");
    setTargetType(cliente.targetType ?? "B2C");
    setTargetAge(cliente.targetAge ?? "25-50");
    setErroriPasso1((prev) => ({ ...prev, nomeCliente: false }));
  }

  function persistiClienteSeRichiesto(): string | null {
    if (!salvaClientePreferito) return clienteId;
    const nome = config.nomeCliente.trim();
    if (!nome) return clienteId;
    const salvato = saveClient({
      id: clienteId ?? undefined,
      nome,
      settore: contesto.settore,
      citta: contesto.citta,
      targetType,
      targetAge,
      sitoWeb,
      note: elevatorPitch,
      preferito: true,
    });
    setClienteId(salvato.id);
    return salvato.id;
  }

  function cambiaTargetType(valore: TargetType) {
    setTargetType(valore);
    if (valore === "B2B") {
      setConfig((prev) => ({
        ...prev,
        raggioKm: Math.max(prev.raggioKm || 15, 30),
      }));
    }
  }

  function cambiaTargetAge(valore: TargetAgeBand) {
    setTargetAge(valore);
    const eta = etaDaTargetAgeBand(valore);
    setConfig((prev) => ({
      ...prev,
      etaMin: eta.etaMin,
      etaMax: eta.etaMax,
    }));
  }

  function snapshotConfigWizardCorrente(): SnapshotConfigurazione {
    const ticket = Number(scontrinoMedio) || 0;
    const tassoNum = Number(tassoConversione) || 0;
    const margineProdotto =
      Number(productMargin) || (isEcommerce ? 60 : isInStore ? 40 : 50);
    return creaSnapshotConfigurazione({
      frontEndOffer,
      elevatorPitch,
      varianteA: config.varianteA,
      varianteB: config.varianteB,
      varianteC: config.varianteC,
      titoloAnnuncio: config.titoloAnnuncio,
      creativita,
      dailyBudget: config.budgetGiornaliero,
      launchBudget: isAwareness ? Number(launchBudget) || 0 : 0,
      citta: contesto.citta,
      raggioKm: config.raggioKm,
      etaMin: config.etaMin,
      etaMax: config.etaMax,
      targetType,
      targetAge,
      ticket,
      conversionRate: tassoNum,
      margine: isPercorsoLeads || isBookings ? targetMargin : margineProdotto,
      objective: objectiveEffettivo,
      destinationUrl: sitoWeb,
      heroProduct,
      bookingChannel: isBookings ? bookingChannel : undefined,
      pageId,
      formId,
      conversionRateSource: isPercorsoLeads ? conversionRateSource : "",
      nomeCampagna: config.nomeCampagna,
    });
  }

  function snapshotWizardCorrente(): string {
    const ticket = Number(scontrinoMedio) || 0;
    const tassoNum = Number(tassoConversione) || 0;
    const margineProdotto =
      Number(productMargin) || (isEcommerce ? 60 : isInStore ? 40 : 50);
    return firmaSostanziale({
      frontEndOffer,
      elevatorPitch,
      varianteA: config.varianteA,
      varianteB: config.varianteB,
      varianteC: config.varianteC,
      titoloAnnuncio: config.titoloAnnuncio,
      creativita,
      dailyBudget: config.budgetGiornaliero,
      launchBudget: isAwareness ? Number(launchBudget) || 0 : 0,
      citta: contesto.citta,
      raggioKm: config.raggioKm,
      etaMin: config.etaMin,
      etaMax: config.etaMax,
      targetType,
      targetAge,
      ticket,
      conversionRate: tassoNum,
      margine: isPercorsoLeads || isBookings ? targetMargin : margineProdotto,
      objective: objectiveEffettivo,
      destinationUrl: sitoWeb,
      heroProduct,
      bookingChannel: isBookings ? bookingChannel : undefined,
    });
  }

  function vaiIndietro() {
    setErroreSalvataggio(null);
    setErroriPasso1({});
    setWizardStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  async function assicuraCampagnaSalvata(): Promise<string> {
    if (saveInFlightRef.current) return saveInFlightRef.current;

    const operazione = (async () => {
      if (!campagnaIdStabileRef.current) {
        if (isEditMode && campaignIdEdit) {
          campagnaIdStabileRef.current = campaignIdEdit;
        } else {
          campagnaIdStabileRef.current =
            campagnaIdSalvata ??
            (typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : null);
        }
        if (!campagnaIdStabileRef.current) {
          throw new Error(
            isEditMode
              ? "ID campagna mancante: impossibile salvare le modifiche."
              : "Impossibile generare un ID campagna stabile in questo browser.",
          );
        }
      }
      const campaignId = campagnaIdStabileRef.current;

      const changesetEdit =
        isEditMode && snapshotConfigInizialeRef.current
          ? diffConfigurazione(
              snapshotConfigInizialeRef.current,
              snapshotConfigWizardCorrente(),
            )
          : [];

      const ticket = Number(scontrinoMedio) || 0;
      const tassoLeads = isPercorsoLeads
        ? tassoConversioneLeadsValido(conversionRateSource, tassoConversione)
        : null;
      const tasso = isPercorsoLeads
        ? tassoLeads
        : Number(tassoConversione) || (isBookings ? 75 : 10);
      const margineProdotto =
        Number(productMargin) || (isEcommerce ? 60 : isInStore ? 40 : 50);
      const costoFulfillment = Number(fulfillmentCost) || 0;
      const sconto = Number(recoveryDiscount) || 0;
      const budgetLancio = Number(launchBudget) || 300;
      const cpm = Number(estimatedCpm) || 7;
      const raggioAwareness = config.raggioKm || 10;
      const maxCpa = isAwareness
        ? cpm
        : isRetargeting
          ? calculateMaxSustainableRecoveryCpa(ticket, margineProdotto, sconto)
          : isInStore
            ? calculateMaxSustainableInStoreCpa(
                ticket,
                margineProdotto,
                targetMargin,
              )
            : isEcommerce
              ? calculateEcommerceCpaMax(
                  ticket,
                  margineProdotto,
                  costoFulfillment,
                  ecommerceLtvAttivo,
                )
              : (() => {
                  if (isPercorsoLeads && tassoLeads == null) {
                    return undefined;
                  }
                  const base = isBookings
                    ? calculateMaxSustainableBookingCpa(
                        ticket,
                        tasso ?? 0,
                        targetMargin,
                      )
                    : calculateMaxSustainableCpl(
                        ticket,
                        tasso ?? 0,
                        targetMargin,
                      );
                  if (
                    !ltvAttivo ||
                    isEcommerce ||
                    isInStore ||
                    isRetargeting ||
                    isAwareness
                  ) {
                    return base;
                  }
                  const ltv = calculateLtvEconomics({
                    scontrinoMedio: ticket,
                    frequenzaAnnuale: Number(frequenzaAnnuale) || 1,
                    anniPermanenza: Number(anniPermanenza) || 1,
                    loyaltyPercent: Number(loyaltyPercent) || 0,
                    margineLordoPercent: Number(margineLordoLtv) || 50,
                    tassoConversionePercent: tasso ?? 0,
                    targetMarginPercent: targetMargin,
                  });
                  return ltv.cplSostenibileLtv > 0
                    ? ltv.cplSostenibileLtv
                    : base;
                })();

      const dailyBudget = isAwareness
        ? Math.max(5, Math.round(budgetLancio / 7))
        : config.budgetGiornaliero;

      const salvata = await salvaCampagnaCompleta({
        campaignId,
        nomeCliente: config.nomeCliente || "Nuovo cliente",
        elevatorPitch: isEditMode ? elevatorPitch : elevatorPitch || undefined,
        website: isEditMode ? sitoWeb : sitoWeb || undefined,
        nomeCampagna:
          config.nomeCampagna.trim() ||
          nomeCampagnaPerObiettivo(
            objectiveEffettivo,
            config.nomeCliente || "Nuovo cliente",
          ),
        dailyBudget,
        maxSustainableCpa: maxCpa,
        averageTicketValue: isAwareness ? undefined : ticket || undefined,
        closingRate:
          isEcommerce || isInStore || isRetargeting || isAwareness
            ? undefined
            : tassoLeads != null
              ? tassoLeads
              : undefined,
        targetMargin: isRetargeting || isAwareness ? undefined : targetMargin,
        objective: objectiveEffettivo,
        bookingServiceValue: isBookings ? ticket || undefined : undefined,
        showUpRate: isBookings ? (tasso ?? 75) : undefined,
        bookingChannel: isBookings ? bookingChannel : undefined,
        bookingConfirmationPolicy: isBookings
          ? bookingConfirmationPolicy
          : undefined,
        averageOrderValue: isEcommerce ? ticket || undefined : undefined,
        productMargin: isEcommerce ? margineProdotto : undefined,
        averageReceipt: isInStore ? ticket || undefined : undefined,
        storeMargin: isInStore ? margineProdotto : undefined,
        recoveryValue: isRetargeting ? ticket || undefined : undefined,
        recoveryMargin: isRetargeting ? margineProdotto : undefined,
        recoveryDiscount: isRetargeting ? sconto : undefined,
        launchBudget: isAwareness ? budgetLancio : undefined,
        awarenessRadiusKm: isAwareness ? raggioAwareness : undefined,
        estimatedCpm: isAwareness ? cpm : undefined,
        varianteA: isEditMode ? config.varianteA : config.varianteA || undefined,
        varianteB: isEditMode ? config.varianteB : config.varianteB || undefined,
        varianteC: isEditMode ? config.varianteC : config.varianteC || undefined,
        pageId: isEditMode ? pageId : pageId || undefined,
        formId: isEditMode ? formId : formId || undefined,
        settore: contesto.settore,
        citta: contesto.citta,
        raggioKm: isAwareness ? raggioAwareness : config.raggioKm,
        etaMin: config.etaMin,
        etaMax: config.etaMax,
        titoloAnnuncio: isEditMode
          ? config.titoloAnnuncio
          : config.titoloAnnuncio || undefined,
        frontEndOffer: isEditMode
          ? frontEndOffer
          : frontEndOffer.trim() || undefined,
        shippingMarket: isEcommerce ? shippingMarket : undefined,
        heroProduct: isEcommerce
          ? isEditMode
            ? heroProduct
            : heroProduct.trim() || elevatorPitch.trim() || undefined
          : undefined,
        targetType,
        targetAge,
        creativitaMeta: creativitaToMeta(creativita),
        creativitaAssets: creativita,
        conversionRateSource: isPercorsoLeads
          ? conversionRateSource
          : undefined,
        permettiCampiVuoti: isEditMode,
      });

      const clientIdSalvato = persistiClienteSeRichiesto();
      campagnaIdStabileRef.current = salvata.id;
      setCampagnaIdSalvata(salvata.id);
      if (isPercorsoLeads) {
        persistiCrsSessione(searchParams.toString(), conversionRateSource);
      }
      if (salvata.conversionRateSource) {
        cambiaConversionRateSource(salvata.conversionRateSource);
      }

      let statusDopoSave = salvata.status ?? "DRAFT";
      let richiestaNuovaApprovazione = false;
      if (isEditMode) {
        const sostanziale = haModificaSostanziale(
          snapshotInizialeRef.current,
          snapshotWizardCorrente(),
        );
        if (
          deveInvalidareApprovazione(statusEditInizialeRef.current, sostanziale)
        ) {
          await invalidaApprovazioneDopoModificaSostanziale(salvata.id);
          statusDopoSave = "DRAFT";
          richiestaNuovaApprovazione = true;
        }
        if (changesetEdit.length > 0) {
          try {
            const { title, description } = testoLogAggiornamento(
              changesetEdit,
              { richiestaNuovaApprovazione },
            );
            await logCampagnaAggiornata({
              campaignId: salvata.id,
              title,
              description,
            });
          } catch {
            // Diario non bloccante: il salvataggio campagna è già riuscito.
          }
        }
      }

      saveCampaign({
        id: salvata.id,
        clientId: clientIdSalvato,
        nomeCliente: config.nomeCliente || "Nuovo cliente",
        nomeCampagna:
          config.nomeCampagna.trim() ||
          nomeCampagnaPerObiettivo(
            objectiveEffettivo,
            config.nomeCliente || "Nuovo cliente",
          ),
        objective: objectiveEffettivo,
        settore: contesto.settore,
        citta: contesto.citta,
        // Preserva status remoto (APPROVED / REVISION_REQUESTED / DRAFT).
        status: statusDopoSave,
        frontEndOffer: frontEndOffer.trim(),
      });

      if (salvata.status || isEditMode) {
        setStatusApprovazioneGrezzo(statusDopoSave);
      }

      return salvata.id;
    })();

    saveInFlightRef.current = operazione;
    try {
      return await operazione;
    } finally {
      if (saveInFlightRef.current === operazione) {
        saveInFlightRef.current = null;
      }
    }
  }

  async function copiaLinkApprovazione() {
    if (linkApprovazioneInCorso) return;
    setLinkApprovazioneInCorso(true);
    setErroreLinkApprovazione(null);
    try {
      const id = await assicuraCampagnaSalvata();
      const token = await assicuratiTokenApprovazione(id);
      const url = urlApprovazioneDaToken(token);
      await navigator.clipboard.writeText(url);
      setLinkApprovazioneCopiato(true);
      window.setTimeout(() => setLinkApprovazioneCopiato(false), 2500);
      if (
        isPercorsoLeads ||
        isPercorsoBookings ||
        isPercorsoEcommerce ||
        isPercorsoInstore ||
        isPercorsoRetargeting ||
        isPercorsoAwareness
      ) {
        await caricaStatusApprovazione(id);
      }
    } catch (e) {
      setErroreLinkApprovazione(
        messaggioErroreSupabase(e, "copia_link"),
      );
      logErroreSupabaseDev("copia_link_approvazione", e);
    } finally {
      setLinkApprovazioneInCorso(false);
    }
  }

  async function rimandaInApprovazione() {
    if (rimandaApprovazioneInCorso) return;
    setRimandaApprovazioneInCorso(true);
    setErroreRimandaApprovazione(null);
    try {
      const id = await assicuraCampagnaSalvata();
      await completaRevisioneCampagnaSuSupabase(id);
      setStatusApprovazioneGrezzo("DRAFT");
      setRevisionNotesCliente(null);
      await caricaStatusApprovazione(id);
    } catch (e) {
      setErroreRimandaApprovazione(
        messaggioErroreSupabase(e, "salva"),
      );
    } finally {
      setRimandaApprovazioneInCorso(false);
    }
  }

  async function lanciaCampagna() {
    if (salvataggioInCorso) return;

    setSalvataggioInCorso(true);
    setErroreSalvataggio(null);

    try {
      const id = await assicuraCampagnaSalvata();
      router.push(`/campagne/${id}`);
    } catch (e) {
      setErroreSalvataggio(messaggioErroreSupabase(e, "salva"));
      logErroreSupabaseDev("salva_campagna", e);
      setSalvataggioInCorso(false);
    }
  }

  const sottotitolo = isInStore
    ? "Assistente guidato per retail, ristorazione e attività su strada. Completa i 6 passaggi ed esporta la campagna pronta per Meta."
    : isAwareness
      ? "Assistente guidato per inaugurazioni e lanci locali. Stima copertura, genera i copy e prepara l'export Meta."
      : isRetargeting
        ? "Assistente guidato per recuperare carrelli e contatti caldi. Calcola il CPA, genera i copy e prepara l'export Meta."
        : isEcommerce
          ? "Assistente guidato per e-commerce. Calcola ROAS e CPA max, genera i copy e prepara l'export Meta."
          : isBookings
            ? "Assistente guidato per studi, saloni e servizi locali. Calcola il CPA sostenibile e prepara l'export Meta."
            : contesto.settore
              ? `Assistente guidato per ${contesto.settore.toLowerCase()}${contesto.citta ? ` a ${contesto.citta}` : ""}. Completa i 6 passaggi e esporta la campagna pronta per Meta.`
              : "Assistente guidato in 6 passaggi: obiettivo, economia, messaggio, creatività, diagnosi e export Meta.";

  const titoloPagina = isAwareness
    ? "Far conoscere un'apertura"
    : isRetargeting
      ? "Recuperare chi non ha comprato"
      : isInStore
        ? "Più gente in negozio"
        : isEcommerce
          ? "Più vendite online"
          : isBookings
            ? "Più prenotazioni"
            : "Più richieste di contatto";

  const stepAttuale = WIZARD_STEPS.find((s) => s.id === wizardStep);
  const titoloStepWizardStatico =
    isPercorsoAwareness && wizardStep === 1
      ? "Partiamo dalla nuova apertura"
      : isPercorsoAwareness && wizardStep === 2
        ? "Copertura del lancio"
      : isPercorsoAwareness && wizardStep === 3
        ? "Facciamo conoscere l'apertura"
      : isPercorsoAwareness && wizardStep === 4
        ? "Prepariamo la creatività di apertura"
      : isPercorsoAwareness && wizardStep === 5
        ? "Controllo prima di spendere"
      : isPercorsoAwareness && wizardStep === 6
        ? "Campagna pronta"
    : isPercorsoRetargeting && wizardStep === 1
      ? "Partiamo dal pubblico da recuperare"
      : isPercorsoRetargeting && wizardStep === 2
        ? "Economia del recupero"
      : isPercorsoRetargeting && wizardStep === 3
        ? "Diamo un motivo per tornare"
      : isPercorsoRetargeting && wizardStep === 4
        ? "Prepariamo la creatività di recupero"
      : isPercorsoRetargeting && wizardStep === 5
        ? "Controllo prima di spendere"
      : isPercorsoRetargeting && wizardStep === 6
        ? "Campagna pronta"
    : isPercorsoInstore && wizardStep === 1
      ? "Partiamo dal punto vendita"
      : isPercorsoInstore && wizardStep === 2
        ? "Economia del punto vendita"
      : isPercorsoInstore && wizardStep === 3
        ? "Portiamo le persone verso il punto vendita"
      : isPercorsoInstore && wizardStep === 4
        ? "Prepariamo la creatività locale"
      : isPercorsoInstore && wizardStep === 5
        ? "Controllo prima di spendere"
      : isPercorsoInstore && wizardStep === 6
        ? "Campagna pronta"
    : isPercorsoEcommerce && wizardStep === 1
      ? "Partiamo dal prodotto da vendere"
      : isPercorsoEcommerce && wizardStep === 2
        ? "Economia dell'acquisto"
        : isPercorsoEcommerce && wizardStep === 3
          ? "Rendiamo l'offerta acquistabile"
          : isPercorsoEcommerce && wizardStep === 4
            ? "Prepariamo la creatività prodotto"
          : isPercorsoEcommerce && wizardStep === 5
            ? "Controllo prima di spendere"
          : isPercorsoBookings && wizardStep === 1
      ? "Partiamo dal servizio da prenotare"
      : isPercorsoBookings && wizardStep === 2
        ? "Economia dell'appuntamento"
        : isPercorsoLeads && wizardStep === 3
          ? "Troviamo il messaggio"
          : isPercorsoLeads && wizardStep === 4
          ? "Prepara le creatività"
          : isPercorsoBookings && wizardStep === 4
            ? "Prepariamo la creatività"
            : isPercorsoLeads && wizardStep === 5
              ? "Controllo prima di spendere"
              : isPercorsoBookings && wizardStep === 5
                ? "Controllo prima di spendere"
                : isPercorsoBookings && wizardStep === 6
                  ? "Campagna pronta"
                  : isPercorsoEcommerce && wizardStep === 6
                    ? "Campagna pronta"
                  : isPercorsoInstore && wizardStep === 6
                    ? "Campagna pronta"
                  : isPercorsoLeads && wizardStep === 6
                ? "Campagna pronta"
                : stepAttuale?.titolo ?? "";
  const sottotitoloStepWizardStatico =
    isPercorsoAwareness && wizardStep === 1
      ? "Definiamo cosa vuoi far conoscere, dove si trova e quale messaggio deve ricordare il pubblico."
      : isPercorsoAwareness && wizardStep === 2
        ? "Usa budget e CPM come riferimento per stimare l'esposizione della campagna nell'area scelta."
      : isPercorsoAwareness && wizardStep === 3
        ? "Controlla che il messaggio spieghi cosa sta aprendo, dove e perché vale la pena scoprirlo."
      : isPercorsoAwareness && wizardStep === 4
        ? "Carica gli asset della campagna e costruisci un visual che faccia capire cosa c'è di nuovo e dove scoprirlo."
      : isPercorsoAwareness && wizardStep === 5
        ? "Verifica che messaggio, area, budget e destinazione siano coerenti prima di esportare la campagna."
      : isPercorsoAwareness && wizardStep === 6
        ? "La struttura è completa. Falla approvare al cliente, esportala su Meta Ads Manager e verifica le impostazioni prima del lancio."
    : isPercorsoRetargeting && wizardStep === 1
      ? "Definiamo cosa vuoi recuperare, cosa stai offrendo e dove deve tornare l'utente."
      : isPercorsoRetargeting && wizardStep === 2
        ? "Calcola quanto puoi permetterti di spendere per recuperare una conversione senza compromettere il margine."
      : isPercorsoRetargeting && wizardStep === 3
        ? "Controlla che il messaggio ricordi il valore dell'offerta senza sembrare invasivo o inventare urgenza."
      : isPercorsoRetargeting && wizardStep === 4
        ? "Carica l'asset della campagna e costruisci un messaggio visivo che dia un motivo concreto per tornare."
      : isPercorsoRetargeting && wizardStep === 5
        ? "Verifica che messaggio, destinazione, creatività ed economia siano coerenti prima di portare la campagna su Meta."
      : isPercorsoRetargeting && wizardStep === 6
        ? "La struttura è completa. Falla approvare al cliente, esportala su Meta Ads Manager e completa la configurazione del pubblico."
    : isPercorsoInstore && wizardStep === 1
      ? "Raccontami l'attività, l'offerta e l'area da raggiungere."
      : isPercorsoInstore && wizardStep === 2
        ? "Calcola quanto puoi permetterti di spendere per acquisire un nuovo cliente senza erodere il margine desiderato."
      : isPercorsoInstore && wizardStep === 3
        ? "Controlla che il messaggio dica chiaramente dove trovarti, perché vale la pena venire e cosa deve fare l'utente."
      : isPercorsoInstore && wizardStep === 4
        ? "Carica l'asset della campagna e assicurati che faccia capire subito attività, zona e motivo per venire."
      : isPercorsoInstore && wizardStep === 5
        ? "Verifica che area, messaggio, destinazione, budget e creatività siano coerenti prima di esportare la campagna."
      : isPercorsoInstore && wizardStep === 6
        ? "La struttura è completa. Falla approvare al cliente e poi esportala su Meta Ads Manager."
    : isPercorsoEcommerce && wizardStep === 1
      ? "Raccontami cosa vende il brand, a chi e con quale offerta."
      : isPercorsoEcommerce && wizardStep === 2
        ? "Calcola quanto può costarti un acquisto e quale ROAS serve per restare sostenibile."
        : isPercorsoEcommerce && wizardStep === 3
          ? "Controlla che prodotto, beneficio, offerta e CTA siano chiari prima di passare alla creatività."
          : isPercorsoEcommerce && wizardStep === 4
            ? "Carica l'asset che userai nella campagna e controlla che presenti prodotto, beneficio e offerta in modo chiaro."
          : isPercorsoEcommerce && wizardStep === 5
            ? "Verifica che economia, messaggio, destinazione e creatività siano coerenti prima di esportare la campagna."
          : isPercorsoEcommerce && wizardStep === 6
            ? "La struttura è completa. Falla approvare al cliente e poi esportala su Meta Ads Manager."
          : isPercorsoBookings && wizardStep === 1
      ? "Raccontami cosa deve prenotare il cliente e come avviene oggi la prenotazione."
      : isPercorsoBookings && wizardStep === 2
        ? "Quanto può costare una prenotazione? Calcola CPA target, tasso di presenza e break-even."
        : isPercorsoBookings && wizardStep === 4
          ? "Carica ciò che vuoi usare nella campagna. Affianco ti aiuta a controllare formato e coerenza con una campagna di prenotazione."
          : isPercorsoBookings && wizardStep === 5
          ? "Affianco controlla che la campagna sia pronta per generare prenotazioni."
          : isPercorsoBookings && wizardStep === 6
            ? "La struttura è completa. Falla approvare al cliente e poi esportala su Meta Ads Manager."
            : isPercorsoLeads && wizardStep === 6
          ? "La struttura è completa. Falla approvare al cliente e poi esportala su Meta Ads Manager."
          : null;
  const headerLancio = copyHeaderStep6(raccomandazioneLancio.stato);
  const titoloStepWizard =
    wizardStep === 6 ? headerLancio.titolo : titoloStepWizardStatico;
  const sottotitoloStepWizard =
    wizardStep === 6 ? headerLancio.sottotitolo : sottotitoloStepWizardStatico;
  const etichettaPulsanteAvanti =
    wizardStep === 5 &&
    (isPercorsoLeads ||
      isPercorsoBookings ||
      isPercorsoEcommerce ||
      isPercorsoInstore ||
      isPercorsoRetargeting ||
      isPercorsoAwareness)
      ? diagnosi.haErroriBloccanti
        ? "Correggi prima di continuare"
        : (diagnosi.riepilogo?.consigli ?? 0) > 0
          ? "Continua comunque"
          : "Continua alla campagna pronta"
      : wizardStep === 5
        ? "Continua verso Campagna Pronta"
        : "Avanti";
  const mostraSidebar =
    wizardStep === 2 ||
    wizardStep === 3 ||
    wizardStep === 4 ||
    wizardStep === 5 ||
    wizardStep === 6;

  return (
    <div className="py-2">
      <div className={`mx-auto ${wizardStep === 1 ? "max-w-[1120px]" : "max-w-7xl"}`}>
        <Link
          href="/campagne"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Torna alle campagne
        </Link>

        <div className="mt-5 mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[var(--ink-muted)]">
              Affianco / Campagna
            </p>
            {config.nomeCliente?.trim() ? (
              <p className="mt-1 text-lg font-medium text-[var(--ink)]">
                {config.nomeCliente.trim()}
              </p>
            ) : null}
            <h1 className="mt-2 text-[28px] font-medium tracking-tight text-[var(--ink)] sm:text-[32px]">
              {titoloPagina}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
              {sottotitolo}
            </p>
          </div>
          {isEditMode ? (
            <div className="inline-flex max-w-full flex-col rounded-full bg-[var(--yellow-soft)] px-4 py-2 sm:px-5">
              <p className="text-[13px] font-medium text-[#6b5420]">
                Stai modificando una campagna esistente
              </p>
              {hydrateEditInCorso ? (
                <p className="mt-0.5 text-[12px] text-[#6b5420]/80">
                  Caricamento dati dal database…
                </p>
              ) : null}
              {erroreHydrateEdit ? (
                <p className="mt-0.5 text-[12px] text-[#a85a72]">{erroreHydrateEdit}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mb-8 aff-panel-lilac p-2 sm:p-3">
          <div className="rounded-[20px] bg-[rgba(110,104,158,0.28)] p-1.5">
            <WizardStepper
            step={wizardStep}
            titoliOverride={{
              ...(isPercorsoAwareness
                ? {
                    3: "Messaggio di apertura",
                    4: "Creatività di apertura",
                    5: "Controllo",
                  }
                : isPercorsoRetargeting
                  ? {
                      3: "Messaggio di recupero",
                      4: "Creatività di recupero",
                      5: "Controllo",
                    }
                  : isPercorsoInstore
                    ? {
                        3: "Messaggio locale",
                        4: "Creatività locale",
                        5: "Controllo",
                      }
                    : {}),
              ...(wizardStep === 6
                ? { 6: etichettaStepperStep6(raccomandazioneLancio.stato) }
                : {}),
            }}
            onVaiAStep={(s) => {
              if (s <= wizardStep) setWizardStep(s);
            }}
          />
          </div>
          {stepAttuale ? (
            <div className="px-3 pb-2 pt-3 sm:px-4">
              <p className="text-sm font-medium text-[var(--ink)]">
                {titoloStepWizard}
              </p>
              {sottotitoloStepWizard ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)]">
                  {sottotitoloStepWizard}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div
            className={`min-w-0 space-y-6 ${
              mostraSidebar ? "lg:col-span-8" : "lg:col-span-12"
            }`}
          >
            {wizardStep === 5 ? (
              <DiagnosiPreLancio
                diagnosi={diagnosi}
                onAzioneRapida={azioneRapidaDiagnosi}
              />
            ) : (
              <>
                {wizardStep === 6 ? (
                  <>
                  <RaccomandazioneLancio result={raccomandazioneLancio} />
                  <StrategicScoreCard result={strategicScore} />
                  <LaunchReadinessCard result={launchReadiness} />
                  <CardLinkApprovazione
                    onCopia={() => void copiaLinkApprovazione()}
                    inCorso={linkApprovazioneInCorso}
                    copiato={linkApprovazioneCopiato}
                    errore={erroreLinkApprovazione}
                    titolo={
                      isPercorsoLeads ||
                      isPercorsoBookings ||
                      isPercorsoEcommerce ||
                      isPercorsoInstore ||
                      isPercorsoRetargeting ||
                      isPercorsoAwareness
                        ? "1. Fai approvare la campagna"
                        : isBookings
                          ? "1. Invia la scheda al cliente prima di lanciare"
                          : undefined
                    }
                    descrizione={
                      isPercorsoEcommerce ||
                      isPercorsoInstore ||
                      isPercorsoRetargeting ||
                      isPercorsoAwareness
                        ? "Condividi il link con il cliente per raccogliere approvazione o richieste di modifica."
                        : isPercorsoLeads
                        ? "Condividi il link con il cliente. Potrà vedere strategia, copy, creatività e anteprima dell'annuncio prima del lancio."
                        : isPercorsoBookings
                          ? "Condividi il link con il cliente. Potrà vedere strategia, messaggio, creatività e anteprima prima del lancio."
                          : isEcommerce
                          ? "Condividi questo link prima di lanciare. Il cliente vedrà l'anteprima dell'annuncio e il ROAS e CPA sostenibile senza bisogno di login."
                          : isInStore
                            ? "Condividi questo link prima di lanciare. Il cliente vedrà l'anteprima dell'annuncio e la CPA In-Store sostenibile (costo per cliente in cassa) senza bisogno di login."
                            : isRetargeting
                              ? "Condividi questo link prima di lanciare. Il cliente vedrà l'anteprima dell'annuncio e la CPA di recupero ed il ROAS target senza bisogno di login."
                              : isAwareness
                                ? "Condividi questo link prima di lanciare. Il cliente vedrà l'anteprima dell'annuncio e la copertura locale e le visualizzazioni stimate senza bisogno di login."
                                : isBookings
                                  ? `Permetti al locale di verificare l'offerta (${
                                      frontEndOffer.trim() || "offerta d'ingresso"
                                    }) e l'anteprima dell'annuncio.`
                                  : undefined
                    }
                    etichettaCta={
                      isPercorsoEcommerce ||
                      isPercorsoInstore ||
                      isPercorsoRetargeting ||
                      isPercorsoAwareness
                        ? "Copia link approvazione"
                        : isPercorsoLeads || isPercorsoBookings
                          ? "Copia link di approvazione"
                          : undefined
                    }
                    statoApprovazione={
                      isPercorsoLeads ||
                      isPercorsoBookings ||
                      isPercorsoEcommerce ||
                      isPercorsoInstore ||
                      isPercorsoRetargeting ||
                      isPercorsoAwareness
                        ? statoApprovazioneLeads
                        : undefined
                    }
                  />
                  {statoApprovazioneLeads === "modifiche_richieste" ? (
                    <section className="rounded-[var(--radius)] border border-[#f5c9b8] bg-[#fff4f0] p-5 shadow-[var(--shadow-soft)]">
                      <h2 className="text-sm font-medium text-[var(--ink)]">
                        Feedback del cliente
                      </h2>
                      {revisionNotesCliente?.trim() ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
                          {revisionNotesCliente.trim()}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--ink-muted)]">
                          Il cliente ha richiesto modifiche senza lasciare una
                          nota testuale.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void rimandaInApprovazione()}
                        disabled={rimandaApprovazioneInCorso}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {rimandaApprovazioneInCorso
                          ? "Invio in corso…"
                          : "Modifiche completate — Rimanda in approvazione"}
                      </button>
                      {erroreRimandaApprovazione ? (
                        <p className="mt-2 text-sm text-[#C45C5C]">
                          {erroreRimandaApprovazione}
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                  </>
                ) : null}
              <FormConfigurazione
                key={
                  isEcommerce
                    ? "form-vendite-online"
                    : isInStore
                      ? "form-instore"
                      : isRetargeting
                        ? "form-retargeting"
                        : isAwareness
                          ? "form-apertura"
                          : `form-${objectiveEffettivo}`
                }
                config={config}
                onCambia={aggiornaConfig}
                varianti={etichetteVarianti}
                citta={contesto.citta}
                settore={contesto.settore}
                onCambiaCitta={(valore) =>
                  setContesto((prev) => ({ ...prev, citta: valore }))
                }
                onCambiaSettore={(valore) =>
                  setContesto((prev) => ({ ...prev, settore: valore }))
                }
                settoreIntel={settoreIntel}
                sectorIntelLoading={sectorIntelLoading}
                onSelezionaSettore={(item) => {
                  setContesto((prev) => ({ ...prev, settore: item.nome }));
                  const preset = presetDaChiave(item.id);
                  if (preset) applicaEconomiaSettore(preset);
                }}
                onCaricaClienteEsistente={applicaClienteEsistente}
                clienteCaricatoId={clienteId}
                salvaClientePreferito={salvaClientePreferito}
                onCambiaSalvaClientePreferito={setSalvaClientePreferito}
                formatoCuratoId={formatoCuratoId}
                onSelezionaFormatoCurato={setFormatoCuratoId}
                deconstructResult={deconstructResult}
                onDeconstructResult={setDeconstructResult}
                creativita={creativita}
                indiceAnteprimaCreativita={indiceAnteprimaCreativita}
                onCambiaCreativita={setCreativita}
                onCambiaIndiceAnteprimaCreativita={
                  setIndiceAnteprimaCreativita
                }
                formatoEcommerce={formatoEcommerce}
                onCambiaFormatoEcommerce={setFormatoEcommerce}
                pageId={pageId}
                formId={formId}
                onCambiaPageId={(valore) => setPageId(valore)}
                onCambiaFormId={(valore) => setFormId(valore)}
                whatsappNumber={whatsappNumber}
                onCambiaWhatsappNumber={setWhatsappNumber}
                postiDisponibiliSettimana={
                  isPercorsoBookings ? postiDisponibiliSettimana : undefined
                }
                onCambiaPostiDisponibiliSettimana={
                  isPercorsoBookings ? setPostiDisponibiliSettimana : undefined
                }
                campaignId={campagnaIdSalvata}
                scontrinoMedio={scontrinoMedio}
                tassoConversione={tassoConversione}
                onCambiaScontrinoMedio={setScontrinoMedio}
                onCambiaTassoConversione={setTassoConversione}
                conversionRateSource={conversionRateSource}
                onCambiaConversionRateSource={cambiaConversionRateSource}
                elevatorPitch={elevatorPitch}
                onCambiaElevatorPitch={(valore) => {
                  setElevatorPitch(valore);
                  setErroriPasso1((prev) => ({
                    ...prev,
                    elevatorPitch: false,
                  }));
                }}
                sitoWeb={sitoWeb}
                onCambiaSitoWeb={setSitoWeb}
                frontEndOffer={frontEndOffer}
                onCambiaFrontEndOffer={(valore) => {
                  setFrontEndOffer(valore);
                  setErroriPasso1((prev) => ({
                    ...prev,
                    frontEndOffer: false,
                  }));
                }}
                shippingMarket={shippingMarket}
                onCambiaShippingMarket={(valore) => {
                  setShippingMarket(valore);
                  if (valore === "ITALY") {
                    setContesto((prev) => ({ ...prev, citta: "Italia" }));
                    setConfig((prev) => ({
                      ...prev,
                      raggioKm: Math.max(prev.raggioKm || 20, 80),
                    }));
                  } else if (valore === "EUROPE") {
                    setContesto((prev) => ({ ...prev, citta: "Europa" }));
                    setConfig((prev) => ({
                      ...prev,
                      raggioKm: Math.max(prev.raggioKm || 20, 200),
                    }));
                  } else if (valore === "GLOBAL") {
                    setContesto((prev) => ({ ...prev, citta: "Globale" }));
                    setConfig((prev) => ({
                      ...prev,
                      raggioKm: Math.max(prev.raggioKm || 20, 500),
                    }));
                  }
                }}
                heroProduct={heroProduct}
                onCambiaHeroProduct={setHeroProduct}
                targetType={targetType}
                onCambiaTargetType={cambiaTargetType}
                targetAge={targetAge}
                onCambiaTargetAge={cambiaTargetAge}
                retargetingAudienceSource={retargetingAudienceSource}
                onCambiaRetargetingAudienceSource={
                  setRetargetingAudienceSource
                }
                dataEventoApertura={dataEventoApertura}
                onCambiaDataEventoApertura={setDataEventoApertura}
                tonoVoce={tonoVoce}
                onCambiaTonoVoce={cambiaTonoVoce}
                onRigeneraVarianti={rigeneraVariantiCopy}
                onDopoSwapVariante={() =>
                  setPreviewTabReset((n) => n + 1)
                }
                copyAiLoading={copyAiLoading}
                targetMargin={targetMargin}
                onCambiaTargetMargin={setTargetMargin}
                objective={objectiveEffettivo}
                bookingChannel={bookingChannel}
                onCambiaBookingChannel={setBookingChannel}
                bookingConfirmationPolicy={bookingConfirmationPolicy}
                onCambiaBookingConfirmationPolicy={
                  setBookingConfirmationPolicy
                }
                productMargin={productMargin}
                onCambiaProductMargin={setProductMargin}
                fulfillmentCost={fulfillmentCost}
                onCambiaFulfillmentCost={setFulfillmentCost}
                ecommerceLtvAttivo={ecommerceLtvAttivo}
                onCambiaEcommerceLtvAttivo={setEcommerceLtvAttivo}
                recoveryDiscount={recoveryDiscount}
                onCambiaRecoveryDiscount={setRecoveryDiscount}
                launchBudget={launchBudget}
                onCambiaLaunchBudget={setLaunchBudget}
                estimatedCpm={estimatedCpm}
                onCambiaEstimatedCpm={setEstimatedCpm}
                ltvAttivo={ltvAttivo}
                onCambiaLtvAttivo={setLtvAttivo}
                frequenzaAnnuale={frequenzaAnnuale}
                onCambiaFrequenzaAnnuale={setFrequenzaAnnuale}
                anniPermanenza={anniPermanenza}
                onCambiaAnniPermanenza={setAnniPermanenza}
                loyaltyPercent={loyaltyPercent}
                onCambiaLoyaltyPercent={setLoyaltyPercent}
                margineLordoLtv={margineLordoLtv}
                onCambiaMargineLordoLtv={setMargineLordoLtv}
                wizardStep={wizardStep}
                erroriPasso1={erroriPasso1}
                copyInPreparazione={isPercorsoLeads && copyAiLoading}
                copyPreparazioneNota={
                  isPercorsoLeads && copyAiErrore ? copyAiErrore : null
                }
                statoApprovazioneLeads={
                  isPercorsoLeads ||
                  isPercorsoBookings ||
                  isPercorsoEcommerce ||
                  isPercorsoInstore ||
                  isPercorsoRetargeting ||
                  isPercorsoAwareness
                    ? statoApprovazioneLeads
                    : undefined
                }
                revisionNotesCliente={revisionNotesCliente}
                statoLancio={raccomandazioneLancio.stato}
              />
              </>
            )}
          </div>

          {mostraSidebar ? (
            <div className="min-w-0 space-y-6 lg:sticky lg:top-8 lg:col-span-4">
              {wizardStep === 2 ? (
                <div className={isPercorsoEcommerce ? "opacity-90" : undefined}>
                  <ValutazioneEconomicaCard result={strategicScore} />
                </div>
              ) : null}
              {wizardStep === 5 ? (
                <StrategicScoreCard result={strategicScore} />
              ) : null}
              {wizardStep === 6 &&
              (isPercorsoLeads ||
                isPercorsoBookings ||
                isPercorsoEcommerce ||
                isPercorsoInstore ||
                isPercorsoRetargeting ||
                isPercorsoAwareness) ? (
                <ChecklistMeta />
              ) : null}
              {wizardStep === 2 ? (
                <PannelloPerche
                  config={config}
                  settore={contesto.settore}
                  citta={contesto.citta}
                  scontrinoMedio={scontrinoMedio}
                  tassoConversione={tassoConversione}
                  targetMargin={targetMargin}
                  objective={objectiveEffettivo}
                  productMargin={productMargin}
                  fulfillmentCost={fulfillmentCost}
                  ecommerceLtvAttivo={ecommerceLtvAttivo}
                  recoveryDiscount={recoveryDiscount}
                  ltvAttivo={ltvAttivo}
                  frequenzaAnnuale={frequenzaAnnuale}
                  anniPermanenza={anniPermanenza}
                  loyaltyPercent={loyaltyPercent}
                  percorsoRetargeting={isPercorsoRetargeting}
                  percorsoAwareness={isPercorsoAwareness}
                  percorsoLeads={isPercorsoLeads}
                  conversionRateSource={conversionRateSource}
                  margineLordoLtv={margineLordoLtv}
                  targetType={targetType}
                  launchBudget={launchBudget}
                  estimatedCpm={estimatedCpm}
                  settoreIntel={settoreIntel}
                />
              ) : null}
              {wizardStep === 3 || wizardStep === 4 ? (
                <MetaFeedMockup
                  config={config}
                  selectedImage={selectedImage}
                  immagini={urlsCreativita}
                  isVideoFlags={creativita.map((c) => Boolean(c.isVideo))}
                  objective={objectiveEffettivo}
                  bookingChannel={bookingChannel}
                  destinationUrl={isAwareness || isInStore ? sitoWeb : undefined}
                  formatoEcommerce={formatoEcommerce}
                  indiceCarosello={indiceAnteprimaCreativita}
                  onCambiaIndiceCarosello={setIndiceAnteprimaCreativita}
                  tabResetKey={previewTabReset}
                />
              ) : null}
              {wizardStep === 6 &&
              !isPercorsoLeads &&
              !isPercorsoBookings &&
              !isPercorsoEcommerce &&
              !isPercorsoInstore &&
              !isPercorsoRetargeting &&
              !isPercorsoAwareness ? (
                <ChecklistMeta />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={vaiIndietro}
              disabled={wizardStep === 1}
              className="rounded-[16px] bg-white/70 px-5 py-2.5 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-card)] transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Indietro
            </button>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => router.push(`/campagne/${campaignIdEdit}`)}
                className="rounded-[16px] bg-white/70 px-5 py-2.5 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-card)] transition-opacity hover:bg-white"
              >
                Annulla
              </button>
            ) : null}
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            {erroreSalvataggio ? (
              <p className="max-w-md text-right text-sm text-[#C45C5C]">
                {erroreSalvataggio}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
            {wizardStep < 6 ? (
              <button
                type="button"
                onClick={vaiAvanti}
                disabled={
                  hydrateEditInCorso ||
                  (wizardStep === 5 &&
                  (isPercorsoLeads ||
                    isPercorsoBookings ||
                    isPercorsoEcommerce ||
                    isPercorsoInstore ||
                    isPercorsoRetargeting ||
                    isPercorsoAwareness) &&
                  Boolean(diagnosi.haErroriBloccanti))
                }
                className="rounded-[16px] bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {etichettaPulsanteAvanti}
              </button>
            ) : !isEditMode ? (
              <button
                type="button"
                onClick={() => void lanciaCampagna()}
                disabled={salvataggioInCorso}
                className="rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvataggioInCorso
                  ? "Salvataggio in corso…"
                  : isPercorsoRetargeting || isPercorsoAwareness
                    ? "4. Salva la campagna"
                    : isPercorsoEcommerce || isPercorsoInstore
                    ? "3. Salva la campagna"
                    : "Salva campagna e procedi"}
              </button>
            ) : null}
            {isEditMode ? (
              <button
                type="button"
                onClick={() => void lanciaCampagna()}
                disabled={
                  salvataggioInCorso ||
                  hydrateEditInCorso ||
                  Boolean(erroreHydrateEdit)
                }
                className="rounded-[16px] bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvataggioInCorso ? "Salvataggio in corso…" : "Salva modifiche"}
              </button>
            ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Percorso dedicato all'obiettivo Prenotazioni / Local Services. */
export function PercorsoPrenotazioni() {
  return <PercorsoContatti objective="BOOKINGS" wizardSlug="prenotazioni" />;
}

/** Percorso dedicato all'obiettivo E-commerce / Vendite online. */
export function PercorsoEcommerce() {
  return (
    <PercorsoContatti objective="ECOMMERCE" wizardSlug="vendite-online" />
  );
}

/** Percorso dedicato all'obiettivo Drive-to-Store / Traffico in negozio. */
export function PercorsoInStore() {
  return <PercorsoContatti objective="IN_STORE" wizardSlug="instore" />;
}

/** Percorso dedicato all'obiettivo Retargeting / Recupero carrelli. */
export function PercorsoRetargeting() {
  return (
    <PercorsoContatti objective="RETARGETING" wizardSlug="retargeting" />
  );
}

/** Percorso dedicato all'obiettivo Awareness / Apertura / Lancio. */
export function PercorsoAwareness() {
  return <PercorsoContatti objective="AWARENESS" wizardSlug="apertura" />;
}
