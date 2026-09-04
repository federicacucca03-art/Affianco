"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreAuthDev,
  messaggioErroreAuth,
} from "@/lib/auth-errori";

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
  const router = useRouter();
  const { email, signOut } = useAuth();
  const [logoutErrore, setLogoutErrore] = useState<string | null>(null);
  const [logoutInCorso, setLogoutInCorso] = useState(false);

  async function esci() {
    setLogoutErrore(null);
    setLogoutInCorso(true);
    try {
      await signOut();
      router.replace("/login");
    } catch (e) {
      logErroreAuthDev("logout", e);
      setLogoutErrore(messaggioErroreAuth(e, "logout"));
    } finally {
      setLogoutInCorso(false);
    }
  }

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
          title={email ? `Esci (${email})` : "Esci"}
          aria-label={logoutInCorso ? "Uscita…" : "Esci"}
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
