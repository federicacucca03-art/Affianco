"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Campagna } from "@/types/campagne";
import { leggiCampagnaDaSupabase } from "@/lib/campagne-db";
import { assicuraVariantiCampagna } from "@/lib/assicura-varianti";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { InstantFormEasyBuilder } from "@/components/campagne/InstantFormEasyBuilder";

/**
 * P0.7 — 5-Minute Instant Form Easy Builder entry route.
 * No Meta mutations on this page.
 */
export default function InstantFormEasyBuilderPage() {
  const params = useParams<{ id: string }>();
  const [campagna, setCampagna] = useState<Campagna | null | undefined>(
    undefined,
  );
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    setCampagna(undefined);
    setErrore(null);
    (async () => {
      try {
        const trovata = await leggiCampagnaDaSupabase(params.id);
        if (!attivo) return;
        setCampagna(
          trovata
            ? assicuraVariantiCampagna(trovata, { persistiLocale: true })
            : null,
        );
      } catch (e) {
        if (!attivo) return;
        logErroreSupabaseDev("instant_form_builder_load", e);
        setCampagna(null);
        setErrore(messaggioErroreSupabase(e, "carica_builder"));
      }
    })();
    return () => {
      attivo = false;
    };
  }, [params.id]);

  if (campagna === undefined) {
    return (
      <main className="aff-page">
        <p className="text-sm text-[var(--ink-muted)]">Caricamento…</p>
      </main>
    );
  }

  if (campagna === null) {
    return (
      <main className="aff-page">
        <Link
          href="/campagne"
          className="text-sm font-medium text-[var(--primary)]"
        >
          Torna alle campagne
        </Link>
        <h1 className="mt-4 text-xl font-medium text-[var(--ink)]">
          Campagna non trovata
        </h1>
        {errore ? (
          <p className="mt-2 text-sm text-[var(--ink-muted)]">{errore}</p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="aff-page pb-12">
      <InstantFormEasyBuilder campaignId={campagna.id} campagna={campagna} />
    </main>
  );
}
