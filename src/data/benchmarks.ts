import { getBenchmarkForNiche } from "@/lib/benchmarks";
import { matchCanonicalSettore } from "@/lib/settore-canonico";
import { SETTORE_ALTRO_LABEL } from "@/data/settoriPresets";

export type ChiaveSettore =
  | "dentista"
  | "palestra"
  | "estetista"
  | "ristorante"
  | "artigiano";

export type BenchmarkSettore = {
  budgetMensileRiferimento: number;
  contattiMin: number;
  contattiMax: number;
  costoMin: number;
  costoMax: number;
  etichetta: string;
};

/** Benchmark di riferimento per settore (a budget mensile tipico). */
export const BENCHMARK_SETTORI: Record<ChiaveSettore, BenchmarkSettore> = {
  dentista: {
    budgetMensileRiferimento: 600,
    contattiMin: 8,
    contattiMax: 15,
    costoMin: 40,
    costoMax: 75,
    etichetta: "dentisti",
  },
  palestra: {
    budgetMensileRiferimento: 450,
    contattiMin: 15,
    contattiMax: 30,
    costoMin: 15,
    costoMax: 30,
    etichetta: "palestre",
  },
  estetista: {
    budgetMensileRiferimento: 300,
    contattiMin: 10,
    contattiMax: 20,
    costoMin: 15,
    costoMax: 25,
    etichetta: "estetiste",
  },
  ristorante: {
    budgetMensileRiferimento: 600,
    contattiMin: 20,
    contattiMax: 40,
    costoMin: 15,
    costoMax: 30,
    etichetta: "ristoranti",
  },
  artigiano: {
    budgetMensileRiferimento: 400,
    contattiMin: 8,
    contattiMax: 12,
    costoMin: 35,
    costoMax: 50,
    etichetta: "attività locali, agenzie e servizi",
  },
};

/**
 * Map a sector string to the legacy monthly-contacts bucket.
 * OLD: unknown → "dentista" (UNSAFE).
 * NEW: unknown / Altro / unmapped → null (no dental inheritance).
 */
export function normalizzaSettore(
  settore: string | null | undefined,
): ChiaveSettore | null {
  const grezzo = (settore ?? "").trim();
  if (!grezzo) return null;

  const match = matchCanonicalSettore(grezzo);
  if (!match.matched || match.label === SETTORE_ALTRO_LABEL || match.id === "altro") {
    return null;
  }

  const id = match.id;
  if (id === "dentista" || id === "implantologia" || id === "ortodontista") {
    return "dentista";
  }
  if (id === "palestra" || id === "personal-trainer" || id === "yoga") {
    return "palestra";
  }
  if (id === "estetista" || id === "parrucchiere" || id === "dermatologia") {
    return "estetista";
  }
  if (
    id === "ristorante" ||
    id === "pizzeria" ||
    id === "bar-caffe" ||
    id === "catering"
  ) {
    return "ristorante";
  }
  if (
    id === "idraulico" ||
    id === "elettricista" ||
    id === "serramenti" ||
    id === "ristrutturazioni" ||
    id === "pulizie" ||
    id === "avvocato" ||
    id === "commercialista" ||
    id === "consulenza-b2b"
  ) {
    return "artigiano";
  }

  // Known canonical niches without a legacy monthly bucket → unavailable
  return null;
}

/** Budget giornaliero = recommendedDailyBudgetMin del motore nicchia (0 se unavailable). */
export function budgetGiornalieroDaSettore(
  settore: string | null | undefined,
  citta = "",
) {
  return getBenchmarkForNiche(settore ?? "", citta).recommendedDailyBudgetMin;
}

export type StimaBenchmarkResult = {
  chiave: ChiaveSettore | null;
  available: boolean;
  budgetMensile: number;
  contattiMin: number;
  contattiMax: number;
  costoMin: number;
  costoMax: number;
  etichettaCategoria: string;
  budgetRiferimento: number;
};

/**
 * Budget mensile = budget giornaliero × 30.
 * Contatti e costo: solo se esiste un bucket legacy sicuro; altrimenti unavailable.
 */
export function stimaBenchmark(
  budgetGiornaliero: number,
  settore?: string | null,
): StimaBenchmarkResult {
  const chiave = normalizzaSettore(settore);
  if (!chiave) {
    return {
      chiave: null,
      available: false,
      budgetMensile: Math.round(budgetGiornaliero * 30),
      contattiMin: 0,
      contattiMax: 0,
      costoMin: 0,
      costoMax: 0,
      etichettaCategoria: SETTORE_ALTRO_LABEL,
      budgetRiferimento: 0,
    };
  }
  const base = BENCHMARK_SETTORI[chiave];
  return {
    chiave,
    available: true,
    budgetMensile: Math.round(budgetGiornaliero * 30),
    contattiMin: base.contattiMin,
    contattiMax: base.contattiMax,
    costoMin: base.costoMin,
    costoMax: base.costoMax,
    etichettaCategoria: base.etichetta,
    budgetRiferimento: base.budgetMensileRiferimento,
  };
}
