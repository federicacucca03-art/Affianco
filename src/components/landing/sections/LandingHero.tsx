import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MockAllyOggi } from "@/components/landing/mock/MockAllyOggi";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #d1d5db 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-5">
          <p className="landing-fade-up text-xs font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            Per freelance e micro-agenzie
          </p>
          <h1 className="landing-fade-up landing-delay-1 mt-4 text-3xl font-medium leading-[1.12] tracking-tight text-[var(--ink)] sm:text-4xl lg:text-[2.65rem]">
            Sai sempre quale campagna guardare.
            <br />
            E cosa fare dopo.
          </h1>
          <p className="landing-fade-up landing-delay-2 mt-5 max-w-md text-base leading-relaxed text-[var(--ink-muted)]">
            Ally è il workspace operativo per freelance e micro-agenzie che
            gestiscono Meta Ads per clienti. Pianifica le campagne, raccogli le
            approvazioni, collega Meta e tieni sotto controllo ciò che richiede
            davvero la tua attenzione.
          </p>
          <p className="landing-fade-up landing-delay-2 mt-4 max-w-md text-sm leading-relaxed text-[var(--ink)]">
            Meta Ads Manager gestisce le inserzioni. Ally organizza il lavoro e
            le decisioni intorno alle campagne.
          </p>
          <div className="landing-fade-up landing-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-medium text-white hover:opacity-90"
            >
              Inizia con Ally
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <a
              href="#come-funziona"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm text-[var(--ink)] hover:bg-[var(--surface-hover)]"
            >
              Guarda come funziona
            </a>
          </div>
        </div>

        <div className="landing-fade-up landing-delay-2 relative lg:col-span-7">
          <div className="landing-float mx-auto max-w-xl lg:max-w-none">
            <MockAllyOggi />
          </div>
        </div>
      </div>
    </section>
  );
}
