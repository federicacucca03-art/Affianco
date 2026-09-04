import type { Giudizio } from "@/types/campagne";
import { AllyBadge, type AllyBadgeVariant } from "@/components/shell/AllyBadge";

const VARIANT: Record<Giudizio, AllyBadgeVariant> = {
  "Va bene": "success",
  "Ancora presto": "warning",
  "Da monitorare": "warning",
  "Da controllare": "danger",
};

type Props = {
  giudizio: Giudizio;
  grande?: boolean;
};

export function EtichettaGiudizio({ giudizio, grande = false }: Props) {
  return (
    <AllyBadge
      variant={VARIANT[giudizio]}
      pill
      className={grande ? "min-h-8 px-4 text-sm" : undefined}
    >
      {giudizio}
    </AllyBadge>
  );
}
