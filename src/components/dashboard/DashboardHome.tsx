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
  derivaAttenzione,
  etichettaAriaBarraAttivita,
  isoInizioFinestraGiorni,
  pillGestione,
  quotaAltezzaBarraAttivita,
  type AttentionItem,
  type GiornoAttivita,
} from "@/lib/dashboard-home";
import { nomeCampagnaCard } from "@/components/risultati/ControlRoomOverview";
import { StatoChip, type StatoChipKind } from "@/components/nuova-contatti/StatoChip";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { normalizzaObjective } from "@/types/campagne";

const MAX_GESTIONE = 5;
const MAX_REVISIONI = 2;
const MAX_ATTENZIONE = 4;

function chipAttenzione(item: AttentionItem): {
  kind: StatoChipKind;
  label: string;
} {
  switch (item.category) {
    case "RED":
      return { kind: "critico", label: item.statusLabel };
    case "REVISION_REQUESTED":
      return { kind: "critico", label: item.statusLabel };
    case "YELLOW":
      return { kind: "watch", label: item.statusLabel };
    case "INSUFFICIENT":
    case "NO_CHECK":
    case "DRAFT":
      return { kind: "pending", label: item.statusLabel };
  }
}

const ALTEZZA_CHART_PX = 72;
const ALTEZZA_BARRA_VUOTA_PX = 5;

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
          const altezzaPx =
            giorno.count === 0
              ? ALTEZZA_BARRA_VUOTA_PX
              : Math.round(quota * ALTEZZA_CHART_PX);
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
            className="min-w-0 flex-1 text-center text-[10px] font-medium leading-none text-[var(--ink-muted)]"
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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-medium text-[var(--primary)] shadow-[var(--shadow-card)]"
      aria-hidden
    >
      {iniziali}
    </span>
  );
}

export function DashboardHome() {
  const { apriModaleCampagna } = useOnboardingCampagna();
  const [campagne, setCampagne] = useState<Campagna[]>([]);
  const [ultimi, setUltimi] = useState<Map<string, CampaignCheck>>(new Map());
  const [checksSettimana, setChecksSettimana] = useState<CampaignCheck[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const da = isoInizioFinestraGiorni(7);
      const [lista, mappa, settimana] = await Promise.all([
        leggiCampagneDaSupabase(),
        leggiUltimiChecksUtente(),
        leggiChecksUtenteDal(da),
      ]);
      setCampagne(lista);
      setUltimi(mappa);
      setChecksSettimana(settimana);
    } catch (e) {
      logErroreSupabaseDev("dashboard_home", e);
      setErrore(messaggioErroreSupabase(e, "lista"));
      setCampagne([]);
      setUltimi(new Map());
      setChecksSettimana([]);
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const attenzione = useMemo(
    () => derivaAttenzione(campagne, ultimi),
    [campagne, ultimi],
  );
  const attenzioneVisibili = attenzione.slice(0, MAX_ATTENZIONE);
  const revisioni = useMemo(
    () => campagneInRevisione(campagne),
    [campagne],
  );
  const attivita = useMemo(
    () => aggregaAttivitaSettimana(checksSettimana),
    [checksSettimana],
  );
  const gestione = campagne.slice(0, MAX_GESTIONE);

  return (
    <main className="mx-auto w-full max-w-[1400px]">
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
      ) : campagne.length === 0 ? (
        <section className="aff-panel-white mt-6 px-5 py-8">
          <p className="text-base font-medium text-[var(--ink)]">
            Non hai ancora campagne in gestione.
          </p>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
            Crea la prima campagna per vedere qui cosa richiede attenzione.
          </p>
          <button
            type="button"
            onClick={apriModaleCampagna}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Crea la prima campagna
          </button>
        </section>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
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

            <section className="flex min-h-[15.5rem] flex-col rounded-[var(--radius)] bg-[var(--lavender-muted)] p-4 shadow-[var(--shadow-soft)] sm:p-5 md:col-span-2">
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

            <section className="aff-panel-white flex min-h-[15.5rem] flex-col p-3.5 sm:p-4">
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
                          className="flex items-start justify-between gap-2 rounded-[14px] bg-[var(--lavender-muted)]/70 px-2 py-1.5 hover:opacity-90"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug text-[var(--ink)]">
                              {campagna.nomeCliente}
                            </p>
                            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                              {nomeCampagnaCard(campagna)}
                            </p>
                          </div>
                          <StatoChip kind="critico" label="Revisione richiesta" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <section className="aff-panel-white mt-3 p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                Cosa richiede attenzione
              </p>
              {attenzione.length > MAX_ATTENZIONE ? (
                <Link
                  href="/risultati"
                  className="text-xs font-medium text-[var(--primary)] hover:opacity-80"
                >
                  Vedi tutte ({attenzione.length})
                </Link>
              ) : null}
            </div>
            {attenzione.length === 0 ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-[var(--ink)]">
                  Nessuna urgenza oggi.
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
                  Le campagne monitorate non richiedono interventi immediati.
                </p>
              </div>
            ) : (
              <ul className="mt-2">
                {attenzioneVisibili.map((item) => {
                  const chip = chipAttenzione(item);
                  const metaCheck = item.lastCheckAt
                    ? formatDataCheck(item.lastCheckAt)
                    : null;
                  return (
                    <li
                      key={item.campaignId}
                      className="grid grid-cols-1 gap-2 border-b border-[var(--border)] py-2.5 last:border-0 sm:grid-cols-[7.5rem_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_auto] sm:items-center sm:gap-3 sm:py-2"
                    >
                      <StatoChip kind={chip.kind} label={chip.label} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-[var(--ink)]">
                          {item.clientName}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                          {item.campaignName}
                          {" · "}
                          {etichettaObiettivo(item.objective)}
                        </p>
                      </div>
                      <p className="text-[13px] leading-snug text-[var(--ink)]">
                        {item.nextAction}
                      </p>
                      <p className="text-xs leading-snug text-[var(--ink-muted)]">
                        {metaCheck ? `Ultimo check ${metaCheck}` : ""}
                      </p>
                      <Link
                        href={item.href}
                        className="inline-flex w-fit shrink-0 items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] shadow-[var(--shadow-card)] hover:opacity-90"
                      >
                        Apri
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
