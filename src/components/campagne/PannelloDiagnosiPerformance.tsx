"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campagna } from "@/types/campagne";
import {
  etichettaHealth,
  etichettaMetricaPrimaria,
  etichettaTrend,
  formatDataCheck,
  formatEuro,
  trendVsPrecedente,
} from "@/lib/control-room";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";
import { normalizzaObjective } from "@/types/campagne";
import {
  leggiChecksCampagna,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import { StoricoControlli } from "@/components/risultati/StoricoControlli";
import { logErroreSupabaseDev } from "@/lib/supabase-errori";

export function PannelloDiagnosiPerformance({
  campagna,
}: {
  campagna: Campagna;
}) {
  const [checks, setChecks] = useState<CampaignCheck[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    setCaricamento(true);
    setErrore(null);
    void (async () => {
      try {
        const lista = await leggiChecksCampagna(campagna.id, 8);
        if (!attivo) return;
        setChecks(lista);
      } catch (e) {
        logErroreSupabaseDev("leggi_campaign_checks", e);
        if (!attivo) return;
        setErrore(
          e instanceof Error
            ? e.message
            : "Impossibile caricare i controlli salvati.",
        );
      } finally {
        if (attivo) setCaricamento(false);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [campagna.id]);

  const ultimo = checks[0] ?? null;
  const precedente = checks[1] ?? null;
  const objective = normalizzaObjective(campagna.objective);
  const metricLabel = etichettaMetricaPrimaria(objective);
  const trend = precedente
    ? trendVsPrecedente(precedente.primaryCost, ultimo?.primaryCost)
    : null;
  const nextAction = ultimo?.actions[0]?.text ?? null;

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Control Room
            </p>
            <h2 className="mt-1 text-xl font-medium text-[var(--ink)]">
              Diagnosi &amp; Performance
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Stesso semaforo di /risultati. Nessun secondo motore.
            </p>
          </div>
          <Link
            href={`/risultati?campaignId=${encodeURIComponent(campagna.id)}`}
            className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Nuovo controllo
          </Link>
        </div>

        {caricamento ? (
          <p className="mt-5 text-sm text-[var(--ink-muted)]">
            Caricamento ultimi controlli…
          </p>
        ) : errore ? (
          <p className="mt-5 text-sm text-[#B42318]">{errore}</p>
        ) : !ultimo ? (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-5">
            <p className="text-sm font-medium text-[var(--ink)]">
              Mai controllata
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Nessun check salvato. Apri la Control Room per inserire i KPI
              reali e salvare il primo controllo.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-xl bg-white px-4 py-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center gap-2">
                <StatoChip
                  kind={chipDaHealth(ultimo.healthStatus)}
                  label={etichettaHealth(ultimo.healthStatus)}
                />
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  Ultimo controllo · {formatDataCheck(ultimo.createdAt)}
                </p>
              </div>
              {trend ? (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  vs check precedente: {etichettaTrend(trend)}
                </p>
              ) : null}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
                <dt className="text-xs text-[var(--ink-muted)]">{metricLabel}</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                  {formatEuro(ultimo.primaryCost)}
                </dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
                <dt className="text-xs text-[var(--ink-muted)]">Soglia</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                  {formatEuro(ultimo.threshold)}
                </dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
                <dt className="text-xs text-[var(--ink-muted)]">Giorni attivi</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                  {ultimo.daysActive ?? "—"}
                </dd>
              </div>
              <div className="rounded-xl bg-[var(--surface-hover)] px-4 py-3">
                <dt className="text-xs text-[var(--ink-muted)]">Risultati</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                  {ultimo.resultsCount ?? "—"}
                </dd>
              </div>
            </dl>

            {nextAction ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  Next action
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                  {nextAction}
                </p>
              </div>
            ) : null}

            {ultimo.note?.trim() ? (
              <p className="mt-3 text-sm text-[var(--ink-muted)]">
                Nota: {ultimo.note.trim()}
              </p>
            ) : null}

            {ultimo.thresholdMode === "EFFICIENCY" ? (
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                Confronto di efficienza rispetto al CPM pianificato. Non è una
                soglia di break-even.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Storico controlli
        </h3>
        <StoricoControlli checks={checks} metricLabel={metricLabel} />
      </section>
    </div>
  );
}
