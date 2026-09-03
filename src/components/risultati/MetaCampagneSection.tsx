"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  etichettaHealthAvailability,
  etichettaMonitoringMode,
  metaHealthStatusLabel,
  kpiLabel,
  HISTORICAL_CTA_SUBSTITUTE,
  isLiveInterventionCta,
  type MetaMonitoringMode,
  type MetaHealthAvailability,
} from "@/lib/meta/insights-control-room";
import { healthBadgeClasses, formatEuro, calcolaHealthStatus } from "@/lib/control-room";
import type { HealthStatus } from "@/lib/control-room";
import {
  fetchMetaCampaignTarget,
  saveMetaCampaignTarget,
  deleteMetaCampaignTarget,
  type MetaMonitoringKpi,
} from "@/lib/meta/campaign-target-client";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type MetaCampaignRow = {
  id: string;
  clientId: string;
  clientName: string;
  metaCampaignId: string;
  name: string;
  effectiveStatus: string | null;
  rawObjective: string | null;
  lastSyncedAt: string | null;
  insightsPeriodSince: string | null;
  insightsPeriodUntil: string | null;
  // aggregated at read time
  spend: number | null;
  impressions: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  // target (from meta_campaigns columns)
  primaryKpi: MetaMonitoringKpi | null;
  targetValue: number | null;
  // computed
  mode: MetaMonitoringMode;
  healthAvailability: MetaHealthAvailability;
  healthStatus: HealthStatus | null;
};

// ------------------------------------------------------------------
// Sub-component: target setter
// ------------------------------------------------------------------

const KPI_OPTIONS: { value: MetaMonitoringKpi; label: string }[] = [
  { value: "CPL", label: "CPL — Costo per Lead" },
  { value: "CPA", label: "CPA — Costo per Azione" },
  { value: "CPM", label: "CPM — Costo per Mille" },
  { value: "CPC", label: "CPC — Costo per Click" },
  { value: "ROAS", label: "ROAS (non ancora valutabile)" },
  { value: "NONE", label: "Nessuno — rimuovi target" },
];

