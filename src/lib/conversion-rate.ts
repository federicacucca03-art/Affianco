export type ConversionRateSource = "REAL" | "ESTIMATED" | "UNKNOWN";

const FONTI: ReadonlySet<string> = new Set(["REAL", "ESTIMATED", "UNKNOWN"]);

export function normalizzaConversionRateSource(
  raw: unknown,
): ConversionRateSource | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim().toUpperCase();
  if (FONTI.has(s)) return s as ConversionRateSource;
  return undefined;
}

export function tassoConversioneLeadsValido(
  source: ConversionRateSource,
  tassoConversione: number | string,
): number | null {
  if (source === "UNKNOWN") return null;
  const n = Number(tassoConversione);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function etichettaConversionRateSource(
  source: ConversionRateSource,
): string {
  switch (source) {
    case "REAL":
      return "Dato reale";
    case "ESTIMATED":
      return "Stima";
    case "UNKNOWN":
      return "Non lo so";
  }
}
