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
import { leggiBozzaOnboarding } from "@/data/clienti-store";
import { saveCampaign, saveClient, getClientById, getCampaigns } from "@/utils/clientStorage";
import type { Cliente } from "@/types/clienti";
import type { DeconstructAdResult } from "@/types/deconstruct-ad";
import { FormConfigurazione } from "@/components/nuova-contatti/FormConfigurazione";
import { PannelloPerche } from "@/components/nuova-contatti/PannelloPerche";
import { ChecklistMeta } from "@/components/nuova-contatti/ChecklistMeta";
import { MetaFeedMockup } from "@/components/nuova-contatti/MetaFeedMockup";
import { StrategicScoreCard } from "@/components/nuova-contatti/StrategicScoreCard";
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
import { salvaCampagnaCompleta, leggiCampagnaDaSupabase } from "@/lib/campagne-db";
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
import { calculateStrategicScore, richiedeDestinationUrl, richiedeModuloContatti } from "@/lib/strategic-score";
import { estraiServizioPrincipale } from "@/lib/extract-service";
import { etaDaTargetAgeBand } from "@/types/campagne";

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
  elevatorPitch: string = "",
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
  const varianti = generaVariantiCopy({
    settore: settorePerCopy,
    nomeCliente,
    citta: cittaPerCopy,
    elevatorPitch,
    objective,
  });

  const servizio = estraiServizioPrincipale(
    elevatorPitch,
    settorePerCopy || undefined,
  );
  const titoloAnnuncio =
    objective === "ECOMMERCE"
      ? titoloAnnuncioEcommerce(servizio || settorePerCopy, "")
      : objective === "LEADS"
        ? titoloAnnuncioLeads(
            servizio,
            cittaPerCopy,
            settorePerCopy,
            "",
            elevatorPitch,
          )
        : cittaPerCopy
          ? `${servizio.charAt(0).toUpperCase()}${servizio.slice(1)} a ${cittaPerCopy}`
          : servizio.charAt(0).toUpperCase() + servizio.slice(1);

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
    varianteA: varianti[0].testo,
    varianteB: varianti[1].testo,
    varianteC: varianti[2].testo,
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
    isBookings ? 75 : 10,
  );
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
    if (intelApplicatoRef.current === intel.id) return;
    intelApplicatoRef.current = intel.id;
    setScontrinoMedio(intel.aovDefault);
    setProductMargin(intel.margineDefault);
    setConfig((prev) => ({
      ...prev,
      budgetGiornaliero: intel.budgetGiornalieroMin,
      raggioKm:
        isEcommerce || isRetargeting
          ? Math.max(prev.raggioKm, intel.raggioKmConsigliato)
          : intel.raggioKmConsigliato,
    }));
  }

  useEffect(() => {
    if (settoreIntel?.source === "ai") {
      applicaEconomiaSettore(settoreIntel);
    }
  }, [settoreIntel]);
  const [campagnaIdSalvata, setCampagnaIdSalvata] = useState<string | null>(
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
        return;
      }
    } catch {
      // Fallback localStorage.
    }
    const locale = getCampaigns().find((c) => c.id === targetId);
    setStatusApprovazioneGrezzo(locale?.status ?? "DRAFT");
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
    setTassoConversione(isBookings ? 75 : 10);
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
    if (variantiManuali) return;

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
    const hero =
      heroProduct.trim() || elevatorPitch.trim() || "";
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

    setConfig((prev) => {
      if (
        prev.varianteA === rigenerate[0].testo &&
        prev.varianteB === rigenerate[1].testo &&
        prev.varianteC === rigenerate[2].testo &&
        prev.titoloAnnuncio === titoloAnnuncio
      ) {
        return prev;
      }
      return {
        ...prev,
        varianteA: rigenerate[0].testo,
        varianteB: rigenerate[1].testo,
        varianteC: rigenerate[2].testo,
        titoloAnnuncio,
      };
    });
  }, [
    elevatorPitch,
    frontEndOffer,
    heroProduct,
    targetType,
    tonoVoce,
    config.nomeCliente,
    contesto.settore,
    contesto.citta,
    variantiManuali,
    objectiveEffettivo,
    bookingChannel,
    isBookings,
    isPercorsoBookings,
    postiDisponibiliSettimana,
    isEcommerce,
    isAwareness,
    sitoWeb,
  ]);

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
    setTonoVoce(tono);
    setVariantiManuali(false);
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

  async function generaCopyConAi() {
    copyAiAbortRef.current?.abort();
    const controller = new AbortController();
    copyAiAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45_000);

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
        throw new Error(data.error || "Generazione AI non riuscita");
      }

      setVariantiManuali(true);
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
      if (controller.signal.aborted && (err as Error)?.name === "AbortError") {
        // Navigazione via / unmount: non sovrascrivere con fallback se abort volontario
        const abortedByTimeout = !copyAiAbortRef.current
          ? false
          : copyAiAbortRef.current.signal.aborted;
        // Se timeout o errore rete → fallback statico
        if (abortedByTimeout || (err as Error)?.name === "AbortError") {
          // distinzione: se ancora sullo step 3 e timeout, applica fallback
        }
      }
      if (controller.signal.reason === "navigate") {
        return;
      }
      applicaCopyFallbackStatico();
      setCopyAiErrore(
        "AI non disponibile: applicati i testi di fallback Affianco.",
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
    void generaCopyConAi();
    return () => {
      if (copyAiAbortRef.current) {
        copyAiAbortRef.current.abort("navigate");
      }
    };
    // Solo all'ingresso nello step 3: i dati del form sono letti al momento della chiamata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    return calculateStrategicScore({
      budgetGiornaliero: config.budgetGiornaliero,
      benchmark,
      settore,
      citta,
      haCopySelezionato,
      fotoCaricata: creativita.length > 0,
      paginaFacebookId: pageId,
      moduloContattiId: formId,
      destinationUrl:
        isEcommerce || isInStore || isRetargeting || isAwareness
          ? sitoWeb
          : undefined,
      objective: objectiveEffettivo,
      bookingChannel: isBookings ? bookingChannel : undefined,
    });
  }, [
    config.budgetGiornaliero,
    config.varianteA,
    config.varianteB,
    config.varianteC,
    contesto.settore,
    contesto.citta,
    creativita.length,
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
      const showUp =
        Number(tassoConversione) || (isBookings ? 75 : 10);
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
      targetMargin,
      productMargin,
      fulfillmentCost,
      ecommerceLtvAttivo,
      shippingMarket,
      recoveryDiscount,
      targetType,
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

  function vaiIndietro() {
    setErroreSalvataggio(null);
    setErroriPasso1({});
    setWizardStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  async function assicuraCampagnaSalvata(): Promise<string> {
    if (campagnaIdSalvata) return campagnaIdSalvata;

    const ticket = Number(scontrinoMedio) || 0;
    const tasso = Number(tassoConversione) || (isBookings ? 75 : 10);
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
                const base = isBookings
                  ? calculateMaxSustainableBookingCpa(
                      ticket,
                      tasso,
                      targetMargin,
                    )
                  : calculateMaxSustainableCpl(ticket, tasso, targetMargin);
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
                  tassoConversionePercent: tasso,
                  targetMarginPercent: targetMargin,
                });
                return ltv.cplSostenibileLtv > 0
                  ? ltv.cplSostenibileLtv
                  : base;
              })();

    const dailyBudget = isAwareness
      ? Math.max(5, Math.round(budgetLancio / 7))
      : config.budgetGiornaliero;

    const creata = await salvaCampagnaCompleta({
      nomeCliente: config.nomeCliente || "Nuovo cliente",
      elevatorPitch,
      website: sitoWeb,
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
          : tasso,
      targetMargin: isRetargeting || isAwareness ? undefined : targetMargin,
      objective: objectiveEffettivo,
      bookingServiceValue: isBookings ? ticket || undefined : undefined,
      showUpRate: isBookings ? tasso : undefined,
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
      varianteA: config.varianteA,
      varianteB: config.varianteB,
      varianteC: config.varianteC,
      pageId,
      formId,
      settore: contesto.settore,
      citta: contesto.citta,
      raggioKm: isAwareness ? raggioAwareness : config.raggioKm,
      etaMin: config.etaMin,
      etaMax: config.etaMax,
      titoloAnnuncio: config.titoloAnnuncio,
      frontEndOffer: frontEndOffer.trim() || undefined,
      shippingMarket: isEcommerce ? shippingMarket : undefined,
      heroProduct: isEcommerce
        ? heroProduct.trim() || elevatorPitch.trim() || undefined
        : undefined,
      targetType,
      targetAge,
      creativitaMeta: creativitaToMeta(creativita),
    });

    const clientIdSalvato = persistiClienteSeRichiesto();
    saveCampaign({
      id: creata.id,
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
      status: creata.status ?? "DRAFT",
      frontEndOffer: frontEndOffer.trim(),
    });

    setCampagnaIdSalvata(creata.id);
    return creata.id;
  }

  async function copiaLinkApprovazione() {
    if (linkApprovazioneInCorso) return;
    setLinkApprovazioneInCorso(true);
    setErroreLinkApprovazione(null);
    try {
      const id = await assicuraCampagnaSalvata();
      const url = `${window.location.origin}/approvazione/${id}`;
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
  const titoloStepWizard =
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
  const sottotitoloStepWizard =
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
    wizardStep === 2 || wizardStep === 3 || wizardStep === 4 || wizardStep === 6;

  return (
    <div className="min-h-screen bg-slate-50/50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/campagne"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Torna alle campagne
        </Link>

        <div className="mt-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            Assistente guidato · Passo {wizardStep} di 6
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)]">
            {titoloPagina}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
            {sottotitolo}
          </p>
        </div>

        <div className="mb-8 rounded-[var(--radius)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <WizardStepper
            step={wizardStep}
            titoliOverride={
              isPercorsoAwareness
                ? {
                    3: "Messaggio di apertura",
                    4: "Creatività di apertura",
                    5: "Controllo",
                    6: "Campagna pronta",
                  }
                : isPercorsoRetargeting
                ? {
                    3: "Messaggio di recupero",
                    4: "Creatività di recupero",
                    5: "Controllo",
                    6: "Campagna pronta",
                  }
                : isPercorsoInstore
                ? {
                    3: "Messaggio locale",
                    4: "Creatività locale",
                    5: "Controllo",
                    6: "Campagna pronta",
                  }
                : undefined
            }
            onVaiAStep={(s) => {
              if (s <= wizardStep) setWizardStep(s);
            }}
          />
          {stepAttuale ? (
            <>
              <p className="mt-3 text-sm font-medium text-[var(--ink)]">
                {titoloStepWizard}
              </p>
              {sottotitoloStepWizard ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)]">
                  {sottotitoloStepWizard}
                </p>
              ) : null}
            </>
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
              />
              </>
            )}
          </div>

          {mostraSidebar ? (
            <div className="min-w-0 space-y-6 lg:sticky lg:top-8 lg:col-span-4">
              {wizardStep === 2 ? (
                <div className={isPercorsoEcommerce ? "opacity-90" : undefined}>
                <StrategicScoreCard
                  result={strategicScore}
                  budgetMin={
                    getBenchmarkForNiche(
                      contesto.settore ?? "",
                      contesto.citta ?? "",
                    ).recommendedDailyBudgetMin
                  }
                  etichettaAssetFinale={
                    richiedeDestinationUrl(objectiveEffettivo)
                      ? "URL destinazione"
                      : richiedeModuloContatti(
                            objectiveEffettivo,
                            bookingChannel,
                          )
                        ? "ID Modulo Contatti"
                        : "Asset di collegamento"
                  }
                />
                </div>
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
              {wizardStep === 6 &&
              (isPercorsoLeads ||
                isPercorsoBookings ||
                isPercorsoEcommerce ||
                isPercorsoInstore ||
                isPercorsoRetargeting ||
                isPercorsoAwareness) ? (
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white/70 p-3 opacity-90 shadow-sm">
                  <p className="mb-2 px-1 text-xs text-[var(--ink-muted)]">
                    Indicatore sintetico
                  </p>
                  <StrategicScoreCard
                    result={strategicScore}
                    budgetMin={
                      getBenchmarkForNiche(
                        contesto.settore ?? "",
                        contesto.citta ?? "",
                      ).recommendedDailyBudgetMin
                    }
                    etichettaAssetFinale={
                      richiedeModuloContatti(
                        objectiveEffettivo,
                        bookingChannel,
                      )
                        ? "ID Modulo Contatti"
                        : "Asset di collegamento"
                    }
                  />
                </div>
              ) : wizardStep === 6 ? (
                <StrategicScoreCard
                  result={strategicScore}
                  budgetMin={
                    getBenchmarkForNiche(
                      contesto.settore ?? "",
                      contesto.citta ?? "",
                    ).recommendedDailyBudgetMin
                  }
                  etichettaAssetFinale={
                    richiedeDestinationUrl(objectiveEffettivo)
                      ? "URL destinazione"
                      : richiedeModuloContatti(
                            objectiveEffettivo,
                            bookingChannel,
                          )
                        ? "ID Modulo Contatti"
                        : "Asset di collegamento"
                  }
                />
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

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={vaiIndietro}
            disabled={wizardStep === 1}
            className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Indietro
          </button>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            {erroreSalvataggio ? (
              <p className="max-w-md text-right text-sm text-[#C45C5C]">
                {erroreSalvataggio}
              </p>
            ) : null}
            {wizardStep < 6 ? (
              <button
                type="button"
                onClick={vaiAvanti}
                disabled={
                  wizardStep === 5 &&
                  (isPercorsoLeads ||
                    isPercorsoBookings ||
                    isPercorsoEcommerce ||
                    isPercorsoInstore ||
                    isPercorsoRetargeting ||
                    isPercorsoAwareness) &&
                  Boolean(diagnosi.haErroriBloccanti)
                }
                className="rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {etichettaPulsanteAvanti}
              </button>
            ) : (
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
            )}
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
