"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { BENCHMARK_NAZIONALI } from "@/data/benchmarks-nazionali";
import { leggiAssetCampagnaLocale } from "@/data/campagne-assets-store";
import { giorniAttiviDaCampagna } from "@/data/campagne-store";
import { getBenchmarkForNiche } from "@/lib/benchmarks";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import type { CampagnaObjective } from "@/types/campagne";
import { normalizzaObjective } from "@/types/campagne";
import type {
  SavedCampaignResult,
  ScreenshotAnalysisResult,
  VerdettoScreenshot,
} from "@/types/screenshot-analysis";
import {
  getCampaigns,
  type SavedCampaign,
} from "@/utils/clientStorage";
import {
  getSavedCampaignResults,
  saveCampaignResult,
} from "@/utils/campaignResultsStorage";
import { messaggioAiUserFacing } from "@/lib/anthropic-messaggi";

const PASSI_CARICAMENTO = [
  "Lettura metriche dallo screenshot…",
  "Confronto con i margini del cliente…",
  "Generazione piano d'azione…",
];

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]";

function stimaTargetCpl(
  campagna: SavedCampaign | null,
  settore: string,
  citta: string,
): number {
  if (!campagna) {
    const bench = getBenchmarkForNiche(settore, citta);
    return bench.cplOptimal;
  }
  const assets = leggiAssetCampagnaLocale(campagna.id);
  const objective = normalizzaObjective(
    assets?.objective ?? campagna.objective,
  );
  const margine = assets?.targetMargin ?? 50;

  if (objective === "ECOMMERCE") {
    const salvato = assets?.maxSustainableCpa;
    if (salvato != null && Number.isFinite(salvato) && salvato > 0) {
      return Math.round(salvato * 100) / 100;
    }
    return 0;
  }
  if (objective === "BOOKINGS") {
    const ticket = assets?.bookingServiceValue ?? 60;
    const showUp = assets?.showUpRate ?? 75;
    const valore = ticket * (showUp / 100);
    return Math.round(valore * (1 - margine / 100) * 100) / 100;
  }
  const bench = getBenchmarkForNiche(
    assets?.settore ?? campagna.settore ?? settore,
    assets?.citta ?? campagna.citta,
  );
  return bench.cplOptimal;
}

function badgeVerdetto(verdetto: VerdettoScreenshot): {
  label: string;
  className: string;
} {
  switch (verdetto) {
    case "ottimo":
      return {
        label: "Ottimo — sostenibile con margine",
        className: "bg-[#E8F5EE] text-[#2D6A4A] border-[#B7E4C7]",
      };
    case "in_target":
      return {
        label: "In target — dentro la soglia",
        className: "bg-[#FFF6E5] text-[#9A6700] border-[#F5D78E]",
      };
    case "fuori_target":
      return {
        label: "Fuori target — azione richiesta",
        className: "bg-[#FDEDED] text-[#B42318] border-[#F5C2C2]",
      };
    default:
      return {
        label: "Dati insufficienti — attendi apprendimento",
        className: "bg-[#EEF0F3] text-[#5A6578] border-[#D8DCE3]",
      };
  }
}

function etichettaCosto(objective: CampagnaObjective): string {
  return objective === "ECOMMERCE" || objective === "RETARGETING"
    ? "CPA"
    : "CPL/CPA";
}

