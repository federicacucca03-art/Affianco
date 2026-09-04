import { Suspense } from "react";
import { BannerHero } from "@/components/BannerHero";
import { CreaCampagnaConCliente } from "@/components/CreaCampagnaConCliente";
import { ListaCampagne } from "@/components/ListaCampagne";

export default function CampagnePage() {
  return (
    <main className="aff-page">
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

      <section className="mt-12">
        <h2 className="aff-section-title text-[17px] tracking-[-0.02em]">
          Le tue campagne
        </h2>
        <p className="aff-section-sub">
          Apri una campagna per continuare pianificazione e attività.
        </p>
        <div className="mt-5">
          <ListaCampagne />
        </div>
      </section>
    </main>
  );
}
