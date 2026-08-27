"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { BENCHMARK_NAZIONALI } from "@/data/benchmarks-nazionali";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import {
  azioniConsigliate,
  avvisoDatiLimitati,
  buildEconomicContext,
  calcolaCostoDaSpesaRisultati,
  calcolaHealthStatus,
  diagnosticaDeterministica,
  formatEuro,
  healthBadgeClasses,
  normalizzaCtrDaApi,
  parseCtrInput,
  parseNum,
  priorityBadgeClasses,
  priorityLabel,
  resolveThresholdFromCampaign,
  type ControlRoomKpis,
} from "@/lib/control-room";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  leggiCampagnaDaSupabase,
  leggiCampagneDaSupabase,
} from "@/lib/campagne-db";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { messaggioAiUserFacing } from "@/lib/anthropic-messaggi";
import type { Campagna, CampagnaObjective } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";
import type { ScreenshotAnalysisResult } from "@/types/screenshot-analysis";
import { getCampaigns, type SavedCampaign } from "@/utils/clientStorage";

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]";

type InputMode = "kpi" | "screenshot";

function inizialiDaNome(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "??";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return `${parti[0][0]}${parti[parti.length - 1][0]}`.toUpperCase();
}

function campagnaDaMemoria(c: SavedCampaign): Campagna {
  return {
    id: c.id,
    nomeCliente: c.nomeCliente,
    iniziali: inizialiDaNome(c.nomeCliente),
    stato: c.status || "Bozza",
    giudizio: "Ancora presto",
    objective: c.objective,
    nomeCampagna: c.nomeCampagna,
    settore: c.settore,
    citta: c.citta,
    dataLancio: c.dataCreazione,
    status: c.status,
    frontEndOffer: c.frontEndOffer || undefined,
  };
}

function fondiCampagne(
  remote: Campagna[],
  locali: SavedCampaign[],
): Campagna[] {
  const byId = new Map<string, Campagna>();
  for (const loc of locali) {
    byId.set(loc.id, campagnaDaMemoria(loc));
  }
  for (const rem of remote) {
    const precedente = byId.get(rem.id);
    byId.set(
      rem.id,
      precedente
        ? {
            ...precedente,
            ...rem,
            dataLancio: rem.dataLancio || precedente.dataLancio,
            objective: rem.objective ?? precedente.objective,
            status: rem.status ?? precedente.status,
            nomeCampagna: rem.nomeCampagna || precedente.nomeCampagna,
          }
        : rem,
    );
  }
  return [...byId.values()].sort((a, b) =>
    (b.dataLancio ?? "").localeCompare(a.dataLancio ?? ""),
  );
}

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

function campiKpiPerObiettivo(
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
    return [
      ...base,
      ["cpm", "CPM (€)"],
      ["ctr", "CTR (%)"],
      ["cpc", "CPC (€)"],
      ["frequency", "Frequenza"],
    ];
  }

  return [
    ...base,
    ["costPerResult", `${metricLabel} (€)`],
    ["ctr", "CTR (%)"],
    ["cpm", "CPM (€)"],
    ["cpc", "CPC (€)"],
    ["frequency", "Frequenza"],
    ...(objective === "ECOMMERCE"
      ? ([["roas", "ROAS (x)"]] as const)
      : []),
  ];
}

