"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";

const MAX_REVISIONI = 3;
const TREND_CHECK_DAYS = 30;

export function DashboardHome() {
  const { apriModaleCampagna } = useOnboardingCampagna();
  const { user } = useAuth();
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

      if (user?.id) {
        try {
          const bundle = await loadMetaMondayBundle(user.id);
          const linked = collectActiveLinkedNativeIds(bundle.rows);
          setLinkedNativeIds(linked);
          setMetaItems(
            bundle.rows.map((row) => {
              const t = bundle.trends.get(row.id);
              return buildMetaAttentionItem({
                row,
                trendDirection: t?.direction ?? null,
                trendLevel: t?.level,
              });
            }),
          );
        } catch (metaErr) {
          logErroreSupabaseDev("dashboard_home_meta", metaErr);
          setMetaItems([]);
          setLinkedNativeIds(new Set());
        }
      } else {
        setMetaItems([]);
        setLinkedNativeIds(new Set());
      }
    } catch (e) {
      logErroreSupabaseDev("dashboard_home", e);
      setErrore(messaggioErroreSupabase(e, "lista"));
      setCampagne([]);
      setUltimi(new Map());
      setChecksSettimana([]);
      setChecksTrend([]);
      setMetaItems([]);
      setLinkedNativeIds(new Set());
    } finally {
      setCaricamento(false);
    }
  }, [user?.id]);

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

  const hasAnyWork = campagne.length > 0 || metaItems.length > 0;

  return (
    <main className="mx-auto w-full max-w-[880px] pb-6">
      <header>
        <h1 className="text-[26px] font-medium tracking-tight text-[var(--ink)] sm:text-[30px]">
          Buongiorno
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)] sm:text-[15px]">
          Sai dove guardare oggi.
        </p>
      </header>

      {caricamento ? (
        <p className="mt-8 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : errore ? (
        <p className="mt-8 text-sm text-[#7a3d58]">{errore}</p>
      ) : !hasAnyWork ? (
        <section className="aff-panel-white mt-6 px-5 py-8">
          <p className="text-base font-medium text-[var(--ink)]">
            Non hai ancora lavori aperti.
          </p>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
            Crea una campagna per vedere qui su cosa concentrarti.
          </p>
          <button
            type="button"
            onClick={apriModaleCampagna}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Crea una campagna
          </button>
        </section>
      ) : (
        <>
          <MondayControlRoomSection summary={monday} />

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
                  <p className="mt-2 text-sm font-medium text-[var(--ink)]">
                    {revisioni.length === 1
                      ? "1 revisione da gestire"
                      : `${revisioni.length} revisioni da gestire`}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {revisioni.slice(0, MAX_REVISIONI).map((campagna) => (
                      <li key={campagna.id}>
                        <Link
                          href={`/campagne/${campagna.id}`}
                          className="block rounded-[12px] bg-[var(--lavender-muted)]/60 px-2.5 py-2 hover:opacity-90"
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
                  <span className="font-medium tabular-nums">
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
      )}
    </main>
  );
}
