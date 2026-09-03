"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Campagna } from "@/types/campagne";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import { leggiCampagneDaSupabase } from "@/lib/campagne-db";
import {
  leggiChecksUtenteDal,
  leggiUltimiChecksUtente,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import { formatDataCheck } from "@/lib/control-room";
import {
  aggregaAttivitaSettimana,
  campagneInRevisione,
  derivaLavoriAperti,
  etichettaAriaBarraAttivita,
  isoInizioFinestraGiorni,
  pillGestione,
  quotaAltezzaBarraAttivita,
  type GiornoAttivita,
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
import { LavoriAperti } from "@/components/dashboard/LavoriAperti";
import { MondayControlRoomSection } from "@/components/dashboard/MondayControlRoomSection";
import { StatoChip, type StatoChipKind } from "@/components/nuova-contatti/StatoChip";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { normalizzaObjective } from "@/types/campagne";

const MAX_GESTIONE = 5;
const MAX_REVISIONI = 2;
const TREND_CHECK_DAYS = 30;

const ALTEZZA_CHART_PX = 56;
const ALTEZZA_BARRA_VUOTA_PX = 5;

const STILE_BADGE: Record<StatoChipKind, string> = {
  ok: "bg-[var(--green-soft)] text-[#2d6a4a]",
  watch: "bg-[var(--yellow-soft)] text-[#6b5420]",
  critico: "bg-[#f8d5e2] text-[#7a3d58]",
  pending: "bg-[var(--lavender-muted)] text-[#5b4fa8]",
  info: "bg-[var(--primary-soft)] text-[var(--primary)]",
};

function BadgeDashboard({
  kind,
  label,
}: {
  kind: StatoChipKind;
  label: string;
}) {
  return (
    <span
      className={`inline-flex h-5 max-w-full shrink-0 items-center rounded-full px-2 text-[10px] font-medium leading-none ${STILE_BADGE[kind]}`}
    >
      {label}
    </span>
  );
}

function classeBarraAttivita(giorno: GiornoAttivita): string {
  if (giorno.isToday) return "bg-[var(--primary)]";
  if (giorno.count > 0) return "bg-[var(--accent-muted)]";
  return "bg-[var(--primary-soft)]";
}

function MiniChartAttivita({ giorni }: { giorni: GiornoAttivita[] }) {
  const max = Math.max(0, ...giorni.map((g) => g.count));
  return (
    <div className="mt-auto w-full min-w-0 pt-5">
      <div
        className="flex items-end gap-1 sm:gap-1.5"
        style={{ height: ALTEZZA_CHART_PX }}
      >
        {giorni.map((giorno) => {
          const label = etichettaAriaBarraAttivita(giorno.data, giorno.count);
          const quota = quotaAltezzaBarraAttivita(giorno.count, max);
          const scala = max <= 1 ? 0.62 : 1;
          const altezzaPx =
            giorno.count === 0
              ? ALTEZZA_BARRA_VUOTA_PX
              : Math.round(quota * ALTEZZA_CHART_PX * scala);
          return (
            <div
              key={giorno.chiave}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <span
                role="img"
                title={label}
                aria-label={label}
                className={`w-[9px] max-w-full rounded-full sm:w-[11px] ${classeBarraAttivita(giorno)}`}
                style={{ height: altezzaPx }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {giorni.map((giorno) => (
          <span
            key={`${giorno.chiave}-label`}
            className="min-w-0 flex-1 text-center text-[10px] font-medium leading-none text-[#6e6a7c]"
            aria-hidden
          >
            {giorno.lettera}
          </span>
        ))}
      </div>
    </div>
  );
}

function AvatarIniziali({ iniziali }: { iniziali: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-medium text-[var(--primary)]"
      aria-hidden
    >
      {iniziali}
    </span>
  );
}

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
  const gestione = campagne.slice(0, MAX_GESTIONE);
  const lavori = useMemo(
    () => derivaLavoriAperti(campagne, ultimi),
    [campagne, ultimi],
  );

  const hasAnyWork = campagne.length > 0 || metaItems.length > 0;

  return (
    <main className="mx-auto w-full max-w-[1400px] pb-6">
      <header>
        <h1 className="text-[26px] font-medium tracking-tight text-[var(--ink)] sm:text-[30px]">
          Buongiorno
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)] sm:text-[15px]">
          Questa è la situazione delle campagne che stai gestendo.
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
            Crea una campagna per vedere qui su cosa stai lavorando.
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

          {campagne.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
            <section className="aff-panel-white flex min-h-[15.5rem] min-w-0 flex-col p-4 sm:p-5">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                Attività
              </p>
              {attivita.totaleCheck === 0 ? (
                <div className="mt-4 space-y-1.5">
                  <p className="text-sm leading-relaxed text-[var(--ink)]">
                    Ancora nessun controllo questa settimana.
                  </p>
                  <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
                    I controlli compariranno qui man mano che aggiorni le
                    campagne.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-[26px] font-medium tabular-nums tracking-tight text-[var(--ink)]">
                    {attivita.campagneControllate}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-muted)]">
                    {attivita.campagneControllate === 1
                      ? "campagna controllata"
                      : "campagne controllate"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    negli ultimi 7 giorni
                  </p>
                  {attivita.totaleCheck !== attivita.campagneControllate ? (
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {attivita.totaleCheck}{" "}
                      {attivita.totaleCheck === 1
                        ? "controllo"
                        : "controlli"}
                    </p>
                  ) : null}
                  <MiniChartAttivita giorni={attivita.giorni} />
                </>
              )}
            </section>

            <section className="flex min-h-[15.5rem] min-w-0 flex-col rounded-[22px] bg-[var(--lavender-muted)] p-4 sm:p-5 md:col-span-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-[var(--primary)]">
                  Campagne in gestione
                </p>
                <Link
                  href="/campagne"
                  className="text-xs font-medium text-[var(--primary)] hover:opacity-80"
                >
                  Vedi tutte
                </Link>
              </div>
              <ul className="mt-3 space-y-1.5">
                {gestione.map((campagna) => {
                  const check = ultimi.get(campagna.id) ?? null;
                  const pill = pillGestione(campagna, check);
                  return (
                    <li key={campagna.id}>
                      <Link
                        href={`/campagne/${campagna.id}`}
                        className="flex items-center gap-2.5 rounded-[14px] bg-white/90 px-2.5 py-2 transition-opacity hover:opacity-90"
                      >
                        <AvatarIniziali iniziali={campagna.iniziali} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-[var(--ink)]">
                            {campagna.nomeCliente}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                            {nomeCampagnaCard(campagna)}
                            {" · "}
                            {etichettaObiettivo(
                              normalizzaObjective(campagna.objective),
                            )}
                            {check ? (
                              <span className="text-[var(--ink-muted)]/80">
                                {" · "}
                                {formatDataCheck(check.createdAt)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <StatoChip kind={pill.kind} label={pill.label} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="aff-panel-white flex min-h-[15.5rem] min-w-0 flex-col p-4 sm:p-5">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                Revisioni cliente
              </p>
              {revisioni.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Nessuna revisione cliente.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-[26px] font-medium tabular-nums tracking-tight text-[var(--ink)]">
                    {revisioni.length}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                    {revisioni.length === 1
                      ? "revisione da gestire"
                      : "revisioni da gestire"}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {revisioni.slice(0, MAX_REVISIONI).map((campagna) => (
                      <li key={campagna.id}>
                        <Link
                          href={`/campagne/${campagna.id}`}
                          className="flex items-start justify-between gap-2.5 rounded-[14px] bg-[var(--lavender-muted)]/70 px-2.5 py-2 hover:opacity-90"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug text-[var(--ink)]">
                              {campagna.nomeCliente}
                            </p>
                            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                              {nomeCampagnaCard(campagna)}
                            </p>
                          </div>
                          <BadgeDashboard
                            kind="critico"
                            label="Revisione richiesta"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
          ) : null}

          {campagne.length > 0 ? <LavoriAperti colonne={lavori} /> : null}
        </>
      )}
    </main>
  );
}
