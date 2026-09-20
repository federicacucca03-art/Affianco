"use client";

import Link from "next/link";
import type { Campagna } from "@/types/campagne";
import {
  badgeReviewDaStatus,
  etichettaStatusCampagna,
  formatDataBreve,
} from "@/types/campagne";
import { BadgeReviewClienteLabel } from "@/components/campagne/BadgeReviewCliente";
import { AllyListRow } from "@/components/shell/AllyListRow";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import type { InventarioRiga } from "@/lib/campagne-inventory-ui";
import { StatoChip, type StatoChipKind } from "@/components/nuova-contatti/StatoChip";

function chipKindForStato(label: string): StatoChipKind {
  const l = label.toLowerCase();
  if (l.includes("approvat")) return "ok";
  if (l.includes("revision")) return "critico";
  if (l.includes("attesa")) return "watch";
  if (l.includes("bozza") || l.includes("configur")) return "pending";
  if (l.includes("monitor") || l.includes("controll")) return "watch";
  if (l.includes("storico") || l.includes("pausa")) return "info";
  return "info";
}

type InventarioProps = {
  riga: InventarioRiga;
  muted?: boolean;
};

/** Inventory row — single status vocabulary, source, optional next action. */
export function RigaCampagnaInventario({ riga, muted }: InventarioProps) {
  const metaParts = [
    riga.clientName,
    riga.objectiveLabel,
    riga.sourceLabel,
    riga.periodLabel,
  ].filter(Boolean);

  // Avoid repeating client name when title already equals client.
  const meta =
    riga.title.trim().toLowerCase() === riga.clientName.trim().toLowerCase()
      ? [riga.objectiveLabel, riga.sourceLabel, riga.periodLabel]
          .filter(Boolean)
          .join(" · ")
      : metaParts.join(" · ");

  return (
    <div
      className={[
        "aff-list-row flex-col items-stretch gap-2 sm:flex-row sm:items-center",
        muted ? "opacity-80" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ally-violet-soft)] text-[12px] font-semibold text-[var(--ally-violet)]"
        >
          {riga.clientName.slice(0, 2).toUpperCase() || "·"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {riga.title}
          </p>
          {meta ? (
            <p className="mt-0.5 truncate text-[12.5px] leading-snug text-[var(--ink-muted)]">
              {meta}
            </p>
          ) : null}
          {riga.nextActionTitle ? (
            <p className="mt-1.5 text-[12px] text-[var(--ink)]">
              <span className="text-[var(--ink-muted)]">Prossimo passo:</span>{" "}
              {riga.nextActionTitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <StatoChip
          kind={chipKindForStato(riga.statoLabel)}
          label={riga.statoLabel}
        />
        <Link
          href={riga.href}
          className="text-[13px] font-medium text-[var(--ink)] hover:text-[var(--primary)]"
        >
          {riga.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

type Props = {
  campagna: Campagna;
};

/**
 * Legacy helper retained for any direct Campagna-based usage.
 * Inventory list uses RigaCampagnaInventario.
 */
export function RigaCampagna({ campagna }: Props) {
  const badge = badgeReviewDaStatus(campagna.status);
  const data = formatDataBreve(campagna.dataLancio);
  const obiettivo = etichettaObiettivo(campagna.objective);
  const status = etichettaStatusCampagna(campagna.status);
  const meta = [data, obiettivo, status].filter(Boolean).join(" · ");

  return (
    <AllyListRow
      href={`/campagne/${campagna.id}`}
      leading={
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ally-violet-soft)] text-sm font-semibold text-[var(--ally-violet)]"
        >
          {campagna.iniziali}
        </span>
      }
      title={campagna.nomeCampagna?.trim() || campagna.nomeCliente}
      meta={
        campagna.nomeCampagna?.trim()
          ? `${campagna.nomeCliente} · ${meta}`
          : meta || campagna.stato
      }
      trailing={<BadgeReviewClienteLabel badge={badge} />}
    />
  );
}
