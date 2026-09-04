import Link from "next/link";

type Props = {
  titolo: string;
  descrizione?: string;
};

export function PercorsoInArrivo({ titolo, descrizione }: Props) {
  return (
    <main className="aff-page aff-page--narrow">
      <Link href="/campagne" className="aff-btn-tertiary min-h-8 px-0">
        Torna alle campagne
      </Link>
      <p className="aff-eyebrow mt-4">Percorso guidato</p>
      <h1 className="aff-page-title mt-1.5">{titolo}</h1>
      <p className="aff-page-subtitle">
        {descrizione ??
          "Questo percorso è in preparazione. Nel frattempo puoi usare Più richieste di contatto per lanciare la prima campagna."}
      </p>
      <Link
        href="/campagne/nuova/richieste-contatto"
        className="aff-btn-primary mt-6"
      >
        Vai a Più richieste di contatto
      </Link>
    </main>
  );
}
