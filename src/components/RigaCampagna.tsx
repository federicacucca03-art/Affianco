"use client";

import Link from "next/link";
import type { Campagna } from "@/types/campagne";
import {
  badgeReviewDaStatus,
  etichettaStatusCampagna,
  formatDataBreve,
} from "@/types/campagne";
import { BadgeReviewClienteLabel } from "@/components/campagne/BadgeReviewCliente";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";

type Props = {
  campagna: Campagna;
};

export function RigaCampagna({ campagna }: Props) {
  const badge = badgeReviewDaStatus(campagna.status);
  const data = formatDataBreve(campagna.dataLancio);
  const obiettivo = etichettaObiettivo(campagna.objective);
  const status = etichettaStatusCampagna(campagna.status);
  const meta = [data, obiettivo, status].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/campagne/${campagna.id}`}
      className="flex w-full items-center gap-3 rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] sm:gap-4"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-medium text-[var(--accent)]"
      >
        {campagna.iniziali}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--ink)]">
          {campagna.nomeCampagna?.trim() || campagna.nomeCliente}
        </p>
        <p className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
          {campagna.nomeCampagna?.trim()
            ? `${campagna.nomeCliente} · ${meta}`
            : meta || campagna.stato}
        </p>
      </div>

      <BadgeReviewClienteLabel badge={badge} />
    </Link>
  );
}
