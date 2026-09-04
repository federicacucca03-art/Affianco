import { Suspense } from "react";
import { BannerHero } from "@/components/BannerHero";
import { CreaCampagnaConCliente } from "@/components/CreaCampagnaConCliente";
import { IntestazioneSezione } from "@/components/IntestazioneSezione";
import { ListaCampagne } from "@/components/ListaCampagne";

export default function CampagnePage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] pb-8">
      <BannerHero />

      <section id="obiettivi-campagna" className="mt-8 scroll-mt-6">
        <IntestazioneSezione titolo="Crea una campagna" />
        <p className="-mt-2 mb-4 text-sm text-[var(--ink-muted)]">
          Scegli cosa deve ottenere il cliente.
        </p>
        <Suspense
          fallback={
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Caricamento obiettivi…
            </p>
          }
        >
          <CreaCampagnaConCliente />
        </Suspense>
      </section>

      <section className="mt-8">
        <IntestazioneSezione titolo="Le tue campagne" />
        <ListaCampagne />
      </section>
    </main>
  );
}
