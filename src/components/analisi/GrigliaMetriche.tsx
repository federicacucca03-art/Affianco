import type { MetricheAnalisi } from "@/data/analisi-demo";
import { formatEuro } from "@/data/analisi-demo";

type Props = {
  metriche: MetricheAnalisi;
};

export function GrigliaMetriche({ metriche }: Props) {
  const voci = [
    {
      etichetta: "Spesa totale",
      valore: formatEuro(metriche.spesaTotale),
    },
    {
      etichetta: "Risultati",
      valore: `${metriche.risultati} ${metriche.etichettaRisultati}`,
    },
    {
      etichetta: "Costo per risultato",
      valore:
        metriche.risultati === 0
          ? "—"
          : formatEuro(metriche.costoPerRisultato),
    },
    {
      etichetta: "Giorni di attività",
      valore: `${metriche.giorniAttivita} giorni`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {voci.map((voce) => (
        <div
          key={voce.etichetta}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-4"
        >
          <p className="text-xs font-medium text-[var(--ink-muted)]">
            {voce.etichetta}
          </p>
          <p className="mt-1.5 text-lg font-medium text-[var(--ink)]">
            {voce.valore}
          </p>
        </div>
      ))}
    </div>
  );
}
