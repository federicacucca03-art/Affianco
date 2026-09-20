"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, Link2, Search } from "lucide-react";
import type { Campagna } from "@/types/campagne";
import { formatDataBreve } from "@/types/campagne";
import { leggiInventarioCampagneNative } from "@/lib/campagne-inventory";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadMetaMondayBundle } from "@/lib/meta/monday-meta-loader";
import {
  buildNativeAttentionItem,
  buildMetaAttentionItem,
} from "@/lib/monday-control-room";
import {
  resolveNextAction,
  shouldShowNextAction,
} from "@/lib/campaign-next-action";
import {
  buildInventarioRighe,
  buildInventarioSummary,
  collectLinkedNativeIdsForInventory,
  filterInventarioRighe,
} from "@/lib/campagne-inventory-ui";
import { RigaCampagnaInventario } from "@/components/RigaCampagna";
import type { MetaCampaignMonitoringRow } from "@/lib/meta/meta-campaign-monitoring-row";
import type {
  MetaTrendDirection,
  MetaTrendLevel,
} from "@/lib/meta/meta-trend";

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

function nextActionTitleForNative(campagna: Campagna): string | null {
  if (!campagna.id) return null;
  const item = buildNativeAttentionItem({
    campagna,
    check: null,
    checksForTrend: [],
  });
  const action = resolveNextAction({
    campaignId: item.campaignId,
    source: item.source,
    campaignStatus: item.campaignStatus,
    attentionState: item.attentionState,
    health: item.healthStatus,
    trend: item.trend,
    healthAvailability: item.healthAvailability,
    configurationKind: item.configurationKind,
    resultsCount: item.resultsCount,
    rowHref: item.href,
    diagnosis: null,
  });
  if (!shouldShowNextAction(action.actionType)) return null;
  return action.title;
}

function nextActionTitleForMeta(
  row: MetaCampaignMonitoringRow,
  trendDirection: MetaTrendDirection | null,
  trendLevel: MetaTrendLevel | undefined,
): string | null {
  const attention = buildMetaAttentionItem({
    row,
    trendDirection,
    trendLevel,
  });
  const action = resolveNextAction({
    campaignId: attention.campaignId,
    source: attention.source,
    campaignStatus: attention.campaignStatus,
    attentionState: attention.attentionState,
    health: attention.healthStatus,
    trend: attention.trend,
    healthAvailability: attention.healthAvailability,
    configurationKind: attention.configurationKind,
    resultsCount: attention.resultsCount,
    rowHref: attention.href,
    diagnosis: null,
  });
  if (!shouldShowNextAction(action.actionType)) return null;
  return action.title;
}

type Props = {
  onImportMeta?: () => void;
  importBusy?: boolean;
};

