"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PannelloAccountMetaCliente } from "@/components/clienti/PannelloAccountMetaCliente";
import { StartPathCards } from "@/components/dashboard/FirstClientForm";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { supabase } from "@/lib/supabase";
import type { Cliente } from "@/types/clienti";
import { getCampaigns, getClientById } from "@/utils/clientStorage";
import { writeSetupPathPreference } from "@/lib/ally-setup";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import { nomeCampagnaContatti } from "@/data/defaults-contatti";
import { useOnboardingCampagna } from "@/components/OnboardingCampagnaContext";

function normalizzaNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function DettaglioClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { apriModaleCampagna } = useOnboardingCampagna();
  const [locale, setLocale] = useState<Cliente | null | undefined>(undefined);
  const [dbClientId, setDbClientId] = useState<string | null>(null);
  const [hasCampaigns, setHasCampaigns] = useState(false);
  const [hasMetaRows, setHasMetaRows] = useState(false);

  useEffect(() => {
    const id = params.id;
    void (async () => {
      const trovato = id ? getClientById(id) : null;
      let resolved: Cliente | null = trovato;
      let dbId: string | null = null;

      if (trovato) {
        setLocale(trovato);
        const { data } = await supabase.from("clients").select("id, name");
        const lista = (data ?? []) as { id: string; name: string }[];
        const match = lista.find(
          (c) => normalizzaNome(c.name) === normalizzaNome(trovato.nome),
        );
        dbId = match?.id ?? null;
        setDbClientId(dbId);
      } else if (!id) {
        setLocale(null);
        return;
      } else {
        const { data } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", id)
          .maybeSingle();
        const row = data as { id: string; name: string } | null;
        if (!row) {
          setLocale(null);
          return;
        }
        resolved = {
          id: row.id,
          nome: row.name,
          settore: "",
          citta: "",
        };
        setLocale(resolved);
        dbId = row.id;
        setDbClientId(row.id);
      }

      const localCamps = getCampaigns().filter(
        (c) =>
          c.clientId === id ||
          (resolved &&
            normalizzaNome(c.nomeCliente) === normalizzaNome(resolved.nome)),
      );
      let metaCount = 0;
      if (dbId) {
        const { count } = await supabase
          .from("meta_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("client_id", dbId);
        metaCount = count ?? 0;
      }
      setHasMetaRows(metaCount > 0);
      setHasCampaigns(localCamps.length > 0 || metaCount > 0);
    })();
  }, [params.id]);

  function planNative() {
    if (!locale) return;
    writeSetupPathPreference("native");
    salvaBozzaOnboarding({
      clienteId: locale.id,
      nomeCliente: locale.nome,
      nomeCampagna: nomeCampagnaContatti(locale.nome),
      settore: locale.settore,
      citta: locale.citta,
      sitoWeb: locale.sitoWeb,
      note: locale.note,
      targetType: locale.targetType,
      targetAge: locale.targetAge,
    });
    apriModaleCampagna();
    router.push("/campagne");
  }

  function chooseMeta() {
    writeSetupPathPreference("meta");
    const el = document.getElementById("meta-client-panel");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (locale === undefined) {
    return (
      <main className="aff-page aff-page--narrow">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </main>
    );
  }

  if (!locale) {
    return (
      <main className="aff-page aff-page--narrow">
        <p className="text-sm text-[var(--ink-muted)]">Cliente non trovato.</p>
        <Link
          href="/clienti"
          className="mt-3 inline-block text-sm text-[var(--primary)] hover:underline"
        >
          Torna ai clienti
        </Link>
      </main>
    );
  }

  return (
    <main className="aff-page aff-page--narrow">
      <Link href="/clienti" className="aff-btn-tertiary min-h-8 px-0">
        Clienti
      </Link>
      <h1 className="aff-page-title mt-3">{locale.nome}</h1>
      <p className="aff-page-subtitle">
        {[locale.settore, locale.citta].filter(Boolean).join(" · ")}
      </p>

      {!hasCampaigns ? (
        <AllyPanel className="mt-8 px-5 py-5 sm:px-6">
          <p className="aff-eyebrow">Come vuoi iniziare?</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
            Porta in Ally le campagne che stai già gestendo, oppure costruisci
            una nuova campagna. Nessuna delle due è obbligatoria.
          </p>
          <div className="mt-5">
            <StartPathCards onMeta={chooseMeta} onNative={planNative} />
          </div>
        </AllyPanel>
      ) : null}

      <div id="meta-client-panel">
        <Suspense
          fallback={
            <p className="mt-8 aff-muted">Caricamento…</p>
          }
        >
          <PannelloAccountMetaCliente clientId={dbClientId} />
        </Suspense>
      </div>

      {hasCampaigns && !hasMetaRows ? (
        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          <Link
            href="/home"
            className="font-medium text-[var(--primary)] hover:opacity-80"
          >
            Torna a Home
          </Link>{" "}
          per il prossimo passo di monitoraggio.
        </p>
      ) : null}
    </main>
  );
}
