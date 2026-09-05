"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PannelloAccountMetaCliente } from "@/components/clienti/PannelloAccountMetaCliente";
import { StartPathCards } from "@/components/dashboard/FirstClientForm";
import { AllyPanel } from "@/components/shell/AllyPanel";
import { supabase } from "@/lib/supabase";
import type { Cliente } from "@/types/clienti";
import { getClientById } from "@/utils/clientStorage";
import {
  readSetupPathPreference,
  writeSetupPathPreference,
} from "@/lib/ally-setup";
import {
  applyMetaImportStart,
  isMetaImportPlaceholderName,
  readBearerToken,
  startMetaImportFlow,
} from "@/lib/meta-import-client";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import { nomeCampagnaContatti } from "@/data/defaults-contatti";
import { clienteHaCampagneCanoniche } from "@/lib/clienti-inventory";

function normalizzaNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ");
}

function isLikelyUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Resolve the canonical DB client id for Meta (client-scoped).
 * Prefer exact id match — first-client onboarding already persists a real
 * `clients` row; do not require a native campaign or name-only matching.
 */
async function resolveDbClientId(
  routeId: string,
  localName: string | null,
): Promise<string | null> {
  if (isLikelyUuid(routeId)) {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("id", routeId)
      .maybeSingle();
    if (!error && data && typeof (data as { id: string }).id === "string") {
      return (data as { id: string }).id;
    }
  }

  if (localName) {
    const { data } = await supabase.from("clients").select("id, name");
    const lista = (data ?? []) as { id: string; name: string }[];
    const match = lista.find(
      (c) => normalizzaNome(c.name) === normalizzaNome(localName),
    );
    if (match?.id) return match.id;
  }

  return null;
}

function DettaglioClienteInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locale, setLocale] = useState<Cliente | null | undefined>(undefined);
  const [dbClientId, setDbClientId] = useState<string | null>(null);
  const [hasCampaigns, setHasCampaigns] = useState(false);
  const [hasMetaRows, setHasMetaRows] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const focusMeta =
    searchParams.get("focus") === "meta" ||
    readSetupPathPreference() === "meta";

  useEffect(() => {
    if (searchParams.get("focus") === "meta") {
      writeSetupPathPreference("meta");
    }
  }, [searchParams]);

  useEffect(() => {
    const id = params.id;
    void (async () => {
      setResolveError(null);
      const trovato = id ? getClientById(id) : null;
      let resolved: Cliente | null = trovato;
      let dbId: string | null = null;

      if (!id) {
        setLocale(null);
        return;
      }

      if (trovato) {
        setLocale(trovato);
        dbId = await resolveDbClientId(id, trovato.nome);
        setDbClientId(dbId);
        if (!dbId) {
          setResolveError(
            "Non riesco a verificare questo cliente sul server. Ricarica la pagina oppure torna a Home e riprova.",
          );
        }
      } else {
        const { data } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", id)
          .maybeSingle();
        const row = data as { id: string; name: string } | null;
        if (!row) {
          setLocale(null);
          setDbClientId(null);
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

      if (dbId) {
        try {
          const flags = await clienteHaCampagneCanoniche(dbId);
          setHasMetaRows(flags.hasMeta);
          setHasCampaigns(flags.hasNative || flags.hasMeta);
        } catch {
          setHasMetaRows(false);
          setHasCampaigns(false);
        }
      } else {
        setHasMetaRows(false);
        setHasCampaigns(false);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (!focusMeta) return;
    const t = window.setTimeout(() => {
      document
        .getElementById("meta-client-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusMeta, dbClientId]);

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
    const paramsQs = new URLSearchParams({
      nomeCliente: locale.nome,
      settore: locale.settore ?? "",
      citta: locale.citta ?? "",
      clienteId: locale.id,
    });
    router.push(`/campagne/nuova/richieste-contatto?${paramsQs.toString()}`);
  }

  async function chooseMeta() {
    writeSetupPathPreference("meta");
    const token = await readBearerToken();
    if (!token || !locale) {
      document
        .getElementById("meta-client-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    try {
      const result = await startMetaImportFlow(locale.id, token);
      applyMetaImportStart(result, (href) => router.push(href));
    } catch {
      document
        .getElementById("meta-client-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  const showStartCards = !hasCampaigns && !focusMeta;
  const displayName = isMetaImportPlaceholderName(locale.nome)
    ? "Import da Meta"
    : locale.nome;

  return (
    <main className="aff-page aff-page--narrow">
      <Link href="/clienti" className="aff-btn-tertiary min-h-8 px-0">
        Clienti
      </Link>
      <h1 className="aff-page-title mt-3">{displayName}</h1>
      <p className="aff-page-subtitle">
        {[locale.settore, locale.citta].filter(Boolean).join(" · ")}
      </p>

      {showStartCards ? (
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

      {focusMeta && !hasCampaigns ? (
        <p className="mt-8 text-sm leading-relaxed text-[var(--ink-muted)]">
          Collega Meta, scegli l&apos;account pubblicitario e importa le
          campagne.
        </p>
      ) : null}

      {resolveError ? (
        <p className="mt-6 text-sm aff-text-danger" role="alert">
          {resolveError}
        </p>
      ) : null}

      <div id="meta-client-panel">
        <Suspense
          fallback={<p className="mt-8 aff-muted">Caricamento…</p>}
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

export default function DettaglioClientePage() {
  return (
    <Suspense
      fallback={
        <main className="aff-page aff-page--narrow">
          <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
        </main>
      }
    >
      <DettaglioClienteInner />
    </Suspense>
  );
}
