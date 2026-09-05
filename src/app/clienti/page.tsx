"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import { nomeCampagnaContatti } from "@/data/defaults-contatti";
import {
  contaCampagneNativePerCliente,
  leggiClientiDaSupabase,
} from "@/lib/clienti-inventory";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import { AllyListRow } from "@/components/shell/AllyListRow";
import { FirstClientForm } from "@/components/dashboard/FirstClientForm";
import { writeSetupPathPreference } from "@/lib/ally-setup";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";

type ClienteLista = { id: string; nome: string };

export default function ClientiPage() {
  const router = useRouter();
  const [clienti, setClienti] = useState<ClienteLista[]>([]);
  const [conteggioCampagne, setConteggioCampagne] = useState<
    Record<string, number>
  >({});
  const [showForm, setShowForm] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const [rows, conteggi] = await Promise.all([
        leggiClientiDaSupabase(),
        contaCampagneNativePerCliente(),
      ]);
      setClienti(rows.map((c) => ({ id: c.id, nome: c.name })));
      setConteggioCampagne(conteggi);
    } catch (e) {
      logErroreSupabaseDev("clienti_lista", e);
      setClienti([]);
      setConteggioCampagne({});
      setErrore(messaggioErroreSupabase(e, "lista"));
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function nuovaCampagna(cliente: ClienteLista) {
    writeSetupPathPreference("native");
    salvaBozzaOnboarding({
      clienteId: cliente.id,
      nomeCliente: cliente.nome,
      nomeCampagna: nomeCampagnaContatti(cliente.nome),
      settore: "",
      citta: "",
    });
    const paramsQs = new URLSearchParams({
      nomeCliente: cliente.nome,
      clienteId: cliente.id,
    });
    router.push(`/campagne/nuova/richieste-contatto?${paramsQs.toString()}`);
  }

  if (caricamento) {
    return (
      <main className="aff-page">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </main>
    );
  }

  if (errore) {
    return (
      <main className="aff-page">
        <AllyEmptyState
          className="mt-1"
          title="Non riesco a caricare i clienti."
          description={errore}
          action={
            <button
              type="button"
              className="aff-btn-secondary"
              onClick={() => void refresh()}
            >
              Riprova
            </button>
          }
        />
      </main>
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
              onCreated={() => {
                void refresh().then(() => setShowForm(false));
              }}
            />
          ) : null}
        </div>
      ) : (
        <ul className="mt-1 flex flex-col gap-2.5">
          {clienti.map((cliente) => {
            const nCampagne = conteggioCampagne[cliente.id] ?? 0;
            const meta =
              nCampagne > 0
                ? `${nCampagne} campagn${nCampagne === 1 ? "a" : "e"}`
                : "Nessuna campagna";

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
