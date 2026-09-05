import Link from "next/link";

const LINK_LEGALI = [
  { href: "/privacy", label: "Privacy" },
  { href: "/termini", label: "Termini" },
  { href: "/eliminazione-dati", label: "Eliminazione dati" },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[var(--ink-muted)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--ink)]">
            Ally
          </p>
          <p className="max-w-xl">
            Il posto in cui un professionista gestisce tutto il lavoro dietro le
            campagne Meta dei propri clienti.
          </p>
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Accedi →
          </Link>
        </div>
        <nav
          aria-label="Informazioni legali"
          className="flex flex-wrap gap-x-5 gap-y-2"
        >
          {LINK_LEGALI.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--ink)] underline-offset-2 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
