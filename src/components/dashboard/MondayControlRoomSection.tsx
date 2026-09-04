"use client";

import { useState } from "react";
import Link from "next/link";
import {
  etichettaAttentionSource,
  etichettaAttentionState,
  etichettaUrgencyLevel,
  formatAttentionMetric,
  type AttentionState,
  type ControlRoomAttentionItem,
  type MondayControlRoomSummary,
  type UrgencyLevel,
} from "@/lib/monday-control-room";
import {
  etichettaConfidence,
  etichettaLikelyArea,
  isDiagnosisUiEligible,
  resolveDiagnosisEligibility,
} from "@/lib/campaign-diagnosis/eligibility";
import { fetchCampaignDiagnosis } from "@/lib/campaign-diagnosis-client";
import type { CampaignDiagnosisResponse } from "@/lib/campaign-diagnosis/types";
import type { StatoChipKind } from "@/components/nuova-contatti/StatoChip";

const MAX_URGENT = 8;
const MAX_STABLE = 3;

const STILE: Record<StatoChipKind, string> = {
  ok: "bg-[var(--green-soft)] text-[#2d6a4a]",
  watch: "bg-[var(--yellow-soft)] text-[#6b5420]",
  critico: "bg-[#f8d5e2] text-[#7a3d58]",
  pending: "bg-[var(--lavender-muted)] text-[#5b4fa8]",
  info: "bg-[var(--primary-soft)] text-[var(--primary)]",
};

function chipKind(state: AttentionState): StatoChipKind {
  switch (state) {
    case "CRITICAL":
    case "NEEDS_ATTENTION":
      return "critico";
    case "MONITOR":
      return "watch";
    case "STABLE":
      return "ok";
    case "CONFIGURATION_REQUIRED":
    case "INSUFFICIENT_DATA":
      return "pending";
    case "HISTORICAL":
      return "info";
  }
}

/** Secondary supporting line — never competing with the attention badge. */
function urgencySupportingText(level: UrgencyLevel): string | null {
  const short = etichettaUrgencyLevel(level);
  if (!short) return null;
  return `Priorità ${short.toLowerCase()}`;
}

function urgencyTone(level: UrgencyLevel): string {
  switch (level) {
    case "NOW":
      return "text-[12px] text-[var(--ink)]";
    case "SOON":
      return "text-[12px] text-[var(--ink-muted)]";
    case "LATER":
      return "text-[11px] text-[var(--ink-muted)]/80";
    case "NONE":
      return "text-[11px] text-[var(--ink-muted)]/80";
  }
}

function Badge({ kind, label }: { kind: StatoChipKind; label: string }) {
  return (
    <span
      className={`inline-flex h-5 max-w-full shrink-0 items-center rounded-full px-2 text-[10px] font-medium leading-none ${STILE[kind]}`}
    >
      {label}
    </span>
  );
}

function rowDiagnosisEligible(item: ControlRoomAttentionItem): boolean {
  const eligibility = resolveDiagnosisEligibility({
    attentionState: item.attentionState,
    health: item.healthStatus,
    campaignStatus: item.campaignStatus,
    trend: item.trend,
    actualValue: item.primaryMetricValue,
    targetValue: item.targetValue,
  });
  return isDiagnosisUiEligible(eligibility);
}

function DiagnosisPanel({
  result,
  loading,
  error,
  onRetry,
}: {
  result: CampaignDiagnosisResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <p className="mt-2 text-[12px] text-[var(--ink-muted)]">Analisi in corso…</p>
    );
  }
  if (error) {
    return (
      <div className="mt-2">
        <p className="text-[12px] text-[var(--ink-muted)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-[12px] font-medium text-[var(--primary)] hover:opacity-80"
        >
          Riprova
        </button>
      </div>
    );
  }
  if (!result) return null;
  if (!result.diagnosis) {
    return (
      <div className="mt-2">
        <p className="text-[12px] text-[var(--ink-muted)]">
          {result.message ?? "Analisi non disponibile al momento."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-[12px] font-medium text-[var(--primary)] hover:opacity-80"
        >
          Riprova
        </button>
      </div>
    );
  }
  const d = result.diagnosis;
  return (
    <div className="mt-2 rounded-[10px] bg-[rgba(80,70,130,0.04)] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Perché Ally lo segnala
      </p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--ink)]">{d.summary}</p>
      <p className="mt-2 text-[12px] text-[var(--ink-muted)]">
        Area probabile:{" "}
        <span className="text-[var(--ink)]">{etichettaLikelyArea(d.likely_area)}</span>
        {" · "}
        Confidenza:{" "}
        <span className="text-[var(--ink)]">{etichettaConfidence(d.confidence)}</span>
      </p>
      {d.evidence.length > 0 ? (
        <>
          <p className="mt-2 text-[11px] font-medium text-[var(--ink-muted)]">
            Evidenze
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-[var(--ink-muted)]">
            {d.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </>
      ) : null}
      {d.uncertainty || d.what_not_to_conclude ? (
        <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-muted)]">
          Limite: {d.what_not_to_conclude ?? d.uncertainty}
        </p>
      ) : null}
    </div>
  );
}

