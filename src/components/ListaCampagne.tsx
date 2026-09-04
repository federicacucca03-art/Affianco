"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campagna } from "@/types/campagne";
import { leggiCampagneDaSupabase } from "@/lib/campagne-db";
import { RigaCampagna } from "@/components/RigaCampagna";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import { getCampaigns, type SavedCampaign } from "@/utils/clientStorage";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { LayoutGrid } from "lucide-react";

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
          className="aff-list-row animate-pulse"
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
      <AllyEmptyState
        className="min-h-[11.5rem] max-w-md"
        title="Non riesco a caricare le campagne."
        description={
          messaggioErrore ?? "Riprova tra qualche secondo."
        }
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
        title="Non hai ancora creato campagne."
        description="Scegli uno degli obiettivi qui sopra per iniziare."
        action={
          <button
            type="button"
            onClick={scrollObiettiviCampagna}
            className="aff-btn-primary"
          >
            Crea la prima campagna
          </button>
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
