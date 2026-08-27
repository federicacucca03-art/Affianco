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
  { etichetta: "Impostazioni", href: null, icona: Settings },
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
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-white md:static md:translate-x-0 ${
          aperta ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            href="/campagne"
            className="text-lg font-medium tracking-tight text-[var(--ink)]"
            onClick={onChiudi}
          >
            Affianco
          </Link>
          <button
            type="button"
            aria-label="Chiudi menu"
            className="rounded-xl p-1 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] md:hidden"
            onClick={onChiudi}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 pb-4">
          {voci.map((voce) => {
            const Icona = voce.icona;
            const attiva =
              voce.href !== null &&
              (pathname === voce.href || pathname.startsWith(`${voce.href}/`));

            const classi = `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              attiva
                ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                : "text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            }`;

            if (voce.href) {
              return (
                <Link
                  key={voce.etichetta}
                  href={voce.href}
                  className={classi}
                  onClick={onChiudi}
                >
                  <Icona className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {voce.etichetta}
                </Link>
              );
            }

            return (
              <span
                key={voce.etichetta}
                className={`${classi} cursor-default opacity-55`}
                aria-disabled
                title="Presto disponibile"
              >
                <Icona className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span>{voce.etichetta}</span>
                  <span className="text-[10px] font-normal text-[var(--ink-muted)]">
                    Presto disponibile
                  </span>
                </span>
              </span>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] px-4 py-4">
          {email ? (
            <p
              className="truncate text-xs text-[var(--ink-muted)]"
              title={email}
            >
              {email}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void esci()}
            disabled={logoutInCorso}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {logoutInCorso ? "Uscita…" : "Esci"}
          </button>
          {logoutErrore ? (
            <p className="mt-1 text-xs text-[#C45C5C]">{logoutErrore}</p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
