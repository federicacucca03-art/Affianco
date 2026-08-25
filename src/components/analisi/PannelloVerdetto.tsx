"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Campagna } from "@/types/campagne";
import type { MetricheAnalisi } from "@/data/analisi-demo";
import { verdettoDaCampagna } from "@/data/analisi-demo";
import { EtichettaGiudizio } from "@/components/EtichettaGiudizio";

type Props = {
  campagna: Campagna;
  metriche: MetricheAnalisi | null;
};

export function PannelloVerdetto({ campagna, metriche }: Props) {
  const [copiato, setCopiato] = useState(false);
  const verdetto = metriche
    ? verdettoDaCampagna(campagna, metriche)
    : null;

  async function copiaFrase() {
    if (!verdetto) return;
    try {
      await navigator.clipboard.writeText(verdetto.fraseCliente);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 1500);
    } catch {
      // Ignora se clipboard non disponibile.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Giudizio
        </p>
        <div className="mt-2">
          <EtichettaGiudizio giudizio={campagna.giudizio} grande />
        </div>
        <p className="mt-3 text-lg font-medium text-[var(--ink)]">
          {campagna.nomeCliente}
        </p>
        <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{campagna.stato}</p>
      </div>

      {!metriche || !verdetto ? (
        <div className="rounded-[var(--radius)] bg-[var(--surface-hover)] p-5">
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            Carica l&apos;export CSV a sinistra per vedere la lettura dei numeri
            e la frase pronta da inviare al cliente.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-[var(--radius)] bg-[var(--accent-soft)] p-5">
            <h3 className="text-sm font-medium text-[var(--ink)]">
              Cosa dicono i numeri
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
              {verdetto.spiegazione}
            </p>
          </section>

          <section className="rounded-[var(--radius)] bg-[#eef7f1] p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Frase per il cliente
              </h3>
              <button
                type="button"
                onClick={() => void copiaFrase()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {copiato ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#3D8B57]" strokeWidth={2} />
                    Copiato
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Copia testo
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
              {verdetto.fraseCliente}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
