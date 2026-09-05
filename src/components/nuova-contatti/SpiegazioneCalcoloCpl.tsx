"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  scontrinoMedio: number;
  tassoConversione: number;
  targetMargin: number;
  breakEven: number;
  cplTarget: number;
  etichettaCosto?: string;
};

export function SpiegazioneCalcoloCpl({
  scontrinoMedio,
  tassoConversione,
  targetMargin,
  breakEven,
  cplTarget,
  etichettaCosto = "CPL",
}: Props) {
  const [aperto, setAperto] = useState(false);
  const spendShare = 100 - targetMargin;

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-[var(--accent)] hover:opacity-80"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
      >
        Come viene calcolato?
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${aperto ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {aperto ? (
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-[var(--ink)]">
          <p>
            Ally non prevede il costo reale su Meta. Costruisce una{" "}
            <strong className="font-medium">soglia economica di riferimento</strong>{" "}
            dai numeri che inserisci:
          </p>
          <ol className="list-decimal space-y-2 pl-4">
            <li>
              <strong className="font-medium">Break-even teorico</strong> = valore
              cliente × tasso di chiusura
              <br />
              <span className="text-[var(--ink-muted)]">
                {scontrinoMedio}€ × {tassoConversione}% = {breakEven}€
              </span>
            </li>
            <li>
              <strong className="font-medium">{etichettaCosto} target di riferimento</strong>{" "}
              = break-even × {spendShare}% (margine target {targetMargin}% da
              preservare)
              <br />
              <span className="text-[var(--ink-muted)]">
                {breakEven}€ × {spendShare}% ≈ {cplTarget}€
              </span>
            </li>
          </ol>
          <p className="text-[var(--ink-muted)]">
            Dopo il lancio confronterai il {etichettaCosto} reale con queste
            soglie — non con una previsione di performance.
          </p>
        </div>
      ) : null}
    </div>
  );
}
