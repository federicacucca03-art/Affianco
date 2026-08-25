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
          className="mt-2 flex h-3 overflow-hidden rounded-full bg-[#EEF0F3]"
          role="img"
          aria-label={`${etichettaCosto} target ${targetProfitto}€, break-even ${breakEven}€`}
        >
          <div
            className="h-full bg-[#3D8B57] transition-all"
            style={{ width: `${verdePct}%` }}
            title={`${etichettaCosto} target di riferimento: ${targetProfitto}€`}
          />
          <div
            className="h-full bg-[#E6A817] transition-all"
            style={{ width: `${arancioPct}%` }}
            title={`Fino a break-even: ${breakEven}€`}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[var(--ink)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3D8B57]"
              aria-hidden
            />
            <span>
              Verde · {etichettaCosto} target:{" "}
              <span className="font-medium">{targetProfitto}€</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--ink)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-[#E6A817]"
              aria-hidden
            />
            <span>
              Arancio · Break-even teorico:{" "}
              <span className="font-medium">{breakEven}€</span>
            </span>
          </div>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-muted)]">
          Sotto {targetProfitto}€ di {etichettaCosto} resti entro la soglia con
          margine target. Tra {targetProfitto}€ e {breakEven}€ sei in zona da
          monitorare; oltre il break-even la campagna perde margine.
        </p>
        {riferimentoMercato &&
        riferimentoMercato.min > 0 &&
        riferimentoMercato.max > 0 ? (
          <p className="mt-2 rounded-lg border border-[#c6d8f0] bg-[#f3f7fc] px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
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
              ? "border-[#f5c9b8] bg-[#fff4f0] text-[var(--ink)]"
              : "border-[#c6e7c8] bg-[#f0faf1] text-[var(--ink)]"
          }`}
        >
          {alert.messaggio}
        </div>
      ) : null}
    </div>
  );
}
