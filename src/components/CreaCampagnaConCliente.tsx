"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GrigliaSituazioni } from "@/components/GrigliaSituazioni";
import { PartiamoDalBrief } from "@/components/campagne/PartiamoDalBrief";
import { getClientById } from "@/utils/clientStorage";

export function CreaCampagnaConCliente() {
  const searchParams = useSearchParams();
  const clienteId = searchParams.get("clienteId")?.trim() || null;
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId) {
      setNomeCliente(null);
      return;
    }
    setNomeCliente(getClientById(clienteId)?.nome ?? null);
  }, [clienteId]);

  return (
    <>
      {nomeCliente ? (
        <p className="mb-4 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-violet-soft)] px-4 py-3 text-[13.5px] leading-snug text-[var(--ink)]">
          Campagna per <span className="font-semibold">{nomeCliente}</span>.
          Puoi partire dal brief oppure scegliere l&apos;obiettivo e compilare
          manualmente.
        </p>
      ) : null}

      <PartiamoDalBrief compactManual />

      <div id="obiettivi-manuali" className="mt-10 scroll-mt-6">
        <h2 className="aff-section-title text-[17px] tracking-[-0.02em]">
          Oppure compila manualmente
        </h2>
        <p className="aff-section-sub mb-4">
          Scegli l&apos;obiettivo e apri il wizard classico.
        </p>
        <GrigliaSituazioni clienteId={clienteId} />
      </div>
    </>
  );
}
