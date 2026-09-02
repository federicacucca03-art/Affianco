"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Campagna } from "@/types/campagne";
import {
  buildEconomicContext,
  calcolaHealthStatus,
  diagnosticaDeterministica,
  etichettaMetricaPrimaria,
  formatDataCheck,
  formatEuro,
  type ControlRoomKpis,
} from "@/lib/control-room";
import { normalizzaObjective } from "@/types/campagne";
import {
  leggiChecksCampagna,
  type CampaignCheck,
} from "@/lib/campaign-checks-db";
import { StoricoControlli } from "@/components/risultati/StoricoControlli";
import { BloccoDiagnosiTrend } from "@/components/risultati/BloccoDiagnosiTrend";
import { evaluateTrend } from "@/lib/campaign-trend";
import { deriveFunnelMetrics } from "@/lib/funnel-metrics";
import { logErroreSupabaseDev } from "@/lib/supabase-errori";

function kpisDaCheck(check: CampaignCheck): ControlRoomKpis {
  const funnel = deriveFunnelMetrics({
    spend: check.spend,
    results: check.resultsCount,
    clicks: check.clicks,
    impressions: check.impressions,
    manualCtr: check.ctr,
    manualCpc: check.cpc,
    manualCpm: check.cpm,
  });
  return {
    spend: check.spend,
    results: check.resultsCount,
    costPerResult: check.primaryCost,
    ctr: funnel.ctr,
    cpm: funnel.cpm,
    cpc: funnel.cpc,
    frequency: check.frequency,
    roas: check.roas,
    clicks: check.clicks,
    impressions: check.impressions,
    conversionRate: funnel.conversionRate,
  };
}

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
  const objective = normalizzaObjective(campagna.objective);
  const metricLabel = etichettaMetricaPrimaria(objective);

  const trend = useMemo(
    () => (checks.length > 0 ? evaluateTrend(checks, objective) : null),
    [checks, objective],
  );

  const diagnosisLive = useMemo(() => {
    if (!ultimo || !trend) return null;
    const kpis = kpisDaCheck(ultimo);
    const economic = buildEconomicContext(
      campagna,
      kpis,
      ultimo.threshold,
      objective,
    );
    const health = calcolaHealthStatus(
      economic.actual,
      economic.threshold,
      economic.healthMode,
      {
        daysActive: ultimo.daysActive,
        resultsCount: kpis.results,
      },
    );
    const diagnosis = diagnosticaDeterministica(kpis, health, economic, {
      trend,
    });
    return { health, diagnosis };
  }, [ultimo, trend, campagna, objective]);

  const nextAction = ultimo?.actions[0]?.text ?? null;
  const healthStatus = ultimo?.healthStatus ?? diagnosisLive?.health.status;

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
        ) : !ultimo || !healthStatus || !diagnosisLive ? (
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
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                Ultimo controllo · {formatDataCheck(ultimo.createdAt)}
              </p>
              <BloccoDiagnosiTrend
                healthStatus={ultimo.healthStatus}
                diagnosis={diagnosisLive.diagnosis}
                trend={trend}
              />
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
        <StoricoControlli
          checks={checks}
          metricLabel={metricLabel}
          objective={objective}
        />
      </section>
    </div>
  );
}
