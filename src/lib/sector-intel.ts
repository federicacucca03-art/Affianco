import {
  SETTORI_POPOLARI,
  SETTORI_PRESETS,
  type MacroCategoria,
  type SettorePreset,
} from "@/data/settoriPresets";
import type { NicheBenchmark } from "@/lib/benchmarks";

export type SettoreIntel = SettorePreset & {
  source: "preset" | "ai";
};

export function normalizzaChiaveSettore(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function punteggioMatch(query: string, preset: SettorePreset): number {
  const q = normalizzaChiaveSettore(query);
  if (!q) return 0;
  const alias = preset.aliases.map(normalizzaChiaveSettore).filter(Boolean);
  const nome = normalizzaChiaveSettore(preset.nome);
  const id = normalizzaChiaveSettore(preset.id);

  if (q === nome || q === id) return 100;
  if (alias.includes(q)) return 95;
  if (nome.startsWith(q) || id.startsWith(q)) return 80;
  if (alias.some((a) => a.startsWith(q))) return 75;
  if (nome.includes(q) || id.includes(q)) return 60;
  if (alias.some((a) => a.includes(q))) return 55;

  const tokens = q.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return 0;
  const corpus = `${nome} ${id} ${alias.join(" ")}`;
  const hits = tokens.filter((t) => corpus.includes(t)).length;
  if (hits === 0) return 0;
  return Math.min(50, 20 + hits * 12);
}

/** Match locale forte (selezione o digitazione completa). */
export function risolviSettoreIntel(query: string): SettoreIntel | null {
  const q = normalizzaChiaveSettore(query);
  if (!q || q.length < 3) return null;

  let best: { preset: SettorePreset; score: number } | null = null;
  for (const preset of SETTORI_PRESETS) {
    const score = punteggioMatch(query, preset);
    if (!best || score > best.score) best = { preset, score };
  }
  if (!best || best.score < 55) return null;
  return { ...best.preset, source: "preset" };
}

export type SuggerimentoSettore = {
  id: string;
  nome: string;
  macroCategoria: MacroCategoria;
  score: number;
};

export function suggerisciSettori(
  query: string,
  limite = 8,
): SuggerimentoSettore[] {
  const q = normalizzaChiaveSettore(query);
  const base = SETTORI_PRESETS.filter((p) => !p.id.startsWith("macro-"));

  if (!q) {
    const popolari = SETTORI_POPOLARI.map((id) =>
      SETTORI_PRESETS.find((p) => p.id === id),
    ).filter((p): p is SettorePreset => Boolean(p));
    return popolari.slice(0, limite).map((p) => ({
      id: p.id,
      nome: p.nome,
      macroCategoria: p.macroCategoria,
      score: 100,
    }));
  }

  return base
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      macroCategoria: p.macroCategoria,
      score: punteggioMatch(query, p),
    }))
    .filter((s) => s.score > 20)
    .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome, "it"))
    .slice(0, limite);
}

export function presetDaChiave(id: string): SettoreIntel | null {
  const trovato = SETTORI_PRESETS.find((p) => p.id === id);
  return trovato ? { ...trovato, source: "preset" } : null;
}

const CATEGORIA_BENCHMARK: Record<
  MacroCategoria,
  NicheBenchmark["category"]
> = {
  "Salute/Dentale": "Salute & Cura",
  "E-commerce Beauty/Fashion": "Beauty & Wellness",
  Ristorazione: "Ristorazione & Eventi",
  "Servizi Locali/Artigiani": "Casa & Servizi",
  "Fitness/Palestre": "Fitness & Sport",
  "B2B/Professionisti": "Servizi Professionali",
  "Real Estate": "Servizi Professionali",
  Formazione: "Altro",
  Automotive: "Automotive",
  "Eventi/Turismo": "Ristorazione & Eventi",
};

export function overlayBenchmarkDaIntel(
  base: NicheBenchmark,
  intel: SettoreIntel,
): NicheBenchmark {
  const ticket: NicheBenchmark["ticketLevel"] =
    intel.aovDefault >= 800 ? "high" : intel.aovDefault >= 80 ? "medium" : "low";
  const cplMid = Math.round(
    (intel.benchmarkCPL.min + intel.benchmarkCPL.max) / 2,
  );
  return {
    ...base,
    key: intel.id,
    label: intel.nome,
    category: CATEGORIA_BENCHMARK[intel.macroCategoria],
    ticketLevel: ticket,
    cplMin: intel.benchmarkCPL.min,
    cplOptimal: cplMid,
    cplMax: intel.benchmarkCPL.max,
    recommendedRadiusKm: intel.raggioKmConsigliato,
    recommendedDailyBudgetMin: intel.budgetGiornalieroMin,
    recommendedDailyBudgetOptimal: Math.round(intel.budgetGiornalieroMin * 1.6),
    explanationText: `${intel.macroCategoria} · scontrino tipico ${intel.aovDefault}€, margine ${intel.margineDefault}%. CPL di mercato ${intel.benchmarkCPL.min}–${intel.benchmarkCPL.max}€.`,
  };
}

export function riferimentoAstaMeta(
  intel: SettoreIntel | null | undefined,
  usaCpa: boolean,
): { min: number; max: number; etichetta: string } | null {
  if (!intel) return null;
  const r = usaCpa ? intel.benchmarkCPA : intel.benchmarkCPL;
  if (!r || r.min <= 0 || r.max <= 0) return null;
  return { min: r.min, max: r.max, etichetta: intel.nome };
}

export function isSettoreIntelPayload(value: unknown): value is SettoreIntel {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SettoreIntel>;
  return (
    typeof v.aovDefault === "number" &&
    typeof v.margineDefault === "number" &&
    Array.isArray(v.ganciConsigliati) &&
    v.ganciConsigliati.length >= 1 &&
    typeof v.benchmarkCPL === "object" &&
    v.benchmarkCPL != null &&
    typeof v.formatoVisualConsigliato === "string"
  );
}
