"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  LayoutDashboard,
  LineChart,
  Link2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { Campagna } from "@/types/campagne";
import { leggiCampagneDaSupabase } from "@/lib/campagne-db";
import {
  leggiChecksUtenteDal,
  leggiUltimiChecksUtente,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import {
  aggregaAttivitaSettimana,
  campagneInRevisione,
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
import { AllyFeatureCard } from "@/components/shell/AllyFeatureCard";
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
  startMetaImportHref,
} from "@/lib/meta-import-client";

const MAX_REVISIONI = 3;
const TREND_CHECK_DAYS = 30;
const STROKE_NAV = 1.75;

const QUICK_ACTIONS = [
  {
    href: "/home",
    title: "Control Room",
    body: "Le campagne che richiedono la tua attenzione.",
    icon: LayoutDashboard,
    tone: 1 as const,
  },
  {
    href: "/risultati",
    title: "Monitoraggio",
    body: "Performance, soglie e trend.",
    icon: LineChart,
    tone: 2 as const,
  },
  {
    href: "/risultati",
    title: "Diagnosi",
    body: "Perché una campagna viene segnalata.",
    icon: Sparkles,
    tone: 3 as const,
  },
  {
    href: "/notifiche",
    title: "Notifiche",
    body: "I cambiamenti importanti.",
    icon: Bell,
    tone: 4 as const,
  },
] as const;

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

  /*
   * Layer A branch intent from URL only on Home:
   * ?setup=import|plan → explicit branch; bare /home → NONE (never inherit Meta/draft).
   */
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
        leggiCampagneDaSupabase(),
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
      /*
       * Home derivation uses URL branch only. Do not wipe sessionStorage here —
       * chooseMeta may have just written "meta" before navigating to the client.
       */
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

  const monday = useMemo(() => {
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
    return buildMondayControlRoom(merged);
  }, [campagne, ultimi, checksByCampaign, metaItems, linkedNativeIds]);

  const revisioni = useMemo(
    () => campagneInRevisione(campagne),
    [campagne],
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
      const preferred =
        setupSignals?.hasDbClient && setupSignals.primaryClientId
          ? setupSignals.primaryClientId
          : null;
      const href = await startMetaImportHref(preferred);
      if (!preferred) {
        setSetupSignals((prev) =>
          prev
            ? {
                ...prev,
                hasClient: true,
                hasDbClient: true,
                pathPreference: "meta",
              }
            : prev,
        );
      } else {
        setSetupSignals((prev) =>
          prev ? { ...prev, pathPreference: "meta" } : prev,
        );
      }
      router.push(href);
    } catch (e) {
      logErroreSupabaseDev("dashboard_home_meta_import_client", e);
      setErrore(
        messaggioErroreSupabase(e, "generico") ||
          "Impossibile preparare il collegamento Meta.",
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

  // Search/quick cards once the workspace is unlocked (first real campaign).
  const showSearchShell = Boolean(
    isActiveWorkspace && guidance?.showHeroTools,
  );
  const showQuickCards = Boolean(
    isActiveWorkspace && guidance?.showQuickActions,
  );
  const heroBadge = guidance?.heroBadge ?? "Ciao, sono Ally";
  const heroTitle =
    guidance?.heroTitle ??
    (isActiveWorkspace
      ? "Capisci cosa conta oggi."
      : "Come vuoi iniziare?");
  const heroSubtitle =
    guidance?.heroSubtitle ??
    (isActiveWorkspace
      ? "Controlla le campagne che richiedono attenzione e il prossimo passo da fare."
      : "Importa le campagne che gestisci già oppure pianificane una nuova.");

  return (
    <main className="mx-auto w-full max-w-[1040px] pb-12">
      <section
        className={[
          "relative text-center",
          showSetup
            ? "pt-8 sm:pt-10 lg:pt-12"
            : "pt-10 sm:pt-14 lg:pt-16",
        ].join(" ")}
      >
        <div className="aff-hero-glow" aria-hidden />

        <div className="relative z-[1] flex flex-col items-center">
          <div className="aff-ally-mark" aria-hidden>
            A
          </div>

          <p className="mt-6 inline-flex items-center rounded-full border border-[var(--border)] bg-white/90 px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--ink)]">
            {heroBadge}
          </p>
          <h2 className="mt-6 text-[clamp(38px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.035em] text-[var(--ink)]">
            {heroTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
            {heroSubtitle}
          </p>

          {showSearchShell ? (
            <div className="mx-auto mt-10 w-full max-w-[960px]">
              <div className="relative w-full text-left">
                <div className="flex min-h-[180px] w-full flex-col rounded-[14px] border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
                  <div className="relative flex-1 px-5 pt-6 sm:px-6 sm:pt-7">
                    <Search
                      className="pointer-events-none absolute left-5 top-7 h-[18px] w-[18px] text-[var(--ink-muted)] sm:left-6 sm:top-8"
                      strokeWidth={STROKE_NAV}
                      aria-hidden
                    />
                    <input
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cerca un cliente o una campagna"
                      className="w-full bg-transparent py-1 pl-8 text-[15px] font-medium tracking-[-0.01em] text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--ink-subtle)] sm:pl-9"
                      aria-label="Cerca un cliente o una campagna"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3.5 sm:px-5">
                    <button
                      type="button"
                      className="aff-tool-chip"
                      onClick={() => searchRef.current?.focus()}
                    >
                      <Search
                        className="h-3.5 w-3.5"
                        strokeWidth={STROKE_NAV}
                      />
                      Cerca
                    </button>
                    <Link href="/home" className="aff-tool-chip">
                      <LayoutDashboard
                        className="h-3.5 w-3.5"
                        strokeWidth={STROKE_NAV}
                      />
                      Control Room
                    </Link>
                    <Link href="/risultati" className="aff-tool-chip">
                      <LineChart
                        className="h-3.5 w-3.5"
                        strokeWidth={STROKE_NAV}
                      />
                      Risultati
                    </Link>
                    <Link
                      href="/impostazioni/integrazioni"
                      className="aff-tool-chip"
                    >
                      <Link2
                        className="h-3.5 w-3.5"
                        strokeWidth={STROKE_NAV}
                      />
                      Importa Meta
                    </Link>
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
                  </div>
                </div>

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

              <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {showQuickCards
                  ? QUICK_ACTIONS.map((card) => (
                      <AllyFeatureCard
                        key={card.title}
                        href={card.href}
                        title={card.title}
                        body={card.body}
                        icon={card.icon}
                        tone={card.tone}
                      />
                    ))
                  : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {caricamento ? (
        <p className="mt-16 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : errore ? (
        <p className="mt-16 text-sm text-[#7a3d58]">{errore}</p>
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
              <div
                className={
                  showSetup || showWorkspaceConfig ? "mt-10" : "mt-16"
                }
              >
                <MondayControlRoomSection summary={monday} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <section className="aff-panel-white min-w-0 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--ink-muted)]">
                      Revisioni cliente
                    </p>
                    {revisioni.length > MAX_REVISIONI ? (
                      <Link
                        href="/campagne"
                        className="text-xs font-medium text-[var(--primary)] hover:opacity-80"
                      >
                        Vedi tutte
                      </Link>
                    ) : null}
                  </div>
                  {revisioni.length === 0 ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
                      Nessuna revisione in sospeso.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
                        {revisioni.length === 1
                          ? "1 revisione da gestire"
                          : `${revisioni.length} revisioni da gestire`}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {revisioni.slice(0, MAX_REVISIONI).map((campagna) => (
                          <li key={campagna.id}>
                            <Link
                              href={`/campagne/${campagna.id}`}
                              className="block rounded-[10px] bg-[var(--surface-hover)] px-2.5 py-2 hover:opacity-90"
                            >
                              <p className="text-sm font-medium leading-snug text-[var(--ink)]">
                                {campagna.nomeCliente}
                              </p>
                              <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                                {nomeCampagnaCard(campagna)}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>

                <section className="aff-panel-white min-w-0 p-4">
                  <p className="text-[13px] font-medium text-[var(--ink-muted)]">
                    Attività recente
                  </p>
                  {attivita.totaleCheck === 0 ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
                      Nessun controllo negli ultimi 7 giorni.
                    </p>
                  ) : (
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
                  )}
                  <Link
                    href="/campagne"
                    className="mt-3 inline-flex text-xs font-medium text-[var(--primary)] hover:opacity-80"
                  >
                    Vedi tutte le campagne
                  </Link>
                </section>
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
