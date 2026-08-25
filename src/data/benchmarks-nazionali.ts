/** Range storici di costo per mercato Meta Italia (guida trasparente). */
export type BenchmarkNazionale = {
  id: string;
  settore: string;
  obiettivo: string;
  metrica: string;
  rangeMin: number;
  rangeMax: number;
  unita: string;
  nota: string;
};

export const BENCHMARK_NAZIONALI: BenchmarkNazionale[] = [
  {
    id: "odontoiatria",
    settore: "Odontoiatria",
    obiettivo: "Lead Generation",
    metrica: "CPL",
    rangeMin: 40,
    rangeMax: 85,
    unita: "€",
    nota: "Implantologia e ortodonzia spesso oltre 60€; check-up più bassi.",
  },
  {
    id: "skincare",
    settore: "Skincare E-commerce",
    obiettivo: "Vendite online",
    metrica: "CPA / ROAS",
    rangeMin: 12,
    rangeMax: 28,
    unita: "€ CPA",
    nota: "ROAS break-even tipico 2,5–3,5x con margine 50–60%.",
  },
  {
    id: "ristorazione",
    settore: "Ristorazione",
    obiettivo: "Prenotazioni / Traffico",
    metrica: "CPA",
    rangeMin: 8,
    rangeMax: 22,
    unita: "€",
    nota: "Weekend e delivery spingono il CPA; raggio locale stretto.",
  },
  {
    id: "artigiani",
    settore: "Artigiani / Servizi locali",
    obiettivo: "Lead Generation",
    metrica: "CPL",
    rangeMin: 25,
    rangeMax: 55,
    unita: "€",
    nota: "Edilizia, infissi e ristrutturazioni verso l'alto del range.",
  },
  {
    id: "b2b",
    settore: "Servizi B2B",
    obiettivo: "Lead qualificati",
    metrica: "CPL",
    rangeMin: 35,
    rangeMax: 120,
    unita: "€",
    nota: "Consulenza e SaaS: volume basso, ticket alto, CPL più elevato.",
  },
];
