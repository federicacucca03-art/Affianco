"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { PannelloAccountMetaCliente } from "@/components/clienti/PannelloAccountMetaCliente";
import { supabase } from "@/lib/supabase";
import type { Cliente } from "@/types/clienti";
import { getClientById } from "@/utils/clientStorage";

function normalizzaNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function DettaglioClientePage() {
  const params = useParams<{ id: string }>();
  const [locale, setLocale] = useState<Cliente | null | undefined>(undefined);
  const [dbClientId, setDbClientId] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id;
    void (async () => {
      const trovato = id ? getClientById(id) : null;
      if (trovato) {
        setLocale(trovato);
        const { data } = await supabase.from("clients").select("id, name");
        const lista = (data ?? []) as { id: string; name: string }[];
        const match = lista.find(
          (c) => normalizzaNome(c.name) === normalizzaNome(trovato.nome),
        );
        setDbClientId(match?.id ?? null);
        return;
      }

      if (!id) {
        setLocale(null);
        return;
      }

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
      setLocale({
        id: row.id,
        nome: row.name,
        settore: "",
        citta: "",
      });
      setDbClientId(row.id);
    })();
  }, [params.id]);

  if (locale === undefined) {
    return (
      <main className="mx-auto w-full max-w-[720px]">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </main>
    );
  }

  if (!locale) {
    return (
      <main className="mx-auto w-full max-w-[720px]">
        <p className="text-sm text-[var(--ink-muted)]">Cliente non trovato.</p>
        <Link
          href="/clienti"
          className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Torna ai clienti
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[720px]">
      <Link
        href="/clienti"
        className="text-sm text-[var(--accent)] hover:underline"
      >
        Clienti
      </Link>
      <h1 className="mt-3 text-lg font-medium text-[var(--ink)]">{locale.nome}</h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        {[locale.settore, locale.citta].filter(Boolean).join(" · ")}
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-[var(--ink-muted)]">Caricamento…</p>
        }
      >
        <PannelloAccountMetaCliente clientId={dbClientId} />
      </Suspense>
    </main>
  );
}
