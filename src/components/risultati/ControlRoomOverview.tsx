"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Campagna, CampagnaObjective } from "@/types/campagne";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import {
  etichettaMetricaPrimaria,
  etichettaSegnaleDiagnosi,
  formatEuro,
  type ActionPriority,
  type HealthStatus,
} from "@/lib/control-room";
import { StatoChip, chipDaHealth } from "@/components/nuova-contatti/StatoChip";
import { AllyEmptyState } from "@/components/shell/AllyEmptyState";
import { AllyMetric } from "@/components/shell/AllyMetric";
import { AllyNextAction } from "@/components/shell/AllyNextAction";
import { normalizzaObjective } from "@/types/campagne";
import type { CampaignCheck } from "@/lib/campaign-checks-db";

export type RigaControlRoom = {
  campagna: Campagna;
  ultimo: CampaignCheck | null;
};

export type FiltroControlRoom =
  | "tutte"
  | "red"
  | "yellow"
  | "insufficient"
  | "green"
  | "no_check";

const FILTRI: ReadonlyArray<{ id: FiltroControlRoom; label: string }> = [
  { id: "tutte", label: "Tutte" },
  { id: "red", label: "Da intervenire" },
  { id: "yellow", label: "Da monitorare" },
  { id: "insufficient", label: "Dati insufficienti" },
  { id: "green", label: "In salute" },
  { id: "no_check", label: "Mai controllate" },
];

/** Label operative solo in lista /risultati. Non tocca gli enum. */
export function etichettaStatoOperativo(
  status: HealthStatus | null,
  haCheck: boolean,
): string {
  if (!haCheck) return "Mai controllata";
  switch (status) {
    case "RED":
      return "Da intervenire";
    case "YELLOW":
      return "Da monitorare";
    case "INSUFFICIENT":
      return "Dati insufficienti";
    case "GREEN":
      return "In salute";
    default:
      return "Mai controllata";
  }
}

export function fallbackNomeCampagna(objective: CampagnaObjective): string {
  switch (objective) {
    case "BOOKINGS":
      return "Prenotazioni";
    case "ECOMMERCE":
      return "Vendite online";
    case "IN_STORE":
      return "Negozio";
    case "RETARGETING":
      return "Retargeting";
    case "AWARENESS":
      return "Awareness";
    default:
      return "Richieste contatto";
  }
}

export function nomeCampagnaCard(campagna: Campagna): string {
  const nome = (campagna.nomeCampagna ?? "").trim();
  const cliente = (campagna.nomeCliente ?? "").trim();
  if (!nome || nome === cliente) {
    return fallbackNomeCampagna(normalizzaObjective(campagna.objective));
  }
  return nome;
}

export function etichettaPrioritaBreve(priority: ActionPriority): string {
  if (priority === "alta") return "Alta";
  if (priority === "media") return "Media";
  return "Bassa";
}

function prioritaLista(ultimo: CampaignCheck | null): number {
  if (!ultimo) return 3;
  switch (ultimo.healthStatus) {
    case "RED":
      return 0;
    case "YELLOW":
      return 1;
    case "INSUFFICIENT":
      return 2;
    case "GREEN":
      return 4;
    default:
      return 3;
  }
}

export function ordinaRigheControlRoom(
  righe: RigaControlRoom[],
): RigaControlRoom[] {
  return [...righe].sort((a, b) => {
    const oa = prioritaLista(a.ultimo);
    const ob = prioritaLista(b.ultimo);
    if (oa !== ob) return oa - ob;

    if (!a.ultimo && !b.ultimo) {
      const da = a.campagna.dataLancio ?? "";
      const db = b.campagna.dataLancio ?? "";
      if (da && db && da !== db) return da.localeCompare(db);
      return (a.campagna.id ?? "").localeCompare(b.campagna.id ?? "");
    }

    const ca = a.ultimo?.createdAt ?? "";
    const cb = b.ultimo?.createdAt ?? "";
    if (ca && cb && ca !== cb) return ca.localeCompare(cb);
    return (a.campagna.id ?? "").localeCompare(b.campagna.id ?? "");
  });
}

export function filtraRigheControlRoom(
  righe: RigaControlRoom[],
  filtro: FiltroControlRoom,
): RigaControlRoom[] {
  if (filtro === "tutte") return righe;
  return righe.filter(({ ultimo }) => {
    if (filtro === "no_check") return !ultimo;
    if (!ultimo) return false;
    if (filtro === "red") return ultimo.healthStatus === "RED";
    if (filtro === "yellow") return ultimo.healthStatus === "YELLOW";
    if (filtro === "insufficient") return ultimo.healthStatus === "INSUFFICIENT";
    if (filtro === "green") return ultimo.healthStatus === "GREEN";
    return true;
  });
}

export function contaAttenzione(righe: RigaControlRoom[]) {
  let red = 0;
  let yellow = 0;
  let noCheck = 0;
  for (const r of righe) {
    if (!r.ultimo) {
      noCheck += 1;
      continue;
    }
    if (r.ultimo.healthStatus === "RED") red += 1;
    else if (r.ultimo.healthStatus === "YELLOW") yellow += 1;
  }
  return { red, yellow, noCheck };
}