function AttentionRow({ item }: { item: ControlRoomAttentionItem }) {
  const kind = chipKind(item.attentionState);
  const urgencyText = urgencySupportingText(item.urgencyLevel);
  const metric = formatAttentionMetric(item);
  const canDiagnose = rowDiagnosisEligible(item);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignDiagnosisResponse | null>(null);

  async function runDiagnosis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCampaignDiagnosis(item.campaignId, item.source);
      setResult(res);
      if (!res.diagnosis && res.message) {
        // Keep panel open with message + retry
      }
    } catch {
      setError("Analisi non disponibile al momento.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function onPerche() {
    const next = !open;
    setOpen(next);
    if (next && !result && !loading) {
      void runDiagnosis();
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-[rgba(80,70,130,0.06)] py-3 last:border-0 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex flex-wrap items-center gap-1.5 sm:w-[9rem] sm:flex-col sm:items-start">
        <Badge kind={kind} label={etichettaAttentionState(item.attentionState)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-[var(--ink)]">
          {item.clientName}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
          {item.campaignName}
          <span className="text-[var(--ink-muted)]/70">
            {" · "}
            {etichettaAttentionSource(item.source)}
          </span>
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--ink)]">
          {item.reason}
        </p>
        {metric ? (
          <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{metric}</p>
        ) : null}
        {urgencyText ? (
          <p
            className={`mt-1 leading-snug ${urgencyTone(item.urgencyLevel)}`}
            title={item.urgencyReason}
          >
            {urgencyText}
          </p>
        ) : null}
        {canDiagnose ? (
          <button
            type="button"
            onClick={onPerche}
            className="mt-1.5 text-[12px] font-medium text-[var(--primary)] hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            {open ? "Nascondi" : "Perché?"}
          </button>
        ) : null}
        {open && canDiagnose ? (
          <DiagnosisPanel
            result={result}
            loading={loading}
            error={error}
            onRetry={() => void runDiagnosis()}
          />
        ) : null}
      </div>
      <Link
        href={item.href}
        className="inline-flex min-h-8 w-fit shrink-0 items-center text-[13px] font-medium text-[var(--primary)] hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        Apri →
      </Link>
    </li>
  );
}

function plural(n: number, uno: string, molti: string): string {
  return `${n} ${n === 1 ? uno : molti}`;
}

/**
 * Attention-oriented Oggi summary (one taxonomy).
 * Urgency still drives list ordering, not the summary chips.
 */
