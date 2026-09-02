"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  House,
  LayoutGrid,
  LogOut,
  Settings,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreAuthDev,
  messaggioErroreAuth,
} from "@/lib/auth-errori";

type VoceNav = {
  etichetta: string;
  href: string | null;
  icona: LucideIcon;
};

const voci: VoceNav[] = [
  { etichetta: "Home", href: "/home", icona: House },
  { etichetta: "Campagne", href: "/campagne", icona: LayoutGrid },
  { etichetta: "Clienti", href: "/clienti", icona: Briefcase },
  { etichetta: "Risultati", href: "/risultati", icona: TrendingUp },
];

type Props = {
  aperta: boolean;
  onChiudi: () => void;
};

export function BarraLaterale({ aperta, onChiudi }: Props) {
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
      onChiudi();
      router.replace("/login");
    } catch (e) {
      logErroreAuthDev("logout", e);
      setLogoutErrore(messaggioErroreAuth(e, "logout"));
    } finally {
      setLogoutInCorso(false);
    }
  }

  return (
    <>
      {aperta && (
        <button
          type="button"
          aria-label="Chiudi menu"
          className="fixed inset-0 z-40 bg-[var(--ink)]/25 md:hidden"
          onClick={onChiudi}
        />
      )}

      <aside
        className={`fixed inset-y-3 left-3 z-50 flex w-16 flex-col rounded-[28px] bg-[#eeecf7] py-6 shadow-[var(--shadow-soft)] md:static md:inset-auto md:h-auto md:self-stretch md:translate-x-0 ${
          aperta ? "translate-x-0" : "-translate-x-[120%]"
        }`}
      >
        <div className="flex flex-col items-center px-2">
          <Link
            href="/home"
            onClick={onChiudi}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-medium text-[var(--primary)] shadow-[var(--shadow-card)]"
            aria-label="Affianco"
            title="Affianco"
          >
            A
          </Link>
          <button
            type="button"
            aria-label="Chiudi menu"
            className="mt-3 rounded-xl p-1 text-[var(--ink-muted)] hover:bg-white/80 md:hidden"
            onClick={onChiudi}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="mt-10 flex flex-1 flex-col items-center gap-4 px-2">
          {voci.map((voce) => {
            const Icona = voce.icona;
            const attiva =
              voce.href === "/home"
                ? pathname === "/home"
                : voce.href !== null &&
                  (pathname === voce.href ||
                    pathname.startsWith(`${voce.href}/`));

            const classi = `flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              attiva
                ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--shadow-card)]"
                : "text-[var(--ink-muted)] hover:bg-white/80 hover:text-[var(--ink)]"
            }`;

            if (voce.href) {
              return (
                <Link
                  key={voce.etichetta}
                  href={voce.href}
                  className={classi}
                  onClick={onChiudi}
                  title={voce.etichetta}
                  aria-label={voce.etichetta}
                  aria-current={attiva ? "page" : undefined}
                >
                  <Icona className="h-[22px] w-[22px]" strokeWidth={1.75} />
                  <span className="sr-only">{voce.etichetta}</span>
                </Link>
              );
            }

            return null;
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4 px-2">
          <Link
            href="/impostazioni/integrazioni"
            onClick={onChiudi}
            title="Impostazioni"
            aria-label="Impostazioni"
            aria-current={
              pathname.startsWith("/impostazioni") ? "page" : undefined
            }
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              pathname.startsWith("/impostazioni")
                ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--shadow-card)]"
                : "text-[var(--ink-muted)] hover:bg-white/80 hover:text-[var(--ink)]"
            }`}
          >
            <Settings className="h-[22px] w-[22px]" strokeWidth={1.75} />
            <span className="sr-only">Impostazioni</span>
          </Link>
          <button
            type="button"
            onClick={() => void esci()}
            disabled={logoutInCorso}
            title={email ? `Esci (${email})` : "Esci"}
            aria-label={logoutInCorso ? "Uscita…" : "Esci"}
            className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-white/80 hover:text-[var(--ink)] disabled:opacity-60"
          >
            <LogOut className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
          {logoutErrore ? (
            <p className="px-1 text-center text-[10px] leading-tight text-[#7a3d58]">
              {logoutErrore}
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