function deltaPct(check: CampaignCheck): string {
  if (
    check.primaryCost == null ||
    check.threshold == null ||
    !(check.threshold > 0)
  ) {
    return "—";
  }
  const pct =
    Math.round(
      ((check.primaryCost - check.threshold) / check.threshold) * 1000,
    ) / 10;
  if (pct === 0) return "in linea";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function copyDiagnosiOverview(signal: string | null | undefined): string {
  if (!signal?.trim()) return "Diagnosi non ancora definita";
  return etichettaSegnaleDiagnosi(signal);
}

function filterChipClass(attivo: boolean): string {
  return `aff-tool-chip ${
    attivo
      ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)] text-[var(--ally-violet-active-text)]"
      : ""
  }`;
}

function BadgeStato({ ultimo }: { ultimo: CampaignCheck | null }) {
  const label = etichettaStatoOperativo(
    ultimo?.healthStatus ?? null,
    Boolean(ultimo),
  );
  if (!ultimo) {
    return <StatoChip kind="pending" label={label} />;
  }
  return (
    <StatoChip kind={chipDaHealth(ultimo.healthStatus)} label={label} />
  );
}

function AttentionMetricButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`aff-metric w-full text-left transition-colors ${
        active
          ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)]"
          : "hover:border-[rgba(99,91,255,0.22)]"
      }`}
    >
      <p className="aff-metric__label">{label}</p>
      <p className="aff-metric__value tabular-nums">{value}</p>
    </button>
  );
}

export function ControlRoomOverview({
  righe,
  caricamento,
  errore,
  onRiprova,
}: {
  righe: RigaControlRoom[];
  caricamento: boolean;
  errore: string | null;
  onRiprova: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroControlRoom>("tutte");
  const attenzione = useMemo(() => contaAttenzione(righe), [righe]);
  const visibili = useMemo(
    () => filtraRigheControlRoom(righe, filtro),
    [righe, filtro],
  );
  const zeroAttenzione =
    attenzione.red === 0 &&
    attenzione.yellow === 0 &&
    attenzione.noCheck === 0;

  if (caricamento) {
    return (
      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-[88px] animate-pulse rounded-[var(--radius)] bg-[var(--surface-hover)]" />
          <div className="h-[88px] animate-pulse rounded-[var(--radius)] bg-[var(--surface-hover)]" />
          <div className="h-[88px] animate-pulse rounded-[var(--radius)] bg-[var(--surface-hover)]" />
        </div>
      </div>
    );
  }

  if (errore && righe.length === 0) {
    return (
      <AllyEmptyState
        className="mt-6"
        title="Non riesco a caricare la Control Room."
        description={errore}
        action={
          <button type="button" onClick={onRiprova} className="aff-btn-secondary">
            Riprova
          </button>
        }
      />
    );
  }

  if (righe.length === 0) {
    return (
      <AllyEmptyState
        className="mt-6"
        title="Nessuna campagna salvata"
        description="Creane una dal wizard, poi torna qui per il controllo settimanale."
      />
    );
  }

  return (
    <div className="mt-6">
      <section>
        <h2 className="aff-section-title">Cosa richiede attenzione</h2>
        {zeroAttenzione ? (
          <p className="aff-section-sub">
            Nessuna campagna richiede intervento oggi.
          </p>
        ) : (
          <p className="aff-section-sub">
            Tocca una card per filtrare l&apos;elenco.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AttentionMetricButton
            label="Da intervenire"
            value={attenzione.red}
            active={filtro === "red"}
            onClick={() => setFiltro("red")}
          />
          <AttentionMetricButton
            label="Da monitorare"
            value={attenzione.yellow}
            active={filtro === "yellow"}
            onClick={() => setFiltro("yellow")}
          />
          <AttentionMetricButton
            label="Mai controllate"
            value={attenzione.noCheck}
            active={filtro === "no_check"}
            onClick={() => setFiltro("no_check")}
          />
        </div>
      </section>

      <div
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filtra campagne"
      >
        {FILTRI.map((chip) => {
          const attivo = filtro === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={attivo}
              onClick={() => setFiltro(chip.id)}
              className={filterChipClass(attivo)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {visibili.length === 0 ? (
        <p className="mt-6 aff-muted">Nessuna campagna in questo filtro.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {visibili.map(({ campagna, ultimo }) => {
            const objective = normalizzaObjective(campagna.objective);
            const metricLabel = etichettaMetricaPrimaria(objective);
            const prima = ultimo?.actions[0] ?? null;
            const diagnosi = ultimo
              ? copyDiagnosiOverview(ultimo.signal)
              : "Diagnosi non ancora definita";
            const hrefControllo = `/risultati?campaignId=${encodeURIComponent(campagna.id)}`;

            return (
              <li
                key={campagna.id}
                className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.06)] bg-[var(--ally-surface)] px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="aff-meta">{campagna.nomeCliente}</p>
                    <p className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                      {nomeCampagnaCard(campagna)}
                    </p>
                    <p className="mt-1 aff-meta">
                      {etichettaObiettivo(objective)}
                    </p>
                  </div>
                  <BadgeStato ultimo={ultimo} />
                </div>

                {ultimo ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <AllyMetric
                      label={metricLabel}
                      value={formatEuro(ultimo.primaryCost)}
                      className="aff-metric--compact"
                    />
                    <AllyMetric
                      label="Soglia"
                      value={formatEuro(ultimo.threshold)}
                      className="aff-metric--compact"
                    />
                    <AllyMetric
                      label="Scostamento"
                      value={deltaPct(ultimo)}
                      className="aff-metric--compact"
                    />
                  </div>
                ) : (
                  <p className="mt-3 aff-muted">
                    Non hai ancora salvato un controllo performance.
                  </p>
                )}

                <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                  <p className="aff-meta">Diagnosi</p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-[var(--ink)]">
                    {diagnosi}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {prima ? (
                    <AllyNextAction title={prima.text} />
                  ) : (
                    <span />
                  )}
                  <Link href={hrefControllo} className="aff-btn-primary shrink-0">
                    {ultimo ? "Apri controllo" : "Controlla ora"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
