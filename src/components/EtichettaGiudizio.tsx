import type { Giudizio } from "@/types/campagne";

const stili: Record<Giudizio, string> = {
  "Va bene": "bg-[#E8F5EE] text-[#3D8B57]",
  "Ancora presto": "bg-[#FFF6E5] text-[#B8860B]",
  "Da monitorare": "bg-[#FFF0E0] text-[#C26A0A]",
  "Da controllare": "bg-[#FDECEC] text-[#C45C5C]",
};

type Props = {
  giudizio: Giudizio;
  grande?: boolean;
};

export function EtichettaGiudizio({ giudizio, grande = false }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ${
        grande ? "px-4 py-2 text-base" : "px-3 py-1 text-xs"
      } ${stili[giudizio]}`}
    >
      {giudizio}
    </span>
  );
}