export default function RisultatiPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [campagne, setCampagne] = useState<SavedCampaign[]>([]);
  const [campagnaId, setCampagnaId] = useState<string>("");
  const [targetCpl, setTargetCpl] = useState<string>("45");
  const [giorniAttiva, setGiorniAttiva] = useState<string>("5");
  const [settore, setSettore] = useState("");
  const [obiettivo, setObiettivo] = useState<CampagnaObjective>("LEADS");
  const [nomeCliente, setNomeCliente] = useState("");
  const [nomeCampagna, setNomeCampagna] = useState("");
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [trascinando, setTrascinando] = useState(false);
  const [analisi, setAnalisi] = useState<ScreenshotAnalysisResult | null>(
    null,
  );
  const [mockInfo, setMockInfo] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [passoCaricamento, setPassoCaricamento] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [storico, setStorico] = useState<SavedCampaignResult[]>([]);

  const campagnaSelezionata = useMemo(
    () => campagne.find((c) => c.id === campagnaId) ?? null,
    [campagne, campagnaId],
  );

  useEffect(() => {
    setCampagne(getCampaigns());
    setStorico(getSavedCampaignResults());
  }, []);

  useEffect(() => {
    if (!campagnaSelezionata) return;
    const assets = leggiAssetCampagnaLocale(campagnaSelezionata.id);
    setNomeCliente(campagnaSelezionata.nomeCliente);
    setNomeCampagna(
      campagnaSelezionata.nomeCampagna || campagnaSelezionata.nomeCliente,
    );
    setSettore(assets?.settore ?? campagnaSelezionata.settore ?? "");
    setObiettivo(
      normalizzaObjective(
        assets?.objective ?? campagnaSelezionata.objective,
      ),
    );
    const stimato = stimaTargetCpl(
      campagnaSelezionata,
      assets?.settore ?? campagnaSelezionata.settore ?? "",
      assets?.citta ?? campagnaSelezionata.citta,
    );
    setTargetCpl(stimato > 0 ? String(stimato) : "");
    const giorni = giorniAttiviDaCampagna({
      id: campagnaSelezionata.id,
      nomeCliente: campagnaSelezionata.nomeCliente,
      iniziali: "??",
      stato: "",
      giudizio: "Ancora presto",
      dataLancio: campagnaSelezionata.dataCreazione,
    });
    setGiorniAttiva(String(Math.max(giorni, 1)));
  }, [campagnaSelezionata]);

  function gestisciFile(file: File | undefined) {
    if (!file) return;
    const ok =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp";
    if (!ok) {
      setErrore("Carica un file JPG, PNG o WebP.");
      return;
    }
    setErrore(null);
    setSalvato(false);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setAnteprima(dataUrl);
      setImageBase64(dataUrl);
      setAnalisi(null);
      setMockInfo(null);
    };
    reader.readAsDataURL(file);
  }

  async function analizza() {
    if (!imageBase64) {
      setErrore("Carica uno screenshot prima di analizzare.");
      return;
    }
    const target = Number(targetCpl);
    if (!Number.isFinite(target) || target <= 0) {
      setErrore("Inserisci un CPL/CPA massimo sostenibile valido.");
      return;
    }

    setCaricamento(true);
    setErrore(null);
    setSalvato(false);
    setAnalisi(null);
    setMockInfo(null);
    setPassoCaricamento(0);

    const timer = window.setInterval(() => {
      setPassoCaricamento((p) => Math.min(p + 1, PASSI_CARICAMENTO.length - 1));
    }, 900);

    try {
      const res = await fetch("/api/analyze-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          targetCpl: target,
          obiettivo,
          settore,
          giorniAttiva: Number(giorniAttiva) || 5,
          nomeCampagna,
          nomeCliente,
        }),
      });

      const data = (await res.json()) as ScreenshotAnalysisResult & {
        error?: string;
        _mock?: boolean;
        _motivo?: string;
      };

      if (!res.ok) {
        throw new Error(
          messaggioAiUserFacing(
            data.error,
            "Non siamo riusciti a generare il contenuto. Riprova.",
          ),
        );
      }

      const { _mock, _motivo, error: _err, ...analisiPulita } = data;
      setAnalisi(analisiPulita as ScreenshotAnalysisResult);
      if (_mock && _motivo) setMockInfo(_motivo);
    } catch (e) {
      setErrore(
        messaggioAiUserFacing(
          e instanceof Error ? e.message : null,
          "Analisi non riuscita. Riprova.",
        ),
      );
    } finally {
      window.clearInterval(timer);
      setCaricamento(false);
      setPassoCaricamento(0);
    }
  }

  function salvaDiagnosi() {
    if (!analisi) return;
    const record = saveCampaignResult({
      campagnaId: campagnaId || null,
      nomeCampagna: nomeCampagna || "Campagna senza nome",
      nomeCliente: nomeCliente || "Cliente",
      obiettivo,
      settore,
      targetCpl: Number(targetCpl) || 45,
      giorniAttiva: Number(giorniAttiva) || 5,
      analisi,
    });
    setStorico(getSavedCampaignResults());
    setSalvato(true);
    window.setTimeout(() => setSalvato(false), 2500);
    return record;
  }

  const badge = analisi ? badgeVerdetto(analisi.verdetto) : null;
  const targetNum = Number(targetCpl) || 0;
  const sottoSoglia =
    analisi && targetNum > 0 && analisi.costoPerRisultato <= targetNum;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Post-lancio
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)] sm:text-3xl">
          Diagnosi Post-Lancio &amp; Scanner Risultati
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          Carica lo screenshot del tuo Meta Ads Manager per verificare la
          sostenibilità reale e ricevere le azioni correttive dall&apos;AI.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-5">
          <div className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-sm font-medium text-[var(--ink)]">
              Campagna di riferimento
            </h2>
            <div className="mt-4 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  Seleziona campagna salvata
                </span>
                <select
                  value={campagnaId}
                  onChange={(e) => setCampagnaId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Inserimento manuale —</option>
                  {campagne.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeCampagna || c.nomeCliente} ·{" "}
                      {etichettaObiettivo(c.objective)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                  {obiettivo === "ECOMMERCE"
                    ? "CPA Max (Break-Even) (€)"
                    : "CPL / CPA massimo sostenibile (€)"}
                </span>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={targetCpl}
                  onChange={(e) => setTargetCpl(e.target.value)}
                  className={inputClass}
                  placeholder={
                    obiettivo === "ECOMMERCE"
                      ? "Soglia salvata al lancio"
                      : undefined
                  }
                />
                {obiettivo === "ECOMMERCE" &&
                campagnaSelezionata &&
                !(Number(targetCpl) > 0) ? (
                  <p className="mt-1.5 text-xs text-[#C26A0A]">
                    CPA Max non disponibile per questa campagna. Dati economici
                    incompleti — usa la soglia salvata al lancio oppure
                    inseriscila manualmente solo se la conosci.
                  </p>
                ) : null}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                    Giorni attiva
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={giorniAttiva}
                    onChange={(e) => setGiorniAttiva(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--ink-muted)]">
                    Settore
                  </span>
                  <input
                    type="text"
                    value={settore}
                    onChange={(e) => setSettore(e.target.value)}
                    placeholder="Es. Dentista"
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          </div>

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
            className={`flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius)] border-2 border-dashed p-6 text-center transition-colors ${
              trascinando
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-white shadow-[var(--shadow-soft)] hover:border-[var(--accent-muted)]"
            }`}
          >
            {anteprima ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={anteprima}
                alt="Anteprima screenshot Meta Ads Manager"
                className="max-h-64 w-full rounded-xl object-contain"
              />
            ) : (
              <>
                <ImagePlus
                  className="h-10 w-10 text-[var(--accent)]"
                  strokeWidth={1.5}
                />
                <p className="mt-3 text-sm font-medium text-[var(--ink)]">
                  Trascina lo screenshot di Ads Manager
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  JPG, PNG o WebP · vista campagna o ad set
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
            onClick={() => void analizza()}
            disabled={caricamento || !imageBase64}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {caricamento ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            )}
            {caricamento ? "Analisi in corso…" : "Analizza con AI"}
          </button>

          {caricamento ? (
            <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--accent)]">
                {PASSI_CARICAMENTO[passoCaricamento]}
              </p>
              <div className="mt-2 flex gap-1">
                {PASSI_CARICAMENTO.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i <= passoCaricamento
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--accent)]/25"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {errore ? (
            <p className="text-sm text-[#B42318]">{errore}</p>
          ) : null}
          {mockInfo ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Modalità demo: {mockInfo}
            </p>
          ) : null}
        </section>

        <section className="lg:col-span-7">
          {!analisi ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
              <p className="max-w-sm text-sm text-[var(--ink-muted)]">
                Carica uno screenshot e avvia l&apos;analisi: qui compariranno
                KPI, verdetto economico e le 3 azioni da fare su Meta Ads.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Spesa totale",
                    valore: `${analisi.spesaTotale.toFixed(2)}€`,
                  },
                  {
                    label: "Risultati",
                    valore: `${analisi.risultati} · ${analisi.tipoRisultato}`,
                  },
                  {
                    label: `${etichettaCosto(obiettivo)} reale vs soglia`,
                    valore: `${analisi.costoPerRisultato.toFixed(2)}€ / ${targetNum.toFixed(2)}€`,
                    accent: sottoSoglia,
                  },
                  {
                    label: "CTR · Frequenza",
                    valore: `${analisi.ctr}% · ${analisi.frequenza}x`,
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-[var(--radius)] bg-white p-4 shadow-[var(--shadow-soft)]"
                  >
                    <p className="text-xs text-[var(--ink-muted)]">
                      {kpi.label}
                    </p>
                    <p
                      className={`mt-1 text-sm font-medium leading-snug text-[var(--ink)] ${
                        kpi.accent ? "text-[#2D6A4A]" : ""
                      }`}
                    >
                      {kpi.valore}
                    </p>
                  </div>
                ))}
              </div>

              {badge ? (
                <div
                  className={`rounded-[var(--radius)] border px-5 py-4 ${badge.className}`}
                >
                  <div className="flex items-start gap-3">
                    {analisi.verdetto === "fuori_target" ? (
                      <TrendingDown className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <TrendingUp className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{badge.label}</p>
                      <p className="mt-2 text-sm leading-relaxed">
                        {analisi.spiegazioneSostenibilita}
                      </p>
                      <p className="mt-2 text-xs opacity-80">
                        Fase apprendimento:{" "}
                        {analisi.faseApprendimento === "in_corso"
                          ? "In corso"
                          : analisi.faseApprendimento === "limitata"
                            ? "Limitata (frequenza alta)"
                            : "Completata"}
                        {analisi.roas != null
                          ? ` · ROAS ${analisi.roas}x`
                          : ""}
                        {` · CPM ${analisi.cpm.toFixed(2)}€`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
                <h3 className="text-sm font-medium text-[var(--ink)]">
                  Cosa fare adesso su Meta Ads
                </h3>
                <ol className="mt-4 space-y-3">
                  {analisi.azioniConsigliate.map((azione, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm leading-relaxed text-[var(--ink)]"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
                        {i + 1}
                      </span>
                      {azione}
                    </li>
                  ))}
                </ol>
              </div>

              <button
                type="button"
                onClick={() => salvaDiagnosi()}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                {salvato ? (
                  <CheckCircle2 className="h-4 w-4 text-[#3D8B57]" />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.75} />
                )}
                {salvato
                  ? "Diagnosi salvata nello storico"
                  : "Salva Diagnosi nello Storico Cliente"}
              </button>
            </div>
          )}
        </section>
      </div>

      {storico.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-[var(--ink)]">
            Diagnosi recenti
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {storico.slice(0, 5).map((item) => (
              <li
                key={item.id}
                className="rounded-[var(--radius)] bg-white px-4 py-3 text-sm shadow-[var(--shadow-soft)]"
              >
                <span className="font-medium text-[var(--ink)]">
                  {item.nomeCampagna}
                </span>
                <span className="text-[var(--ink-muted)]">
                  {" "}
                  · {item.analisi.costoPerRisultato.toFixed(2)}€ vs soglia{" "}
                  {item.targetCpl}€ ·{" "}
                  {new Date(item.salvatoIl).toLocaleDateString("it-IT")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-lg font-medium text-[var(--ink)]">
          Benchmark di settore — mercato italiano
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          Range storici di riferimento su Meta Ads in Italia. Non sono promesse
          di performance: servono a contestualizzare CPL/CPA reali.
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
