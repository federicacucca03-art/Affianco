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

function BadgeStato({
  ultimo,
}: {
  ultimo: CampaignCheck | null;
}) {
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
      <div className="mt-8 space-y-3">
        <div className="h-24 animate-pulse rounded-[var(--radius)] bg-[var(--surface-hover)]" />
        <div className="h-24 animate-pulse rounded-[var(--radius)] bg-[var(--surface-hover)]" />
      </div>
    );
  }

  if (errore && righe.length === 0) {
    return (
      <div className="mt-8 rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-5 text-sm text-[var(--ink-muted)]">
        <p>{errore}</p>
        <button
          type="button"
          onClick={onRiprova}
          className="mt-2 text-sm font-medium text-[var(--accent)]"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (righe.length === 0) {
    return (
      <div className="mt-8 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-white px-6 py-8 text-center">
        <p className="text-sm text-[var(--ink-muted)]">
          Non hai ancora campagne salvate. Creane una dal wizard, poi torna
          qui per il controllo settimanale.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <section className="rounded-[var(--radius)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <h2 className="text-sm font-medium text-[var(--ink)]">
          Cosa richiede attenzione
        </h2>
        {zeroAttenzione ? (
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Nessuna campagna richiede intervento oggi.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltro("red")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                filtro === "red"
                  ? "bg-[#FDEDED] text-[#B42318]"
                  : "bg-[#FDEDED]/70 text-[#B42318] hover:bg-[#FDEDED]"
              }`}
            >
              {attenzione.red} da intervenire
            </button>
            <button
              type="button"
              onClick={() => setFiltro("yellow")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                filtro === "yellow"
                  ? "bg-[#FFF6E5] text-[#9A6700]"
                  : "bg-[#FFF6E5]/70 text-[#9A6700] hover:bg-[#FFF6E5]"
              }`}
            >
              {attenzione.yellow} da monitorare
            </button>
            <button
              type="button"
              onClick={() => setFiltro("no_check")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                filtro === "no_check"
                  ? "bg-[#EEF0F3] text-[#5A6578]"
                  : "bg-[#EEF0F3]/70 text-[#5A6578] hover:bg-[#EEF0F3]"
              }`}
            >
              {attenzione.noCheck} mai controllate
            </button>
          </div>
        )}
      </section>

      <div
        className="mt-4 flex flex-wrap gap-2"
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
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                attivo
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-white text-[var(--ink-muted)] shadow-[var(--shadow-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {visibili.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          Nessuna campagna in questo filtro.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {visibili.map(({ campagna, ultimo }) => {
            const objective = normalizzaObjective(campagna.objective);
            const metricLabel = etichettaMetricaPrimaria(objective);
            const prima = ultimo?.actions[0] ?? null;
            const diagnosi = ultimo
              ? copyDiagnosiOverview(ultimo.signal)
              : "Diagnosi non ancora definita";
            return (
              <li
                key={campagna.id}
                className="rounded-[var(--radius)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="order-2 min-w-0 sm:order-1">
                    <p className="text-xs text-[var(--ink-muted)]">
                      {campagna.nomeCliente}
                    </p>
                    <p className="mt-0.5 text-base font-medium text-[var(--ink)]">
                      {nomeCampagnaCard(campagna)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                      {etichettaObiettivo(objective)}
                    </p>
                  </div>
                  <div className="order-1 sm:order-2 sm:text-right">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                      Stato
                    </p>
                    <BadgeStato ultimo={ultimo} />
                  </div>
                </div>

                {ultimo ? (
                  <p className="mt-3 text-sm text-[var(--ink)]">
                    <span className="text-[var(--ink-muted)]">
                      {metricLabel}{" "}
                    </span>
                    <span className="font-medium">
                      {formatEuro(ultimo.primaryCost)}
                    </span>
                    <span className="text-[var(--ink-muted)]"> · soglia </span>
                    <span className="font-medium">
                      {formatEuro(ultimo.threshold)}
                    </span>
                    <span className="text-[var(--ink-muted)]">
                      {" "}
                      · {deltaPct(ultimo)}
                    </span>
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-[var(--ink-muted)]">
                    Non hai ancora salvato un controllo performance.
                  </p>
                )}

                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    Diagnosi
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--ink)]">{diagnosi}</p>
                </div>

                {prima ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                      Prossima azione
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--ink)]">
                      {prima.text}
                    </p>
                  </div>
                ) : null}

                <Link
                  href={`/risultati?campaignId=${encodeURIComponent(campagna.id)}`}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  {ultimo ? "Apri controllo" : "Controlla ora"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
