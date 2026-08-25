import { Suspense } from "react";
import { PercorsoContatti } from "@/components/nuova-contatti/PercorsoContatti";

export default function RichiesteContattoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
        </main>
      }
    >
      <PercorsoContatti />
    </Suspense>
  );
}
