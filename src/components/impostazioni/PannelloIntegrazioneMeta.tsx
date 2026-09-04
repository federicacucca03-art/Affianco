"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FirstClientForm } from "@/components/dashboard/FirstClientForm";
import { supabase } from "@/lib/supabase";
import { getClients } from "@/utils/clientStorage";

/**
 * Settings Meta entry — Meta remains optional; guides to the right client
 * without changing OAuth.
 */
export function PannelloIntegrazioneMeta() {
  const [primaryClientId, setPrimaryClientId] = useState<string | null>(null);
  const [hasClient, setHasClient] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void (async () => {
      const locali = getClients();
      let dbId: string | null = null;
      try {
        const { data } = await supabase
          .from("clients")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1);
        dbId = data?.[0]?.id ?? null;
      } catch {
        dbId = null;
      }
      setPrimaryClientId(dbId ?? locali[0]?.id ?? null);
      setHasClient(Boolean(dbId || locali.length > 0));
    })();
  }, []);

  return (
    <section className="aff-panel-white mt-8 overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Meta Ads
        </h2>
        <p className="mt-1 aff-muted">
          Opzionale. Collega Meta per cliente quando vuoi importare campagne già
          attive.
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        {!hasClient ? (
          <>
            <p className="aff-muted">
              Aggiungi prima un cliente. Poi potrai collegare Meta oppure
              pianificare una campagna Ally.
            </p>
            {showForm ? (
              <div className="mt-4">
                <FirstClientForm
                  onCreated={(c) => {
                    setHasClient(true);
                    setPrimaryClientId(c.id);
                    setShowForm(false);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="aff-btn-primary mt-5"
                onClick={() => setShowForm(true)}
              >
                Aggiungi il primo cliente
              </button>
            )}
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              Oppure{" "}
              <Link
                href="/home"
                className="font-medium text-[var(--primary)] hover:opacity-80"
              >
                torna a Home
              </Link>{" "}
              per scegliere come iniziare.
            </p>
          </>
        ) : (
          <>
            <p className="aff-muted">
              Apri il cliente per collegare Meta, scegliere l&apos;account
              pubblicitario e importare le campagne.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={
                  primaryClientId
                    ? `/clienti/${encodeURIComponent(primaryClientId)}`
                    : "/clienti"
                }
                className="aff-btn-primary"
              >
                Continua su cliente
              </Link>
              <Link href="/campagne" className="aff-btn-secondary">
                Pianifica una campagna
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
