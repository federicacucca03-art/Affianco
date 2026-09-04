"use client";

import {
  CalendarDays,
  MapPin,
  Megaphone,
  Phone,
  RotateCcw,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import {
  AllyFeatureCard,
  type AllyFeatureTone,
} from "@/components/shell/AllyFeatureCard";
import type { SituazioneId } from "@/types/campagne";

type ObjectiveCard = {
  id: SituazioneId | "ecommerce";
  title: string;
  description: string;
  status: "active" | "coming_soon";
  disabled: boolean;
  href: string | null;
  icon: LucideIcon;
  tone: AllyFeatureTone;
};

/**
 * Objective cards — same AllyFeatureCard + Home tones as /home quick actions.
 * Desktop: 3×2 so card proportions match Home (not six cramped columns).
 */
const OBJECTIVES: ObjectiveCard[] = [
  {
    id: "contatti",
    title: "Più richieste di contatto",
    description: "Dentisti, avvocati, artigiani",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/richieste-contatto",
    icon: Phone,
    tone: 1,
  },
  {
    id: "prenotazioni",
    title: "Più prenotazioni",
    description: "Estetiste, ristoranti, palestre",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/prenotazioni",
    icon: CalendarDays,
    tone: 4,
  },
  {
    id: "vendite",
    title: "Più vendite online",
    description: "E-commerce con catalogo",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/vendite",
    icon: ShoppingBag,
    tone: 2,
  },
  {
    id: "negozio",
    title: "Più gente in negozio",
    description: "Attività con una sede fisica",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/instore",
    icon: MapPin,
    tone: 1,
  },
  {
    id: "recupero",
    title: "Recuperare chi non ha comprato",
    description: "Serve chi ti conosce già",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/retargeting",
    icon: RotateCcw,
    tone: 3,
  },
  {
    id: "apertura",
    title: "Far conoscere un'apertura",
    description: "Nuova sede, evento, lancio",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/apertura",
    icon: Megaphone,
    tone: 4,
  },
];

type Props = {
  clienteId?: string | null;
};

function hrefConCliente(href: string, clienteId?: string | null) {
  if (!clienteId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}clienteId=${encodeURIComponent(clienteId)}`;
}

export function GrigliaSituazioni({ clienteId }: Props = {}) {
  return (
    <div className="mx-auto grid w-full max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {OBJECTIVES.map((item) => {
        const isActive = item.disabled === false && item.status === "active";
        return (
          <AllyFeatureCard
            key={item.id}
            title={item.title}
            body={item.description}
            icon={item.icon}
            tone={item.tone}
            href={
              isActive && item.href
                ? hrefConCliente(item.href, clienteId)
                : undefined
            }
            disabled={!isActive}
          />
        );
      })}
    </div>
  );
}
