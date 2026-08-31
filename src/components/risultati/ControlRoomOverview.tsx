"use client";

import Link from "next/link";
import type { Campagna } from "@/types/campagne";
import { etichettaObiettivo } from "@/lib/pre-lancio-check";
import {
  emojiHealth,
  etichettaHealth,
  etichettaMetricaPrimaria,
  formatDataCheck,
  formatEuro,
  healthBadgeClasses,
  healthStatusOrdine,
} from "@/lib/control-room";
import { normalizzaObjective } from "@/types/campagne";
import type { CampaignCheck } from "@/lib/campaign-checks-db";

export type RigaControlRoom = {
  campagna: Campagna;
  ultimo: CampaignCheck | null;
};

export function ordinaRigheControlRoom(
  righe: RigaControlRoom[],
): RigaControlRoom[] {
  return [...righe].sort((a, b) => {
    const oa = healthStatusOrdine(a.ultimo?.healthStatus ?? null);
    const ob = healthStatusOrdine(b.ultimo?.healthStatus ?? null);
    if (oa !== ob) return oa - ob;
    const da = a.ultimo?.createdAt ?? "";
    const db = b.ultimo?.createdAt ?? "";
    return db.localeCompare(da);
  });
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
    <ul className="mt-8 space-y-3">
      {righe.map(({ campagna, ultimo }) => {
        const objective = normalizzaObjective(campagna.objective);
        const metricLabel = etichettaMetricaPrimaria(objective);
        const status = ultimo?.healthStatus ?? null;
        const next = ultimo?.actions[0]?.text ?? null;
        return (
          <li
            key={campagna.id}
            className="rounded-[var(--radius)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[var(--ink-muted)]">
                  {campagna.nomeCliente}
                  {campagna.nomeCampagna &&
                  campagna.nomeCampagna !== campagna.nomeCliente
                    ? ` · ${etichettaObiettivo(objective)}`
                    : ` · ${etichettaObiettivo(objective)}`}
                </p>
                <p className="mt-0.5 text-base font-medium text-[var(--ink)]">
                  {campagna.nomeCampagna || campagna.nomeCliente}
                </p>
              </div>
              {ultimo ? (
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${healthBadgeClasses(ultimo.healthStatus)}`}
                >
                  {emojiHealth(status)} {etichettaHealth(status)}
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-[#EEF0F3] px-3 py-1 text-xs font-medium text-[#5A6578]">
                  Mai controllata
                </span>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-[var(--ink-muted)]">
                  {metricLabel}
                </dt>
                <dd className="mt-0.5 font-medium text-[var(--ink)]">
                  {ultimo ? formatEuro(ultimo.primaryCost) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ink-muted)]">Soglia</dt>
                <dd className="mt-0.5 font-medium text-[var(--ink)]">
                  {ultimo ? formatEuro(ultimo.threshold) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ink-muted)]">Delta</dt>
                <dd className="mt-0.5 font-medium text-[var(--ink)]">
                  {ultimo ? deltaPct(ultimo) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ink-muted)]">
                  Ultimo check
                </dt>
                <dd className="mt-0.5 font-medium text-[var(--ink)]">
                  {ultimo ? formatDataCheck(ultimo.createdAt) : "—"}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              {next ? (
                <>
                  <span className="font-medium text-[var(--ink)]">
                    Next action:{" "}
                  </span>
                  {next}
                </>
              ) : (
                "Nessuna next action salvata."
              )}
            </p>

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
  );
}
