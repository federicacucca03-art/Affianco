/**
 * M9.3A — map accepted brief → wizard route + hydrate helpers.
 */

import { rottaWizardDaObjective } from "@/data/percorsi-nuova-campagna";
import { salvaBozzaOnboarding } from "@/data/clienti-store";
import type { CampagnaObjective, TargetAgeBand, TargetType } from "@/types/campagne";
import type { AllyBriefAcceptedPayload } from "@/lib/ally-brief/types";

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
  if (!nome) return;
  salvaBozzaOnboarding({
    clienteId: payload.matchedClienteId ?? "",
    nomeCliente: nome,
    nomeCampagna: `Campagna ${nome}`,
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
    targetAge:
      typeof payload.values.targetAge === "string"
        ? (payload.values.targetAge as TargetAgeBand)
        : undefined,
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

  return {
    nomeCliente: str(v.nomeCliente),
    settore: str(v.settore),
    citta: str(v.citta),
    sitoWeb: str(v.sitoWeb),
    elevatorPitch: str(v.elevatorPitch) ?? payload.brief.slice(0, 2000),
    frontEndOffer: str(v.frontEndOffer),
    budgetGiornaliero: num(v.budgetGiornaliero),
    raggioKm: num(v.raggioKm),
    etaMin: num(v.etaMin),
    etaMax: num(v.etaMax),
    targetType:
      v.targetType === "B2B" || v.targetType === "B2C" ? v.targetType : null,
    targetAge:
      typeof v.targetAge === "string"
        ? (v.targetAge as TargetAgeBand)
        : null,
    scontrinoMedio: num(v.scontrinoMedio),
    tassoConversione: num(v.tassoConversione),
    productMargin: num(v.productMargin),
    targetMargin: num(v.targetMargin),
    marketingAngle: str(v.marketingAngle),
    objective: payload.objective,
  };
}
