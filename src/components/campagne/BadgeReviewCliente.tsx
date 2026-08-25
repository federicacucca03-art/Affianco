"use client";

import type { BadgeReviewCliente } from "@/types/campagne";

const stili: Record<BadgeReviewCliente, string> = {
  "In Attesa": "bg-[#FFF6E5] text-[#B8860B]",
  Approvata: "bg-[#FFF8E7] text-[#9A7B0A] ring-1 ring-[#E8D48A]",
  "Revisione Richiesta": "bg-[#FDECEC] text-[#C45C5C]",
};

type Props = {
  badge: BadgeReviewCliente;
};

export function BadgeReviewClienteLabel({ badge }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${stili[badge]}`}
    >
      {badge === "Approvata" ? "✅ " : badge === "Revisione Richiesta" ? "⚠️ " : ""}
      {badge}
    </span>
  );
}
