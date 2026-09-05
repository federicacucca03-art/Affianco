"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Campagna } from "@/types/campagne";
import { leggiInventarioCampagneNative } from "@/lib/campagne-inventory";
import { RigaCampagna } from "@/components/RigaCampagna";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { LayoutGrid } from "lucide-react";

function SkeletonCampagne() {
  return (
    <ul
      className="flex min-h-[11.5rem] flex-col gap-2.5"
      aria-busy="true"
      aria-label="Caricamento campagne"
    >
      {[0, 1, 2].map((i) => (
        <li key={i} className="aff-list-row animate-pulse">
          <span className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-hover)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 max-w-[200px] rounded bg-[var(--surface-hover)]" />
            <span className="block h-3 w-3/5 max-w-[280px] rounded bg-[var(--surface-hover)]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function scrollObiettiviCampagna() {
  document
    .getElementById("obiettivi-campagna")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ListaCampagne() {
  const [campagne, setCampagne] = useState<Campagna[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null);

  const caricaCampagne = useCallback(async () => {
    setCaricamento(true);
    setErrore(false);
    setMessaggioErrore(null);

    try {
      /* Canonical Supabase inventory only — never localStorage campaign memory. */
      const lista = await leggiInventarioCampagneNative();
      setCampagne(lista);
      setErrore(false);
      setMessaggioErrore(null);
    } catch (e) {
      logErroreSupabaseDev("lista_campagne", e);
      setCampagne([]);
      setErrore(true);
      setMessaggioErrore(messaggioErroreSupabase(e, "lista"));
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void caricaCampagne();
  }, [caricaCampagne]);

  if (caricamento) {
    return <SkeletonCampagne />;
  }

  if (errore) {
    return (
      <AllyEmptyState
        className="min-h-[11.5rem] max-w-md"
        title="Non riesco a caricare le campagne."
        description={messaggioErrore ?? "Riprova tra qualche secondo."}
        action={
          <button
            type="button"
            onClick={() => void caricaCampagne()}
            className="aff-btn-secondary"
          >
            Riprova
          </button>
        }
      />
    );
  }

  if (campagne.length === 0) {
    return (
      <AllyEmptyState
        className="min-h-[11.5rem] max-w-md"
        icon={LayoutGrid}
        title="Nessuna campagna ancora"
        description="Importa da Meta oppure pianifica una campagna Ally partendo dall'obiettivo."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/home" className="aff-btn-primary">
              Scegli come iniziare
            </Link>
            <button
              type="button"
              onClick={scrollObiettiviCampagna}
              className="aff-btn-secondary"
            >
              Pianifica ora
            </button>
          </div>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {campagne.map((campagna) => (
        <li key={campagna.id}>
          <RigaCampagna campagna={campagna} />
        </li>
      ))}
    </ul>
  );
}
