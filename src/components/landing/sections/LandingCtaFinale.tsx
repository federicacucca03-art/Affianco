import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingCtaFinale() {
  return (
    <section className="border-t border-[var(--border)] bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl">
          Meno tempo a capire dove guardare.
          <br />
          Più tempo a decidere cosa fare.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-muted)]">
          Porta clienti, campagne e performance nello stesso workspace.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Inizia con Ally
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          Per freelance, media buyer e micro-agenzie che gestiscono Meta Ads per
          clienti.
        </p>
      </div>
    </section>
  );
}
