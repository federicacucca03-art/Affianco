"use client";

import {
  haGuidanceDaMostrare,
  selezionaGuidanceDaMostrare,
  type GuidanceItem,
  type GuidanceLevel,
  type RaccomandazioneLancio,
} from "@/lib/guidance";
import { StatoChip, type StatoChipKind } from "@/components/nuova-contatti/StatoChip";

type AffiancoSuggerisceProps = {
  items: GuidanceItem[];
  onAction?: (item: GuidanceItem) => void;
};

const STILE_LIVELLO: Record<
  GuidanceLevel,
  { badge: string; etichetta: string }
> = {
  INFO: {
    badge: "aff-badge aff-badge--violet aff-badge--pill",
    etichetta: "Info",
  },
  SUGGESTION: {
    badge: "aff-badge aff-badge--success aff-badge--pill",
    etichetta: "Suggerimento",
  },
  WARNING: {
    badge: "aff-badge aff-badge--warning aff-badge--pill",
    etichetta: "Attenzione",
  },
  BLOCKER: {
    badge: "aff-badge aff-badge--danger aff-badge--pill",
    etichetta: "Da sistemare",
  },
};

function InsightRiga({
  item,
  evidenziato,
  onAction,
}: {
  item: GuidanceItem;
  evidenziato: boolean;
  onAction?: (item: GuidanceItem) => void;
}) {
  const stile = STILE_LIVELLO[item.level];
  return (
    <li className={evidenziato ? "" : "border-t border-[var(--border)] pt-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${stile.badge}`}
        >
          {stile.etichetta}
        </span>
      </div>
      <p
        className={`mt-1.5 font-medium text-[var(--ink)] ${
          evidenziato ? "text-base" : "text-sm"
        }`}
      >
        {item.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
        {item.description}
      </p>
      {item.actionLabel ? (
        onAction ? (
          <button
            type="button"
            onClick={() => onAction(item)}
            className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            {item.actionLabel}
          </button>
        ) : (
          <p className="mt-2 text-xs font-medium text-[var(--ink)]">
            {item.actionLabel}
          </p>
        )
      ) : null}
    </li>
  );
}

export function AffiancoSuggerisce({
  items,
  onAction,
}: AffiancoSuggerisceProps) {
  if (!haGuidanceDaMostrare(items)) return null;
  const { principale, secondari } = selezionaGuidanceDaMostrare(items);
  if (!principale) return null;

  return (
    <section className="aff-panel-white p-6">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Affianco suggerisce
      </p>
      <ul className="mt-3 space-y-3">
        <InsightRiga item={principale} evidenziato onAction={onAction} />
        {secondari.map((item) => (
          <InsightRiga
            key={item.id}
            item={item}
            evidenziato={false}
            onAction={onAction}
          />
        ))}
      </ul>
    </section>
  );
}

const STILE_RACCOMANDAZIONE: Record<
  RaccomandazioneLancio["stato"],
  { kind: StatoChipKind; etichetta: string }
> = {
  READY_TO_LAUNCH: {
    kind: "ok",
    etichetta: "Puoi lanciare",
  },
  READY_WITH_CAUTION: {
    kind: "watch",
    etichetta: "Con cautela",
  },
  NOT_READY: {
    kind: "critico",
    etichetta: "Non ancora",
  },
};

export function RaccomandazioneLancio({
  result,
}: {
  result: RaccomandazioneLancio;
}) {
  const stile = STILE_RACCOMANDAZIONE[result.stato];
  return (
    <section className="aff-panel-white p-5 sm:p-6">
      <p className="text-[13px] font-medium text-[var(--primary)]">
        Affianco suggerisce
      </p>
      <span className="mt-2 inline-flex">
        <StatoChip kind={stile.kind} label={stile.etichetta} />
      </span>
      <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--ink)]">
        {result.title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
        {result.description}
      </p>
      {result.reasons.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-black/5 pt-3">
          {result.reasons.map((motivo) => (
            <li
              key={motivo}
              className="text-sm leading-relaxed text-[var(--ink-muted)]"
            >
              {motivo}
            </li>
          ))}
        </ul>
      ) : null}
      {result.actions.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {result.actions.map((azione) => (
            <li
              key={azione}
              className="text-sm font-medium leading-relaxed text-[var(--ink)]"
            >
              {azione}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
