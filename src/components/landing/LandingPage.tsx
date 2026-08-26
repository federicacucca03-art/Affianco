"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/sections/LandingHero";
import { LandingProblema } from "@/components/landing/sections/LandingProblema";
import { LandingComeFunziona } from "@/components/landing/sections/LandingComeFunziona";
import { LandingSostenibilita } from "@/components/landing/sections/LandingSostenibilita";
import { LandingApprovazione } from "@/components/landing/sections/LandingApprovazione";
import { LandingControlRoom } from "@/components/landing/sections/LandingControlRoom";
import { LandingStoricoCliente } from "@/components/landing/sections/LandingStoricoCliente";
import { LandingPerChiE } from "@/components/landing/sections/LandingPerChiE";
import { LandingDifferenziazione } from "@/components/landing/sections/LandingDifferenziazione";
import { LandingFaq } from "@/components/landing/sections/LandingFaq";
import { LandingCtaFinale } from "@/components/landing/sections/LandingCtaFinale";

export function LandingPage() {
  const [menuAperto, setMenuAperto] = useState(false);

  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--ink)]">
      <LandingNavbar
        menuAperto={menuAperto}
        onToggleMenu={() => setMenuAperto((v) => !v)}
        onChiudiMenu={() => setMenuAperto(false)}
      />

      <main id="top">
        <LandingHero />
        <LandingProblema />
        <LandingComeFunziona />
        <LandingSostenibilita />
        <LandingApprovazione />
        <LandingControlRoom />
        <LandingStoricoCliente />
        <LandingPerChiE />
        <LandingDifferenziazione />
        <LandingFaq />
        <LandingCtaFinale />
      </main>

      <footer className="border-t border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[var(--ink-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--ink)]">
            Affianco
          </p>
          <p>
            Il posto in cui un professionista gestisce tutto il lavoro dietro le
            campagne Meta dei propri clienti.
          </p>
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Accedi →
          </Link>
        </div>
      </footer>
    </div>
  );
}
