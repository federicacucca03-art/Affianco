"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { IntestazioneSezione } from "@/components/IntestazioneSezione";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import { nomeCampagnaContatti } from "@/data/defaults-contatti";
import type { Cliente } from "@/types/clienti";
import { getCampaigns, getClients } from "@/utils/clientStorage";

export default function ClientiPage() {
  const router = useRouter();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [conteggioCampagne, setConteggioCampagne] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const lista = getClients();
    setClienti(lista);
    const campagne = getCampaigns();
    const conteggi: Record<string, number> = {};
    for (const cliente of lista) {
      const ids = new Set(cliente.storicoCampagne ?? []);
      for (const campagna of campagne) {
        if (campagna.clientId === cliente.id) ids.add(campagna.id);
      }
      conteggi[cliente.id] = ids.size;
    }
    setConteggioCampagne(conteggi);
  }, []);

  function nuovaCampagna(cliente: Cliente) {
    salvaBozzaOnboarding({
      clienteId: cliente.id,
      nomeCliente: cliente.nome,
      nomeCampagna: nomeCampagnaContatti(cliente.nome),
      settore: cliente.settore,
      citta: cliente.citta,
      sitoWeb: cliente.sitoWeb,
      note: cliente.note,
      targetType: cliente.targetType,
      targetAge: cliente.targetAge,
    });
    router.push(
      `/campagne?clienteId=${encodeURIComponent(cliente.id)}`,
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <IntestazioneSezione titolo="Clienti" />
      <p className="mt-1 max-w-xl text-sm text-[var(--ink-muted)]">
        Profili salvati per riutilizzare nome, nicchia, città, target e brief
        al Passo 1.
      </p>

      {clienti.length === 0 ? (
        <p className="mt-6 max-w-md text-sm text-[var(--ink-muted)]">
          Nessun cliente nei preferiti. Nel Passo 1 spunta «Salva cliente nei
          preferiti» oppure carica un profilo dopo la prima campagna.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2.5">
          {clienti.map((cliente) => {
            const nCampagne = conteggioCampagne[cliente.id] ?? 0;
            return (
              <li
                key={cliente.id}
                className="flex flex-col gap-3 rounded-[var(--radius)] bg-white px-4 py-3.5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">
                    {cliente.nome}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
                    {[cliente.settore, cliente.citta, cliente.targetType]
                      .filter(Boolean)
                      .join(" · ")}
                    {nCampagne > 0
                      ? ` · ${nCampagne} campagn${nCampagne === 1 ? "a" : "e"}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => nuovaCampagna(cliente)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Nuova Campagna per questo cliente
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-[var(--ink-muted)]">
        Oppure{" "}
        <Link href="/campagne" className="text-[var(--accent)] hover:underline">
          scegli un obiettivo da Campagne
        </Link>
        .
      </p>
    </main>
  );
}
