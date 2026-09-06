/**
 * M9.3A — map accepted brief → wizard route + hydrate helpers.
 */

import { rottaWizardDaObjective } from "@/data/percorsi-nuova-campagna";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import {
  normalizzaTargetAgeBand,
  type CampagnaObjective,
  type TargetAgeBand,
  type TargetType,
} from "@/types/campagne";
import type { AllyBriefAcceptedPayload } from "@/lib/ally-brief/types";

/** Canonical wizard bands used for brief → UI mapping (no new age model). */
const CANONICAL_AGE_BANDS: Array<{
  band: TargetAgeBand;
  min: number;
  max: number;
}> = [
  { band: "18-35", min: 18, max: 35 },
  { band: "25-50", min: 25, max: 50 },
  { band: "35-65+", min: 35, max: 65 },
];

/**
 * Map explicit age min/max from the brief onto an existing TargetAgeBand.
 * Exact matches win; otherwise closest canonical endpoints.
 * Returns null when age is absent (wizard default unchanged).
 */
export function targetAgeBandFromEtaRange(
  etaMin: number | null | undefined,
  etaMax: number | null | undefined,
): TargetAgeBand | null {
  if (
    typeof etaMin !== "number" ||
    typeof etaMax !== "number" ||
    !Number.isFinite(etaMin) ||
    !Number.isFinite(etaMax) ||
    etaMin > etaMax
  ) {
    return null;
  }
  for (const b of CANONICAL_AGE_BANDS) {
    if (etaMin === b.min && etaMax === b.max) return b.band;
  }
  let best: TargetAgeBand | null = null;
  let bestDist = Infinity;
  for (const b of CANONICAL_AGE_BANDS) {
    const d = Math.abs(etaMin - b.min) + Math.abs(etaMax - b.max);
    if (d < bestDist) {
      bestDist = d;
      best = b.band;
    }
  }
  return best;
}

function resolveHydratedTargetAge(
  rawTargetAge: unknown,
  etaMin: number | null,
  etaMax: number | null,
): TargetAgeBand | null {
  if (typeof rawTargetAge === "string") {
    const normalized = normalizzaTargetAgeBand(rawTargetAge);
    if (normalized) return normalized;
  }
  return targetAgeBandFromEtaRange(etaMin, etaMax);
}

export function hrefWizardFromAcceptedBrief(
  payload: AllyBriefAcceptedPayload,
): string {
  const base = rottaWizardDaObjective(payload.objective);
  const params = new URLSearchParams({ fromBrief: "1" });
  if (payload.matchedClienteId) {
    params.set("clienteId", payload.matchedClienteId);
  }
  const nome = payload.values.nomeCliente;
  if (typeof nome === "string" && nome.trim()) {
    params.set("nomeCliente", nome.trim());
  }
  const settore = payload.values.settore;
  if (typeof settore === "string" && settore.trim()) {
    params.set("settore", settore.trim());
  }
  const citta = payload.values.citta;
  if (typeof citta === "string" && citta.trim()) {
    params.set("citta", citta.trim());
  }
  return `${base}?${params.toString()}`;
}

/** Seed onboarding draft before navigating into wizard (no campaign DB write). */
export function seedBozzaFromAcceptedBrief(
  payload: AllyBriefAcceptedPayload,
): void {
  const nome =
    typeof payload.values.nomeCliente === "string"
      ? payload.values.nomeCliente.trim()
      : "";
  const hydrated = hydrationFromAcceptedBrief(payload);
  // Always rewrite bozza so a previous Aurora (or other) clientId cannot linger.
  // Without an explicit client name / matched id, leave client fields empty.
  salvaBozzaOnboarding({
    clienteId: payload.matchedClienteId ?? "",
    nomeCliente: nome,
    nomeCampagna: nome ? `Campagna ${nome}` : "",
    settore:
      typeof payload.values.settore === "string"
        ? payload.values.settore
        : "",
    citta:
      typeof payload.values.citta === "string" ? payload.values.citta : "",
    sitoWeb:
      typeof payload.values.sitoWeb === "string"
        ? payload.values.sitoWeb
        : undefined,
    note:
      typeof payload.values.elevatorPitch === "string"
        ? payload.values.elevatorPitch
        : payload.brief,
    targetType:
      payload.values.targetType === "B2B" || payload.values.targetType === "B2C"
        ? (payload.values.targetType as TargetType)
        : undefined,
    // Prefer band derived from explicit etaMin/etaMax when targetAge omitted.
    targetAge: hydrated.targetAge ?? undefined,
  });
}

export type AllyBriefWizardHydration = {
  nomeCliente: string | null;
  settore: string | null;
  citta: string | null;
  sitoWeb: string | null;
  elevatorPitch: string | null;
  frontEndOffer: string | null;
  budgetGiornaliero: number | null;
  raggioKm: number | null;
  etaMin: number | null;
  etaMax: number | null;
  targetType: TargetType | null;
  targetAge: TargetAgeBand | null;
  scontrinoMedio: number | null;
  tassoConversione: number | null;
  productMargin: number | null;
  targetMargin: number | null;
  marketingAngle: string | null;
  objective: CampagnaObjective;
};

export function hydrationFromAcceptedBrief(
  payload: AllyBriefAcceptedPayload,
): AllyBriefWizardHydration {
  const v = payload.values;
  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null;
  const str = (x: unknown): string | null =>
    typeof x === "string" && x.trim() ? x.trim() : null;

  const etaMin = num(v.etaMin);
  const etaMax = num(v.etaMax);

  return {
    nomeCliente: str(v.nomeCliente),
    settore: str(v.settore),
    citta: str(v.citta),
    sitoWeb: str(v.sitoWeb),
    elevatorPitch: str(v.elevatorPitch) ?? payload.brief.slice(0, 2000),
    frontEndOffer: str(v.frontEndOffer),
    budgetGiornaliero: num(v.budgetGiornaliero),
    raggioKm: num(v.raggioKm),
    etaMin,
    etaMax,
    targetType:
      v.targetType === "B2B" || v.targetType === "B2C" ? v.targetType : null,
    targetAge: resolveHydratedTargetAge(v.targetAge, etaMin, etaMax),
    scontrinoMedio: num(v.scontrinoMedio),
    tassoConversione: num(v.tassoConversione),
    productMargin: num(v.productMargin),
    targetMargin: num(v.targetMargin),
    marketingAngle: str(v.marketingAngle),
    objective: payload.objective,
  };
}
