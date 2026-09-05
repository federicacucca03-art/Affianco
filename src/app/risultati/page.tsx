"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  Sparkles,
  FileUp,
} from "lucide-react";
import { BENCHMARK_NAZIONALI } from "@/data/benchmarks-nazionali";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import {
  azioniConsigliate,
  avvisoDatiLimitati,
  buildEconomicContext,
  calcolaCostoDaSpesaRisultati,
  calcolaHealthStatus,
  descrizioneLogControllo,
  diagnosticaDeterministica,
  formatEuro,
  normalizzaCtrDaApi,
  parseCtrInput,
  parseNum,
  formatFrequenzaInput,
  priorityBadgeClasses,
  priorityLabel,
  resolveThresholdFromCampaign,
  thresholdModeDaHealth,
  type ControlRoomKpis,
} from "@/lib/control-room";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  leggiCampagnaDaSupabase,
  leggiCampagneDaSupabase,
} from "@/lib/campagne-db";
import {
  inserisciCampaignCheck,
  leggiChecksCampagna,
  leggiUltimiChecksUtente,
  stessaGiornataLocale,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import { logControlloPerformanceSalvato } from "@/lib/campaign-logs";
import {
  avvisiConteggiFunnel,
  conteggiFormDaScreenshot,
  deriveFunnelMetrics,
  etichettaTassoClickRisultato,
  formatFunnelPercent,
  parseOptionalNonNegativeInteger,
} from "@/lib/funnel-metrics";
import {
  ControlRoomOverview,
  ordinaRigheControlRoom,
} from "@/components/risultati/ControlRoomOverview";
import { StoricoControlli } from "@/components/risultati/StoricoControlli";
import { BloccoDiagnosiTrend } from "@/components/risultati/BloccoDiagnosiTrend";
import {
  snapshotCheckLive,
  etichettaContestoStorico,
  trendPerLiveCheck,
} from "@/lib/campaign-trend";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { messaggioAiUserFacing } from "@/lib/anthropic-messaggi";
import type { Campagna, CampagnaObjective } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";
import type { ScreenshotAnalysisResult } from "@/types/screenshot-analysis";
import {
  etichettaRigaMetaCsv,
  kpiFormDaRigaMeta,
  parseAdsManagerCsv,
  validaFileCsvMeta,
  type MetaCsvMappedRow,
} from "@/lib/meta-csv";
import { MetaCampagneSection } from "@/components/risultati/MetaCampagneSection";
import { supabase as supabaseClient } from "@/lib/supabase";

const inputClass = "aff-input";

type InputMode = "kpi" | "import";
type ImportTab = "screenshot" | "csv";
type ImportOrigin = "screenshot" | "csv" | null;

function emptyKpiStrings() {
  return {
    spend: "",
    results: "",
    costPerResult: "",
    ctr: "",
    cpm: "",
    cpc: "",
    frequency: "",
    roas: "",
    clicks: "",
    impressions: "",
  };
}

function etichettaCampagnaDropdown(c: Campagna): string {
  const nome = (c.nomeCampagna || c.nomeCliente).trim();
  const cliente = c.nomeCliente.trim();
  if (nome && cliente && nome !== cliente) {
    return `${nome} — ${cliente}`;
  }
  return nome || cliente || "Campagna";
}

function testoKpiDerivato(
  key: keyof ReturnType<typeof emptyKpiStrings>,
  funnel: ReturnType<typeof deriveFunnelMetrics>,
): string | null {
  if (key === "ctr" && funnel.sources.ctr === "derived") {
    return formatFunnelPercent(funnel.ctr);
  }
  if (key === "cpc" && funnel.sources.cpc === "derived") {
    return formatEuro(funnel.cpc);
  }
  if (key === "cpm" && funnel.sources.cpm === "derived") {
    return formatEuro(funnel.cpm);
  }
  return null;
}

function CampoKpiForm({
  label,
  derived,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  derived: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  if (derived) {
    return (
      <div className="block min-w-0">
        <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
          {label}
        </span>
        <p className={`${inputClass} bg-[var(--surface)]`}>{derived}</p>
        <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
          Calcolato automaticamente
        </p>
      </div>
    );
  }
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
        {label}
      </span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
    </label>
  );
}

function campiBloccoRisultato(
  objective: CampagnaObjective,
  metricLabel: string,
): ReadonlyArray<readonly [keyof ReturnType<typeof emptyKpiStrings>, string]> {
  const base: ReadonlyArray<
    readonly [keyof ReturnType<typeof emptyKpiStrings>, string]
  > = [
    ["spend", "Spesa (€)"],
    ["results", "Risultati"],
  ];
  if (objective === "AWARENESS") {
    return [...base, ["cpm", "CPM (€)"]];
  }
  return [...base, ["costPerResult", `${metricLabel} (€)`]];
}

function campiBloccoDiagnostica(
  objective: CampagnaObjective,
): ReadonlyArray<readonly [keyof ReturnType<typeof emptyKpiStrings>, string]> {
  if (objective === "AWARENESS") {
    return [
      ["ctr", "CTR (%)"],
      ["cpc", "CPC (€)"],
      ["frequency", "Frequenza"],
    ];
  }
  return [
    ["ctr", "CTR (%)"],
    ["cpc", "CPC (€)"],
    ["cpm", "CPM (€)"],
    ["frequency", "Frequenza"],
    ...(objective === "ECOMMERCE"
      ? ([["roas", "ROAS (x)"]] as const)
      : []),
  ];
}

// ------------------------------------------------------------------
// MetaClientsLoader: loads clients with Meta data and renders sections
// ------------------------------------------------------------------
function MetaClientsLoader() {
  const { user } = useAuth();
  const [metaClients, setMetaClients] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        // Load clients that have at least one meta_campaign for this user
        const { data } = await supabaseClient
          .from("meta_campaigns")
          .select("client_id")
          .eq("user_id", user.id)
          .limit(50);
        if (!data || data.length === 0) return;
        const ids = [
          ...new Set(
            (data as { client_id: string }[]).map((r) => r.client_id),
          ),
        ];
        const { data: clients } = await supabaseClient
          .from("clients")
          .select("id, name")
          .in("id", ids);
        setMetaClients(
          (clients ?? []) as { id: string; name: string }[],
        );
      } catch {
        // non-blocking
      }
    })();
  }, [user]);

  if (metaClients.length === 0) return null;

  return (
    <>
      {metaClients.map((c) => (
        <MetaCampagneSection key={c.id} clientId={c.id} clientName={c.name} />
      ))}
    </>
  );
}

function RisultatiPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const campaignIdQuery = searchParams.get("campaignId") ?? "";

  const [campagne, setCampagne] = useState<Campagna[]>([]);
  const [caricamentoCampagne, setCaricamentoCampagne] = useState(true);
  const [erroreCampagne, setErroreCampagne] = useState<string | null>(null);
  const [ultimiChecks, setUltimiChecks] = useState<Map<string, CampaignCheck>>(
    () => new Map(),
  );

  const [campagnaId, setCampagnaId] = useState(campaignIdQuery);
  const [manuale, setManuale] = useState(false);
  const [campagnaDettaglio, setCampagnaDettaglio] = useState<Campagna | null>(
    null,
  );
  const [caricamentoDettaglio, setCaricamentoDettaglio] = useState(false);

  // Manual fallback fields
  const [nomeCliente, setNomeCliente] = useState("");
  const [nomeCampagna, setNomeCampagna] = useState("");
  const [settore, setSettore] = useState("");
  const [obiettivo, setObiettivo] = useState<CampagnaObjective>("LEADS");
  const [sogliaManuale, setSogliaManuale] = useState("");
  const [giorniAttiva, setGiorniAttiva] = useState("5");

  const [inputMode, setInputMode] = useState<InputMode>("kpi");
  const [importTab, setImportTab] = useState<ImportTab>("screenshot");
  const [importOrigin, setImportOrigin] = useState<ImportOrigin>(null);
  const [kpiForm, setKpiForm] = useState(emptyKpiStrings);

  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [trascinando, setTrascinando] = useState(false);
  const [analisiAi, setAnalisiAi] = useState<ScreenshotAnalysisResult | null>(
    null,
  );
  const [caricamentoAi, setCaricamentoAi] = useState(false);
  const [erroreAi, setErroreAi] = useState<string | null>(null);
  const [notaBuyer, setNotaBuyer] = useState("");
  const [storicoChecks, setStoricoChecks] = useState<CampaignCheck[]>([]);
  const [salvataggio, setSalvataggio] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(
    null,
  );
  const [okSalvataggio, setOkSalvataggio] = useState<string | null>(null);
  const [funnelAperto, setFunnelAperto] = useState(false);
  const [erroreCsv, setErroreCsv] = useState<string | null>(null);
  const [feedbackCsv, setFeedbackCsv] = useState<string | null>(null);
  const [righeCsv, setRigheCsv] = useState<MetaCsvMappedRow[]>([]);
  const [trascinandoCsv, setTrascinandoCsv] = useState(false);

  const caricaLista = useCallback(async () => {
    setCaricamentoCampagne(true);
    setErroreCampagne(null);
    try {
      const lista = await leggiCampagneDaSupabase();
      setCampagne(lista);
      try {
        const mappa = await leggiUltimiChecksUtente();
        setUltimiChecks(mappa);
      } catch (eCheck) {
        logErroreSupabaseDev("risultati_ultimi_checks", eCheck);
        setUltimiChecks(new Map());
      }
    } catch (e) {
      logErroreSupabaseDev("risultati_liste_campagne", e);
      /* No localStorage inventory fallback — canonical source is Supabase only. */
      setCampagne([]);
      setUltimiChecks(new Map());
      setErroreCampagne(messaggioErroreSupabase(e, "lista"));
    } finally {
      setCaricamentoCampagne(false);
    }
  }, []);

  useEffect(() => {
    if (campaignIdQuery && campaignIdQuery !== campagnaId) {
      setManuale(false);
      setCampagnaId(campaignIdQuery);
    }
  }, [campaignIdQuery, campagnaId]);

  useEffect(() => {
    const uid = user?.id ?? null;
    if (userIdRef.current != null && userIdRef.current !== uid) {
      setCampagnaId("");
      setCampagnaDettaglio(null);
      setManuale(false);
      setKpiForm(emptyKpiStrings());
      setGiorniAttiva("5");
      setAnalisiAi(null);
      setAnteprima(null);
      setImageBase64(null);
      setErroreAi(null);
      setInputMode("kpi");
      setFunnelAperto(false);
    }
    userIdRef.current = uid;
  }, [user?.id]);

  useEffect(() => {
    if (!manuale) return;
    setKpiForm(emptyKpiStrings());
    setAnalisiAi(null);
    setAnteprima(null);
    setImageBase64(null);
    setErroreAi(null);
    setInputMode("kpi");
    setFunnelAperto(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset solo all'attivazione manuale
  }, [manuale]);

  useEffect(() => {
    void caricaLista();
  }, [caricaLista]);

  useEffect(() => {
    if (!campagnaId || manuale) {
      setCampagnaDettaglio(null);
      return;
    }

    let cancelled = false;
    setCaricamentoDettaglio(true);

    void (async () => {
      try {
        const dettaglio = await leggiCampagnaDaSupabase(campagnaId);
        if (cancelled) return;
        if (!dettaglio) {
          const fallback = campagne.find((c) => c.id === campagnaId) ?? null;
          setCampagnaDettaglio(fallback);
          if (fallback) {
            const obj = normalizzaObjective(fallback.objective);
            setObiettivo(obj);
            setNomeCliente(fallback.nomeCliente);
            setNomeCampagna(fallback.nomeCampagna || fallback.nomeCliente);
            setSettore(fallback.settore ?? "");
            const { threshold } = resolveThresholdFromCampaign(fallback, obj);
            setSogliaManuale(threshold != null ? String(threshold) : "");
          }
          return;
        }
        setCampagnaDettaglio(dettaglio);
        const obj = normalizzaObjective(dettaglio.objective);
        setObiettivo(obj);
        setNomeCliente(dettaglio.nomeCliente);
        setNomeCampagna(dettaglio.nomeCampagna || dettaglio.nomeCliente);
        setSettore(dettaglio.settore ?? "");
        const { threshold } = resolveThresholdFromCampaign(dettaglio, obj);
        setSogliaManuale(threshold != null ? String(threshold) : "");
      } catch (e) {
        logErroreSupabaseDev("risultati_dettaglio_campagna", e);
        if (cancelled) return;
        const fallback = campagne.find((c) => c.id === campagnaId) ?? null;
        setCampagnaDettaglio(fallback);
        if (fallback) {
          const obj = normalizzaObjective(fallback.objective);
          setObiettivo(obj);
          setNomeCliente(fallback.nomeCliente);
          setNomeCampagna(fallback.nomeCampagna || fallback.nomeCliente);
          setSettore(fallback.settore ?? "");
          const { threshold } = resolveThresholdFromCampaign(fallback, obj);
          setSogliaManuale(threshold != null ? String(threshold) : "");
        }
      } finally {
        if (!cancelled) setCaricamentoDettaglio(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campagnaId, manuale, campagne]);

  useEffect(() => {
    if (!campagnaId || manuale) {
      setStoricoChecks([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const lista = await leggiChecksCampagna(campagnaId, 8);
        if (!cancelled) setStoricoChecks(lista);
      } catch (e) {
        logErroreSupabaseDev("risultati_storico_checks", e);
        if (!cancelled) setStoricoChecks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campagnaId, manuale]);

  const campagnaAttiva = manuale ? null : campagnaDettaglio;

  const conteggiFunnel = useMemo(() => {
    const clicksParse = parseOptionalNonNegativeInteger(kpiForm.clicks);
    const impressionsParse = parseOptionalNonNegativeInteger(
      kpiForm.impressions,
    );
    const errors: string[] = [];
    if (!clicksParse.ok) errors.push(clicksParse.error);
    if (!impressionsParse.ok) errors.push(impressionsParse.error);
    const clicks = clicksParse.ok ? clicksParse.value : null;
    const impressions = impressionsParse.ok ? impressionsParse.value : null;
    return {
      clicks,
      impressions,
      errors: [...new Set(errors)],
      warnings: avvisiConteggiFunnel(clicks, impressions),
    };
  }, [kpiForm.clicks, kpiForm.impressions]);

  const funnelMetrics = useMemo(() => {
    const spend = parseNum(kpiForm.spend);
    const results = parseNum(kpiForm.results);
    return deriveFunnelMetrics({
      spend,
      results,
      clicks: conteggiFunnel.clicks,
      impressions: conteggiFunnel.impressions,
      manualCtr: parseCtrInput(kpiForm.ctr),
      manualCpc: parseNum(kpiForm.cpc),
      manualCpm: parseNum(kpiForm.cpm),
    });
  }, [
    kpiForm.spend,
    kpiForm.results,
    kpiForm.ctr,
    kpiForm.cpc,
    kpiForm.cpm,
    conteggiFunnel.clicks,
    conteggiFunnel.impressions,
  ]);

  const kpis: ControlRoomKpis = useMemo(() => {
    const spend = parseNum(kpiForm.spend);
    const results = parseNum(kpiForm.results);
    const costManual = parseNum(kpiForm.costPerResult);
    const costAuto = calcolaCostoDaSpesaRisultati(spend, results);
    const roasManual = parseNum(kpiForm.roas);
    return {
      spend,
      results,
      costPerResult: costManual ?? costAuto,
      ctr: funnelMetrics.ctr,
      cpm: funnelMetrics.cpm,
      cpc: funnelMetrics.cpc,
      frequency: parseNum(kpiForm.frequency),
      roas: roasManual ?? analisiAi?.roas ?? null,
      clicks: conteggiFunnel.clicks,
      impressions: conteggiFunnel.impressions,
      conversionRate: funnelMetrics.conversionRate,
    };
  }, [kpiForm, analisiAi, funnelMetrics, conteggiFunnel]);

  const sogliaOverride = parseNum(sogliaManuale);

  const economic = useMemo(
    () =>
      buildEconomicContext(
        campagnaAttiva,
        kpis,
        sogliaOverride,
        manuale ? obiettivo : undefined,
      ),
    [campagnaAttiva, kpis, sogliaOverride, manuale, obiettivo],
  );

  const health = useMemo(
    () =>
      calcolaHealthStatus(
        economic.actual,
        economic.threshold,
        economic.healthMode,
        {
          daysActive: parseNum(giorniAttiva),
          resultsCount: kpis.results,
        },
      ),
    [economic.actual, economic.threshold, economic.healthMode, giorniAttiva, kpis.results],
  );

  const datiLimitati = useMemo(
    () =>
      avvisoDatiLimitati(
        parseNum(giorniAttiva),
        kpis.results,
      ),
    [giorniAttiva, kpis.results],
  );

  const giaSalvatoOggi = Boolean(
    storicoChecks[0] && stessaGiornataLocale(storicoChecks[0].createdAt),
  );

  const trendLive = useMemo(() => {
    const live = snapshotCheckLive({
      campaignId: campagnaId || "live",
      daysActive: parseNum(giorniAttiva),
      spend: kpis.spend,
      resultsCount: kpis.results,
      primaryCost: economic.actual,
      ctr: kpis.ctr,
      cpm: kpis.cpm,
      cpc: kpis.cpc,
      frequency: kpis.frequency,
      roas: kpis.roas,
      clicks: kpis.clicks,
      impressions: kpis.impressions,
      healthStatus: health.status,
      objective: economic.objective,
      threshold: economic.threshold,
      thresholdMode: thresholdModeDaHealth(economic.healthMode),
      source:
        importOrigin === "csv"
          ? "CSV"
          : importOrigin === "screenshot"
            ? "SCREENSHOT"
            : "MANUAL",
    });
    return trendPerLiveCheck(
      storicoChecks,
      live,
      giaSalvatoOggi,
      economic.objective,
    );
  }, [
    campagnaId,
    giorniAttiva,
    kpis,
    economic.actual,
    economic.objective,
    economic.threshold,
    economic.healthMode,
    health.status,
    importOrigin,
    storicoChecks,
    giaSalvatoOggi,
  ]);

  const diagnosis = useMemo(
    () =>
      diagnosticaDeterministica(kpis, health, economic, {
        datiLimitati: datiLimitati.show,
        trend: trendLive,
      }),
    [kpis, health, economic, datiLimitati.show, trendLive],
  );

  const actions = useMemo(
    () => azioniConsigliate(diagnosis, health, { trend: trendLive }),
    [diagnosis, health, trendLive],
  );

  const costoCalcolato = useMemo(
    () =>
      calcolaCostoDaSpesaRisultati(
        parseNum(kpiForm.spend),
        parseNum(kpiForm.results),
      ),
    [kpiForm.spend, kpiForm.results],
  );

  const resetSessioneKpi = useCallback(() => {
    setKpiForm(emptyKpiStrings());
    setGiorniAttiva("5");
    setAnalisiAi(null);
    setAnteprima(null);
    setImageBase64(null);
    setErroreAi(null);
    setInputMode("kpi");
    setTrascinando(false);
    setNotaBuyer("");
    setErroreSalvataggio(null);
    setOkSalvataggio(null);
    setFunnelAperto(false);
    setImportOrigin(null);
    setErroreCsv(null);
    setFeedbackCsv(null);
    setRigheCsv([]);
    setImportTab("screenshot");
  }, []);

  function selezionaCampagna(id: string) {
    setManuale(false);
    setCampagnaId(id);
    resetSessioneKpi();
  }

  function attivaManuale() {
    setManuale(true);
    setCampagnaId("");
    setCampagnaDettaglio(null);
    resetSessioneKpi();
  }

  function gestisciFile(file: File | undefined) {
    if (!file) return;
    const ok =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp";
    if (!ok) {
      setErroreAi("Carica un file JPG, PNG o WebP.");
      return;
    }
    setErroreAi(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setAnteprima(dataUrl);
      setImageBase64(dataUrl);
      setAnalisiAi(null);
    };
    reader.readAsDataURL(file);
  }

  function applicaKpiDaScreenshot(analisi: ScreenshotAnalysisResult) {
    const ctrNorm = normalizzaCtrDaApi(analisi.ctr);
    const conteggi = conteggiFormDaScreenshot(analisi);
    setKpiForm({
      spend: analisi.spesaTotale > 0 ? String(analisi.spesaTotale) : "",
      results: analisi.risultati > 0 ? String(analisi.risultati) : "",
      costPerResult:
        analisi.costoPerRisultato > 0
          ? String(analisi.costoPerRisultato)
          : "",
      ctr: ctrNorm != null && ctrNorm > 0 ? String(ctrNorm) : "",
      cpm: analisi.cpm > 0 ? String(analisi.cpm) : "",
      cpc:
        analisi.cpc != null && analisi.cpc > 0 ? String(analisi.cpc) : "",
      frequency: analisi.frequenza > 0 ? String(analisi.frequenza) : "",
      roas:
        analisi.roas != null && analisi.roas > 0 ? String(analisi.roas) : "",
      clicks: conteggi.clicks,
      impressions: conteggi.impressions,
    });
    setFunnelAperto(conteggi.apriFunnel);
    setImportOrigin("screenshot");
    setFeedbackCsv(null);
    setRigheCsv([]);
  }

  function applicaRigaCsv(row: MetaCsvMappedRow) {
    const form = kpiFormDaRigaMeta(row);
    setKpiForm(form);
    setFunnelAperto(form.clicks !== "" || form.impressions !== "");
    setImportOrigin("csv");
    setAnalisiAi(null);
    setRigheCsv([]);
    setErroreCsv(null);
    setFeedbackCsv(
      `CSV importato · ${row.recognizedCount} metriche riconosciute`,
    );
    setInputMode("kpi");
  }

  async function gestisciFileCsv(file: File | undefined) {
    if (!file) return;
    const fileErr = validaFileCsvMeta(file);
    if (fileErr) {
      setErroreCsv(fileErr);
      setRigheCsv([]);
      return;
    }
    setErroreCsv(null);
    try {
      const text = await file.text();
      const parsed = parseAdsManagerCsv(text);
      if (!parsed.ok) {
        setErroreCsv(parsed.error);
        setRigheCsv([]);
        return;
      }
      if (parsed.needsSelection) {
        setRigheCsv(parsed.dataRows);
        setFeedbackCsv("Il file contiene più righe. Scegli quale importare.");
        setErroreCsv(null);
        return;
      }
      if (parsed.autoRow) {
        applicaRigaCsv(parsed.autoRow);
      }
    } catch {
      setErroreCsv("Non riesco a leggere questo CSV.");
      setRigheCsv([]);
    }
  }

  async function analizzaScreenshot() {
    if (!imageBase64) {
      setErroreAi("Carica uno screenshot prima di analizzare.");
      return;
    }
    const target = economic.threshold ?? sogliaOverride;
    if (target == null || !(target > 0)) {
      setErroreAi(
        "Serve una soglia economica (dalla campagna o inserimento manuale) per contestualizzare lo screenshot.",
      );
      return;
    }

    setCaricamentoAi(true);
    setErroreAi(null);
    setAnalisiAi(null);

    try {
      const res = await fetch("/api/analyze-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          targetCpl: target,
          obiettivo: economic.objective,
          settore: economic.settore || settore,
          giorniAttiva: Number(giorniAttiva) || 5,
          nomeCampagna:
            campagnaAttiva?.nomeCampagna || nomeCampagna || "Campagna",
          nomeCliente: campagnaAttiva?.nomeCliente || nomeCliente || "Cliente",
        }),
      });

      const data = (await res.json()) as ScreenshotAnalysisResult & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(
          messaggioAiUserFacing(
            data.error,
            "Non siamo riusciti a leggere lo screenshot. Riprova.",
          ),
        );
      }

      const { error: _err, verdetto: _verdetto, ...resto } = data;
      const analisi = resto as ScreenshotAnalysisResult;
      setAnalisiAi(analisi);
      applicaKpiDaScreenshot(analisi);
      setInputMode("kpi");
    } catch (e) {
      setErroreAi(
        messaggioAiUserFacing(
          e instanceof Error ? e.message : null,
          "Analisi non riuscita. Puoi inserire i KPI a mano.",
        ),
      );
    } finally {
      setCaricamentoAi(false);
    }
  }

  async function salvaControllo() {
    if (salvataggio) return;
    if (!campagnaAttiva?.id) {
      setErroreSalvataggio(
        "Seleziona una campagna salvata per registrare il controllo.",
      );
      return;
    }
    const ultimo = storicoChecks[0];
    if (ultimo && stessaGiornataLocale(ultimo.createdAt)) {
      setErroreSalvataggio(
        "Hai già salvato un controllo oggi per questa campagna. Potrai salvarne un altro in una data diversa.",
      );
      return;
    }

    if (conteggiFunnel.errors.length > 0) {
      setErroreSalvataggio(conteggiFunnel.errors[0] ?? null);
      return;
    }

    setSalvataggio(true);
    setErroreSalvataggio(null);
    setOkSalvataggio(null);
    try {
      const salvato = await inserisciCampaignCheck({
        campaignId: campagnaAttiva.id,
        daysActive: parseNum(giorniAttiva),
        spend: kpis.spend,
        resultsCount: kpis.results,
        primaryCost: economic.actual,
        ctr: kpis.ctr,
        cpm: kpis.cpm,
        cpc: kpis.cpc,
        clicks: conteggiFunnel.clicks,
        impressions: conteggiFunnel.impressions,
        frequency: kpis.frequency,
        roas: kpis.roas,
        healthStatus: health.status,
        signal: diagnosis.signal,
        actions,
        note: notaBuyer.trim() || null,
        objective: economic.objective,
        threshold: economic.threshold,
        thresholdMode: thresholdModeDaHealth(economic.healthMode),
        source:
          importOrigin === "csv"
            ? "CSV"
            : importOrigin === "screenshot" || analisiAi
              ? "SCREENSHOT"
              : "MANUAL",
      });
      setStoricoChecks((prev) => [salvato, ...prev].slice(0, 8));
      setUltimiChecks((prev) => {
        const next = new Map(prev);
        next.set(salvato.campaignId, salvato);
        return next;
      });
      try {
        await logControlloPerformanceSalvato({
          campaignId: campagnaAttiva.id,
          description: descrizioneLogControllo({
            status: health.status,
            metricLabel: economic.metricLabel,
            primaryCost: economic.actual,
            threshold: economic.threshold,
          }),
        });
      } catch (eLog) {
        logErroreSupabaseDev("log_controllo_performance", eLog);
      }
      setOkSalvataggio("Controllo salvato.");
    } catch (e) {
      logErroreSupabaseDev("salva_campaign_check", e);
      setErroreSalvataggio(
        e instanceof Error
          ? e.message
          : "Impossibile salvare il controllo. Riprova.",
      );
    } finally {
      setSalvataggio(false);
    }
  }

  const haSelezione = Boolean(campagnaAttiva) || manuale;
  const mostraOverview = !campagnaId && !manuale;
  const metricLabel = economic.metricLabel;
  const trendStoricoSalvato = useMemo(
    () =>
      storicoChecks.length > 0
        ? trendPerLiveCheck(
            storicoChecks,
            storicoChecks[0]!,
            true,
            economic.objective,
          )
        : null,
    [storicoChecks, economic.objective],
  );
  const contestoStorico = etichettaContestoStorico({
    savedCount: storicoChecks.length,
    liveConfrontoDisponibile:
      !giaSalvatoOggi && trendLive.level === "ONE_PERIOD_CHANGE",
    trendStorico: trendStoricoSalvato,
  });

  const righeOverview = useMemo(
    () =>
      ordinaRigheControlRoom(
        campagne.map((c) => ({
          campagna: c,
          ultimo: ultimiChecks.get(c.id) ?? null,
        })),
      ),
    [campagne, ultimiChecks],
  );

  return (
    <main className="aff-page aff-page--wide">
      <header>
        {mostraOverview ? (
          <>
            <h2 className="aff-page-title">Risultati</h2>
            <p className="aff-page-subtitle">
              Controlla performance, soglie e campagne da monitorare.
            </p>
          </>
        ) : (
          <>
            <h2 className="aff-page-title">
              Controlla come sta andando la campagna
            </h2>
            <p className="aff-page-subtitle">
              Confronta i risultati reali con la soglia economica definita prima
              del lancio e capisci cosa fare dopo.
            </p>
            <Link href="/risultati" className="aff-btn-tertiary mt-3 min-h-8 px-0">
              ← Tutte le campagne
            </Link>
          </>
        )}
      </header>

      {mostraOverview ? (
        <>
          <ControlRoomOverview
            righe={righeOverview}
            caricamento={caricamentoCampagne}
            errore={erroreCampagne}
            onRiprova={() => void caricaLista()}
          />
          <MetaClientsLoader />
        </>
      ) : null}

      {/* TOP: campagna */}
      {!mostraOverview ? (
      <>
      <section className="aff-panel-white mt-8 p-5">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Campagna da analizzare
        </h2>

        {caricamentoCampagne ? (
          <div className="mt-4 h-11 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
        ) : erroreCampagne && campagne.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            <p>{erroreCampagne}</p>
            <button
              type="button"
              onClick={() => void caricaLista()}
              className="mt-2 text-sm font-medium text-[var(--accent)]"
            >
              Riprova
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Seleziona campagna salvata
              </span>
              <select
                value={manuale ? "" : campagnaId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  selezionaCampagna(v);
                }}
                disabled={campagne.length === 0}
                className={inputClass}
              >
                <option value="">
                  {campagne.length === 0
                    ? "Nessuna campagna salvata"
                    : "— Scegli una campagna —"}
                </option>
                {campagne.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    title={`${etichettaCampagnaDropdown(c)} · ${etichettaObiettivo(c.objective)}`}
                  >
                    {etichettaCampagnaDropdown(c)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={attivaManuale}
              className={`text-sm ${
                manuale
                  ? "font-medium text-[var(--accent)]"
                  : "text-[var(--ink-muted)] underline-offset-2 hover:underline"
              }`}
            >
              Inserimento manuale
              {manuale ? " (attivo)" : " — fallback se non selezioni una campagna"}
            </button>

            {campagne.length === 0 && !manuale ? (
              <p className="text-xs text-[var(--ink-muted)]">
                Non hai ancora campagne salvate. Usa l&apos;inserimento manuale
                oppure crea una campagna dal wizard.
              </p>
            ) : null}
          </div>
        )}

        {manuale ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-1">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Cliente
              </span>
              <input
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className={inputClass}
                placeholder="Nome cliente"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Campagna
              </span>
              <input
                value={nomeCampagna}
                onChange={(e) => setNomeCampagna(e.target.value)}
                className={inputClass}
                placeholder="Nome campagna"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Obiettivo
              </span>
              <select
                value={obiettivo}
                onChange={(e) => {
                  const next = e.target.value as CampagnaObjective;
                  if (next !== obiettivo) {
                    resetSessioneKpi();
                  }
                  setObiettivo(next);
                }}
                className={inputClass}
              >
                <option value="LEADS">Lead Generation</option>
                <option value="BOOKINGS">Prenotazioni</option>
                <option value="ECOMMERCE">Vendite online</option>
                <option value="IN_STORE">Traffico in negozio</option>
                <option value="RETARGETING">Retargeting</option>
                <option value="AWARENESS">Awareness / Apertura</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                Settore
              </span>
              <input
                value={settore}
                onChange={(e) => setSettore(e.target.value)}
                className={inputClass}
                placeholder="Es. Dentista"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                {obiettivo === "AWARENESS"
                  ? "CPM di riferimento (piano) (€)"
                  : `${metricLabel} massimo sostenibile (€)`}
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={sogliaManuale}
                onChange={(e) => setSogliaManuale(e.target.value)}
                className={inputClass}
                placeholder="Soglia economica"
              />
            </label>
          </div>
        ) : null}

        {caricamentoDettaglio ? (
          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            Caricamento dati campagna…
          </p>
        ) : null}

        {campagnaAttiva ? (
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-[var(--ink-muted)]">Cliente</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {campagnaAttiva.nomeCliente}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ink-muted)]">Obiettivo</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {etichettaObiettivo(campagnaAttiva.objective)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ink-muted)]">Budget giornaliero</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {formatEuro(campagnaAttiva.budgetGiornaliero ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ink-muted)]">
                {economic.objective === "AWARENESS"
                  ? "CPM di riferimento (piano)"
                  : `Soglia ${metricLabel}`}
              </dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {formatEuro(economic.threshold)}
              </dd>
            </div>
            {campagnaAttiva.settore ? (
              <div>
                <dt className="text-xs text-[var(--ink-muted)]">Settore</dt>
                <dd className="mt-0.5 font-medium text-[var(--ink)]">
                  {campagnaAttiva.settore}
                </dd>
              </div>
            ) : null}
            {campagnaAttiva.targetMargin != null ? (
              <div>
                <dt className="text-xs text-[var(--ink-muted)]">Margine target</dt>
                <dd className="mt-0.5 font-medium text-[var(--ink)]">
                  {campagnaAttiva.targetMargin}%
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {!manuale &&
        campagnaAttiva &&
        economic.threshold == null ? (
          <p className="aff-callout aff-callout--warning mt-4 text-sm">
            Dati insufficienti per lo stato economico. Inserisci la soglia solo se
            la conosci.
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium">
                {economic.objective === "AWARENESS"
                  ? "CPM di riferimento (piano) (€)"
                  : `${metricLabel} massimo sostenibile (€)`}
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={sogliaManuale}
                onChange={(e) => setSogliaManuale(e.target.value)}
                className={inputClass}
              />
            </label>
          </p>
        ) : null}
      </section>

      {/* Stato economico — dopo selezione */}
      {haSelezione ? (
        <section className="aff-panel-white mt-6 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <StatoChip
                kind={chipDaHealth(health.status)}
                label={health.label}
              />
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                Stato
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink)]">
                {health.explanation}
              </p>
              {health.efficiencyNote ? (
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--ink-muted)]">
                  {health.efficiencyNote}
                </p>
              ) : null}
            </div>
            {health.deltaLabel ? (
              <span className="aff-badge aff-badge--neutral aff-badge--pill">
                {health.deltaLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="aff-metric">
              <p className="text-xs text-[var(--ink-muted)]">
                {health.mode === "efficiency"
                  ? "CPM attuale"
                  : `${metricLabel} attuale`}
              </p>
              <p className="aff-metric__value">
                {formatEuro(economic.actual)}
              </p>
            </div>
            <div className="aff-metric">
              <p className="text-xs text-[var(--ink-muted)]">
                {health.mode === "efficiency"
                  ? "CPM di riferimento (piano)"
                  : `${metricLabel} massimo sostenibile`}
              </p>
              <p className="aff-metric__value">
                {formatEuro(economic.threshold)}
              </p>
            </div>
          </div>

          {economic.objective === "ECOMMERCE" &&
          economic.roasAttuale != null &&
          economic.roasBreakEvenHint != null ? (
            <div className="aff-metric mt-4">
              <p className="aff-metric__label">
                ROAS attuale vs break-even (da campagna)
              </p>
              <p className="aff-metric__value text-[15px]">
                {economic.roasAttuale}x attuale · {economic.roasBreakEvenHint}x
                break-even stimato
              </p>
            </div>
          ) : null}

          {datiLimitati.show ? (
            <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm">
              {datiLimitati.message}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Main 2-col */}
      {haSelezione ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: KPI + screenshot */}
          <div className="space-y-5 lg:col-span-6">
            <section className="aff-panel-white p-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode("kpi")}
                  className={`aff-tool-chip ${
                    inputMode === "kpi"
                      ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)] text-[var(--ally-violet-active-text)]"
                      : ""
                  }`}
                >
                  Inserisci KPI
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("import")}
                  className={`aff-tool-chip ${
                    inputMode === "import"
                      ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)] text-[var(--ally-violet-active-text)]"
                      : ""
                  }`}
                >
                  Importa da Ads Manager
                </button>
              </div>

              {inputMode === "kpi" ? (
                <div className="mt-5">
                  <h3 className="text-sm font-medium text-[var(--ink)]">
                    Risultati reali
                  </h3>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Non tutti i campi sono obbligatori. Se inserisci spesa e
                    risultati, il {metricLabel} si calcola automaticamente.
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                      Giorni attiva (opzionale)
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={giorniAttiva}
                      onChange={(e) => setGiorniAttiva(e.target.value)}
                      className={inputClass}
                      placeholder="Es. 5"
                    />
                  </label>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    Risultato
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {campiBloccoRisultato(economic.objective, metricLabel).map(
                      ([key, label]) => (
                        <CampoKpiForm
                          key={key}
                          label={label}
                          derived={testoKpiDerivato(key, funnelMetrics)}
                          value={
                            key === "costPerResult" &&
                            kpiForm.costPerResult === "" &&
                            costoCalcolato != null
                              ? String(costoCalcolato)
                              : kpiForm[key]
                          }
                          onChange={(value) =>
                            setKpiForm((prev) => ({ ...prev, [key]: value }))
                          }
                          placeholder={
                            key === "costPerResult" && costoCalcolato != null
                              ? `Auto: ${costoCalcolato}`
                              : undefined
                          }
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    Diagnostica
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {campiBloccoDiagnostica(economic.objective).map(
                      ([key, label]) => (
                        <CampoKpiForm
                          key={key}
                          label={label}
                          derived={testoKpiDerivato(key, funnelMetrics)}
                          value={
                            key === "frequency"
                              ? formatFrequenzaInput(kpiForm.frequency)
                              : kpiForm[key]
                          }
                          onChange={(value) =>
                            setKpiForm((prev) => ({ ...prev, [key]: value }))
                          }
                        />
                      ),
                    )}
                  </div>
                  {funnelMetrics.mismatches.length > 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
                      {funnelMetrics.mismatches.map((m) => m.message).join(" ")}
                    </p>
                  ) : null}
                  <details
                    className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                    open={funnelAperto}
                    onToggle={(e) =>
                      setFunnelAperto(
                        (e.currentTarget as HTMLDetailsElement).open,
                      )
                    }
                  >
                    <summary className="cursor-pointer text-xs font-medium text-[var(--ink-muted)]">
                      Metriche di funnel
                    </summary>
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      {economic.objective === "AWARENESS"
                        ? "Facoltative · le impression aiutano a contestualizzare il CPM"
                        : "Facoltative · migliorano la precisione della diagnosi"}
                    </p>
                    {analisiAi && funnelAperto && (kpiForm.clicks !== "" || kpiForm.impressions !== "") ? (
                      <p className="mt-2 text-xs text-[var(--ink-muted)]">
                        Trovati nello screenshot. Verificali e correggili se
                        serve prima di salvare.
                      </p>
                    ) : null}
                    {importOrigin === "csv" && funnelAperto && (kpiForm.clicks !== "" || kpiForm.impressions !== "") ? (
                      <p className="mt-2 text-xs text-[var(--ink-muted)]">
                        Trovati nel CSV. Verificali e correggili se serve prima
                        di salvare.
                      </p>
                    ) : null}
                    {feedbackCsv && inputMode === "kpi" ? (
                      <p className="mt-2 text-xs text-[var(--ink-muted)]">
                        {feedbackCsv}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block min-w-0">
                        <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                          Click
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={kpiForm.clicks}
                          onChange={(e) =>
                            setKpiForm((prev) => ({
                              ...prev,
                              clicks: e.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Opzionale"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                          Impression
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={kpiForm.impressions}
                          onChange={(e) =>
                            setKpiForm((prev) => ({
                              ...prev,
                              impressions: e.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Opzionale"
                        />
                      </label>
                    </div>
                    {etichettaTassoClickRisultato(economic.objective) &&
                    funnelMetrics.conversionRate != null ? (
                      <p className="mt-3 text-xs text-[var(--ink-muted)]">
                        {etichettaTassoClickRisultato(economic.objective)}
                        {": "}
                        {formatFunnelPercent(funnelMetrics.conversionRate)}
                      </p>
                    ) : null}
                    {conteggiFunnel.errors.length > 0 ? (
                      <p className="mt-2 text-xs aff-text-danger">
                        {conteggiFunnel.errors[0]}
                      </p>
                    ) : null}
                    {conteggiFunnel.warnings.map((w) => (
                      <p
                        key={w}
                        className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]"
                      >
                        {w}
                      </p>
                    ))}
                  </details>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setImportTab("screenshot")}
                      className={`aff-tool-chip ${
                        importTab === "screenshot"
                          ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)] text-[var(--ally-violet-active-text)]"
                          : ""
                      }`}
                    >
                      Screenshot
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportTab("csv")}
                      className={`aff-tool-chip ${
                        importTab === "csv"
                          ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)] text-[var(--ally-violet-active-text)]"
                          : ""
                      }`}
                    >
                      CSV
                    </button>
                  </div>
                  {importTab === "csv" ? (
                    <div className="mt-4">
                      <p className="text-sm text-[var(--ink-muted)]">
                        Carica un export .csv di Ads Manager. Ally legge le
                        metriche senza AI.
                      </p>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => csvInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            csvInputRef.current?.click();
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setTrascinandoCsv(true);
                        }}
                        onDragLeave={() => setTrascinandoCsv(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setTrascinandoCsv(false);
                          void gestisciFileCsv(e.dataTransfer.files[0]);
                        }}
                        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                          trascinandoCsv
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-muted)]"
                        }`}
                      >
                        <FileUp
                          className="h-9 w-9 text-[var(--accent)]"
                          strokeWidth={1.5}
                        />
                        <p className="mt-3 text-sm font-medium text-[var(--ink)]">
                          Trascina il CSV di Ads Manager
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          Solo file .csv
                        </p>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => {
                            void gestisciFileCsv(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {feedbackCsv ? (
                        <p className="mt-3 text-xs text-[var(--ink-muted)]">
                          {feedbackCsv}
                        </p>
                      ) : null}
                      {erroreCsv ? (
                        <p className="mt-3 text-sm aff-text-danger">{erroreCsv}</p>
                      ) : null}
                      {righeCsv.length > 0 ? (
                        <ul className="mt-4 space-y-2">
                          {righeCsv.map((row, i) => (
                            <li
                              key={`${etichettaRigaMetaCsv(row)}-${i}`}
                              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
                            >
                              <p className="text-sm font-medium text-[var(--ink)]">
                                {etichettaRigaMetaCsv(row)}
                              </p>
                              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                                Spesa {row.spend ?? "—"} · Risultati{" "}
                                {row.results ?? "—"} · Click {row.clicks ?? "—"}{" "}
                                · Impression {row.impressions ?? "—"}
                              </p>
                              <button
                                type="button"
                                onClick={() => applicaRigaCsv(row)}
                                className="mt-2 text-xs font-medium text-[var(--accent)]"
                              >
                                Usa questi dati
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                <div className="mt-4">
                  <p className="text-sm text-[var(--ink-muted)]">
                    Non vuoi compilare i KPI? Carica uno screenshot di Ads
                    Manager e Ally prova a leggerli per te.
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
                    className={`mt-4 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                      trascinando
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-muted)]"
                    }`}
                  >
                    {anteprima ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={anteprima}
                        alt="Anteprima screenshot Meta Ads Manager"
                        className="max-h-56 w-full rounded-xl object-contain"
                      />
                    ) : (
                      <>
                        <ImagePlus
                          className="h-9 w-9 text-[var(--accent)]"
                          strokeWidth={1.5}
                        />
                        <p className="mt-3 text-sm font-medium text-[var(--ink)]">
                          Trascina lo screenshot di Ads Manager
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          JPG, PNG o WebP
                        </p>
                      </>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        gestisciFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void analizzaScreenshot()}
                    disabled={caricamentoAi || !imageBase64}
                    className="aff-btn-primary mt-4 w-full"
                  >
                    {caricamentoAi ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    {caricamentoAi
                      ? "Lettura screenshot…"
                      : "Leggi KPI dallo screenshot"}
                  </button>

                  {caricamentoAi ? (
                    <p className="mt-3 text-xs text-[var(--ink-muted)]">
                      Lettura metriche dallo screenshot…
                    </p>
                  ) : null}
                  {erroreAi ? (
                    <p className="mt-3 text-sm aff-text-danger">{erroreAi}</p>
                  ) : null}
                  {analisiAi ? (
                    <p className="mt-3 text-xs text-[var(--ink-muted)]">
                      KPI letti e copiati nei campi. Puoi correggerli nella
                      modalità «Inserisci KPI». Lo stato economico resta
                      calcolato dalle regole Ally, non dall&apos;AI.
                    </p>
                  ) : null}
                </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Diagnosi + azioni */}
          <div className="space-y-5 lg:col-span-6">
            <section className="aff-panel-white p-5">
              <h3 className="text-sm font-medium text-[var(--ink)]">Diagnosi</h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Ipotesi sui segnali, distinta dallo stato economico. Non è una
                certezza sulla creatività, sull&apos;audience o sulla landing.
              </p>

              {diagnosis.canDiagnose || diagnosis.signal === "dati_insufficienti" ? (
                <BloccoDiagnosiTrend
                  healthStatus={health.status}
                  diagnosis={diagnosis}
                  trend={trendLive}
                />
              ) : null}
            </section>

            <section className="aff-panel-white p-5">
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Cosa fare adesso
              </h3>
              <ol className="mt-4 space-y-3">
                {actions.map((azione, i) => (
                  <li
                    key={`${i}-${azione.text}`}
                    className="flex gap-3 text-sm leading-relaxed text-[var(--ink)]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p>{azione.text}</p>
                      <span
                        className={`mt-1 ${priorityBadgeClasses(azione.priority)}`}
                      >
                        {priorityLabel(azione.priority)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="aff-panel-white p-5">
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Nota del media buyer
              </h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Opzionale. Esempio: «Creatività nuova lanciata martedì.»
              </p>
              <textarea
                value={notaBuyer}
                onChange={(e) => setNotaBuyer(e.target.value)}
                rows={3}
                className={`${inputClass} mt-3 resize-y`}
                placeholder="Creatività nuova lanciata martedì."
              />
              <button
                type="button"
                onClick={() => void salvaControllo()}
                disabled={
                  salvataggio || !campagnaAttiva?.id || giaSalvatoOggi
                }
                className="aff-btn-primary mt-4 w-full"
              >
                {salvataggio ? "Salvataggio…" : "Salva controllo"}
              </button>
              {!campagnaAttiva?.id ? (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  Seleziona una campagna salvata per registrare il controllo.
                </p>
              ) : null}
              {giaSalvatoOggi ? (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  Hai già salvato un controllo oggi. Un nuovo check è
                  disponibile in una data diversa.
                </p>
              ) : null}
              {erroreSalvataggio ? (
                <p className="mt-2 text-sm aff-text-danger">{erroreSalvataggio}</p>
              ) : null}
              {okSalvataggio ? (
                <p className="mt-2 text-sm aff-text-success">{okSalvataggio}</p>
              ) : null}
            </section>
          </div>
        </div>
      ) : (
        <div className="aff-empty mt-4 text-center">
          <p className="text-sm text-[var(--ink-muted)]">
            Seleziona una campagna salvata (o usa l&apos;inserimento manuale)
            per vedere stato economico, KPI e diagnosi.
          </p>
        </div>
      )}

      <section
        className={`aff-panel-white p-5 ${haSelezione ? "mt-10" : "mt-6"}`}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2">
          <h2 className="text-lg font-medium text-[var(--ink)]">
            Storico controlli
          </h2>
          {contestoStorico ? (
            <p className="min-w-0 max-w-full break-words text-sm leading-relaxed text-[var(--ink-muted)] sm:max-w-xl sm:text-right">
              {contestoStorico}
            </p>
          ) : null}
        </div>
        <StoricoControlli
          checks={storicoChecks}
          metricLabel={metricLabel}
          objective={economic.objective}
        />
      </section>
      </>
      ) : null}

      {!mostraOverview ? (
      <section className="mt-8">
        <h2 className="text-lg font-medium text-[var(--ink)]">
          Riferimenti di mercato
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          Valori indicativi, non soglie decisionali.
        </p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-surface)] shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="px-4 py-3 font-medium">Settore</th>
                <th className="px-4 py-3 font-medium">Obiettivo</th>
                <th className="px-4 py-3 font-medium">Metrica</th>
                <th className="px-4 py-3 font-medium">Range Italia</th>
                <th className="px-4 py-3 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_NAZIONALI.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">
                    {row.settore}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-muted)]">
                    {row.obiettivo}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-muted)]">
                    {row.metrica}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--accent)]">
                    {row.rangeMin}–{row.rangeMax}
                    {row.unita}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-muted)]">
                    {row.nota}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </main>
  );
}

export default function RisultatiPageRoute() {
  return (
    <Suspense
      fallback={
        <main className="aff-page aff-page--wide">
          <p className="text-sm text-[var(--ink-muted)]">Caricamento Control Room…</p>
        </main>
      }
    >
      <RisultatiPage />
    </Suspense>
  );
}
