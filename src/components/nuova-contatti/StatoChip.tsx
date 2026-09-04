"use client";

import type { HealthStatus } from "@/lib/control-room";
import { AllyBadge, type AllyBadgeVariant } from "@/components/shell/AllyBadge";

export type StatoChipKind = "ok" | "watch" | "critico" | "pending" | "info";

const ETICHETTA: Record<StatoChipKind, string> = {
  ok: "OK",
  watch: "Da monitorare",
  critico: "Critico",
  pending: "Da verificare",
  info: "Info",
};

const VARIANT: Record<StatoChipKind, AllyBadgeVariant> = {
  ok: "success",
  watch: "warning",
  critico: "danger",
  pending: "neutral",
  info: "violet",
};

const INDICATORE_INIZIALE =
  /^(?:[\s]*(?:🟢|🟡|🔴|⚪|ℹ️|●|•|⚠️|✅)\s*)+/u;

export function testoSenzaIndicatoreStato(testo: string): string {
  return testo.replace(INDICATORE_INIZIALE, "").trimStart();
}

export function StatoChip({
  kind,
  label,
}: {
  kind: StatoChipKind;
  label?: string;
}) {
  return (
    <AllyBadge variant={VARIANT[kind]} pill>
      {label ?? ETICHETTA[kind]}
    </AllyBadge>
  );
}

export function chipDaEmoji(emoji: string): StatoChipKind {
  if (emoji === "🟢") return "ok";
  if (emoji === "🟡") return "watch";
  if (emoji === "🔴") return "critico";
  if (emoji === "ℹ️") return "info";
  return "pending";
}

export function chipDaHealth(
  status: HealthStatus | null | undefined,
): StatoChipKind {
  switch (status) {
    case "GREEN":
      return "ok";
    case "YELLOW":
      return "watch";
    case "RED":
      return "critico";
    case "INSUFFICIENT":
      return "pending";
    default:
      return "pending";
  }
}

export function chipLabelMessaggio(kind: StatoChipKind): string {
  if (kind === "ok") return "OK";
  if (kind === "watch" || kind === "critico") return "Da rivedere";
  if (kind === "pending") return "Da verificare";
  return "Info";
}

export function chipLabelFormato(kind: StatoChipKind): string {
  if (kind === "ok") return "OK";
  if (kind === "watch") return "Da ottimizzare";
  return "Da verificare";
}

export function RigaDiagnostica({
  voce,
  kind,
  spiegazione,
  chipLabel,
}: {
  voce: string;
  kind: StatoChipKind;
  spiegazione: string;
  chipLabel?: string;
}) {
  return (
    <li className="grid grid-cols-1 gap-1.5 border-b border-[var(--border)] py-3 last:border-0 sm:grid-cols-[10rem_8.25rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="text-[13px] font-medium text-[var(--ink)]">{voce}</span>
      <span className="sm:pt-0.5">
        <StatoChip kind={kind} label={chipLabel} />
      </span>
      <span className="text-[13px] leading-relaxed text-[var(--ink-muted)] sm:text-left">
        {testoSenzaIndicatoreStato(spiegazione)}
      </span>
    </li>
  );
}
