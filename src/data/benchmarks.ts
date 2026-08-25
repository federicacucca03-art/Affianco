import { getBenchmarkForNiche } from "@/lib/benchmarks";

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

export function normalizzaSettore(
  settore: string | null | undefined,
): ChiaveSettore {
  const grezzo = (settore ?? "").toLowerCase().trim();
  if (grezzo.includes("palestra")) return "palestra";
  if (grezzo.includes("estet")) return "estetista";
  if (grezzo.includes("ristor")) return "ristorante";
  if (
    grezzo.includes("artigian") ||
    grezzo.includes("locale") ||
    grezzo.includes("agenzia") ||
    grezzo.includes("broker") ||
    grezzo.includes("servizi") ||
    grezzo.includes("avvocat")
  ) {
    return "artigiano";
  }
  if (grezzo.includes("dentist") || grezzo.includes("dent")) return "dentista";
  return "dentista";
}

/** Budget giornaliero = recommendedDailyBudgetMin del motore nicchia. */
export function budgetGiornalieroDaSettore(
  settore: string | null | undefined,
  citta = "",
) {
  return getBenchmarkForNiche(settore ?? "", citta).recommendedDailyBudgetMin;
}

/**
 * Budget mensile = budget giornaliero × 30.
 * Contatti e costo restano i riferimenti del settore.
 */
export function stimaBenchmark(
  budgetGiornaliero: number,
  settore?: string | null,
) {
  const chiave = normalizzaSettore(settore);
  const base = BENCHMARK_SETTORI[chiave];

  return {
    chiave,
    budgetMensile: Math.round(budgetGiornaliero * 30),
    contattiMin: base.contattiMin,
    contattiMax: base.contattiMax,
    costoMin: base.costoMin,
    costoMax: base.costoMax,
    etichettaCategoria: base.etichetta,
    budgetRiferimento: base.budgetMensileRiferimento,
  };
}
