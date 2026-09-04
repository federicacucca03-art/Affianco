"use client";

import type { Campagna } from "@/types/campagne";
import {
  badgeReviewDaStatus,
  etichettaStatusCampagna,
  formatDataBreve,
} from "@/types/campagne";
import { BadgeReviewClienteLabel } from "@/components/campagne/BadgeReviewCliente";
import { AllyListRow } from "@/components/shell/AllyListRow";
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
