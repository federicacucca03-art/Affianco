"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Copy, FileUp } from "lucide-react";
import type { Campagna } from "@/types/campagne";
import { formatDataApprovazione } from "@/types/campagne";
import { giorniAttiviDaCampagna } from "@/data/campagne-store";
import {
  completaRevisioneCampagnaSuSupabase,
  leggiCampagnaDaSupabase,
} from "@/lib/campagne-db";
import { assicuraVariantiCampagna } from "@/lib/assicura-varianti";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { PannelloAssetStrategia } from "@/components/campagne/PannelloAssetStrategia";
import { DiarioBordo } from "@/components/campagne/DiarioBordo";
import {
  analyzeCampaignData,
  generaReportWhatsAppCliente,
  parseMetaCsvReport,
  type CampaignAnalysisResult,
  type VerdictStatus,
} from "@/lib/analyzer";
import {
  etichettaSemaforoDiagnosi,
  registraEventoCampagna,
} from "@/lib/campaign-logs";
import {
  calculateEcommerceBreakEvenRoas,
  calculateEcommerceTargetRoas,
  calculateMaxSustainableBookingCpa,
  calculateMaxSustainableCpl,
  calculateMaxSustainableInStoreCpa,
  calculateMaxSustainableRecoveryCpa,
  calculateRoasReale,
} from "@/lib/benchmarks";

type TabDettaglio = "asset" | "diagnosi";

type Aggregati = {
  spesaTotale: number;
  contatti: number;
  fatturato?: number;
  impressions: number;
  clicks: number;
  frequenza: number;
  /** CTR % da inserimento manuale (se > 0 ha priorità sul calcolo da click). */
  ctrPercent?: number;
};

type MetricheManual = {
  spesaTotale: string;
  contatti: string;
  fatturato: string;
  frequenza: string;
  ctr: string;
};

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]";

const BADGE_STILI: Record<
  VerdictStatus,
  { emoji: string; label: string; className: string }
> = {
  learning: {
    emoji: "🟡",
    label: "In ottimizzazione",
    className: "bg-[#FFF6E5] text-[#B8860B]",
  },
  good: {
    emoji: "🟢",
    label: "In target",
    className: "bg-[#E8F5EE] text-[#3D8B57]",
  },
  warning: {
    emoji: "🟡",
    label: "In ottimizzazione",
    className: "bg-[#FFF0E0] text-[#C26A0A]",
  },
  alert: {
    emoji: "🔴",
    label: "Fuori soglia",
    className: "bg-[#FDECEC] text-[#C45C5C]",
  },
};

