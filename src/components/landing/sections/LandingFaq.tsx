"use client";

import { useState } from "react";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const FAQ = [
  {
    q: "Ally sostituisce Meta Ads Manager?",
    a: "No. Ally organizza il lavoro operativo prima, durante e dopo la campagna. Meta Ads Manager resta lo strumento di pubblicazione e gestione delle inserzioni.",
  },
  {
    q: "Il cliente deve creare un account?",
    a: "No. Condividi un link di approvazione: il cliente vede copy, creatività e soglie economiche senza login.",
  },
  {
    q: "Cosa significa “CPL target”?",
    a: "È una soglia economica di riferimento calcolata da valore medio, margine e tasso di chiusura. Non è una previsione certa, ma un criterio per capire se la campagna ha senso per il business del cliente.",
  },
  {
    q: "Posso riusare profili e storico clienti?",
    a: "Sì. Ally conserva nome, settore, brief e campagne passate, così non riparti da zero ad ogni progetto.",
  },
  {
    q: "Come funziona la diagnosi post-lancio?",
    a: "Carichi uno screenshot o i dati da Ads Manager: Ally confronta CPL reale e soglia definita, e ti indica cosa richiede attenzione e cosa fare.",
  },
];

export function LandingFaq() {
  const [aperta, setAperta] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-[var(--border)] bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <LandingSectionHeader
          eyebrow="FAQ"
          titolo="Domande frequenti"
          allineamento="centro"
        />

        <div className="mt-10 divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]">
          {FAQ.map((item, i) => {
            const isAperta = aperta === i;
            return (
              <div key={item.q} className="px-4 sm:px-5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-[var(--ink)]"
                  onClick={() => setAperta(isAperta ? null : i)}
                  aria-expanded={isAperta}
                >
                  {item.q}
                  <span className="shrink-0 text-[var(--ink-muted)]">
                    {isAperta ? "−" : "+"}
                  </span>
                </button>
                {isAperta ? (
                  <p className="pb-4 text-sm leading-relaxed text-[var(--ink-muted)]">
                    {item.a}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
