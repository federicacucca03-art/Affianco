import { Suspense } from "react";
import { PannelloIntegrazioneMeta } from "@/components/impostazioni/PannelloIntegrazioneMeta";

export default function IntegrazioniPage() {
  return (
    <main className="mx-auto w-full max-w-[720px]">
      <h1 className="text-lg font-medium text-[var(--ink)]">Integrazioni</h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Collegamenti esterni per Affianco.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-[var(--ink-muted)]">Caricamento…</p>
        }
      >
        <PannelloIntegrazioneMeta />
      </Suspense>
    </main>
  );
}
