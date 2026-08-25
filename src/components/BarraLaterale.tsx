"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  LayoutGrid,
  Settings,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";

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

        <nav className="flex flex-col gap-1 px-3 pb-6">
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
              >
                <Icona className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {voce.etichetta}
              </span>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
