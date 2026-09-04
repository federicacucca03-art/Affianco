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
      <section className="aff-panel-white p-5 sm:p-6">
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
            className="aff-btn-primary"
          >
            Nuovo controllo
          </Link>
        </div>

        {caricamento ? (
          <p className="mt-5 text-sm text-[var(--ink-muted)]">
            Caricamento ultimi controlli…
          </p>
        ) : errore ? (
          <p className="mt-5 text-sm aff-text-danger">{errore}</p>
        ) : !ultimo || !healthStatus || !diagnosisLive ? (
          <div className="aff-empty mt-5">
            <p className="aff-empty__title">Mai controllata</p>
            <p className="aff-empty__body">
              Nessun check salvato. Apri la Control Room per inserire i KPI
              reali e salvare il primo controllo.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-violet-soft)]/40 px-4 py-4">
              <p className="aff-meta font-medium uppercase tracking-wide">
                Ultimo controllo · {formatDataCheck(ultimo.createdAt)}
              </p>
              <BloccoDiagnosiTrend
                healthStatus={ultimo.healthStatus}
                diagnosis={diagnosisLive.diagnosis}
                trend={trend}
              />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="aff-metric">
                <dt className="aff-metric__label">{metricLabel}</dt>
                <dd className="aff-metric__value text-[15px]">
                  {formatEuro(ultimo.primaryCost)}
                </dd>
              </div>
              <div className="aff-metric">
                <dt className="aff-metric__label">Soglia</dt>
                <dd className="aff-metric__value text-[15px]">
                  {formatEuro(ultimo.threshold)}
                </dd>
              </div>
              <div className="aff-metric">
                <dt className="aff-metric__label">Giorni attivi</dt>
                <dd className="aff-metric__value text-[15px]">
                  {ultimo.daysActive ?? "—"}
                </dd>
              </div>
              <div className="aff-metric">
                <dt className="aff-metric__label">Risultati</dt>
                <dd className="aff-metric__value text-[15px]">
                  {ultimo.resultsCount ?? "—"}
                </dd>
              </div>
            </dl>

            {nextAction ? (
              <div className="mt-4">
                <div className="aff-next-action">
                  <p className="aff-next-action__eyebrow">Prossimo passo</p>
                  <p className="aff-next-action__title">{nextAction}</p>
                </div>
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

      <section className="aff-panel-white p-5 sm:p-6">
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