function TodaySummary({ summary }: { summary: MondayControlRoomSummary }) {
  const daControllare =
    summary.counts.CRITICAL + summary.counts.NEEDS_ATTENTION;
  const chips: { key: string; label: string; strong?: boolean }[] = [];
  if (daControllare > 0) {
    chips.push({
      key: "check",
      label: plural(daControllare, "da controllare", "da controllare"),
      strong: true,
    });
  }
  if (summary.counts.CONFIGURATION_REQUIRED > 0) {
    chips.push({
      key: "cfg",
      label: plural(
        summary.counts.CONFIGURATION_REQUIRED,
        "da configurare",
        "da configurare",
      ),
    });
  }
  if (summary.counts.MONITOR > 0) {
    chips.push({
      key: "mon",
      label: plural(
        summary.counts.MONITOR,
        "da monitorare",
        "da monitorare",
      ),
    });
  }
  if (summary.counts.INSUFFICIENT_DATA > 0) {
    chips.push({
      key: "ins",
      label: plural(
        summary.counts.INSUFFICIENT_DATA,
        "con dati insufficienti",
        "con dati insufficienti",
      ),
    });
  }
  if (summary.counts.STABLE > 0) {
    chips.push({
      key: "ok",
      label: plural(summary.counts.STABLE, "stabile", "stabili"),
    });
  }
  if (summary.counts.HISTORICAL > 0) {
    chips.push({
      key: "hist",
      label: plural(
        summary.counts.HISTORICAL,
        "in revisione storica",
        "in revisione storica",
      ),
    });
  }

  if (chips.length === 0) {
    return (
      <div className="mb-4">
        <p className="text-[13px] font-medium text-[var(--primary)]">Oggi</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Nessun carico operativo al momento.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-[13px] font-medium text-[var(--primary)]">Oggi</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
        {chips.map((chip) => (
          <li
            key={chip.key}
            className={`text-[13px] leading-snug ${
              chip.strong
                ? "font-medium text-[var(--ink)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            {chip.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MondayControlRoomSection({
  summary,
}: {
  summary: MondayControlRoomSummary;
}) {
  const urgent = summary.urgent.slice(0, MAX_URGENT);
  const stablePreview = summary.stable.slice(0, MAX_STABLE);
  const hasUrgent = urgent.length > 0;
  const historicalCount = summary.counts.HISTORICAL;

  return (
    <section className="aff-panel-white mt-4 min-w-0 p-4 sm:p-5">
      <TodaySummary summary={summary} />

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[rgba(80,70,130,0.06)] pt-3">
        <div>
          <p className="text-[15px] font-medium text-[var(--ink)]">
            Da controllare
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            Le campagne che meritano la tua attenzione adesso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/campagne"
            className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--primary)]"
          >
            Vedi tutte le campagne
          </Link>
          <Link
            href="/risultati"
            className="text-xs font-medium text-[var(--primary)] hover:opacity-80"
          >
            Apri Control Room
          </Link>
        </div>
      </div>

      {!hasUrgent ? (
        <div className="mt-3 rounded-[14px] bg-[var(--green-soft)]/50 px-3 py-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            Nessuna campagna richiede attenzione urgente.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            {summary.counts.STABLE > 0
              ? plural(summary.counts.STABLE, "stabile", "stabili")
              : "Nessuna stabile"}
            {summary.counts.CONFIGURATION_REQUIRED > 0
              ? ` · ${plural(summary.counts.CONFIGURATION_REQUIRED, "da configurare", "da configurare")}`
              : ""}
            {summary.counts.MONITOR > 0
              ? ` · ${plural(summary.counts.MONITOR, "da monitorare", "da monitorare")}`
              : ""}
            {summary.counts.INSUFFICIENT_DATA > 0
              ? ` · ${plural(summary.counts.INSUFFICIENT_DATA, "con dati insufficienti", "con dati insufficienti")}`
              : ""}
            {historicalCount > 0
              ? ` · ${plural(historicalCount, "in revisione storica", "in revisione storica")}`
              : ""}
          </p>
        </div>
      ) : (
        <ul className="mt-1">
          {urgent.map((item) => (
            <AttentionRow
              key={`${item.source}-${item.campaignId}`}
              item={item}
            />
          ))}
        </ul>
      )}

      {stablePreview.length > 0 && hasUrgent ? (
        <div className="mt-3 border-t border-[rgba(80,70,130,0.06)] pt-3">
          <p className="text-[12px] font-medium text-[var(--ink-muted)]">
            Stabili
            {summary.counts.STABLE > MAX_STABLE
              ? ` · ${summary.counts.STABLE}`
              : ""}
          </p>
          <ul className="mt-0.5">
            {stablePreview.map((item) => (
              <AttentionRow
                key={`stable-${item.source}-${item.campaignId}`}
                item={item}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {historicalCount > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(80,70,130,0.06)] pt-3">
          <p className="text-[12px] text-[var(--ink-muted)]">
            {historicalCount === 1
              ? "1 campagna in revisione storica"
              : `${historicalCount} campagne in revisione storica`}
          </p>
          <Link
            href="/risultati"
            className="text-xs font-medium text-[var(--primary)] hover:opacity-80"
          >
            Vedi storico
          </Link>
        </div>
      ) : null}
    </section>
  );
}
