"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campagna } from "@/types/campagne";
import { leggiCampagneDaSupabase } from "@/lib/campagne-db";
import { RigaCampagna } from "@/components/RigaCampagna";
import { getCampaigns, type SavedCampaign } from "@/utils/clientStorage";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";

function inizialiDaNome(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "??";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return `${parti[0][0]}${parti[parti.length - 1][0]}`.toUpperCase();
}

function campagnaDaMemoria(c: SavedCampaign): Campagna {
  return {
    id: c.id,
    nomeCliente: c.nomeCliente,
    iniziali: inizialiDaNome(c.nomeCliente),
    stato: c.status || "Bozza",
    giudizio: "Ancora presto",
    objective: c.objective,
    nomeCampagna: c.nomeCampagna,
    settore: c.settore,
    citta: c.citta,
    dataLancio: c.dataCreazione,
    status: c.status,
    frontEndOffer: c.frontEndOffer || undefined,
  };
}

function fondiCampagne(
  remote: Campagna[],
  locali: SavedCampaign[],
): Campagna[] {
  const byId = new Map<string, Campagna>();
  for (const loc of locali) {
    byId.set(loc.id, campagnaDaMemoria(loc));
  }
  for (const rem of remote) {
    const precedente = byId.get(rem.id);
    byId.set(
      rem.id,
      precedente
        ? {
            ...precedente,
            ...rem,
            dataLancio: rem.dataLancio || precedente.dataLancio,
            objective: rem.objective ?? precedente.objective,
            status: rem.status ?? precedente.status,
            nomeCampagna: rem.nomeCampagna || precedente.nomeCampagna,
          }
        : rem,
    );
  }
  return [...byId.values()].sort((a, b) =>
    (b.dataLancio ?? "").localeCompare(a.dataLancio ?? ""),
  );
}

function SkeletonCampagne() {
  return (
    <ul
      className="flex min-h-[11.5rem] flex-col gap-2.5"
      aria-busy="true"
      aria-label="Caricamento campagne"
    >
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-[var(--radius)] bg-white px-4 py-3 shadow-[var(--shadow-soft)] sm:gap-4"
        >
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

    const locali = getCampaigns();
    try {
      const lista = await leggiCampagneDaSupabase();
      setCampagne(fondiCampagne(lista, locali));
      setErrore(false);
      setMessaggioErrore(null);
    } catch (e) {
      logErroreSupabaseDev("lista_campagne", e);
      console.warn(
        "[Affianco] Impossibile caricare campagne da Supabase, uso fallback locale",
        e,
      );
      const daLocale = fondiCampagne([], locali);
      setCampagne(daLocale);
      if (daLocale.length === 0) {
        setErrore(true);
        setMessaggioErrore(messaggioErroreSupabase(e, "lista"));
      } else {
        setErrore(false);
        setMessaggioErrore(null);
      }
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
      <div className="min-h-[11.5rem] max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-white px-5 py-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-medium text-[var(--ink)]">
          Non riesco a caricare le campagne.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          {messaggioErrore ??
            "Riprova tra qualche secondo."}
        </p>
        <button
          type="button"
          onClick={() => void caricaCampagne()}
          className="mt-4 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--accent-muted)] hover:text-[var(--accent)]"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (campagne.length === 0) {
    return (
      <div className="min-h-[11.5rem] max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-white px-5 py-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-medium text-[var(--ink)]">
          Non hai ancora creato campagne.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          Scegli uno degli obiettivi qui sopra per iniziare.
        </p>
        <button
          type="button"
          onClick={scrollObiettiviCampagna}
          className="mt-4 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Crea la prima campagna
        </button>
      </div>
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
