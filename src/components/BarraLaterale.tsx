"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
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
        className={`fixed inset-y-3 left-3 z-50 flex w-16 flex-col rounded-[28px] bg-[rgba(110,104,158,0.55)] py-6 shadow-[var(--shadow-soft)] backdrop-blur-xl md:static md:inset-auto md:h-auto md:self-stretch md:translate-x-0 ${
          aperta ? "translate-x-0" : "-translate-x-[120%]"
        }`}
      >
        <div className="flex flex-col items-center px-2">
          <Link
            href="/campagne"
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
            className="mt-3 rounded-xl p-1 text-white/80 hover:bg-white/15 md:hidden"
            onClick={onChiudi}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="mt-10 flex flex-1 flex-col items-center gap-4 px-2">
          {voci.map((voce) => {
            const Icona = voce.icona;
            const attiva =
              voce.href !== null &&
              (pathname === voce.href || pathname.startsWith(`${voce.href}/`));

            const classi = `flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              attiva
                ? "bg-white text-[var(--primary)] shadow-[var(--shadow-card)]"
                : "text-white/90 hover:bg-white/20"
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
          <span
            className="flex h-12 w-12 cursor-default items-center justify-center rounded-full text-white/50"
            aria-disabled
            title="Impostazioni — presto disponibile"
          >
            <Settings className="h-[22px] w-[22px]" strokeWidth={1.75} />
            <span className="sr-only">Impostazioni, presto disponibile</span>
          </span>
          <button
            type="button"
            onClick={() => void esci()}
            disabled={logoutInCorso}
            title={email ? `Esci (${email})` : "Esci"}
            aria-label={logoutInCorso ? "Uscita…" : "Esci"}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <LogOut className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
          {logoutErrore ? (
            <p className="px-1 text-center text-[10px] leading-tight text-white">
              {logoutErrore}
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
