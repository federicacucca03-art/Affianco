"use client";

import type { AlertFattibilita } from "@/lib/fattibilita-nicchia";

type Props = {
  /** CPL/CPA a break-even (guadagno zero). */
  breakEven: number;
  /** CPL/CPA target con margine di profitto preservato. */
  targetProfitto: number;
  etichettaCosto?: string;
  alert?: AlertFattibilita;
  /** Range di mercato Meta della nicchia (CPL o CPA). */
  riferimentoMercato?: { min: number; max: number; etichetta?: string } | null;
};

/**
 * Barra Break-Even vs soglia di profitto + eventuale alert fattibilità.
 */
export function BarraBreakEven({
  breakEven,
  targetProfitto,
  etichettaCosto = "CPL",
  alert,
  riferimentoMercato = null,
}: Props) {
  if (breakEven <= 0 || targetProfitto <= 0) return null;

  const verdePct = Math.min(
    100,
    Math.max(4, (targetProfitto / breakEven) * 100),
  );
  const arancioPct = Math.max(0, 100 - verdePct);

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          {etichettaCosto} target vs break-even
        </p>
        <div
          className="mt-2 flex h-3 overflow-hidden rounded-full bg-[var(--lavender-muted)]"
          role="img"
          aria-label={`${etichettaCosto} target ${targetProfitto}€, break-even ${breakEven}€`}
        >
          <div
            className="h-full bg-[var(--green-soft)] transition-all"
            style={{ width: `${verdePct}%` }}
            title={`${etichettaCosto} target di riferimento: ${targetProfitto}€`}
          />
          <div
            className="h-full bg-[var(--yellow-soft)] transition-all"
            style={{ width: `${arancioPct}%` }}
            title={`Fino a break-even: ${breakEven}€`}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs">
          <span className="text-[var(--ink)]">
            {etichettaCosto} target:{" "}
            <span className="font-medium">{targetProfitto}€</span>
          </span>
          <span className="text-[var(--ink)]">
            Break-even teorico:{" "}
            <span className="font-medium">{breakEven}€</span>
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-muted)]">
          Sotto {targetProfitto}€ di {etichettaCosto} resti entro la soglia con
          margine target. Tra {targetProfitto}€ e {breakEven}€ sei in zona da
          monitorare; oltre il break-even la campagna perde margine.
        </p>
        {riferimentoMercato &&
        riferimentoMercato.min > 0 &&
        riferimentoMercato.max > 0 ? (
          <p className="mt-2 rounded-[14px] bg-[var(--lavender-muted)]/70 px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
            Asta Meta{" "}
            {riferimentoMercato.etichetta
              ? `· ${riferimentoMercato.etichetta}`
              : "di nicchia"}
            : {etichettaCosto} tipico{" "}
            <span className="font-medium">
              {riferimentoMercato.min}–{riferimentoMercato.max}€
            </span>
            . Confronta la tua soglia sostenibile con questo range.
          </p>
        ) : null}
      </div>

      {alert ? (
        <div
          className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${
            alert.tone === "warning"
              ? "border-0 bg-[var(--yellow-soft)]/80 text-[var(--ink)]"
              : "border-0 bg-[var(--lavender-muted)] text-[var(--ink)]"
          }`}
        >
          {alert.messaggio}
        </div>
      ) : null}
    </div>
  );
}
