import type { ReactNode } from "react";
import Link from "next/link";
import { PublicFooter } from "@/components/landing/PublicFooter";

type Props = {
  titolo: string;
  aggiornamento: string;
  children: ReactNode;
};

export function PaginaLegale({ titolo, aggiornamento, children }: Props) {
  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)]/80 bg-[var(--background)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--ink)]"
          >
            Ally
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-hover)]"
          >
            Accedi
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[1.65rem] font-medium tracking-tight text-[var(--ink)] sm:text-[2rem]">
          {titolo}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">{aggiornamento}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--ink)] [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-medium [&_p]:break-words [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
