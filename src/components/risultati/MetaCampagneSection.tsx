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
  fetchMetaCampaignLink,
  saveMetaCampaignLink,
  deleteMetaCampaignLink,
  type NativeCampaignLinkOption,
} from "@/lib/meta/campaign-link-client";
import {
  mapMetaCampaignToMonitoringRow,
  refreshAfterMetaTargetMutation,
  type MetaCampaignApiRow,
  type MetaCampaignMonitoringRow,
} from "@/lib/meta/meta-campaign-monitoring-row";
import type { LinkedAffiancoCampaignSnapshot } from "@/lib/meta/campaign-link-compatibility";
import type { ResultMappingConfidence } from "@/lib/meta/insight-actions";

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
    <div className="mt-3 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-surface)] px-4 py-4 text-sm shadow-[var(--shadow-soft)]">
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
            className="aff-input"
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
              className="aff-input"
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
        className="aff-btn-primary mt-3"
      >
        {saving ? "Salvataggio…" : "Salva target"}
      </button>
      {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}
      {ok && <p className="mt-2 text-xs text-[#2D6A4A]">Target salvato.</p>}
    </div>
  );
}

function LinkPicker({
  clientId,
  metaCampaignId,
  currentLinkedId,
  onMutated,
  onClose,
}: {
  clientId: string;
  metaCampaignId: string;
  currentLinkedId: string | null;
  onMutated: () => Promise<void>;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<NativeCampaignLinkOption[]>([]);
  const [selected, setSelected] = useState(currentLinkedId ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const link = await fetchMetaCampaignLink(clientId, metaCampaignId);
        if (cancelled) return;
        setOptions(link.options);
        setSelected(link.affiancoCampaignId ?? currentLinkedId ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Impossibile caricare le campagne.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, metaCampaignId, currentLinkedId]);

  async function handleConfirm() {
    if (!selected) {
      setError("Seleziona una campagna Ally.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveMetaCampaignLink(clientId, metaCampaignId, selected);
      await onMutated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collegamento non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-surface)] px-4 py-4 text-sm shadow-[var(--shadow-soft)]">
      <p className="font-medium text-[var(--ink)]">Collega campagna Ally</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Solo campagne di questo cliente. Il collegamento è esplicito: nessun
        abbinamento automatico.
      </p>
      {loading ? (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">Caricamento…</p>
      ) : options.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          Nessuna campagna Ally per questo cliente. Puoi continuare il
          monitoraggio solo con un target Meta.
        </p>
      ) : (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-[var(--ink-muted)]">
            Campagna
          </span>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError(null);
            }}
            className="aff-input"
          >
            <option value="">— Scegli —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.objectiveLabel} · {o.statusLabel}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={saving || loading || options.length === 0 || !selected}
          className="aff-btn-primary"
        >
          {saving ? "Collegamento…" : "Conferma"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="aff-btn-tertiary"
        >
          Annulla
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}
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
  const [showLink, setShowLink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const isPaused = row.mode === "HISTORICAL_REVIEW";

  const healthBadge =
    row.healthStatus != null ? (
      <span
        className={healthBadgeClasses(row.healthStatus)}
      >
        {metaHealthStatusLabel(row.healthStatus)}
      </span>
    ) : null;

  const targetState =
    row.linkState === "LINKED_BUT_KPI_INCOMPATIBLE" ? (
      <span className="aff-badge aff-badge--warning aff-badge--pill">
        KPI non compatibile
      </span>
    ) : row.primaryKpi && row.primaryKpi !== "NONE" ? (
      <span className="text-xs text-[var(--ink-muted)]">
        Target {kpiLabel(row.primaryKpi)}
        {row.targetValue != null ? ` ${formatEuro(row.targetValue)}` : ""}
        {row.targetSource === "LINKED_AFFIANCO" ? " · Ally" : ""}
      </span>
    ) : (
      <span className="aff-badge aff-badge--warning aff-badge--pill">
        Target da impostare
      </span>
    );

  const noTargetMessage =
    row.healthAvailability === "LINKED_BUT_KPI_INCOMPATIBLE"
      ? "Campagna collegata, ma il KPI pianificato non è compatibile con i risultati Meta disponibili."
      : row.healthAvailability === "TARGET_REQUIRED"
        ? "Dati disponibili — imposta un target per valutare la performance."
        : row.healthAvailability === "RESULT_MAPPING_REQUIRED"
          ? "Tipo di risultato non determinabile — monitoraggio parziale disponibile."
          : row.healthAvailability === "ROAS_DEFERRED"
            ? "ROAS non ancora valutabile in Control Room."
            : null;

  return (
    <div className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.06)] bg-[var(--ally-surface)] px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="aff-badge aff-badge--violet">Meta</span>
            {isPaused ? (
              <span className="aff-badge aff-badge--neutral">
                {etichettaMonitoringMode(row.mode)}
              </span>
            ) : null}
            {healthBadge}
            {targetState}
          </div>
          <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)] leading-snug">
            {row.name}
          </p>
          <p className="mt-1 aff-meta">
            {row.clientName}
            {row.rawObjective ? ` · ${row.rawObjective}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {row.lastSyncedAt && (
            <p className="aff-meta">
              Sincronizzato{" "}
              {new Date(row.lastSyncedAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          )}
          {row.insightsPeriodSince && row.insightsPeriodUntil && (
            <p className="aff-meta">
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
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {row.spend != null && (
            <div className="aff-metric aff-metric--compact">
              <dt className="aff-metric__label">Spesa</dt>
              <dd className="aff-metric__value text-[15px]">
                {formatEuro(row.spend)}
              </dd>
            </div>
          )}
          {row.impressions != null && (
            <div className="aff-metric aff-metric--compact">
              <dt className="aff-metric__label">Impression</dt>
              <dd className="aff-metric__value text-[15px]">
                {row.impressions.toLocaleString("it-IT")}
              </dd>
            </div>
          )}
          {row.linkClicks != null && (
            <div className="aff-metric aff-metric--compact">
              <dt className="aff-metric__label">Link click</dt>
              <dd className="aff-metric__value text-[15px]">
                {row.linkClicks.toLocaleString("it-IT")}
              </dd>
            </div>
          )}
          {row.ctr != null && (
            <div className="aff-metric aff-metric--compact">
              <dt className="aff-metric__label">CTR</dt>
              <dd className="aff-metric__value text-[15px]">
                {row.ctr.toFixed(2)}%
              </dd>
            </div>
          )}
          {row.cpc != null && (
            <div className="aff-metric aff-metric--compact">
              <dt className="aff-metric__label">CPC</dt>
              <dd className="aff-metric__value text-[15px]">
                {formatEuro(row.cpc)}
              </dd>
            </div>
          )}
          {row.frequency != null && (
            <div className="aff-metric aff-metric--compact">
              <dt className="aff-metric__label">Frequenza</dt>
              <dd className="aff-metric__value text-[15px]">
                {row.frequency.toFixed(2)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {noTargetMessage && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">{noTargetMessage}</p>
      )}

      <div className="mt-3 text-xs text-[var(--ink-muted)]">
        {row.linkedCampaignName && row.linkState !== "UNLINKED" ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Collegata a:{" "}
              <span className="font-medium text-[var(--ink)]">
                {row.linkedCampaignName}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setShowLink(true);
                setShowTarget(false);
              }}
              className="font-medium text-[var(--accent)]"
            >
              Cambia
            </button>
            <button
              type="button"
              disabled={unlinking}
              onClick={() => {
                void (async () => {
                  setUnlinking(true);
                  try {
                    await deleteMetaCampaignLink(row.clientId, row.id);
                    await onTargetMutated();
                    setShowLink(false);
                  } finally {
                    setUnlinking(false);
                  }
                })();
              }}
              className="font-medium text-[var(--accent)] disabled:opacity-50"
            >
              {unlinking ? "Scollegamento…" : "Scollega"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowLink(true);
              setShowTarget(false);
            }}
            className="font-medium text-[var(--accent)]"
          >
            Collega campagna Ally
          </button>
        )}
      </div>

      {showLink && (
        <LinkPicker
          clientId={row.clientId}
          metaCampaignId={row.id}
          currentLinkedId={row.linkedCampaignId}
          onMutated={onTargetMutated}
          onClose={() => setShowLink(false)}
        />
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
          currentKpi={row.storedPrimaryKpi}
          currentTarget={row.storedTargetValue}
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
            "id, client_id, meta_campaign_id, name, effective_status, raw_objective, last_synced_at, insights_period_since, insights_period_until, insights_period_frequency, primary_kpi, target_value, affianco_campaign_id",
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
          .select(
            "meta_campaign_id, spend, impressions, link_clicks, primary_result_type, primary_results, result_mapping_confidence",
          )
          .eq("user_id", user.id)
          .eq("client_id", clientId)
          .in("meta_campaign_id", campaignIds);

        const aggMap = new Map<
          string,
          {
            spend: number;
            impressions: number;
            linkClicks: number;
            primaryResults: number | null;
            primaryResultType: string | null;
            resultMappingConfidence: ResultMappingConfidence;
          }
        >();
        const typeSets = new Map<string, Set<string>>();
        const ambiguous = new Set<string>();
        for (const ins of (insightData ?? []) as {
          meta_campaign_id: string;
          spend: number | null;
          impressions: number | null;
          link_clicks: number | null;
          primary_result_type: string | null;
          primary_results: number | null;
          result_mapping_confidence: string | null;
        }[]) {
          const prev = aggMap.get(ins.meta_campaign_id) ?? {
            spend: 0,
            impressions: 0,
            linkClicks: 0,
            primaryResults: 0,
            primaryResultType: null,
            resultMappingConfidence: "UNKNOWN" as ResultMappingConfidence,
          };
          aggMap.set(ins.meta_campaign_id, {
            spend: prev.spend + (ins.spend ?? 0),
            impressions: prev.impressions + (ins.impressions ?? 0),
            linkClicks: prev.linkClicks + (ins.link_clicks ?? 0),
            primaryResults: prev.primaryResults,
            primaryResultType: prev.primaryResultType,
            resultMappingConfidence: prev.resultMappingConfidence,
          });
          if (ins.result_mapping_confidence === "AMBIGUOUS") {
            ambiguous.add(ins.meta_campaign_id);
          }
          if (
            ins.result_mapping_confidence === "CONFIDENT" &&
            ins.primary_result_type
          ) {
            const set = typeSets.get(ins.meta_campaign_id) ?? new Set();
            set.add(ins.primary_result_type);
            typeSets.set(ins.meta_campaign_id, set);
            const cur = aggMap.get(ins.meta_campaign_id)!;
            cur.primaryResults =
              (cur.primaryResults ?? 0) + (ins.primary_results ?? 0);
          }
        }
        for (const [id, agg] of aggMap) {
          if (ambiguous.has(id)) {
            agg.resultMappingConfidence = "AMBIGUOUS";
            agg.primaryResultType = null;
            agg.primaryResults = null;
            continue;
          }
          const types = typeSets.get(id);
          if (!types || types.size === 0) {
            agg.resultMappingConfidence = "UNKNOWN";
            agg.primaryResultType = null;
            agg.primaryResults = null;
          } else if (types.size > 1) {
            agg.resultMappingConfidence = "AMBIGUOUS";
            agg.primaryResultType = null;
            agg.primaryResults = null;
          } else {
            agg.resultMappingConfidence = "CONFIDENT";
            agg.primaryResultType = [...types][0];
          }
        }

        const linkedIds = [
          ...new Set(
            campRows
              .map((c) => c.affianco_campaign_id)
              .filter((id): id is string => typeof id === "string" && id.length > 0),
          ),
        ];
        const linkedMap = new Map<string, LinkedAffiancoCampaignSnapshot>();
        if (linkedIds.length > 0) {
          const { data: nativeRows } = await supabase
            .from("campaigns")
            .select(
              "id, name, objective, status, max_sustainable_cpa, estimated_cpm, target_margin, booking_service_value, show_up_rate, average_order_value, product_margin, average_receipt, store_margin, recovery_value, recovery_margin",
            )
            .eq("user_id", user.id)
            .eq("client_id", clientId)
            .in("id", linkedIds);
          for (const n of (nativeRows ?? []) as {
            id: string;
            name: string;
            objective: string | null;
            status: string | null;
            max_sustainable_cpa: number | null;
            estimated_cpm: number | null;
            target_margin: number | null;
            booking_service_value: number | null;
            show_up_rate: number | null;
            average_order_value: number | null;
            product_margin: number | null;
            average_receipt: number | null;
            store_margin: number | null;
            recovery_value: number | null;
            recovery_margin: number | null;
          }[]) {
            linkedMap.set(n.id, {
              id: n.id,
              name: n.name,
              objective: n.objective,
              status: n.status,
              maxSustainableCpa: n.max_sustainable_cpa,
              estimatedCpm: n.estimated_cpm,
              targetMargin: n.target_margin,
              bookingServiceValue: n.booking_service_value,
              showUpRate: n.show_up_rate,
              averageOrderValue: n.average_order_value,
              productMargin: n.product_margin,
              averageReceipt: n.average_receipt,
              storeMargin: n.store_margin,
              recoveryValue: n.recovery_value,
              recoveryMargin: n.recovery_margin,
            });
          }
        }

        const mapped = campRows.map((c) =>
          mapMetaCampaignToMonitoringRow(
            c,
            aggMap.get(c.meta_campaign_id) ?? null,
            clientName,
            c.affianco_campaign_id
              ? (linkedMap.get(c.affianco_campaign_id) ?? null)
              : null,
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
        Monitoraggio separato dalle campagne Ally. Imposta un target per
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
