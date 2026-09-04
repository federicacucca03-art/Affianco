"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Home,
  LayoutGrid,
  Plus,
  Settings,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";

const STROKE = 1.75;

type VoceNav = {
  etichetta: string;
  href: string;
  icona: LucideIcon;
};

const vociPrimarie: VoceNav[] = [
  { etichetta: "Control Room", href: "/home", icona: Home },
  { etichetta: "Campagne", href: "/campagne", icona: LayoutGrid },
  { etichetta: "Risultati", href: "/risultati", icona: TrendingUp },
  { etichetta: "Notifiche", href: "/notifiche", icona: Bell },
  { etichetta: "Clienti", href: "/clienti", icona: Briefcase },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  aperta: boolean;
  onChiudi: () => void;
};

/** Labeled secondary sidebar — M8.2 reference match */
export function SecondarySidebar({ aperta, onChiudi }: Props) {
  const pathname = usePathname();
  const { apriModaleCampagna } = useOnboardingCampagna();

  return (
    <>
      {aperta ? (
        <button
          type="button"
          aria-label="Chiudi menu"
          className="fixed inset-0 z-40 bg-[var(--ink)]/20 md:hidden"
          onClick={onChiudi}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,var(--sidebar-width))] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-3.5 py-4 transition-transform md:static md:z-auto md:translate-x-0 ${
          aperta ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        aria-label="Menu secondario"
      >
        <div className="flex items-center justify-between gap-2 md:hidden">
          <p className="text-sm font-semibold text-[var(--ink)]">Menu</p>
          <button
            type="button"
            aria-label="Chiudi menu"
            className="rounded-[8px] p-1.5 text-[var(--ink-muted)] hover:bg-white"
            onClick={onChiudi}
          >
            <X className="h-5 w-5" strokeWidth={STROKE} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            apriModaleCampagna();
            onChiudi();
          }}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-white px-3.5 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] md:mt-0"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={STROKE} aria-hidden />
          Nuova campagna
        </button>

        <nav className="mt-5 flex flex-col gap-0.5">
          <p className="mb-1.5 px-2 text-[11px] font-medium text-[var(--ink-muted)]">
            Navigazione
          </p>
          {vociPrimarie.map((voce) => {
            const Icona = voce.icona;
            const attiva = isActive(pathname, voce.href);
            return (
              <Link
                key={voce.href}
                href={voce.href}
                onClick={onChiudi}
                className="aff-nav-item"
                aria-current={attiva ? "page" : undefined}
              >
                <Icona className="h-[18px] w-[18px] shrink-0" strokeWidth={STROKE} />
                <span>{voce.etichetta}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="mb-1.5 px-2 text-[11px] font-medium text-[var(--ink-muted)]">
            Connessioni
          </p>
          <Link
            href="/impostazioni/integrazioni"
            onClick={onChiudi}
            className="aff-nav-item"
            aria-current={
              pathname.startsWith("/impostazioni") ? "page" : undefined
            }
          >
            <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={STROKE} />
            <span>Meta</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
