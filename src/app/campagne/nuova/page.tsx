import { Suspense } from "react";
import { BannerHero } from "@/components/BannerHero";
import { CreaCampagnaConCliente } from "@/components/CreaCampagnaConCliente";
import Link from "next/link";

/**
 * Campaign creation entry — brief AI + manual objectives.
 * Inventory lives at /campagne; this route is opened via Nuova campagna.
 */
export default function NuovaCampagnaPage() {
  return (
    <main className="aff-page">
      <div className="mb-4">
        <Link
          href="/campagne"
          className="text-[13px] font-medium text-[var(--ink-muted)] hover:text-[var(--primary)]"
        >
          ← Torna alle campagne
        </Link>
      </div>
      <section id="obiettivi-campagna" className="scroll-mt-6">
        <BannerHero />
        <div className="mt-6">
          <Suspense
            fallback={
              <p className="aff-muted">Caricamento obiettivi…</p>
            }
          >
            <CreaCampagnaConCliente />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
