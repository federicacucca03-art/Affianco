"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const PASSAGGI = [
  {
    id: "fase-1",
    testo:
      'Clicca su «Esporta Campagna Pronta per Meta» e scarica il file di importazione Meta (3 varianti + opt-out Advantage+).',
  },
  {
    id: "fase-2",
    testo:
      "Apri Meta Ads Manager, seleziona l'account del cliente e in alto a sinistra clicca sulle tre barrette / «Importa».",
  },
  {
    id: "fase-3",
    testo:
      "Scegli «Importa file in blocco», carica il .csv appena scaricato e clicca «Importa». Campagna, budget e target restano in bozza.",
  },
  {
    id: "fase-4",
    testo:
      "Apri la bozza su Meta, collega Pagina e Lead Form se mancano, poi carica le creatività. Advantage+ Creative resta disattivato.",
  },
];

export function ChecklistMeta() {
  const [completate, setCompletate] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setCompletate((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <details className="group rounded-[var(--radius)] bg-white shadow-[var(--shadow-soft)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-sm font-medium text-[var(--ink)]">
            Come importare su Meta Ads Manager
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Quattro passaggi per importare la campagna in bozza su Meta.
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <ul className="space-y-2 border-t border-[var(--border)] px-5 pt-4 pb-5">
        {PASSAGGI.map((passaggio, indice) => {
          const fatta = Boolean(completate[passaggio.id]);
          return (
            <li key={passaggio.id}>
              <div
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
                  fatta
                    ? "border-[#cce5d4] bg-[#f3faf5] opacity-50"
                    : "border-[var(--border)] bg-white opacity-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(passaggio.id)}
                  aria-pressed={fatta}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                    fatta
                      ? "border-[#3D8B57] bg-[#3D8B57] text-white"
                      : "border-[var(--border)] bg-white"
                  }`}
                >
                  {fatta ? (
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  ) : null}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-xs font-medium text-[var(--accent)]">
                    Fase {indice + 1}
                  </p>
                  <p
                    className={`text-sm leading-snug transition-all ${
                      fatta
                        ? "text-[var(--ink-muted)] line-through"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {passaggio.testo}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
