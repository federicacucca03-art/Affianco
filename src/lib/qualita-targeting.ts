/**
 * Targeting contestuale Step 1–2 (deterministico, non persistito).
 * Nessuna audience size, saturazione, CPM o benchmark città.
 */

import { stripAccents } from "@/lib/validate-elevator-pitch";
import type { CampagnaObjective, TargetType } from "@/types/campagne";

export const RAGGIO_MOLTO_STRETTO_KM = 3;
export const BUDGET_DISPERSIVO_MAX_EURO = 15;
export const RAGGIO_DISPERSIVO_MIN_KM = 50;

const OBJECTIVE_LOCALI: ReadonlySet<CampagnaObjective> = new Set([
  "LEADS",
  "BOOKINGS",
  "IN_STORE",
  "AWARENESS",
]);

export function isObjectiveLocale(
  objective?: CampagnaObjective | null,
): boolean {
  return objective != null && OBJECTIVE_LOCALI.has(objective);
}

export const ANCORE_B2B = [
  "aziende",
  "imprese",
  "responsabili",
  "ufficio acquisti",
  "procurement",
  "r&d",
  "produzione",
  "horeca",
  "hotel",
  "buyer",
  "direttori",
  "manager",
] as const;

export const ANCORE_B2C = [
  "famiglie",
  "genitori",
  "bambini",
  "adulti",
  "pazienti",
  "privati",
  "consumatori",
  "persone",
] as const;

function normalizzaTargeting(raw: string): string {
  return stripAccents(raw.toLowerCase().trim()).replace(/['’]/g, " ");
}

function ancoraNelTesto(testoNorm: string, ancora: string): boolean {
  const parti = ancora.split(/\s+/).filter(Boolean).map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  if (parti.length === 0) return false;
  const corpo = parti.join("\\s+");
  const pattern =
    ancora === "r&d"
      ? String.raw`\br\s*&\s*d\b`
      : String.raw`\b${corpo}\b`;
  return new RegExp(pattern).test(testoNorm);
}

export function contaAncoreB2B(brief: string): number {
  const n = normalizzaTargeting(brief);
  return ANCORE_B2B.filter((a) => ancoraNelTesto(n, a)).length;
}

export function contaAncoreB2C(brief: string): number {
  const n = normalizzaTargeting(brief);
  return ANCORE_B2C.filter((a) => ancoraNelTesto(n, a)).length;
}

export function cittaLocaleMancante(
  objective: CampagnaObjective | null | undefined,
  citta: string | null | undefined,
): boolean {
  if (!isObjectiveLocale(objective)) return false;
  return !(citta ?? "").trim();
}

export function raggioMoltoStretto(
  objective: CampagnaObjective | null | undefined,
  raggioKm: number | null | undefined,
): boolean {
  if (!isObjectiveLocale(objective)) return false;
  const r = Number(raggioKm);
  return Number.isFinite(r) && r > 0 && r <= RAGGIO_MOLTO_STRETTO_KM;
}

export function budgetRaggioDispersivo(
  objective: CampagnaObjective | null | undefined,
  budgetGiornaliero: number | null | undefined,
  raggioKm: number | null | undefined,
): boolean {
  if (!isObjectiveLocale(objective)) return false;
  const budget = Number(budgetGiornaliero);
  const raggio = Number(raggioKm);
  if (!Number.isFinite(budget) || !Number.isFinite(raggio)) return false;
  return (
    budget > 0 &&
    budget <= BUDGET_DISPERSIVO_MAX_EURO &&
    raggio >= RAGGIO_DISPERSIVO_MIN_KM
  );
}

export type MismatchTargetType = "B2B" | "B2C";

/**
 * Mismatch solo con segnale forte: ≥2 ancore del tipo opposto e 0 del tipo scelto.
 * Non usa "professionisti" / "professionale".
 */
export function rilevaMismatchTargetType(
  targetType: TargetType | null | undefined,
  brief: string | null | undefined,
): MismatchTargetType | null {
  if (targetType !== "B2C" && targetType !== "B2B") return null;
  const testo = (brief ?? "").trim();
  if (!testo) return null;
  const nB2b = contaAncoreB2B(testo);
  const nB2c = contaAncoreB2C(testo);
  if (targetType === "B2C" && nB2b >= 2 && nB2c === 0) return "B2B";
  if (targetType === "B2B" && nB2c >= 2 && nB2b === 0) return "B2C";
  return null;
}

export function stepRaggioStretto(
  objective: CampagnaObjective | null | undefined,
): 1 | 2 {
  if (objective === "IN_STORE" || objective === "AWARENESS") return 1;
  return 2;
}
