"use client";

import { Suspense } from "react";
import { PercorsoPrenotazioni } from "@/components/nuova-contatti/PercorsoContatti";

export default function PrenotazioniPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 text-sm text-[var(--ink-muted)]">
          Caricamento…
        </div>
      }
    >
      <PercorsoPrenotazioni />
    </Suspense>
  );
}
