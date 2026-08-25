import Link from "next/link";

type Props = {
  titolo: string;
  descrizione?: string;
};

export function PercorsoInArrivo({ titolo, descrizione }: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/campagne"
        className="text-sm font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
      >
        Torna alle campagne
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
        Percorso guidato
      </p>
      <h1 className="mt-1 text-2xl font-medium tracking-tight text-[var(--ink)]">
        {titolo}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        {descrizione ??
          "Questo percorso è in preparazione. Nel frattempo puoi usare Più richieste di contatto per lanciare la prima campagna."}
      </p>
      <Link
        href="/campagne/nuova/richieste-contatto"
        className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Vai a Più richieste di contatto
      </Link>
    </main>
  );
}
