import "server-only";
import { fingerprintPayload } from "@/lib/meta/write/fingerprint";

export type MetaRowFingerprintInput = {
  name: string | null;
  raw_objective: string | null;
  status: string | null;
  effective_status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  primary_kpi: string | null;
  target_value: number | null;
};

export type AllyRowFingerprintInput = {
  name: string | null;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  page_id: string | null;
  form_id: string | null;
  citta: string | null;
  raggio_km: number | null;
  eta_min: number | null;
  eta_max: number | null;
  target_margin: number | null;
  max_sustainable_cpa: number | null;
};

export function fingerprintMetaCampaignRow(
  row: MetaRowFingerprintInput,
): string {
  return fingerprintPayload({
    v: 1,
    side: "meta",
    name: (row.name ?? "").trim(),
    rawObjective: row.raw_objective,
    status: row.status,
    effectiveStatus: row.effective_status,
    dailyBudget: row.daily_budget,
    lifetimeBudget: row.lifetime_budget,
    primaryKpi: row.primary_kpi,
    targetValue: row.target_value,
  });
}

export function fingerprintAllyCampaignRow(
  row: AllyRowFingerprintInput,
): string {
  return fingerprintPayload({
    v: 1,
    side: "ally",
    name: (row.name ?? "").trim(),
    objective: row.objective,
    status: row.status,
    dailyBudget: row.daily_budget,
    pageId: row.page_id,
    formId: row.form_id,
    citta: row.citta,
    raggioKm: row.raggio_km,
    etaMin: row.eta_min,
    etaMax: row.eta_max,
    targetMargin: row.target_margin,
    maxSustainableCpa: row.max_sustainable_cpa,
  });
}
