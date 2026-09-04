"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Home,
  LayoutGrid,
  LogOut,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAllyLogout } from "@/components/auth/useAllyLogout";

const STROKE = 1.75;

type VoceNav = {
  etichetta: string;
  href: string;
  icona: LucideIcon;
};

const voci: VoceNav[] = [
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

/** Compact left icon rail — M8.2 reference match */
export function IconRail() {
  const pathname = usePathname();
  const { esci, logoutErrore, logoutInCorso, email } = useAllyLogout();

  return (
    <aside
      className="hidden h-full w-[var(--rail-width)] shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--rail)] py-4 md:flex"
      aria-label="Navigazione principale"
    >
      <Link
        href="/home"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--primary)] text-[13px] font-semibold text-white"
        aria-label="Ally"
        title="Ally"
      >
        A
      </Link>

      <div className="my-5 h-px w-7 bg-[var(--border)]" aria-hidden />

      <nav className="flex flex-1 flex-col items-center gap-3">
        {voci.map((voce) => {
          const Icona = voce.icona;
          const attiva = isActive(pathname, voce.href);
          return (
            <Link
              key={voce.href}
              href={voce.href}
              className="aff-rail-btn"
              title={voce.etichetta}
              aria-label={voce.etichetta}
              aria-current={attiva ? "page" : undefined}
            >
              <Icona className="h-5 w-5" strokeWidth={STROKE} />
              <span className="sr-only">{voce.etichetta}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3 pb-1">
        <div className="mb-1 h-px w-7 bg-[var(--border)]" aria-hidden />
        <Link
          href="/impostazioni/integrazioni"
          title="Impostazioni"
          aria-label="Impostazioni"
          aria-current={
            pathname.startsWith("/impostazioni") ? "page" : undefined
          }
          className="aff-rail-btn"
        >
          <Settings className="h-5 w-5" strokeWidth={STROKE} />
          <span className="sr-only">Impostazioni</span>
        </Link>
        <button
          type="button"
          onClick={() => void esci()}
          disabled={logoutInCorso}
          title="Esci"
          aria-label={
            logoutInCorso
              ? "Uscita…"
              : email
                ? `Esci (${email})`
                : "Esci"
          }
          className="aff-rail-btn disabled:opacity-60"
        >
          <LogOut className="h-5 w-5" strokeWidth={STROKE} />
        </button>
        {logoutErrore ? (
          <p className="max-w-[52px] px-1 text-center text-[9px] leading-tight text-[#7a3d58]">
            {logoutErrore}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
