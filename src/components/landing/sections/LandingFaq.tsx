"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const FAQ = [
  {
    q: "Ally sostituisce Meta Ads Manager?",
    a: "No. Meta Ads Manager resta lo strumento per pubblicazione e gestione operativa delle inserzioni. Qui organizzi strategia, preparazione, approvazioni, monitoraggio e decisioni attorno alle campagne.",
  },
  {
    q: "Ally può collegarsi a Meta?",
    a: "Sì: puoi collegare e importare campagne e leggere i dati disponibili per il monitoraggio. Non vengono modificate automaticamente campagne, budget o stato delle inserzioni.",
  },
  {
    q: "Devo conoscere già il CPL target?",
    a: "No. Puoi completare la pianificazione anche quando alcuni dati economici non sono ancora disponibili. Quei dati servono soprattutto a confrontare i risultati con la sostenibilità economica.",
  },
  {
    q: "Il cliente deve avere un account Ally?",
    a: "No. Puoi condividere un link di approvazione dedicato.",
  },
  {
    q: "Ally usa l'AI?",
    a: "Sì, dove serve per interpretare brief, creatività e contesto. Stati, controlli e soglie operative non vengono affidati ciecamente all'AI.",
  },
];

export function LandingFaq() {
  const [aperto, setAperto] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <LandingSectionHeader allineamento="centro" titolo="Domande frequenti" />

      <ul className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {FAQ.map((item, i) => {
          const isOpen = aperto === i;
          return (
            <li key={item.q}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
                aria-expanded={isOpen}
                onClick={() => setAperto(isOpen ? null : i)}
              >
                <span className="text-sm font-medium text-[var(--ink)] sm:text-base">
                  {item.q}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen ? (
                <p className="pb-4 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {item.a}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
