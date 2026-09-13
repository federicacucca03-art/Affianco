const BLOCCHI = [
  {
    titolo: "Contesto disperso",
    testo:
      "Obiettivi, numeri e decisioni finiscono in posti diversi e ogni volta devi ricostruire la situazione.",
  },
  {
    titolo: "Priorità poco chiare",
    testo:
      "Non tutte le campagne richiedono attenzione nello stesso momento, ma è facile trattarle tutte allo stesso modo.",
  },
  {
    titolo: "Decisioni da ricostruire",
    testo:
      "Prima di decidere cosa fare devi ricordare cosa è successo, cosa era stato approvato e quali dati sono davvero affidabili.",
  },
] as const;

export function LandingProblema() {
  return (
    <section className="border-y border-[var(--border)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 lg:items-start">
          <div className="lg:col-span-5">
            <h2 className="text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl">
              Quando gestisci più clienti, il difficile è non perdere il filo.
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-[var(--ink-muted)]">
              <p>Obiettivi, numeri, approvazioni e risultati cambiano continuamente.</p>
              <p>
                Il problema non è avere più dati.
                <br />
                È riuscire a capire{" "}
                <span className="font-medium text-[var(--ink)]">
                  cosa conta adesso
                </span>
                .
              </p>
            </div>
            <p className="mt-8 text-sm font-medium text-[var(--ink)]">
              Tutto il lavoro resta collegato alla campagna e al cliente.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-1">
            {BLOCCHI.map((blocco, i) => (
              <article
                key={blocco.titolo}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-hover)]/60 p-5 sm:col-span-1"
              >
                <p className="text-xs font-medium text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-base font-medium text-[var(--ink)]">
                  {blocco.titolo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {blocco.testo}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
