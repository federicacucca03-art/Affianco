import { Suspense } from "react";
import { PercorsoAwareness } from "@/components/nuova-contatti/PercorsoContatti";

export default function AperturaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
        </main>
      }
    >
      <PercorsoAwareness />
    </Suspense>
  );
}