function TargetSetter({
  clientId,
  campaignId,
  currentKpi,
  currentTarget,
  rawObjective,
  onSaved,
}: {
  clientId: string;
  campaignId: string;
  currentKpi: MetaMonitoringKpi | null;
  currentTarget: number | null;
  rawObjective: string | null;
  onSaved: (kpi: MetaMonitoringKpi | null, value: number | null) => void;
}) {
  const isLead =
    rawObjective?.toUpperCase() === "OUTCOME_LEADS" ||
    rawObjective?.toUpperCase() === "LEADS";

  const [kpi, setKpi] = useState<MetaMonitoringKpi | "">(currentKpi ?? "");
  const [value, setValue] = useState<string>(
    currentTarget != null ? String(currentTarget) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSave() {
    if (!kpi) {
      setError("Seleziona un KPI.");
      return;
    }
    const numValue =
      kpi === "NONE" ? null : value.trim() ? Number(value) : null;
    if (
      kpi !== "NONE" &&
      (numValue == null || !Number.isFinite(numValue) || numValue <= 0)
    ) {
      setError("Inserisci un valore target positivo.");
      return;
    }
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      if (kpi === "NONE") {
        await deleteMetaCampaignTarget(clientId, campaignId);
        onSaved(null, null);
      } else {
        await saveMetaCampaignTarget(clientId, campaignId, kpi, numValue);
        onSaved(kpi, numValue);
      }
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore salvataggio target.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm">
      <p className="font-medium text-[var(--ink)]">Imposta target</p>
      {isLead && !currentKpi && (
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          L&apos;obiettivo è generazione lead — puoi usare CPL come KPI.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="block min-w-[160px]">
          <span className="mb-1 block text-xs text-[var(--ink-muted)]">KPI</span>
          <select
            value={kpi}
            onChange={(e) => {
              setKpi(e.target.value as MetaMonitoringKpi);
              setOk(false);
              setError(null);
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">— Scegli —</option>
            {KPI_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {kpi && kpi !== "NONE" && kpi !== "ROAS" && (
          <label className="block min-w-[120px]">
            <span className="mb-1 block text-xs text-[var(--ink-muted)]">
              Valore (€)
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setOk(false);
                setError(null);
              }}
              placeholder="Es. 20"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
        )}
        {kpi === "ROAS" && (
          <p className="self-end pb-2 text-xs text-[var(--ink-muted)]">
            ROAS non ancora valutabile in Control Room.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || !kpi}
        className="mt-3 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Salvataggio…" : "Salva target"}
      </button>
      {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}
      {ok && <p className="mt-2 text-xs text-[#2D6A4A]">Target salvato.</p>}
    </div>
  );
}

// ------------------------------------------------------------------
// Card
// ------------------------------------------------------------------

function MetaCampaignCard({
  row,
  onTargetUpdated,
}: {
  row: MetaCampaignRow;
  onTargetUpdated: (kpi: MetaMonitoringKpi | null, value: number | null) => void;
}) {
  const [showTarget, setShowTarget] = useState(false);

  const isPaused = row.mode === "HISTORICAL_REVIEW";

  const healthBadge =
    row.healthStatus != null ? (
      <span
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${healthBadgeClasses(row.healthStatus)}`}
      >
        {metaHealthStatusLabel(row.healthStatus)}
      </span>
    ) : null;

  const targetState =
    row.primaryKpi && row.primaryKpi !== "NONE" ? (
      <span className="text-xs text-[var(--ink-muted)]">
        Target {kpiLabel(row.primaryKpi)}
        {row.targetValue != null ? ` ${formatEuro(row.targetValue)}` : ""}
      </span>
    ) : (
      <span className="rounded-full border border-[#F5D78E] bg-[#FFF6E5] px-2.5 py-0.5 text-xs font-medium text-[#9A6700]">
        Target da impostare
      </span>
    );

  const noTargetMessage =
    row.healthAvailability === "TARGET_REQUIRED"
      ? "Dati disponibili — imposta un target per valutare la performance."
      : row.healthAvailability === "RESULT_MAPPING_REQUIRED"
        ? "Tipo di risultato non determinabile — monitoraggio parziale disponibile."
        : row.healthAvailability === "ROAS_DEFERRED"
          ? "ROAS non ancora valutabile in Control Room."
          : null;

  return (
    <div className="rounded-[var(--radius)] bg-white p-5 shadow-[var(--shadow-soft)]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
              Meta
            </span>
            {isPaused && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                {etichettaMonitoringMode(row.mode)}
              </span>
            )}
            {healthBadge}
            {!row.healthStatus && targetState}
          </div>
          <p className="mt-1.5 font-medium text-[var(--ink)] leading-snug">
            {row.name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {row.clientName}
            {row.rawObjective ? ` · ${row.rawObjective}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {row.lastSyncedAt && (
            <p className="text-[10px] text-[var(--ink-muted)]">
              Sincronizzato{" "}
              {new Date(row.lastSyncedAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          )}
          {row.insightsPeriodSince && row.insightsPeriodUntil && (
            <p className="text-[10px] text-[var(--ink-muted)]">
              {new Date(row.insightsPeriodSince).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
              })}{" "}
              –{" "}
              {new Date(row.insightsPeriodUntil).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {/* Metrics */}
      {(row.spend != null ||
        row.impressions != null ||
        row.linkClicks != null) && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {row.spend != null && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] text-[var(--ink-muted)]">Spesa</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {formatEuro(row.spend)}
              </dd>
            </div>
          )}
          {row.impressions != null && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] text-[var(--ink-muted)]">Impression</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {row.impressions.toLocaleString("it-IT")}
              </dd>
            </div>
          )}
          {row.linkClicks != null && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] text-[var(--ink-muted)]">Link click</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {row.linkClicks.toLocaleString("it-IT")}
              </dd>
            </div>
          )}
          {row.ctr != null && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] text-[var(--ink-muted)]">CTR</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {row.ctr.toFixed(2)}%
              </dd>
            </div>
          )}
          {row.cpc != null && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] text-[var(--ink-muted)]">CPC</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {formatEuro(row.cpc)}
              </dd>
            </div>
          )}
          {row.frequency != null && (
            <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
              <dt className="text-[10px] text-[var(--ink-muted)]">Frequenza</dt>
              <dd className="mt-0.5 font-medium text-[var(--ink)]">
                {row.frequency.toFixed(2)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Health availability message */}
      {noTargetMessage && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">{noTargetMessage}</p>
      )}

      {/* Historical framing */}
      {isPaused && row.healthStatus && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          {HISTORICAL_CTA_SUBSTITUTE}
        </p>
      )}

      {/* Target setter */}
      <button
        type="button"
        onClick={() => setShowTarget((v) => !v)}
        className="mt-4 text-xs font-medium text-[var(--accent)]"
      >
        {showTarget ? "Chiudi" : row.primaryKpi && row.primaryKpi !== "NONE" ? "Modifica target" : "Imposta target"}
      </button>

      {showTarget && (
        <TargetSetter
          clientId={row.clientId}
          campaignId={row.id}
          currentKpi={row.primaryKpi}
          currentTarget={row.targetValue}
          rawObjective={row.rawObjective}
          onSaved={(kpi, value) => {
            setShowTarget(false);
            onTargetUpdated(kpi, value);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Health derivation helper (pure — used both at load time and on mutation)
// ------------------------------------------------------------------

function deriveHealth(
  primaryKpi: MetaMonitoringKpi | null,
  targetValue: number | null,
  row: Pick<MetaCampaignRow, "cpc" | "cpm" | "spend" | "impressions">,
): { healthAvailability: MetaHealthAvailability; healthStatus: HealthStatus | null } {
  if (primaryKpi === "ROAS") {
    return { healthAvailability: "ROAS_DEFERRED", healthStatus: null };
  }
  if (!primaryKpi || primaryKpi === "NONE" || targetValue == null || targetValue <= 0) {
    return { healthAvailability: "TARGET_REQUIRED", healthStatus: null };
  }
  if (primaryKpi === "CPL" || primaryKpi === "CPA") {
    // Result confidence not available in list view — mark INSUFFICIENT_DATA
    return { healthAvailability: "INSUFFICIENT_DATA", healthStatus: null };
  }
  if (primaryKpi === "CPC") {
    if (row.cpc != null) {
      const h = calcolaHealthStatus(row.cpc, targetValue, "economic");
      return { healthAvailability: "AVAILABLE", healthStatus: h.status };
    }
    return { healthAvailability: "INSUFFICIENT_DATA", healthStatus: null };
  }
  if (primaryKpi === "CPM") {
    const cpm =
      row.cpm != null
        ? row.cpm
        : row.spend != null && row.impressions != null && row.impressions > 0
          ? Math.round((row.spend / row.impressions) * 1000 * 100) / 100
          : null;
    if (cpm != null) {
      const h = calcolaHealthStatus(cpm, targetValue, "efficiency");
      return { healthAvailability: "AVAILABLE", healthStatus: h.status };
    }
    return { healthAvailability: "INSUFFICIENT_DATA", healthStatus: null };
  }
  return { healthAvailability: "TARGET_REQUIRED", healthStatus: null };
}

// ------------------------------------------------------------------
// Section: loads meta campaigns for a given client
// ------------------------------------------------------------------

type MetaCampaignApiRow = {
  id: string;
  client_id: string;
  meta_campaign_id: string;
  name: string;
  effective_status: string | null;
  raw_objective: string | null;
  last_synced_at: string | null;
  insights_period_since: string | null;
  insights_period_until: string | null;
  insights_period_frequency: number | null;
  primary_kpi: string | null;
  target_value: number | null;
};

type InsightSumRow = {
  meta_campaign_id: string;
  spend_sum: number | null;
  impressions_sum: number | null;
  link_clicks_sum: number | null;
};

export function MetaCampagneSection({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<MetaCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: camps, error: campErr } = await supabase
        .from("meta_campaigns")
        .select(
          "id, client_id, meta_campaign_id, name, effective_status, raw_objective, last_synced_at, insights_period_since, insights_period_until, insights_period_frequency, primary_kpi, target_value",
        )
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .order("last_synced_at", { ascending: false });

      if (campErr) throw campErr;
      const campRows = (camps ?? []) as MetaCampaignApiRow[];
      if (campRows.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Load aggregated insight sums for each campaign
      const campaignIds = campRows.map((c) => c.meta_campaign_id);
      const { data: insightData } = await supabase
        .from("meta_campaign_insights_daily")
        .select("meta_campaign_id, spend, impressions, link_clicks")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .in("meta_campaign_id", campaignIds);

      // Aggregate per campaign
      const aggMap = new Map<
        string,
        { spend: number; impressions: number; linkClicks: number; rows: number }
      >();
      for (const ins of (insightData ?? []) as {
        meta_campaign_id: string;
        spend: number | null;
        impressions: number | null;
        link_clicks: number | null;
      }[]) {
        const prev = aggMap.get(ins.meta_campaign_id) ?? {
          spend: 0,
          impressions: 0,
          linkClicks: 0,
          rows: 0,
        };
        aggMap.set(ins.meta_campaign_id, {
          spend: prev.spend + (ins.spend ?? 0),
          impressions: prev.impressions + (ins.impressions ?? 0),
          linkClicks: prev.linkClicks + (ins.link_clicks ?? 0),
          rows: prev.rows + 1,
        });
      }

      const mapped: MetaCampaignRow[] = campRows.map((c) => {
        const agg = aggMap.get(c.meta_campaign_id);
        const spend = agg ? agg.spend : null;
        const impressions = agg ? agg.impressions : null;
        const linkClicks = agg ? agg.linkClicks : null;
        const ctr =
          linkClicks != null && impressions != null && impressions > 0
            ? Math.round((linkClicks / impressions) * 10000) / 100
            : null;
        const cpc =
          spend != null && linkClicks != null && linkClicks > 0
            ? Math.round((spend / linkClicks) * 100) / 100
            : null;
        const frequency = c.insights_period_frequency ?? null;

        // Resolve mode
        const effectiveUpper = (c.effective_status ?? "").toUpperCase();
        const mode: MetaMonitoringMode =
          ["PAUSED", "CAMPAIGN_PAUSED", "ARCHIVED", "DELETED", "ADSET_PAUSED"].includes(
            effectiveUpper,
          )
            ? "HISTORICAL_REVIEW"
            : "ACTIVE_MONITORING";

        // Resolve health availability (simplified for list view — no result confidence available here)
        const primaryKpi = c.primary_kpi as MetaMonitoringKpi | null;
        const targetValue = c.target_value;
        const cpmComputed =
          spend != null && impressions != null && impressions > 0
            ? Math.round((spend / impressions) * 1000 * 100) / 100
            : null;

        const { healthAvailability, healthStatus } = deriveHealth(
          primaryKpi,
          targetValue,
          { cpc, cpm: cpmComputed, spend, impressions },
        );

        return {
          id: c.id,
          clientId: c.client_id,
          clientName,
          metaCampaignId: c.meta_campaign_id,
          name: c.name,
          effectiveStatus: c.effective_status,
          rawObjective: c.raw_objective,
          lastSyncedAt: c.last_synced_at,
          insightsPeriodSince: c.insights_period_since,
          insightsPeriodUntil: c.insights_period_until,
          spend,
          impressions,
          linkClicks,
          ctr,
          cpc,
          cpm: cpmComputed,
          frequency,
          primaryKpi,
          targetValue,
          mode,
          healthAvailability,
          healthStatus,
        };
      });

      setRows(mapped);
    } catch (e) {
      setError("Impossibile caricare le campagne Meta.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, clientId, clientName]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleTargetUpdated(
    rowId: string,
    kpi: MetaMonitoringKpi | null,
    value: number | null,
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const { healthAvailability, healthStatus } = deriveHealth(
          kpi,
          value,
          { cpc: r.cpc, cpm: r.cpm, spend: r.spend, impressions: r.impressions },
        );
        return {
          ...r,
          primaryKpi: kpi,
          targetValue: value,
          healthAvailability,
          healthStatus,
        };
      }),
    );
  }

  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-medium text-[var(--ink)]">Campagne Meta</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-medium text-[var(--ink)]">Campagne Meta</h2>
        <p className="mt-2 text-sm text-[#B42318]">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 text-sm font-medium text-[var(--accent)]"
        >
          Riprova
        </button>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-medium text-[var(--ink)]">Campagne Meta</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Nessuna campagna Meta importata per questo cliente.{" "}
          <span className="text-[var(--ink-muted)]">
            Usa «Importa campagne» per sincronizzare.
          </span>
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-[var(--ink)]">Campagne Meta</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Monitoraggio separato dalle campagne Affianco. Imposta un target per
        valutare la performance.
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <MetaCampaignCard
            key={row.id}
            row={row}
            onTargetUpdated={(kpi, value) =>
              handleTargetUpdated(row.id, kpi, value)
            }
          />
        ))}
      </div>
    </section>
  );
}
