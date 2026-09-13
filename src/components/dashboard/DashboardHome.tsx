"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, Plus, Search } from "lucide-react";
import type { Campagna } from "@/types/campagne";
import { leggiInventarioCampagneNative } from "@/lib/campagne-inventory";
import {
  leggiChecksUtenteDal,
  leggiUltimiChecksUtente,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import {
  aggregaAttivitaSettimana,
  isoInizioFinestraGiorni,
} from "@/lib/dashboard-home";
import {
  applyLinkedCampaignSuppression,
  buildMetaAttentionItem,
  buildMondayControlRoom,
  buildNativeAttentionItem,
  collectActiveLinkedNativeIds,
  type ControlRoomAttentionItem,
} from "@/lib/monday-control-room";
import { loadMetaMondayBundle } from "@/lib/meta/monday-meta-loader";
import { nomeCampagnaCard } from "@/components/risultati/ControlRoomOverview";
import { MondayControlRoomSection } from "@/components/dashboard/MondayControlRoomSection";
import { HomeAskAllyBar } from "@/components/dashboard/HomeAskAllyBar";
import { HomeSetupPanel } from "@/components/dashboard/HomeSetupPanel";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import {
  buildAllySetupGuidance,
  isFirstRunOnboardingPhase,
  readSetupPathPreference,
  writeSetupPathPreference,
  type AllySetupGuidance,
  type AllySetupSignals,
} from "@/lib/ally-setup";
import { loadAllySetupSignals } from "@/lib/ally-setup-loader";
import { notifyAllySetupChanged } from "@/lib/ally-setup-shell-loader";
import {
  applyMetaImportStart,
  readBearerToken,
  startMetaImportFlow,
} from "@/lib/meta-import-client";
import {
  countWorkspaceCampaigns,
} from "@/lib/ally-oggi/workspace-summary";

const TREND_CHECK_DAYS = 30;
const STROKE_NAV = 1.75;

export function DashboardHome() {
  const { apriModaleCampagna } = useOnboardingCampagna();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [campagne, setCampagne] = useState<Campagna[]>([]);
  const [ultimi, setUltimi] = useState<Map<string, CampaignCheck>>(new Map());
  const [checksSettimana, setChecksSettimana] = useState<CampaignCheck[]>([]);
  const [checksTrend, setChecksTrend] = useState<CampaignCheck[]>([]);
  const [metaItems, setMetaItems] = useState<ControlRoomAttentionItem[]>([]);
  const [linkedNativeIds, setLinkedNativeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [setupSignals, setSetupSignals] = useState<AllySetupSignals | null>(
    null,
  );
  const [showFirstClientForm, setShowFirstClientForm] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    const setup = searchParams.get("setup");
    if (setup === "import") {
      writeSetupPathPreference("meta");
      setSetupSignals((prev) =>
        prev ? { ...prev, pathPreference: "meta" } : prev,
      );
      return;
    }
    if (setup === "plan") {
      writeSetupPathPreference("native");
      setSetupSignals((prev) =>
        prev ? { ...prev, pathPreference: "native" } : prev,
      );
      setShowFirstClientForm(true);
      return;
    }
    writeSetupPathPreference(null);
    setSetupSignals((prev) =>
      prev ? { ...prev, pathPreference: null } : prev,
    );
    setShowFirstClientForm(false);
  }, [searchParams]);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const da = isoInizioFinestraGiorni(7);
      const daTrend = isoInizioFinestraGiorni(TREND_CHECK_DAYS);
      const [lista, mappa, settimana, trendChecks] = await Promise.all([
        leggiInventarioCampagneNative(),
        leggiUltimiChecksUtente(),
        leggiChecksUtenteDal(da),
        leggiChecksUtenteDal(daTrend),
      ]);
      setCampagne(lista);
      setUltimi(mappa);
      setChecksSettimana(settimana);
      setChecksTrend(trendChecks);

      let nextMeta: ControlRoomAttentionItem[] = [];
      let nextLinked = new Set<string>();
      if (user?.id) {
        try {
          const bundle = await loadMetaMondayBundle(user.id);
          nextLinked = collectActiveLinkedNativeIds(bundle.rows);
          nextMeta = bundle.rows.map((row) => {
            const t = bundle.trends.get(row.id);
            return buildMetaAttentionItem({
              row,
              trendDirection: t?.direction ?? null,
              trendLevel: t?.level,
            });
          });
          setLinkedNativeIds(nextLinked);
          setMetaItems(nextMeta);
        } catch (metaErr) {
          logErroreSupabaseDev("dashboard_home_meta", metaErr);
          setMetaItems([]);
          setLinkedNativeIds(new Set());
          nextMeta = [];
          nextLinked = new Set();
        }
      } else {
        setMetaItems([]);
        setLinkedNativeIds(new Set());
      }

      const checksByCampaignTmp = new Map<string, CampaignCheck[]>();
      for (const c of trendChecks) {
        const list = checksByCampaignTmp.get(c.campaignId) ?? [];
        list.push(c);
        checksByCampaignTmp.set(c.campaignId, list);
      }
      const nativeItems = lista
        .filter((c) => c.id)
        .map((campagna) =>
          buildNativeAttentionItem({
            campagna,
            check: mappa.get(campagna.id) ?? null,
            checksForTrend: checksByCampaignTmp.get(campagna.id) ?? [],
          }),
        );
      const merged = applyLinkedCampaignSuppression(
        [...nativeItems, ...nextMeta],
        nextLinked,
      );

      const signals = await loadAllySetupSignals({
        hasNativeCampaign: lista.length > 0,
        hasMetaCampaign: nextMeta.length > 0,
        attentionItems: merged,
      });
      const setup = searchParams.get("setup");
      const pathPreference =
        setup === "import" ? "meta" : setup === "plan" ? "native" : null;
      setSetupSignals({ ...signals, pathPreference });
      notifyAllySetupChanged();
    } catch (e) {
      logErroreSupabaseDev("dashboard_home", e);
      setErrore(messaggioErroreSupabase(e, "lista"));
      setCampagne([]);
      setUltimi(new Map());
      setChecksSettimana([]);
      setChecksTrend([]);
      setMetaItems([]);
      setLinkedNativeIds(new Set());
      setSetupSignals(null);
      notifyAllySetupChanged();
    } finally {
      setCaricamento(false);
    }
  }, [user?.id, searchParams]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const checksByCampaign = useMemo(() => {
    const m = new Map<string, CampaignCheck[]>();
    for (const c of checksTrend) {
      const list = m.get(c.campaignId) ?? [];
      list.push(c);
      m.set(c.campaignId, list);
    }
    return m;
  }, [checksTrend]);

  const mondayBundle = useMemo(() => {
    const nativeItems = campagne
      .filter((c) => c.id)
      .map((campagna) =>
        buildNativeAttentionItem({
          campagna,
          check: ultimi.get(campagna.id) ?? null,
          checksForTrend: checksByCampaign.get(campagna.id) ?? [],
        }),
      );
    const merged = applyLinkedCampaignSuppression(
      [...nativeItems, ...metaItems],
      linkedNativeIds,
    );
    return {
      merged,
      summary: buildMondayControlRoom(merged),
    };
  }, [campagne, ultimi, checksByCampaign, metaItems, linkedNativeIds]);
  const monday = mondayBundle.summary;

  const totalWorkspaceCampaigns = useMemo(
    () =>
      countWorkspaceCampaigns({
        nativeCampaigns: campagne,
        metaCampaignCount: metaItems.filter((i) => i.source === "META").length,
        linkedNativeIds,
      }),
    [campagne, metaItems, linkedNativeIds],
  );

  const attivita = useMemo(
    () => aggregaAttivitaSettimana(checksSettimana),
    [checksSettimana],
  );

  const guidance: AllySetupGuidance | null = useMemo(() => {
    if (!setupSignals) return null;
    return buildAllySetupGuidance(setupSignals);
  }, [setupSignals]);

  const isActiveWorkspace = Boolean(
    guidance && !isFirstRunOnboardingPhase(guidance.phase),
  );
  const showSetup = Boolean(
    guidance && isFirstRunOnboardingPhase(guidance.phase),
  );
  const showWorkspaceConfig = Boolean(
    guidance &&
      !isFirstRunOnboardingPhase(guidance.phase) &&
      guidance.phase !== "ACTIVE_WORKSPACE" &&
      guidance.primaryLabel,
  );
  const showControlRoom = Boolean(
    guidance?.showControlRoom &&
      guidance.phase !== "CHOOSE_START_PATH" &&
      (campagne.length > 0 || metaItems.length > 0),
  );

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return campagne
      .filter((c) => {
        const nome = (c.nomeCampagna ?? "").toLowerCase();
        const cliente = (c.nomeCliente ?? "").toLowerCase();
        return nome.includes(q) || cliente.includes(q);
      })
      .slice(0, 5);
  }, [campagne, query]);

  async function chooseMeta() {
    if (importBusy) return;
    setImportBusy(true);
    setErrore(null);
    try {
      const token = await readBearerToken();
      if (!token) {
        setErrore("Sessione assente. Accedi di nuovo.");
        return;
      }
      const result = await startMetaImportFlow(null, token);
      setSetupSignals((prev) =>
        prev
          ? {
              ...prev,
              hasClient: true,
              hasDbClient: true,
              primaryClientId: result.clientId,
              pathPreference: "meta",
            }
          : prev,
      );
      applyMetaImportStart(result, (href) => router.push(href));
    } catch (e) {
      logErroreSupabaseDev("dashboard_home_meta_import_client", e);
      setErrore(
        messaggioErroreSupabase(e, "generico") ||
          (e instanceof Error
            ? e.message
            : "Impossibile preparare il collegamento Meta."),
      );
      writeSetupPathPreference(null);
    } finally {
      setImportBusy(false);
    }
  }

  function chooseNative() {
    writeSetupPathPreference("native");
    if (!setupSignals?.hasClient) {
      setSetupSignals((prev) =>
        prev ? { ...prev, pathPreference: "native" } : prev,
      );
      router.replace("/home?setup=plan");
      setShowFirstClientForm(true);
      return;
    }
    apriModaleCampagna();
  }

  function chooseContinueDraft() {
    const href = guidance?.resumeDraftHref;
    if (!href) return;
    writeSetupPathPreference("native");
    router.push(href);
  }

  function onPrimaryClick() {
    if (!guidance) return;
    if (
      guidance.primaryAction === "open_campaign_modal" ||
      guidance.secondaryAction === "open_campaign_modal"
    ) {
      chooseNative();
    }
  }

  async function onCreateClientDone(client: { id: string; name: string }) {
    setShowFirstClientForm(false);
    const preferNative =
      setupSignals?.pathPreference === "native" ||
      readSetupPathPreference() === "native";
    setSetupSignals((prev) =>
      prev
        ? {
            ...prev,
            hasClient: true,
            hasDbClient: true,
            primaryClientId: client.id,
            primaryClientName: client.name,
          }
        : prev,
    );
    await carica();
    if (preferNative) {
      apriModaleCampagna();
    }
  }

  const showSearchShell = Boolean(
    isActiveWorkspace && guidance?.showHeroTools,
  );

  return (
    <main
      className={[
        "mx-auto w-full pb-12",
        isActiveWorkspace ? "max-w-[840px]" : "max-w-[1040px]",
      ].join(" ")}
    >
      <section
        className={[
          "relative",
          showSetup
            ? "pt-8 text-center sm:pt-10 lg:pt-12"
            : isActiveWorkspace
              ? "pt-4 sm:pt-5"
              : "pt-10 text-center sm:pt-14 lg:pt-16",
        ].join(" ")}
      >
        {!isActiveWorkspace ? <div className="aff-hero-glow" aria-hidden /> : null}

        <div
          className={[
            "relative z-[1] flex flex-col",
            isActiveWorkspace ? "items-stretch" : "items-center text-center",
          ].join(" ")}
        >
          {!isActiveWorkspace ? (
            <>
              <div className="aff-ally-mark" aria-hidden>
                A
              </div>
              <p className="mt-6 inline-flex items-center rounded-full border border-[var(--border)] bg-white/90 px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--ink)]">
                {guidance?.heroBadge ?? "Ciao, sono Ally"}
              </p>
              <h2 className="mt-6 text-[clamp(38px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.035em] text-[var(--ink)]">
                {guidance?.heroTitle ?? "Come vuoi iniziare?"}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
                {guidance?.heroSubtitle ??
                  "Importa le campagne che gestisci già oppure pianificane una nuova."}
              </p>
            </>
          ) : null}

          {showSearchShell ? (
            <div
              className={[
                "w-full",
                isActiveWorkspace ? "mt-0" : "mx-auto mt-10 max-w-[960px]",
              ].join(" ")}
            >
              <div className="relative w-full text-left">
                {isActiveWorkspace ? (
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                        strokeWidth={STROKE_NAV}
                        aria-hidden
                      />
                      <input
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cerca cliente o campagna"
                        className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-white/80 pl-9 pr-3 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)] focus-visible:border-[var(--primary)]/30"
                        aria-label="Cerca un cliente o una campagna"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="aff-tool-chip"
                        onClick={apriModaleCampagna}
                      >
                        <Plus
                          className="h-3.5 w-3.5"
                          strokeWidth={STROKE_NAV}
                        />
                        Nuova campagna
                      </button>
                      <button
                        type="button"
                        className="aff-tool-chip"
                        onClick={() => void chooseMeta()}
                        disabled={importBusy}
                      >
                        <Link2
                          className="h-3.5 w-3.5"
                          strokeWidth={STROKE_NAV}
                        />
                        {importBusy ? "Preparazione…" : "Importa da Meta"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full flex-col rounded-[12px] border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
                    <div className="relative px-4 py-3 sm:px-4 sm:py-3.5">
                      <Search
                        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                        strokeWidth={STROKE_NAV}
                        aria-hidden
                      />
                      <input
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cerca un cliente o una campagna"
                        className="w-full bg-transparent py-1 pl-7 text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--ink-subtle)]"
                        aria-label="Cerca un cliente o una campagna"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 sm:px-4">
                      <button
                        type="button"
                        className="aff-tool-chip"
                        onClick={apriModaleCampagna}
                      >
                        <Plus
                          className="h-3.5 w-3.5"
                          strokeWidth={STROKE_NAV}
                        />
                        Nuova campagna
                      </button>
                      <button
                        type="button"
                        className="aff-tool-chip"
                        onClick={() => void chooseMeta()}
                        disabled={importBusy}
                      >
                        <Link2
                          className="h-3.5 w-3.5"
                          strokeWidth={STROKE_NAV}
                        />
                        {importBusy ? "Preparazione…" : "Importa da Meta"}
                      </button>
                    </div>
                  </div>
                )}

                {searchHits.length > 0 ? (
                  <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
                    {searchHits.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/campagne/${c.id}`}
                          className="block px-4 py-2.5 text-left hover:bg-[var(--surface-hover)]"
                        >
                          <p className="text-sm font-medium text-[var(--ink)]">
                            {c.nomeCliente}
                          </p>
                          <p className="text-[12px] text-[var(--ink-muted)]">
                            {nomeCampagnaCard(c)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {caricamento ? (
        <p className="mt-10 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : errore ? (
        <p className="mt-10 text-sm text-[#7a3d58]">{errore}</p>
      ) : (
        <>
          {(showSetup || showWorkspaceConfig) && guidance ? (
            <HomeSetupPanel
              guidance={guidance}
              showForm={showFirstClientForm}
              onShowForm={() => setShowFirstClientForm(true)}
              onCreateClientDone={(c) => void onCreateClientDone(c)}
              onChooseMeta={() => void chooseMeta()}
              onChooseNative={chooseNative}
              onContinueDraft={chooseContinueDraft}
              onPrimaryClick={onPrimaryClick}
            />
          ) : null}

          {showControlRoom ? (
            <>
              {isActiveWorkspace ? (
                <div className="mt-5 sm:mt-6">
                  <HomeAskAllyBar
                    attentionItems={mondayBundle.merged}
                    nativeCampaigns={campagne}
                    metaItems={metaItems}
                    linkedNativeIds={linkedNativeIds}
                    enabled={isActiveWorkspace}
                  />
                </div>
              ) : null}

              <div
                className={
                  showSetup || showWorkspaceConfig ? "mt-8" : "mt-5 sm:mt-6"
                }
              >
                <MondayControlRoomSection
                  summary={monday}
                  totalWorkspaceCampaigns={totalWorkspaceCampaigns}
                />
              </div>

              {attivita.totaleCheck > 0 ? (
                <section className="aff-panel-white mt-4 min-w-0 p-4">
                  <p className="text-[13px] font-medium text-[var(--ink-muted)]">
                    Attività recente
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink)]">
                    <span className="font-semibold tabular-nums">
                      {attivita.campagneControllate}
                    </span>
                    {attivita.campagneControllate === 1
                      ? " campagna controllata"
                      : " campagne controllate"}
                    {" negli ultimi 7 giorni"}
                    {attivita.totaleCheck !== attivita.campagneControllate
                      ? ` · ${attivita.totaleCheck} controlli`
                      : ""}
                  </p>
                  <Link
                    href="/campagne"
                    className="mt-3 inline-flex text-xs font-medium text-[var(--primary)] hover:opacity-80"
                  >
                    Vedi tutte le campagne
                  </Link>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
