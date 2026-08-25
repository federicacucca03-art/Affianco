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
import Link from "next/link";
import type { SituazioneId } from "@/types/campagne";

type ObjectiveCard = {
  id: SituazioneId | "ecommerce";
  title: string;
  description: string;
  badge: "ATTIVO" | "IN ARRIVO";
  status: "active" | "coming_soon";
  disabled: boolean;
  href: string | null;
  icon: LucideIcon;
  colori: { fondo: string; icona: string };
};

/** Schede "Crea una campagna" su /campagne. */
const OBJECTIVES: ObjectiveCard[] = [
  {
    id: "contatti",
    title: "Più richieste di contatto",
    description: "Dentisti, avvocati, artigiani",
    badge: "ATTIVO",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/richieste-contatto",
    icon: Phone,
    colori: { fondo: "#DCEBFF", icona: "#2F6FED" },
  },
  {
    id: "prenotazioni",
    title: "Più prenotazioni",
    description: "Estetiste, ristoranti, palestre",
    badge: "ATTIVO",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/prenotazioni",
    icon: CalendarDays,
    colori: { fondo: "#DDF2F5", icona: "#2A8A96" },
  },
  {
    id: "vendite",
    title: "Più vendite online",
    description: "E-commerce con catalogo",
    badge: "ATTIVO",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/vendite",
    icon: ShoppingBag,
    colori: { fondo: "#E4F3E8", icona: "#3D8B57" },
  },
  {
    id: "negozio",
    title: "Più gente in negozio",
    description: "Attività con una sede fisica",
    badge: "ATTIVO",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/instore",
    icon: MapPin,
    colori: { fondo: "#E8EAF0", icona: "#5A6578" },
  },
  {
    id: "recupero",
    title: "Recuperare chi non ha comprato",
    description: "Serve chi ti conosce già",
    badge: "ATTIVO",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/retargeting",
    icon: RotateCcw,
    colori: { fondo: "#EBE4F5", icona: "#6B5B8C" },
  },
  {
    id: "apertura",
    title: "Far conoscere un'apertura",
    description: "Nuova sede, evento, lancio",
    badge: "ATTIVO",
    status: "active",
    disabled: false,
    href: "/campagne/nuova/apertura",
    icon: Megaphone,
    colori: { fondo: "#F5E6E2", icona: "#C06B55" },
  },
];

const TOOLTIP_IN_ARRIVO =
  "Tutti gli obiettivi principali sono attivi. Continuano gli aggiornamenti sulle funzioni avanzate.";

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {OBJECTIVES.map((item) => {
        const Icona = item.icon;
        const isActive = item.disabled === false && item.status === "active";

        const cardInner = (
          <>
            <span
              aria-hidden
              className="flex aspect-[4/3] w-full items-center justify-center"
              style={{ backgroundColor: item.colori.fondo }}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70">
                <Icona
                  className="h-6 w-6"
                  style={{ color: item.colori.icona }}
                  strokeWidth={1.75}
                />
              </span>
            </span>
            <div className="flex flex-1 flex-col px-3.5 py-3">
              <p className="text-sm font-medium leading-snug text-[var(--ink)]">
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-snug text-[var(--ink-muted)]">
                {item.description}
              </p>
            </div>
          </>
        );

        if (isActive && item.href) {
          return (
            <div key={item.id} className="h-full">
              <Link
                href={hrefConCliente(item.href, clienteId)}
                className="relative flex h-full w-full flex-col overflow-hidden rounded-[var(--radius)] border border-[#2F6FED]/35 bg-white text-left shadow-[var(--shadow-soft)] ring-1 ring-[#2F6FED]/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2F6FED]/50 hover:bg-[var(--surface-hover)] hover:shadow-md"
              >
                {cardInner}
              </Link>
            </div>
          );
        }

        return (
          <div key={item.id} className="group relative h-full">
            <div
              className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-[var(--radius)] bg-white text-left opacity-60 shadow-[var(--shadow-soft)]"
              aria-disabled="true"
            >
              {cardInner}
            </div>
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-center text-[11px] leading-snug text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
            >
              {TOOLTIP_IN_ARRIVO}
            </div>
          </div>
        );
      })}
    </div>
  );
}
