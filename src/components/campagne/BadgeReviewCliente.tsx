"use client";

import type { BadgeReviewCliente } from "@/types/campagne";

const stili: Record<BadgeReviewCliente, string> = {
  "In Attesa": "aff-badge aff-badge--warning",
  Approvata: "aff-badge aff-badge--success",
  "Revisione Richiesta": "aff-badge aff-badge--danger",
};

type Props = {
  badge: BadgeReviewCliente;
};

export function BadgeReviewClienteLabel({ badge }: Props) {
  return <span className={`shrink-0 ${stili[badge]}`}>{badge}</span>;
}
