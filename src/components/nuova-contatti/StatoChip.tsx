"use client";

export type StatoChipKind = "ok" | "watch" | "critico" | "pending" | "info";

const ETICHETTA: Record<StatoChipKind, string> = {
  ok: "OK",
  watch: "Da monitorare",
  critico: "Critico",
  pending: "Da verificare",
  info: "Info",
};

const STILE: Record<StatoChipKind, string> = {
  ok: "bg-[var(--green-soft)] text-[#2d6a4a]",
  watch: "bg-[var(--yellow-soft)] text-[#6b5420]",
  critico: "bg-[var(--pink-soft)] text-[#7a3d58]",
  pending: "bg-[var(--lavender-muted)] text-[#5b4fa8]",
  info: "bg-[var(--primary-soft)] text-[var(--primary)]",
};

export function StatoChip({
  kind,
  label,
}: {
  kind: StatoChipKind;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight ${STILE[kind]}`}
    >
      {label ?? ETICHETTA[kind]}
    </span>
  );
}

export function chipDaEmoji(emoji: string): StatoChipKind {
  if (emoji === "🟢") return "ok";
  if (emoji === "🟡") return "watch";
  if (emoji === "🔴") return "critico";
  if (emoji === "ℹ️") return "info";
  return "pending";
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
        {spiegazione}
      </span>
    </li>
  );
}
