"use client";

import { useState } from "react";
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
import { PublicFooter } from "@/components/landing/PublicFooter";

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

      <PublicFooter />
    </div>
  );
}