export default function RisultatiPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);

  const [campagne, setCampagne] = useState<Campagna[]>([]);
  const [caricamentoCampagne, setCaricamentoCampagne] = useState(true);
  const [erroreCampagne, setErroreCampagne] = useState<string | null>(null);
  const [fallbackLocale, setFallbackLocale] = useState(false);

  const [campagnaId, setCampagnaId] = useState("");
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
  const [kpiForm, setKpiForm] = useState(emptyKpiStrings);

  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [trascinando, setTrascinando] = useState(false);
  const [analisiAi, setAnalisiAi] = useState<ScreenshotAnalysisResult | null>(
    null,
  );
  const [caricamentoAi, setCaricamentoAi] = useState(false);
  const [erroreAi, setErroreAi] = useState<string | null>(null);

  const caricaLista = useCallback(async () => {
    setCaricamentoCampagne(true);
    setErroreCampagne(null);
    setFallbackLocale(false);
    try {
      const lista = await leggiCampagneDaSupabase();
      setCampagne(lista);
    } catch (e) {
      logErroreSupabaseDev("risultati_liste_campagne", e);
      const locali = getCampaigns();
      const daLocale = fondiCampagne([], locali);
      setCampagne(daLocale);
      setFallbackLocale(daLocale.length > 0);
      if (daLocale.length === 0) {
        setErroreCampagne(messaggioErroreSupabase(e, "lista"));
      }
    } finally {
      setCaricamentoCampagne(false);
    }
  }, []);

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

  const campagnaAttiva = manuale ? null : campagnaDettaglio;

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
      ctr: parseCtrInput(kpiForm.ctr),
      cpm: parseNum(kpiForm.cpm),
      cpc: parseNum(kpiForm.cpc),
      frequency: parseNum(kpiForm.frequency),
      roas: roasManual ?? analisiAi?.roas ?? null,
    };
  }, [kpiForm, analisiAi]);

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
      ),
    [economic.actual, economic.threshold, economic.healthMode],
  );

  const datiLimitati = useMemo(
    () =>
      avvisoDatiLimitati(
        parseNum(giorniAttiva),
        kpis.results,
      ),
    [giorniAttiva, kpis.results],
  );

  const diagnosis = useMemo(
    () =>
      diagnosticaDeterministica(kpis, health, economic, {
        datiLimitati: datiLimitati.show,
      }),
    [kpis, health, economic, datiLimitati.show],
  );

  const actions = useMemo(
    () => azioniConsigliate(diagnosis, health),
    [diagnosis, health],
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
    setKpiForm({
      spend: analisi.spesaTotale > 0 ? String(analisi.spesaTotale) : "",
      results: analisi.risultati > 0 ? String(analisi.risultati) : "",
      costPerResult:
        analisi.costoPerRisultato > 0
          ? String(analisi.costoPerRisultato)
          : "",
      ctr: ctrNorm != null && ctrNorm > 0 ? String(ctrNorm) : "",
      cpm: analisi.cpm > 0 ? String(analisi.cpm) : "",
      cpc: "",
      frequency: analisi.frequenza > 0 ? String(analisi.frequenza) : "",
      roas:
        analisi.roas != null && analisi.roas > 0 ? String(analisi.roas) : "",
    });
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

      const { error: _err, ...analisiPulita } = data;
      const analisi = analisiPulita as ScreenshotAnalysisResult;
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

  const haSelezione = Boolean(campagnaAttiva) || manuale;
  const metricLabel = economic.metricLabel;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Control Room
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)] sm:text-3xl">
          Controlla come sta andando la campagna
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          Confronta i risultati reali con la soglia economica definita prima del
          lancio e capisci cosa fare dopo.
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--ink)]">
          Non guardare solo i numeri. Capisci cosa fare dopo.
        </p>
      </header>

      {/* TOP: campagna */}
      <section className="mt-8 rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
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

        {fallbackLocale ? (
          <p className="mt-3 rounded-xl border border-[#F5D78E] bg-[#FFF6E5] px-4 py-3 text-xs text-[#9A6700]">
            Connessione al database non disponibile: mostrando solo campagne
            salvate in questo browser. Accedi con lo stesso account e riprova.
          </p>
        ) : null}

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
          <p className="mt-4 rounded-xl border border-[#F5D78E] bg-[#FFF6E5] px-4 py-3 text-sm text-[#9A6700]">
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
        <section
          className={`mt-6 rounded-[var(--radius)] border px-5 py-5 shadow-[var(--shadow-soft)] ${healthBadgeClasses(health.status)}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {health.mode === "efficiency"
                  ? "Controllo di efficienza"
                  : "Stato campagna"}
              </p>
              <p className="mt-1 text-xl font-medium">{health.label}</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed">
                {health.explanation}
              </p>
              {health.efficiencyNote ? (
                <p className="mt-2 max-w-xl text-xs leading-relaxed opacity-90">
                  {health.efficiencyNote}
                </p>
              ) : null}
            </div>
            {health.deltaLabel ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium">
                {health.deltaLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white/70 px-4 py-3">
              <p className="text-xs text-[var(--ink-muted)]">
                {health.mode === "efficiency"
                  ? "CPM attuale"
                  : `${metricLabel} attuale`}
              </p>
              <p className="mt-1 text-2xl font-medium text-[var(--ink)]">
                {formatEuro(economic.actual)}
              </p>
            </div>
            <div className="rounded-xl bg-white/70 px-4 py-3">
              <p className="text-xs text-[var(--ink-muted)]">
                {health.mode === "efficiency"
                  ? "CPM di riferimento (piano)"
                  : `${metricLabel} massimo sostenibile`}
              </p>
              <p className="mt-1 text-2xl font-medium text-[var(--ink)]">
                {formatEuro(economic.threshold)}
              </p>
            </div>
          </div>

          {economic.objective === "ECOMMERCE" &&
          economic.roasAttuale != null &&
          economic.roasBreakEvenHint != null ? (
            <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm">
              <p className="text-xs text-[var(--ink-muted)]">
                ROAS attuale vs break-even (da campagna)
              </p>
              <p className="mt-1 font-medium text-[var(--ink)]">
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
            <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode("kpi")}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    inputMode === "kpi"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--surface-hover)] text-[var(--ink-muted)]"
                  }`}
                >
                  Inserisci KPI
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("screenshot")}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    inputMode === "screenshot"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--surface-hover)] text-[var(--ink-muted)]"
                  }`}
                >
                  Analizza screenshot Ads Manager
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
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
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
                    {campiKpiPerObiettivo(economic.objective, metricLabel).map(
                      ([key, label]) => (
                      <label key={key} className="block">
                        <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={
                            key === "costPerResult" &&
                            kpiForm.costPerResult === "" &&
                            costoCalcolato != null
                              ? String(costoCalcolato)
                              : kpiForm[key]
                          }
                          onChange={(e) =>
                            setKpiForm((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder={
                            key === "costPerResult" && costoCalcolato != null
                              ? `Auto: ${costoCalcolato}`
                              : undefined
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <p className="text-sm text-[var(--ink-muted)]">
                    Non vuoi compilare i KPI? Carica uno screenshot di Ads
                    Manager e Affianco prova a leggerli per te.
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
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <p className="mt-3 text-sm text-[#B42318]">{erroreAi}</p>
                  ) : null}
                  {analisiAi ? (
                    <p className="mt-3 text-xs text-[var(--ink-muted)]">
                      KPI letti e copiati nei campi. Puoi correggerli nella
                      modalità «Inserisci KPI». Lo stato economico resta
                      calcolato dalle regole Affianco, non dall&apos;AI.
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Diagnosi + azioni */}
          <div className="space-y-5 lg:col-span-6">
            <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h3 className="text-sm font-medium text-[var(--ink)]">Diagnosi</h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Diagnosi indicativa basata sui KPI disponibili. Verifica sempre
                il contesto della campagna. Segnali indicativi, da interpretare
                nel contesto della campagna.
              </p>

              {diagnosis.canDiagnose || diagnosis.signal === "dati_insufficienti" ? (
                <div className="mt-4">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {diagnosis.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                    {diagnosis.body}
                  </p>
                  {diagnosis.hint ? (
                    <p className="mt-3 rounded-xl bg-[var(--surface-hover)] px-3 py-2 text-xs text-[var(--ink-muted)]">
                      {diagnosis.hint}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-[var(--ink-muted)]">
                    Segnale: {diagnosis.signal.replace(/_/g, " ")}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
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
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadgeClasses(azione.priority)}`}
                      >
                        {priorityLabel(azione.priority)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-white px-6 py-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--ink-muted)]">
            Seleziona una campagna salvata (o usa l&apos;inserimento manuale)
            per vedere stato economico, KPI e diagnosi.
          </p>
        </div>
      )}

      {/* BOTTOM: storico + benchmark */}
      <section
        className={`rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] ${haSelezione ? "mt-10" : "mt-6"}`}
      >
        <h2 className="text-lg font-medium text-[var(--ink)]">
          Storico controlli
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Lo storico dei controlli sarà disponibile dopo il primo check salvato.
        </p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Persistenza su database in arrivo (tabella dedicata). Nessun dato
          fittizio mostrato qui.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-[var(--ink)]">
          Riferimenti di mercato
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          Range indicativi utili come contesto. La soglia economica del cliente
          resta il riferimento principale.
        </p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius)] bg-white shadow-[var(--shadow-soft)]">
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
    </main>
  );
}
