"use client";

import Link from "next/link";
import {
  etichettaAttentionSource,
  etichettaAttentionState,
  etichettaPriorityBand,
  formatAttentionMetric,
  type AttentionState,
  type ControlRoomAttentionItem,
  type MondayControlRoomSummary,
} from "@/lib/monday-control-room";
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

function Badge({ kind, label }: { kind: StatoChipKind; label: string }) {
  return (
    <span
      className={`inline-flex h-5 max-w-full shrink-0 items-center rounded-full px-2 text-[10px] font-medium leading-none ${STILE[kind]}`}
    >
      {label}
    </span>
  );
}

function AttentionRow({ item }: { item: ControlRoomAttentionItem }) {
  const kind = chipKind(item.attentionState);
  const band = etichettaPriorityBand(item.attentionState);
  const metric = formatAttentionMetric(item);
  return (
    <li className="flex flex-col gap-2 border-b border-[rgba(80,70,130,0.06)] py-3 last:border-0 sm:flex-row sm:items-start sm:gap-5">
      <div className="flex flex-wrap items-center gap-1.5 sm:w-[9.5rem] sm:flex-col sm:items-start">
        <Badge kind={kind} label={etichettaAttentionState(item.attentionState)} />
        {band ? (
          <span className="text-[10px] font-medium text-[var(--ink-muted)]">
            {band}
          </span>
        ) : null}
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

export function MondayControlRoomSection({
  summary,
}: {
  summary: MondayControlRoomSummary;
}) {
  const urgent = summary.urgent.slice(0, MAX_URGENT);
  const stablePreview = summary.stable.slice(0, MAX_STABLE);
  const hasUrgent = urgent.length > 0;
  const historicalCount = summary.counts.HISTORICAL;
  const insufficientCount = summary.counts.INSUFFICIENT_DATA;

  return (
    <section className="aff-panel-white mt-3 min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-[var(--primary)]">
            Da controllare
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            Le campagne che meritano la tua attenzione adesso.
          </p>
        </div>
        <Link
          href="/risultati"
          className="text-xs font-medium text-[var(--primary)] hover:opacity-80"
        >
          Apri Control Room
        </Link>
      </div>

      {!hasUrgent ? (
        <div className="mt-3 rounded-[14px] bg-[var(--green-soft)]/50 px-3 py-3">
          <p className="text-sm font-medium text-[var(--ink)]">
            Nessuna campagna richiede interventi urgenti.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
            {summary.counts.STABLE > 0
              ? `${summary.counts.STABLE} ${summary.counts.STABLE === 1 ? "stabile" : "stabili"}`
              : "Nessuna stabile"}
            {" · "}
            {summary.counts.MONITOR > 0
              ? `${summary.counts.MONITOR} in monitoraggio`
              : "0 in monitoraggio"}
            {summary.counts.CONFIGURATION_REQUIRED > 0
              ? ` · ${summary.counts.CONFIGURATION_REQUIRED} da configurare`
              : ""}
            {insufficientCount > 0
              ? ` · ${insufficientCount} con dati insufficienti`
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

      {stablePreview.length > 0 ? (
        <div className="mt-4 border-t border-[rgba(80,70,130,0.06)] pt-3">
          <p className="text-[13px] font-medium text-[var(--ink-muted)]">
            Stabili
            {summary.counts.STABLE > MAX_STABLE
              ? ` · ${summary.counts.STABLE}`
              : ""}
          </p>
          <ul className="mt-1">
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
        <div className="mt-3 flex items-center justify-between gap-2">
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
