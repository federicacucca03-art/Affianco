"use client";

import { Suspense } from "react";
import { PercorsoContatti } from "@/components/nuova-contatti/PercorsoContatti";

export default function VenditeOnlinePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 text-sm text-[var(--ink-muted)]">
          Caricamento…
        </div>
      }
    >
      <PercorsoContatti objective="ECOMMERCE" wizardSlug="vendite-online" />
    </Suspense>
  );
}