export function ListaCampagne({ onImportMeta, importBusy }: Props) {
  const { user } = useAuth();
  const [campagne, setCampagne] = useState<Campagna[]>([]);
  const [metaSource, setMetaSource] = useState<MetaCampaignMonitoringRow[]>(
    [],
  );
  const [metaNextById, setMetaNextById] = useState<
    Record<string, string | null>
  >({});
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const [messaggioErrore, setMessaggioErrore] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [cliente, setCliente] = useState("");
  const [stato, setStato] = useState("");
  const [origine, setOrigine] = useState("");

  const caricaCampagne = useCallback(async () => {
    setCaricamento(true);
    setErrore(false);
    setMessaggioErrore(null);

    try {
      /* Canonical Supabase inventory only — never localStorage campaign memory. */
      const lista = await leggiInventarioCampagneNative();
      setCampagne(lista);

      if (user?.id) {
        const bundle = await loadMetaMondayBundle(user.id);
        const nextMap: Record<string, string | null> = {};
        for (const row of bundle.rows) {
          const trend = bundle.trends.get(row.id);
          nextMap[row.id] = nextActionTitleForMeta(
            row,
            trend?.direction ?? null,
            trend?.level,
          );
        }
        setMetaSource(bundle.rows);
        setMetaNextById(nextMap);
      } else {
        setMetaSource([]);
        setMetaNextById({});
      }

      setErrore(false);
      setMessaggioErrore(null);
    } catch (e) {
      logErroreSupabaseDev("lista_campagne", e);
      setCampagne([]);
      setMetaSource([]);
      setMetaNextById({});
      setErrore(true);
      setMessaggioErrore(messaggioErroreSupabase(e, "lista"));
    } finally {
      setCaricamento(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void caricaCampagne();
  }, [caricaCampagne]);

  const allRows = useMemo(() => {
    const linkedNative = collectLinkedNativeIdsForInventory(metaSource);
    return buildInventarioRighe({
      native: campagne
        .filter((c) => Boolean(c.id))
        .map((campagna) => ({
          campagna,
          linkedToMeta: linkedNative.has(campagna.id!),
          nextActionTitle: nextActionTitleForNative(campagna),
          objectiveLabel: etichettaObiettivo(campagna.objective) || null,
          periodLabel: formatDataBreve(campagna.dataLancio) || null,
        })),
      meta: metaSource.map((row) => ({
        row,
        nextActionTitle: metaNextById[row.id] ?? null,
      })),
    });
  }, [campagne, metaSource, metaNextById]);

  const summary = useMemo(() => buildInventarioSummary(allRows), [allRows]);

  const clienti = useMemo(() => {
    const set = new Set(allRows.map((r) => r.clientName).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "it"));
  }, [allRows]);

  const filtered = useMemo(
    () =>
      filterInventarioRighe(allRows, {
        query,
        cliente,
        stato,
        origine,
      }),
    [allRows, query, cliente, stato, origine],
  );

  const activeRows = filtered.filter((r) => !r.historical);
  const historicalRows = filtered.filter((r) => r.historical);

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

  if (allRows.length === 0) {
    return (
      <AllyEmptyState
        className="min-h-[11.5rem] max-w-md"
        icon={LayoutGrid}
        title="Non hai ancora campagne."
        description="Crea una campagna in Ally oppure importa quelle che gestisci già su Meta."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/campagne/nuova" className="aff-btn-primary inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Nuova campagna
            </Link>
            <button
              type="button"
              onClick={onImportMeta}
              disabled={importBusy}
              className="aff-btn-secondary inline-flex items-center gap-1.5"
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {importBusy ? "Preparazione…" : "Importa da Meta"}
            </button>
          </div>
        }
      />
    );
  }

  const summaryItems: { key: string; label: string; count: number }[] = [
    { key: "all", label: "Tutte", count: summary.totale },
    { key: "DRAFT", label: "Bozze", count: summary.bozze },
    {
      key: "APPROVAL_PENDING",
      label: "In attesa di approvazione",
      count: summary.inAttesaApprovazione,
    },
    { key: "REVISION", label: "In revisione", count: summary.inRevisione },
    { key: "APPROVED", label: "Approvate", count: summary.approvate },
  ].filter((i) => i.key === "all" || i.count > 0);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {summaryItems.map((item) => {
          const selected =
            (item.key === "all" && !stato) || stato === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setStato(item.key === "all" ? "" : item.key)
              }
              className={[
                "min-w-[4.5rem] rounded-[10px] border px-3 py-2 text-left transition-colors",
                selected
                  ? "border-[var(--primary)]/35 bg-[var(--ally-violet-soft)]"
                  : "border-[var(--border)] bg-white/80 hover:border-[var(--primary)]/25",
              ].join(" ")}
            >
              <p className="text-[18px] font-semibold tabular-nums leading-none text-[var(--ink)]">
                {item.count}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                {item.label}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca campagna o cliente"
            className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-white/80 pl-9 pr-3 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-subtle)]"
            aria-label="Cerca campagna o cliente"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="h-10 rounded-[10px] border border-[var(--border)] bg-white/80 px-2.5 text-[13px] text-[var(--ink)]"
            aria-label="Filtra per cliente"
          >
            <option value="">Cliente</option>
            {clienti.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={stato}
            onChange={(e) => setStato(e.target.value)}
            className="h-10 rounded-[10px] border border-[var(--border)] bg-white/80 px-2.5 text-[13px] text-[var(--ink)]"
            aria-label="Filtra per stato"
          >
            <option value="">Stato</option>
            <option value="DRAFT">Bozza</option>
            <option value="APPROVAL_PENDING">In attesa di approvazione</option>
            <option value="REVISION">Revisione richiesta</option>
            <option value="APPROVED">Approvata</option>
            <option value="META_ACTIVE">Attiva su Meta</option>
            <option value="META_PAUSED">In pausa su Meta</option>
            <option value="HISTORICAL">Storico</option>
          </select>
          <select
            value={origine}
            onChange={(e) => setOrigine(e.target.value)}
            className="h-10 rounded-[10px] border border-[var(--border)] bg-white/80 px-2.5 text-[13px] text-[var(--ink)]"
            aria-label="Filtra per origine"
          >
            <option value="">Origine</option>
            <option value="ALLY">Ally</option>
            <option value="META">Meta</option>
            <option value="ALLY_META">Ally + Meta</option>
          </select>
        </div>
      </div>

      {activeRows.length === 0 && historicalRows.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-muted)]">
          Nessuna campagna corrisponde ai filtri.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activeRows.map((riga) => (
            <li key={riga.id}>
              <RigaCampagnaInventario riga={riga} />
            </li>
          ))}
        </ul>
      )}

      {historicalRows.length > 0 ? (
        <section className="mt-2 border-t border-[var(--border)]/70 pt-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
            Storico
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {historicalRows.map((riga) => (
              <li key={riga.id}>
                <RigaCampagnaInventario riga={riga} muted />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
