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
  isoInizioFinestraGiorni,
  pillGestione,
  type AttentionItem,
} from "@/lib/dashboard-home";
import {
  etichettaStatoOperativo,
  nomeCampagnaCard,
} from "@/components/risultati/ControlRoomOverview";
import { StatoChip, type StatoChipKind } from "@/components/nuova-contatti/StatoChip";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { normalizzaObjective } from "@/types/campagne";

const MAX_GESTIONE = 8;
const MAX_REVISIONI = 3;

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

function MiniBars({ valori }: { valori: number[] }) {
  const max = Math.max(1, ...valori);
  return (
    <div
      className="mt-5 flex h-14 items-end gap-1.5"
      aria-hidden
    >
      {valori.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-md bg-[var(--primary-soft)]"
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium tracking-tight text-[var(--ink)] sm:text-[32px]">
            Buongiorno
          </h1>
          <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
            Questa è la situazione delle campagne che stai gestendo.
          </p>
        </div>
        <button
          type="button"
          onClick={apriModaleCampagna}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuova campagna
        </button>
      </header>

      {caricamento ? (
        <p className="mt-10 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : errore ? (
        <p className="mt-10 text-sm text-[#7a3d58]">{errore}</p>
      ) : campagne.length === 0 ? (
        <section className="aff-panel-white mt-8 px-6 py-10">
          <p className="text-base font-medium text-[var(--ink)]">
            Non hai ancora campagne in gestione.
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
            Crea la prima campagna per vedere qui cosa richiede attenzione.
          </p>
          <button
            type="button"
            onClick={apriModaleCampagna}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Crea la prima campagna
          </button>
        </section>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <section className="aff-panel-white flex flex-col p-5 md:min-h-[16rem]">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                Attività
              </p>
              {attivita.campagneControllate === 0 ? (
                <p className="mt-6 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Ancora nessun controllo questa settimana.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-[28px] font-medium tabular-nums tracking-tight text-[var(--ink)]">
                    {attivita.campagneControllate}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {attivita.campagneControllate === 1
                      ? "campagna controllata"
                      : "campagne controllate"}
                    {attivita.totaleCheck > 0
                      ? ` · ${attivita.totaleCheck} ${
                          attivita.totaleCheck === 1
                            ? "controllo"
                            : "controlli"
                        }`
                      : ""}
                  </p>
                  <MiniBars valori={attivita.perGiorno} />
                </>
              )}
            </section>

            <section className="flex flex-col rounded-[var(--radius)] bg-[var(--lavender-muted)] p-5 shadow-[var(--shadow-soft)] md:col-span-2 md:min-h-[16rem]">
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
              <ul className="mt-4 space-y-2">
                {gestione.map((campagna) => {
                  const check = ultimi.get(campagna.id) ?? null;
                  const pill = pillGestione(campagna, check);
                  return (
                    <li key={campagna.id}>
                      <Link
                        href={`/campagne/${campagna.id}`}
                        className="flex items-start gap-3 rounded-[16px] bg-white/90 px-3.5 py-3 transition-opacity hover:opacity-90"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--ink)]">
                            {campagna.nomeCliente}
                          </p>
                          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                            {nomeCampagnaCard(campagna)}
                            {" · "}
                            {etichettaObiettivo(
                              normalizzaObjective(campagna.objective),
                            )}
                            {check
                              ? ` · ${formatDataCheck(check.createdAt)}`
                              : ""}
                          </p>
                        </div>
                        <StatoChip kind={pill.kind} label={pill.label} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="aff-panel-white flex flex-col p-5 md:min-h-[16rem]">
              <p className="text-[13px] font-medium text-[var(--primary)]">
                Revisioni cliente
              </p>
              {revisioni.length === 0 ? (
                <p className="mt-6 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Nessuna revisione cliente.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-[28px] font-medium tabular-nums tracking-tight text-[var(--ink)]">
                    {revisioni.length}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {revisioni.slice(0, MAX_REVISIONI).map((campagna) => (
                      <li key={campagna.id}>
                        <Link
                          href={`/campagne/${campagna.id}`}
                          className="block rounded-[14px] bg-[var(--lavender-muted)]/60 px-3 py-2.5 hover:opacity-90"
                        >
                          <p className="text-sm font-medium text-[var(--ink)]">
                            {campagna.nomeCliente}
                          </p>
                          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                            {nomeCampagnaCard(campagna)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <section className="aff-panel-white mt-4 p-5 sm:p-6">
            <p className="text-[13px] font-medium text-[var(--primary)]">
              Cosa richiede attenzione
            </p>
            {attenzione.length === 0 ? (
              <div className="mt-5">
                <p className="text-base font-medium text-[var(--ink)]">
                  Nessuna urgenza oggi.
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                  Le campagne monitorate non richiedono interventi immediati.
                </p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {attenzione.map((item) => {
                  const chip = chipAttenzione(item);
                  return (
                    <li
                      key={item.campaignId}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatoChip kind={chip.kind} label={chip.label} />
                          <span className="text-sm font-medium text-[var(--ink)]">
                            {item.clientName}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
                          {item.campaignName}
                          {" · "}
                          {etichettaObiettivo(item.objective)}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
                          {item.nextAction}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">
                          {item.lastCheckAt
                            ? `Ultimo controllo ${formatDataCheck(item.lastCheckAt)}`
                            : etichettaStatoOperativo(null, false)}
                        </p>
                      </div>
                      <Link
                        href={item.href}
                        className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-card)] hover:opacity-90"
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
