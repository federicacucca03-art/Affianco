"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  etichettaMonitoringMode,
  metaHealthStatusLabel,
  kpiLabel,
  HISTORICAL_CTA_SUBSTITUTE,
} from "@/lib/meta/insights-control-room";
import { healthBadgeClasses, formatEuro } from "@/lib/control-room";
import {
  saveMetaCampaignTarget,
  deleteMetaCampaignTarget,
  type MetaMonitoringKpi,
} from "@/lib/meta/campaign-target-client";
import {
  mapMetaCampaignToMonitoringRow,
  refreshAfterMetaTargetMutation,
  type MetaCampaignApiRow,
  type MetaCampaignMonitoringRow,
} from "@/lib/meta/meta-campaign-monitoring-row";

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
  onMutated,
}: {
  clientId: string;
  campaignId: string;
  currentKpi: MetaMonitoringKpi | null;
  currentTarget: number | null;
  rawObjective: string | null;
  onMutated: () => Promise<void>;
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
      } else {
        await saveMetaCampaignTarget(clientId, campaignId, kpi, numValue);
      }
      await onMutated();
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
  onTargetMutated,
}: {
  row: MetaCampaignMonitoringRow;
  onTargetMutated: () => Promise<void>;
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
            {targetState}
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

      {noTargetMessage && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">{noTargetMessage}</p>
      )}

      {isPaused && row.healthStatus && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          {HISTORICAL_CTA_SUBSTITUTE}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowTarget((v) => !v)}
        className="mt-4 text-xs font-medium text-[var(--accent)]"
      >
        {showTarget
          ? "Chiudi"
          : row.primaryKpi && row.primaryKpi !== "NONE"
            ? "Modifica target"
            : "Imposta target"}
      </button>

      {showTarget && (
        <TargetSetter
          clientId={row.clientId}
          campaignId={row.id}
          currentKpi={row.primaryKpi}
          currentTarget={row.targetValue}
          rawObjective={row.rawObjective}
          onMutated={async () => {
            setShowTarget(false);
            await onTargetMutated();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Section
// ------------------------------------------------------------------

export function MetaCampagneSection({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<MetaCampaignMonitoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) return;
      if (!opts?.silent) {
        setLoading(true);
      }
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
          return;
        }

        const campaignIds = campRows.map((c) => c.meta_campaign_id);
        const { data: insightData } = await supabase
          .from("meta_campaign_insights_daily")
          .select("meta_campaign_id, spend, impressions, link_clicks")
          .eq("user_id", user.id)
          .eq("client_id", clientId)
          .in("meta_campaign_id", campaignIds);

        const aggMap = new Map<
          string,
          { spend: number; impressions: number; linkClicks: number }
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
          };
          aggMap.set(ins.meta_campaign_id, {
            spend: prev.spend + (ins.spend ?? 0),
            impressions: prev.impressions + (ins.impressions ?? 0),
            linkClicks: prev.linkClicks + (ins.link_clicks ?? 0),
          });
        }

        const mapped = campRows.map((c) =>
          mapMetaCampaignToMonitoringRow(
            c,
            aggMap.get(c.meta_campaign_id) ?? null,
            clientName,
          ),
        );

        setRows(mapped);
      } catch (e) {
        setError("Impossibile caricare le campagne Meta.");
        console.error(e);
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [user, clientId, clientName],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleTargetMutated = useCallback(async () => {
    await refreshAfterMetaTargetMutation(
      () => load({ silent: true }),
      () => router.refresh(),
    );
  }, [load, router]);

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
            onTargetMutated={handleTargetMutated}
          />
        ))}
      </div>
    </section>
  );
}
