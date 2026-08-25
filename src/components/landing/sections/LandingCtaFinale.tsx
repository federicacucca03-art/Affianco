import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingCtaFinale() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl">
          Le tue campagne sono già abbastanza complicate.
        </h2>
        <p className="mt-3 text-2xl font-medium tracking-tight text-[var(--ink-muted)] sm:text-3xl">
          Il modo in cui le gestisci non deve esserlo.
        </p>
        <Link
          href="/campagne"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Inizia con Affianco
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          Organizza. Approva. Lancia. Controlla.
        </p>
      </div>
    </section>
  );
}
