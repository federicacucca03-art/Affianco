"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GrigliaSituazioni } from "@/components/GrigliaSituazioni";
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
          Scegli l&apos;obiettivo: al Passo 1 i dati del cliente saranno già
          compilati.
        </p>
      ) : null}
      <GrigliaSituazioni clienteId={clienteId} />
    </>
  );
}
