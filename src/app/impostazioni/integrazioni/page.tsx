import { PannelloIntegrazioneMeta } from "@/components/impostazioni/PannelloIntegrazioneMeta";

export default function IntegrazioniPage() {
  return (
    <main className="aff-page aff-page--narrow">
      <p className="aff-eyebrow">Impostazioni</p>
      <h2 className="aff-page-title mt-1.5">Integrazioni</h2>
      <p className="aff-page-subtitle">
        Collegamenti esterni per Ally.
      </p>
      <PannelloIntegrazioneMeta />
    </main>
  );
}
