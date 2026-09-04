"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import { nomeCampagnaContatti } from "@/data/defaults-contatti";
import type { Cliente } from "@/types/clienti";
import { getCampaigns, getClients } from "@/utils/clientStorage";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import { AllyListRow } from "@/components/shell/AllyListRow";
import { FirstClientForm } from "@/components/dashboard/FirstClientForm";
import { writeSetupPathPreference } from "@/lib/ally-setup";

export default function ClientiPage() {
  const router = useRouter();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [conteggioCampagne, setConteggioCampagne] = useState<
    Record<string, number>
  >({});
  const [showForm, setShowForm] = useState(false);

  function refresh() {
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
  }

  useEffect(() => {
    refresh();
  }, []);

  function nuovaCampagna(cliente: Cliente) {
    writeSetupPathPreference("native");
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
    <main className="aff-page">
      {clienti.length === 0 ? (
        <div className="space-y-4">
          <AllyEmptyState
            className="mt-1"
            icon={Users}
            title="Aggiungi il primo cliente"
            description="Partiamo dal cliente che vuoi gestire. Poi scegli se importare da Meta o pianificare una campagna."
            action={
              showForm ? undefined : (
                <button
                  type="button"
                  className="aff-btn-primary"
                  onClick={() => setShowForm(true)}
                >
                  Aggiungi il primo cliente
                </button>
              )
            }
          />
          {showForm ? (
            <FirstClientForm
              onCreated={(c) => {
                refresh();
                setShowForm(false);
                router.push(`/clienti/${encodeURIComponent(c.id)}`);
              }}
            />
          ) : null}
        </div>
      ) : (
        <ul className="mt-1 flex flex-col gap-2.5">
          {clienti.map((cliente) => {
            const nCampagne = conteggioCampagne[cliente.id] ?? 0;
            const meta = [
              [cliente.settore, cliente.citta, cliente.targetType]
                .filter(Boolean)
                .join(" · "),
              nCampagne > 0
                ? `${nCampagne} campagn${nCampagne === 1 ? "a" : "e"}`
                : "Nessuna campagna",
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={cliente.id}>
                <AllyListRow
                  title={cliente.nome}
                  meta={meta}
                  className="flex-col items-stretch sm:flex-row sm:items-center"
                  trailing={
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <Link
                        href={`/clienti/${encodeURIComponent(cliente.id)}`}
                        className="aff-btn-secondary"
                      >
                        Dettaglio
                      </Link>
                      <button
                        type="button"
                        onClick={() => nuovaCampagna(cliente)}
                        className="aff-btn-primary"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        Nuova campagna
                      </button>
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {clienti.length > 0 ? (
        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          Oppure{" "}
          <Link
            href="/home"
            className="font-medium text-[var(--primary)] hover:opacity-80"
          >
            torna a Home
          </Link>{" "}
          per vedere il prossimo passo.
        </p>
      ) : null}
    </main>
  );
}