function BadgeVerdetto({
  verdict,
  fallbackLabel,
  marginStatus,
  marginBadgeLabel,
}: {
  verdict?: VerdictStatus;
  fallbackLabel?: string;
  marginStatus?: CampaignAnalysisResult["marginStatus"];
  marginBadgeLabel?: string;
}) {
  if (marginStatus === "out_of_target") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#FDECEC] px-4 py-2 text-base font-medium text-[#C45C5C]">
        <span aria-hidden>🔴</span>
        {marginBadgeLabel || "Fuori soglia"}
      </span>
    );
  }

  if (marginStatus === "in_target") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F5EE] px-4 py-2 text-base font-medium text-[#3D8B57]">
        <span aria-hidden>🟢</span>
        {marginBadgeLabel || "In target"}
      </span>
    );
  }

  const stile = verdict
    ? BADGE_STILI[verdict]
    : {
        emoji: "🟡",
        label: fallbackLabel || "In ottimizzazione",
        className: "bg-[#FFF6E5] text-[#B8860B]",
      };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium ${stile.className}`}
    >
      <span aria-hidden>{stile.emoji}</span>
      {stile.label}
    </span>
  );
}

function azioneConsigliata(
  analisi: CampaignAnalysisResult,
): string {
  return analisi.actionableAdvice;
}

function titoloCampagnaBreve(campagna: Campagna): string {
  const grezzo =
    campagna.nomeCampagna ||
    "Richieste Contatto";
  // Preferisce un titolo corto tipo "Richieste Contatto"
  if (/richieste\s+contatto/i.test(grezzo)) return "Richieste Contatto";
  return grezzo;
}

export default function DettaglioCampagnaPage() {
  const params = useParams<{ id: string }>();
  const [campagna, setCampagna] = useState<Campagna | null | undefined>(
    undefined,
  );
  const [nomeFile, setNomeFile] = useState<string | null>(null);
  const [trascinando, setTrascinando] = useState(false);
  const [mostraManuale, setMostraManuale] = useState(false);
  const [giorniOverride, setGiorniOverride] = useState<number | null>(null);
  const [manuale, setManuale] = useState<MetricheManual>({
    spesaTotale: "",
    contatti: "",
    fatturato: "",
    frequenza: "",
    ctr: "",
  });
  const [aggregati, setAggregati] = useState<Aggregati | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [tabAttivo, setTabAttivo] = useState<TabDettaglio>("diagnosi");
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [revisioneInChiusura, setRevisioneInChiusura] = useState(false);
  const [erroreRevisione, setErroreRevisione] = useState<string | null>(null);
  /** Errore rete/API distinto da record assente. */
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(
    null,
  );
  const [diarioRefreshKey, setDiarioRefreshKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMetricsKeyRef = useRef<string | null>(null);
  const prevVerdictRef = useRef<string | null>(null);

  useEffect(() => {
    let attivo = true;
    setCampagna(undefined);
    setErroreCaricamento(null);
    setNomeFile(null);
    setAggregati(null);
    setMostraManuale(false);
    setGiorniOverride(null);
    prevMetricsKeyRef.current = null;
    prevVerdictRef.current = null;
    setDiarioRefreshKey(0);

    (async () => {
      try {
        const trovata = await leggiCampagnaDaSupabase(params.id);
        if (!attivo) return;
        setErroreCaricamento(null);
        setCampagna(
          trovata
            ? assicuraVariantiCampagna(trovata, { persistiLocale: true })
            : null,
        );
      } catch (e) {
        if (!attivo) return;
        logErroreSupabaseDev("carica_dettaglio_campagna", e);
        setCampagna(null);
        setErroreCaricamento(messaggioErroreSupabase(e, "carica_dettaglio"));
      }
    })();

    return () => {
      attivo = false;
    };
  }, [params.id]);

  const giorniAttivi = useMemo(() => {
    if (!campagna) return 0;
    if (giorniOverride !== null) return giorniOverride;
    return giorniAttiviDaCampagna(campagna);
  }, [campagna, giorniOverride]);

  const maxCplHeader = useMemo(() => {
    if (!campagna) return 0;
    const objective = campagna.objective ?? "LEADS";
    const margine = campagna.targetMargin ?? 50;
    if (objective === "ECOMMERCE") {
      return campagna.maxSustainableCpa && campagna.maxSustainableCpa > 0
        ? campagna.maxSustainableCpa
        : 0;
    }
    if (objective === "IN_STORE") {
      const receipt =
        campagna.averageReceipt ?? campagna.scontrinoMedio ?? 40;
      const storeMargin = campagna.storeMargin ?? 40;
      return calculateMaxSustainableInStoreCpa(receipt, storeMargin, margine);
    }
    if (objective === "RETARGETING") {
      const valore =
        campagna.recoveryValue ?? campagna.scontrinoMedio ?? 100;
      const recoveryMargin = campagna.recoveryMargin ?? 50;
      const discount = campagna.recoveryDiscount ?? 0;
      return calculateMaxSustainableRecoveryCpa(
        valore,
        recoveryMargin,
        discount,
      );
    }
    if (objective === "AWARENESS") {
      return campagna.estimatedCpm ?? 7;
    }
    if (objective === "BOOKINGS") {
      const ticket =
        campagna.bookingServiceValue ?? campagna.scontrinoMedio ?? 60;
      const tasso =
        campagna.showUpRate ?? campagna.tassoConversionePercent ?? 75;
      return calculateMaxSustainableBookingCpa(ticket, tasso, margine);
    }
    return calculateMaxSustainableCpl(
      campagna.scontrinoMedio ?? 1500,
      campagna.tassoConversionePercent ?? 10,
      margine,
    );
  }, [campagna]);

  const economiaEcommerce = useMemo(() => {
    if (!campagna || campagna.objective !== "ECOMMERCE") return null;
    const aov = campagna.averageOrderValue ?? campagna.scontrinoMedio ?? 0;
    const productMargin = campagna.productMargin ?? 0;
    const cpaMax =
      campagna.maxSustainableCpa && campagna.maxSustainableCpa > 0
        ? campagna.maxSustainableCpa
        : 0;
    const spesa = aggregati?.spesaTotale ?? 0;
    const acquisti = aggregati?.contatti ?? 0;
    const fatturato =
      aggregati?.fatturato && aggregati.fatturato > 0
        ? aggregati.fatturato
        : acquisti > 0 && aov > 0
          ? acquisti * aov
          : 0;
    const roasReale = calculateRoasReale(fatturato, spesa);
    const haCpaMax = cpaMax > 0;
    const haAov = aov > 0;
    const roasBreakEven =
      haCpaMax && haAov
        ? calculateEcommerceBreakEvenRoas(aov, cpaMax)
        : 0;
    const roasTarget =
      haCpaMax && haAov
        ? calculateEcommerceTargetRoas(aov, cpaMax)
        : 0;
    return {
      aov,
      productMargin,
      fatturato,
      roasReale,
      roasBreakEven,
      roasTarget,
      cpaMax,
      acquisti,
      spesa,
      haCpaMax,
      haAov,
      roasDisponibili: haCpaMax && haAov,
    };
  }, [campagna, aggregati]);

  const analisi = useMemo(() => {
    if (!campagna || !aggregati) return null;
    const objective = campagna.objective ?? "LEADS";
    const base = {
      nomeCliente: campagna.nomeCliente,
      citta: campagna.citta || "",
      spesaTotale: aggregati.spesaTotale,
      contatti: aggregati.contatti,
      impressions: aggregati.impressions,
      clicks: aggregati.clicks,
      giorniAttivi,
      frequenza: aggregati.frequenza,
      ctrPercent: aggregati.ctrPercent,
      maxCplSustainable: maxCplHeader > 0 ? maxCplHeader : undefined,
      nomeCampagna: campagna.nomeCampagna,
    };

    if (objective === "ECOMMERCE") {
      const aov =
        campagna.averageOrderValue ?? campagna.scontrinoMedio ?? 70;
      const productMargin = campagna.productMargin ?? 50;
      return analyzeCampaignData({
        ...base,
        settore: campagna.settore || "E-commerce",
        scontrinoMedio: aov,
        tassoConversione: productMargin,
        targetMargin: campagna.targetMargin ?? 50,
      });
    }
    if (objective === "IN_STORE") {
      const receipt =
        campagna.averageReceipt ?? campagna.scontrinoMedio ?? 40;
      const storeMargin = campagna.storeMargin ?? 40;
      return analyzeCampaignData({
        ...base,
        settore: campagna.settore || "Retail / Negozio",
        scontrinoMedio: receipt,
        tassoConversione: storeMargin,
        targetMargin: campagna.targetMargin ?? 50,
      });
    }
    if (objective === "RETARGETING") {
      const valore =
        campagna.recoveryValue ?? campagna.scontrinoMedio ?? 100;
      const recoveryMargin = campagna.recoveryMargin ?? 50;
      const sconto = campagna.recoveryDiscount ?? 0;
      const valoreNetto =
        valore * (1 - Math.min(100, Math.max(0, sconto)) / 100);
      return analyzeCampaignData({
        ...base,
        settore: campagna.settore || "Retargeting",
        scontrinoMedio: valoreNetto,
        tassoConversione: recoveryMargin * 0.6,
        targetMargin: 0,
      });
    }
    const isBook = objective === "BOOKINGS";
    const ticket =
      (isBook
        ? campagna.bookingServiceValue ?? campagna.scontrinoMedio
        : campagna.scontrinoMedio) ?? (isBook ? 60 : 1500);
    const tasso =
      (isBook
        ? campagna.showUpRate ?? campagna.tassoConversionePercent
        : campagna.tassoConversionePercent) ?? (isBook ? 75 : 10);

    return analyzeCampaignData({
      ...base,
      settore: campagna.settore || "Dentista",
      scontrinoMedio: ticket,
      tassoConversione: tasso,
      targetMargin: campagna.targetMargin ?? 50,
    });
  }, [campagna, aggregati, giorniAttivi, maxCplHeader]);

  useEffect(() => {
    if (!campagna || !aggregati) return;
    const metricsKey = JSON.stringify({
      spesa: aggregati.spesaTotale,
      contatti: aggregati.contatti,
      freq: aggregati.frequenza,
      ctr: aggregati.ctrPercent ?? 0,
      fat: aggregati.fatturato ?? 0,
    });
    if (prevMetricsKeyRef.current === metricsKey) return;
    prevMetricsKeyRef.current = metricsKey;

    void (async () => {
      await registraEventoCampagna({
        campaignId: campagna.id,
        eventType: "METRICS_UPDATED",
        title: "Dati reali aggiornati",
        description: `Spesa ${aggregati.spesaTotale}€ · risultati ${aggregati.contatti}${
          aggregati.frequenza > 0 ? ` · frequenza ${aggregati.frequenza}` : ""
        }${
          aggregati.ctrPercent && aggregati.ctrPercent > 0
            ? ` · CTR ${aggregati.ctrPercent}%`
            : ""
        }`,
      });
      setDiarioRefreshKey((k) => k + 1);
    })();
  }, [campagna, aggregati]);

  useEffect(() => {
    if (!campagna || !analisi) return;
    const chiave = `${analisi.verdict}|${analisi.badgeLabel}|${analisi.marginStatus}`;
    if (prevVerdictRef.current === null) {
      prevVerdictRef.current = chiave;
      return;
    }
    if (prevVerdictRef.current === chiave) return;
    prevVerdictRef.current = chiave;

    const semaforo = etichettaSemaforoDiagnosi(
      analisi.verdict,
      analisi.badgeLabel,
    );
    void (async () => {
      await registraEventoCampagna({
        campaignId: campagna.id,
        eventType: "DIAGNOSIS_CHANGED",
        title: `Stato diagnostico: ${semaforo}`,
        description: `Stato diagnostico cambiato in ${semaforo}. ${analisi.diagnosisText}`,
      });
      setDiarioRefreshKey((k) => k + 1);
    })();
  }, [campagna, analisi]);

  function gestisciFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const testo = String(reader.result ?? "");
      const parsed = parseMetaCsvReport(testo);
      setNomeFile(file.name);
      setMostraManuale(false);
      setGiorniOverride(null);
      setAggregati({
        spesaTotale: parsed.spesaTotale,
        contatti: parsed.contatti,
        impressions: parsed.impressions,
        clicks: parsed.clicks,
        frequenza: parsed.frequenza,
      });
    };
    reader.readAsText(file);
  }

  function applicaManuale() {
    setGiorniOverride(null);
    const spesa = Number(manuale.spesaTotale) || 0;
    const contatti = Number(manuale.contatti) || 0;
    const fatturato = Number(manuale.fatturato) || 0;
    const frequenza = Number(manuale.frequenza) || 0;
    const ctr = Number(manuale.ctr) || 0;
    setNomeFile(null);
    setAggregati({
      spesaTotale: spesa,
      contatti,
      fatturato: fatturato > 0 ? fatturato : undefined,
      impressions: 0,
      clicks: 0,
      frequenza,
      ctrPercent: ctr > 0 ? ctr : undefined,
    });
  }

  const reportWhatsApp = useMemo(() => {
    if (!campagna || !analisi) return null;
    return generaReportWhatsAppCliente({
      nomeCliente: campagna.nomeCliente,
      nomeAzienda: campagna.nomeCliente,
      nomeCampagna: titoloCampagnaBreve(campagna),
      spesaTotale: analisi.metrics.spesaTotale,
      contatti: analisi.metrics.contatti,
      cplReale: analisi.metrics.cplReale,
      cplSostenibile: analisi.maxCplSustainable,
      giorniAttivi,
      marginStatus: analisi.marginStatus,
      verdict: analisi.verdict,
      azioneClienteSintetica: analisi.azioneClienteSintetica,
      objective: campagna.objective ?? "LEADS",
      fatturato: economiaEcommerce?.fatturato,
      roasReale: economiaEcommerce?.roasReale,
      roasBreakEven: economiaEcommerce?.roasBreakEven,
      roasTarget: economiaEcommerce?.roasTarget,
    });
  }, [campagna, analisi, giorniAttivi, economiaEcommerce]);

  async function copiaReportWhatsApp() {
    if (!reportWhatsApp) return;
    try {
      await navigator.clipboard.writeText(reportWhatsApp);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 1800);
    } catch {
      // Ignora se clipboard non disponibile.
    }
  }

  async function copiaLinkApprovazione() {
    const url = `${window.location.origin}/approvazione/${params.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiato(true);
      window.setTimeout(() => setLinkCopiato(false), 2200);
    } catch {
      // Ignora se clipboard non disponibile.
    }
  }

  async function segnaModificheCompletate() {
    if (!campagna || revisioneInChiusura) return;
    setRevisioneInChiusura(true);
    setErroreRevisione(null);
    try {
      await completaRevisioneCampagnaSuSupabase(campagna.id);
      setCampagna({
        ...campagna,
        status: "DRAFT",
        revisionNotes: undefined,
        stato: "In attesa di approvazione cliente",
      });
    } catch (e) {
      logErroreSupabaseDev("completa_revisione", e);
      setErroreRevisione(messaggioErroreSupabase(e, "azione_approvazione"));
    } finally {
      setRevisioneInChiusura(false);
    }
  }

  if (campagna === undefined) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </main>
    );
  }

  if (erroreCaricamento) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/campagne"
          className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          Torna alle campagne
        </Link>
        <h1 className="mt-4 text-xl font-medium text-[var(--ink)]">
          Campagna non disponibile
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{erroreCaricamento}</p>
      </main>
    );
  }

  if (campagna === null) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/campagne"
          className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          Torna alle campagne
        </Link>
        <h1 className="mt-4 text-xl font-medium text-[var(--ink)]">
          Campagna non trovata
        </h1>
      </main>
    );
  }

  const settore = campagna.settore || "Attività locale";
  const citta = campagna.citta || "—";
  const budgetGiornaliero = campagna.budgetGiornaliero ?? 20;
  const consiglio = analisi ? azioneConsigliata(analisi) : null;
  const faseApprendimento = giorniAttivi < 4;
  const giornoApprendimento = Math.min(Math.max(giorniAttivi + 1, 1), 4);
  const evidenziaLearning =
    analisi?.verdict === "learning" || (analisi && faseApprendimento);
  const evidenziaAlert =
    analisi?.verdict === "alert" || analisi?.marginStatus === "out_of_target";
  const fuoriMargine = analisi?.marginStatus === "out_of_target";
  const cplSottoSoglia =
    !!analisi &&
    analisi.metrics.contatti > 0 &&
    analisi.maxCplSustainable > 0 &&
    analisi.metrics.cplReale <= analisi.maxCplSustainable;
  const cplSopraSoglia =
    !!analisi &&
    analisi.metrics.contatti > 0 &&
    analisi.maxCplSustainable > 0 &&
    analisi.metrics.cplReale > analisi.maxCplSustainable;
  const isEcommerce = campagna.objective === "ECOMMERCE";
  const isInStore = campagna.objective === "IN_STORE";
  const isBookings = campagna.objective === "BOOKINGS";
  const isRetargeting = campagna.objective === "RETARGETING";
  const isAwareness = campagna.objective === "AWARENESS";
  const badgeRoasProfitto =
    !!economiaEcommerce &&
    economiaEcommerce.roasReale > 0 &&
    economiaEcommerce.roasTarget > 0 &&
    economiaEcommerce.roasReale >= economiaEcommerce.roasTarget;
  const badgeRoasPerdita =
    !!economiaEcommerce &&
    economiaEcommerce.roasReale > 0 &&
    economiaEcommerce.roasBreakEven > 0 &&
    economiaEcommerce.roasReale < economiaEcommerce.roasBreakEven;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/campagne"
        className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
      >
        Torna alle campagne
      </Link>

      {/* 1. Header di Stato */}
      <header className="mt-5 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        {(campagna.status ?? "").toUpperCase() === "APPROVED" ? (
          <div className="mb-4 rounded-xl border border-[#E8D48A] bg-[#FFF8E7] px-4 py-3">
            <p className="text-sm font-medium text-[#9A7B0A]">
              ✅ Approvata dal cliente
              {campagna.approvedAt
                ? ` il ${formatDataApprovazione(campagna.approvedAt)}`
                : ""}
            </p>
          </div>
        ) : null}

        {(campagna.status ?? "").toUpperCase() === "REVISION_REQUESTED" ? (
          <div className="mb-4 rounded-xl border border-[#f5c9b8] bg-[#fff4f0] p-4 sm:p-5">
            <p className="text-sm font-bold text-[#C45C5C]">
              ⚠️ Il cliente ha richiesto una modifica
            </p>
            {campagna.revisionNotes?.trim() ? (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
                <p className="text-sm italic leading-relaxed text-[var(--ink)]">
                  Nota: &ldquo;{campagna.revisionNotes.trim()}&rdquo;
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3">
                <p className="text-sm text-[var(--ink-muted)]">
                  La richiesta è arrivata, ma la nota testuale non è disponibile.
                  Chiedi al cliente di reinviare il dettaglio.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void segnaModificheCompletate()}
              disabled={revisioneInChiusura}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#3D8B57] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {revisioneInChiusura
                ? "Aggiornamento…"
                : "✅ Segna modifiche come completate"}
            </button>
            {erroreRevisione ? (
              <p className="mt-2 text-xs text-[#C45C5C]">{erroreRevisione}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Diagnosi post-lancio
            </p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)]">
              {campagna.nomeCliente}
              <span className="font-normal text-[var(--ink-muted)]">
                {" "}
                — {titoloCampagnaBreve(campagna)}
              </span>
            </h1>
          </div>
          <BadgeVerdetto
            verdict={analisi?.verdict}
            fallbackLabel={campagna.giudizio}
            marginStatus={analisi?.marginStatus}
            marginBadgeLabel={analisi?.marginBadgeLabel}
          />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Settore</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {settore}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Città</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {citta}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">Budget giornaliero</dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {budgetGiornaliero}€/giorno
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
            <dt className="text-xs text-[var(--ink-muted)]">
              {campagna.objective === "ECOMMERCE"
                ? "CPA Max (Break-Even)"
                : campagna.objective === "AWARENESS"
                  ? "CPM stimato locale"
                  : campagna.objective === "RETARGETING"
                    ? "CPA recupero sostenibile"
                    : campagna.objective === "IN_STORE"
                      ? "CPA Max sostenibile"
                      : campagna.objective === "BOOKINGS"
                        ? "CPA massimo sostenibile"
                        : "CPL massimo sostenibile"}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {campagna.objective === "ECOMMERCE" && maxCplHeader <= 0
                ? "Dati economici incompleti"
                : maxCplHeader > 0
                  ? `${maxCplHeader}€`
                  : "—"}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => void copiaLinkApprovazione()}
          className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            linkCopiato
              ? "bg-[#E8F5EE] text-[#3D8B57]"
              : "bg-[var(--accent)] text-white hover:opacity-90"
          }`}
        >
          {linkCopiato
            ? "Link copiato!"
            : "🔗 Copia Link Cliente per Approvazione"}
        </button>
      </div>

      <nav
        className="mt-4 flex gap-1 border-b border-[var(--border)]"
        aria-label="Sezioni campagna"
      >
        {(
          [
            { id: "asset" as const, label: "📋 Asset & Strategia" },
            { id: "diagnosi" as const, label: "📊 Diagnosi & Performance" },
          ] as const
        ).map((tab) => {
          const attivo = tabAttivo === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabAttivo(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                attivo
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {tabAttivo === "asset" ? (
        <div className="mt-6">
          <PannelloAssetStrategia
            campagna={campagna}
            onEsportata={() => setDiarioRefreshKey((k) => k + 1)}
          />
        </div>
      ) : (
        <>
      {faseApprendimento ? (
        <section
          className="mt-6 overflow-hidden rounded-[var(--radius)] border border-[#7BA3D4]/40 bg-gradient-to-br from-[#FFF8E7] via-[#FFF6E5] to-[#E8F1FB] p-5 shadow-[var(--shadow-soft)] sm:p-6"
          aria-live="polite"
        >
          <p className="text-base font-medium tracking-tight text-[#8A6A0A] sm:text-lg">
            ✋ MANI IN TASCA — Fase di Apprendimento Attiva (Giorno{" "}
            {giornoApprendimento} di 4)
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#3A5A7A]">
            L&apos;algoritmo di Meta sta calibrando il pubblico. Non modificare
            budget, target o annunci prima di 4 giorni per non azzerare
            l&apos;ottimizzazione dell&apos;asta.
          </p>
        </section>
      ) : null}

      {/* 2. Area Import Dati */}
      <section className="mt-6 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Dati settimana · CSV Meta o inserimento manuale
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Carica il report sintetico di Ads Manager oppure inserisci Spesa,
          Contatti, Frequenza e CTR. Il Motore Diagnostico Prescrittivo si
          aggiorna subito.
        </p>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setTrascinando(true);
          }}
          onDragLeave={() => setTrascinando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setTrascinando(false);
            gestisciFile(e.dataTransfer.files[0]);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius)] border-2 border-dashed px-6 py-10 text-center transition-colors ${
            trascinando
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--accent-muted)]"
          }`}
        >
          <FileUp
            className="h-8 w-8 text-[var(--accent)]"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-3 max-w-md text-sm font-medium text-[var(--ink)]">
            {nomeFile
              ? nomeFile
              : "📥 Trascina qui il file CSV esportato da Meta Ads Manager"}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {nomeFile
              ? "File caricato. Puoi sostituirlo con un altro CSV."
              : "Oppure clicca per selezionare un file .csv"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              gestisciFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setMostraManuale((v) => !v)}
          className="mt-4 text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
        >
          {mostraManuale
            ? "Nascondi inserimento manuale"
            : "Inserimento manuale dati settimana"}
        </button>

        {mostraManuale ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Spesa totale settimana (€)
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={manuale.spesaTotale}
                onChange={(e) =>
                  setManuale((m) => ({ ...m, spesaTotale: e.target.value }))
                }
                className={inputClass}
                placeholder="es. 180"
              />
            </label>
            {isEcommerce ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                    Fatturato generato (€)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={manuale.fatturato}
                    onChange={(e) =>
                      setManuale((m) => ({ ...m, fatturato: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="es. 900"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                    Numero acquisti / conversioni
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={manuale.contatti}
                    onChange={(e) =>
                      setManuale((m) => ({ ...m, contatti: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="es. 12"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  {campagna.objective === "BOOKINGS"
                    ? "Prenotazioni / conversioni ricevute"
                    : campagna.objective === "RETARGETING"
                      ? "Conversioni di recupero"
                      : campagna.objective === "IN_STORE"
                        ? "Clienti in negozio / conversioni"
                        : "Contatti / conversioni ricevuti"}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={manuale.contatti}
                  onChange={(e) =>
                    setManuale((m) => ({ ...m, contatti: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="es. 6"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Frequenza media Meta
              </span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={manuale.frequenza}
                onChange={(e) =>
                  setManuale((m) => ({ ...m, frequenza: e.target.value }))
                }
                className={inputClass}
                placeholder="es. 2.1"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                CTR (%)
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={manuale.ctr}
                onChange={(e) =>
                  setManuale((m) => ({ ...m, ctr: e.target.value }))
                }
                className={inputClass}
                placeholder="es. 1.2"
              />
            </label>
            <div className="flex items-end sm:col-span-2">
              <button
                type="button"
                onClick={applicaManuale}
                className="w-full rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                Salva e aggiorna diagnosi
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {analisi && consiglio ? (
        <>
          {/* 3. Diagnosi Operativa Prescrittiva */}
          <section className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Motore Diagnostico Prescrittivo · Cosa fare oggi
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--ink)]">
              {analisi.headline}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
              <span className="font-medium">Diagnosi: </span>
              {analisi.diagnosisText}
            </p>

            {isEcommerce && economiaEcommerce ? (
              <div
                className={`mt-5 rounded-xl border p-4 ${
                  !economiaEcommerce.haCpaMax
                    ? "border-[var(--border)] bg-[var(--surface-hover)]"
                    : badgeRoasProfitto
                      ? "border-[#c6e7c8] bg-[#f0faf1]"
                      : badgeRoasPerdita
                        ? "border-[#f5c9b8] bg-[#fff4f0]"
                        : "border-[#f5e0a8] bg-[#fff9e8]"
                }`}
              >
                {!economiaEcommerce.haCpaMax ? (
                  <>
                    <p className="text-sm font-medium text-[var(--ink)]">
                      Dati economici incompleti
                    </p>
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      CPA Max non disponibile per questa campagna. La soglia
                      economica salvata al lancio non è presente.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {economiaEcommerce.roasReale > 0 &&
                      economiaEcommerce.roasDisponibili
                        ? badgeRoasProfitto
                          ? `🟢 Campagna in profitto diretto (ROAS ${economiaEcommerce.roasReale}x)`
                          : badgeRoasPerdita
                            ? `🔴 Campagna in perdita (ROAS sotto il punto di pareggio)`
                            : `ROAS reale ${economiaEcommerce.roasReale}x · Break-Even ROAS ${economiaEcommerce.roasBreakEven}x · Target ROAS ${economiaEcommerce.roasTarget}x`
                        : economiaEcommerce.roasDisponibili
                          ? `Break-Even ROAS ${economiaEcommerce.roasBreakEven}x · Target ROAS ${economiaEcommerce.roasTarget}x`
                          : "CPA Max disponibile — ROAS: dati economici incompleti (manca AOV)"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      CPA Max (Break-Even) {economiaEcommerce.cpaMax}€
                      {economiaEcommerce.spesa > 0
                        ? ` · Fatturato ${economiaEcommerce.fatturato}€ su spesa ${economiaEcommerce.spesa}€`
                        : ""}
                      {!economiaEcommerce.roasDisponibili
                        ? " · Break-Even / Target ROAS non calcolabili senza AOV"
                        : ""}
                    </p>
                  </>
                )}
              </div>
            ) : null}

            {fuoriMargine && analisi.marginWarningText ? (
              <div className="mt-5 rounded-xl border border-[#f5c9b8] bg-[#fff4f0] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#C45C5C]">
                  Allarme margine
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--ink)]">
                  {analisi.marginWarningText}
                </p>
              </div>
            ) : analisi.marginStatus === "in_target" ? (
              <div className="mt-5 rounded-xl border border-[#c6e7c8] bg-[#f0faf1] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[#3D8B57]">
                  Margine sotto controllo
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                  CPL reale {analisi.metrics.cplReale}€ entro la soglia
                  sostenibile di {analisi.maxCplSustainable}€: sei in target di
                  profitto.
                </p>
              </div>
            ) : null}

            <div
              className={`mt-5 rounded-xl p-4 ${
                faseApprendimento
                  ? "border border-[#7BA3D4]/50 bg-[#E8F1FB]"
                  : evidenziaAlert || cplSopraSoglia
                    ? "border border-[#f5c9b8] bg-[#fff4f0]"
                    : evidenziaLearning
                      ? "border border-[#f5e0a8] bg-[#fff9e8]"
                      : cplSottoSoglia
                        ? "border border-[#c6e7c8] bg-[#f0faf1]"
                        : "border border-[#c6e7c8] bg-[#f0faf1]"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                Azione prescrittiva
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--ink)]">
                {consiglio}
              </p>
              {(analisi.metrics.ctr > 0 || analisi.metrics.frequenza > 0) &&
              evidenziaAlert ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                  Segnali: CTR{" "}
                  {analisi.metrics.ctr > 0
                    ? `${analisi.metrics.ctr}%`
                    : "n/d"}
                  {analisi.metrics.frequenza > 0
                    ? ` · Frequenza ${analisi.metrics.frequenza}`
                    : ""}
                  {analisi.scostamentoSogliaPercent != null
                    ? ` · Scostamento +${analisi.scostamentoSogliaPercent}% vs soglia`
                    : ""}
                </p>
              ) : null}
            </div>
          </section>

          {/* 4. Confronto metriche */}
          <section className="mt-6 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <h2 className="text-sm font-medium text-[var(--ink)]">
              Metriche vs soglia sostenibile
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  Spesa e giorni attivi
                </p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                  {analisi.metrics.spesaTotale}€
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {giorniAttivi}{" "}
                  {giorniAttivi === 1 ? "giorno attivo" : "giorni attivi"}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  {isBookings
                    ? "Prenotazioni e CPA reale"
                    : isRetargeting
                      ? "Recuperi e CPA reale"
                      : isInStore
                        ? "Clienti in negozio e CPA reale"
                        : isEcommerce
                          ? "Acquisti e CPA reale"
                          : "Contatti e CPL reale"}
                </p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                  {analisi.metrics.contatti}{" "}
                  {isBookings
                    ? "prenotazioni"
                    : isRetargeting
                      ? "recuperi"
                      : isInStore
                        ? "clienti"
                        : isEcommerce
                          ? "acquisti"
                          : "contatti"}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {isBookings || isInStore || isEcommerce || isRetargeting
                    ? "CPA"
                    : "CPL"}{" "}
                  reale:{" "}
                  {analisi.metrics.cplReale > 0
                    ? `${analisi.metrics.cplReale}€`
                    : "—"}{" "}
                  · soglia{" "}
                  {analisi.maxCplSustainable > 0
                    ? `${analisi.maxCplSustainable}€`
                    : "n/d"}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  Frequenza
                </p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                  {analisi.metrics.frequenza > 0
                    ? analisi.metrics.frequenza
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Soglie: &lt;2,5 ok · 2,5–3,5 attenzione · &gt;3,5 fatigue
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  CTR
                </p>
                <p className="mt-2 text-lg font-medium text-[var(--ink)]">
                  {analisi.metrics.ctr > 0
                    ? `${analisi.metrics.ctr}%`
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Soglia critica prescrittiva: &lt;1% (aggancio creativo)
                </p>
              </div>
            </div>
          </section>

          {/* 5. Report WhatsApp */}
          {reportWhatsApp ? (
            <section className="mt-6 mb-8 rounded-[var(--radius)] border border-[#c6e7c8] bg-[#f3faf5] p-5 sm:p-6">
              <h2 className="text-base font-medium text-[var(--ink)]">
                📲 Report WhatsApp per il cliente
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Testo trasparente e autorevole, pronto da inviare.
              </p>
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-white p-4 font-sans text-sm leading-relaxed text-[var(--ink)]">
                {reportWhatsApp}
              </pre>
              <button
                type="button"
                onClick={() => void copiaReportWhatsApp()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#3D8B57] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                {copiato ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2} />
                    Report copiato!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" strokeWidth={1.75} />
                    Copia Report WhatsApp
                  </>
                )}
              </button>
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-6 mb-8 rounded-[var(--radius)] bg-[var(--surface-hover)] p-5">
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            Carica il CSV Meta o inserisci i dati della settimana (spesa,
            contatti, frequenza, CTR): il Motore Diagnostico Prescrittivo e il
            report WhatsApp si aggiornano subito.
          </p>
        </section>
      )}
        </>
      )}

      <DiarioBordo
        campaignId={campagna.id}
        nomeCliente={campagna.nomeCliente}
        nomeCampagna={titoloCampagnaBreve(campagna)}
        refreshKey={diarioRefreshKey}
      />
    </main>
  );
}
