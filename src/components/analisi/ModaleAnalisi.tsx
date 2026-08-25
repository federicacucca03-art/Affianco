"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Campagna } from "@/types/campagne";
import type { MetricheAnalisi } from "@/data/analisi-demo";
import { metricheDemoDaCampagna } from "@/data/analisi-demo";
import { AreaCaricamentoCsv } from "@/components/analisi/AreaCaricamentoCsv";
import { GrigliaMetriche } from "@/components/analisi/GrigliaMetriche";
import { PannelloVerdetto } from "@/components/analisi/PannelloVerdetto";

type Props = {
  campagna: Campagna;
  onChiudi: () => void;
};

export function ModaleAnalisi({ campagna, onChiudi }: Props) {
  const [nomeFile, setNomeFile] = useState<string | null>(null);
  const [metriche, setMetriche] = useState<MetricheAnalisi | null>(null);

  useEffect(() => {
    const precedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function suTasto(e: KeyboardEvent) {
      if (e.key === "Escape") onChiudi();
    }

    window.addEventListener("keydown", suTasto);
    return () => {
      document.body.style.overflow = precedente;
      window.removeEventListener("keydown", suTasto);
    };
  }, [onChiudi]);

  useEffect(() => {
    setNomeFile(null);
    setMetriche(null);
  }, [campagna.id]);

  function handleCSVUpload(file: File) {
    // Qui collegheremo il parser CSV reale.
    // Per ora simuliamo l'attivazione con metriche demo della campagna.
    setNomeFile(file.name);
    setMetriche(metricheDemoDaCampagna(campagna));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Chiudi analisi"
        className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
        onClick={onChiudi}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-analisi"
        className="relative z-10 flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[var(--background)] shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-[var(--radius-lg)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Analisi post-lancio
            </p>
            <h2
              id="titolo-analisi"
              className="truncate text-lg font-medium text-[var(--ink)]"
            >
              {campagna.nomeCliente}
            </h2>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="rounded-full p-2 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 border-b border-[var(--border)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Aggiorna i dati
              </h3>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Solo le metriche che contano per il cliente: spesa, risultati,
                costo e giorni.
              </p>
            </div>

            <AreaCaricamentoCsv
              nomeFile={nomeFile}
              onCarica={handleCSVUpload}
            />

            {metriche ? (
              <div>
                <h3 className="mb-3 text-sm font-medium text-[var(--ink)]">
                  Metriche chiave
                </h3>
                <GrigliaMetriche metriche={metriche} />
              </div>
            ) : null}
          </div>

          <aside className="bg-white p-5 sm:p-6 lg:sticky lg:top-0 lg:self-start">
            <PannelloVerdetto campagna={campagna} metriche={metriche} />
          </aside>
        </div>
      </div>
    </div>
  );
}
