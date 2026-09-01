import { supabase } from "@/lib/supabase";
import type { CampagnaObjective } from "@/types/campagne";
import {
  type HealthStatus,
  type RecommendedAction,
} from "@/lib/control-room";

export type CampaignCheckSource = "MANUAL" | "SCREENSHOT" | "CSV";
export type CampaignCheckThresholdMode =
  | "BREAK_EVEN"
  | "EFFICIENCY"
  | "OTHER";

export type CampaignCheck = {
  id: string;
  campaignId: string;
  userId: string;
  createdAt: string;
  daysActive: number | null;
  spend: number | null;
  resultsCount: number | null;
  primaryCost: number | null;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  frequency: number | null;
  roas: number | null;
  healthStatus: HealthStatus;
  signal: string | null;
  actions: RecommendedAction[];
  note: string | null;
  objective: string | null;
  threshold: number | null;
  thresholdMode: CampaignCheckThresholdMode | null;
  source: CampaignCheckSource;
};

export type NuovoCampaignCheck = {
  campaignId: string;
  daysActive: number | null;
  spend: number | null;
  resultsCount: number | null;
  primaryCost: number | null;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  frequency: number | null;
  roas: number | null;
  healthStatus: HealthStatus;
  signal: string | null;
  actions: RecommendedAction[];
  note: string | null;
  objective: CampagnaObjective | string | null;
  threshold: number | null;
  thresholdMode: CampaignCheckThresholdMode | null;
  source: CampaignCheckSource;
};

type CampaignCheckRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  days_active: number | string | null;
  spend: number | string | null;
  results_count: number | string | null;
  primary_cost: number | string | null;
  ctr: number | string | null;
  cpm: number | string | null;
  cpc: number | string | null;
  frequency: number | string | null;
  roas: number | string | null;
  health_status: string;
  signal: string | null;
  actions: unknown;
  note: string | null;
  objective: string | null;
  threshold: number | string | null;
  threshold_mode: string | null;
  source: string;
};

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isHealth(v: string): v is HealthStatus {
  return (
    v === "GREEN" || v === "YELLOW" || v === "RED" || v === "INSUFFICIENT"
  );
}

function isSource(v: string): v is CampaignCheckSource {
  return v === "MANUAL" || v === "SCREENSHOT" || v === "CSV";
}

function isThresholdMode(v: string): v is CampaignCheckThresholdMode {
  return v === "BREAK_EVEN" || v === "EFFICIENCY" || v === "OTHER";
}

function mappaAzioni(raw: unknown): RecommendedAction[] {
  if (!Array.isArray(raw)) return [];
  const out: RecommendedAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { text?: unknown; priority?: unknown };
    if (typeof rec.text !== "string" || !rec.text.trim()) continue;
    const p = rec.priority;
    const priority =
      p === "alta" || p === "media" || p === "bassa" ? p : "media";
    out.push({ text: rec.text.trim(), priority });
    if (out.length >= 3) break;
  }
  return out;
}

function mappaDaRow(row: CampaignCheckRow): CampaignCheck | null {
  if (!isHealth(row.health_status) || !isSource(row.source)) return null;
  const mode = row.threshold_mode;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    createdAt: row.created_at,
    daysActive: num(row.days_active),
    spend: num(row.spend),
    resultsCount: num(row.results_count),
    primaryCost: num(row.primary_cost),
    ctr: num(row.ctr),
    cpm: num(row.cpm),
    cpc: num(row.cpc),
    frequency: num(row.frequency),
    roas: num(row.roas),
    healthStatus: row.health_status,
    signal: row.signal,
    actions: mappaAzioni(row.actions),
    note: row.note,
    objective: row.objective,
    threshold: num(row.threshold),
    thresholdMode:
      mode && isThresholdMode(mode) ? mode : null,
    source: row.source,
  };
}

async function requireAuthUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const uid = data.user?.id;
  if (!uid) {
    throw new Error("Devi accedere per salvare o leggere i controlli.");
  }
  return uid;
}

export function stessaGiornataLocale(
  iso: string,
  now: Date = new Date(),
): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export async function leggiChecksCampagna(
  campaignId: string,
  limite = 8,
): Promise<CampaignCheck[]> {
  await requireAuthUserId();
  const { data, error } = await supabase
    .from("campaign_checks")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return ((data ?? []) as CampaignCheckRow[])
    .map(mappaDaRow)
    .filter((c): c is CampaignCheck => Boolean(c));
}

export async function leggiUltimoCheckCampagna(
  campaignId: string,
): Promise<CampaignCheck | null> {
  const lista = await leggiChecksCampagna(campaignId, 1);
  return lista[0] ?? null;
}

/** Ultimo check per campagna, per l'utente autenticato. */
export async function leggiUltimiChecksUtente(): Promise<
  Map<string, CampaignCheck>
> {
  const uid = await requireAuthUserId();
  const { data, error } = await supabase
    .from("campaign_checks")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const mappa = new Map<string, CampaignCheck>();
  for (const row of (data ?? []) as CampaignCheckRow[]) {
    const mapped = mappaDaRow(row);
    if (!mapped) continue;
    if (!mappa.has(mapped.campaignId)) {
      mappa.set(mapped.campaignId, mapped);
    }
  }
  return mappa;
}

/** Check dell'utente da `isoFrom` in poi (una query, nessun N+1). */
export async function leggiChecksUtenteDal(
  isoFrom: string,
): Promise<CampaignCheck[]> {
  const uid = await requireAuthUserId();
  const { data, error } = await supabase
    .from("campaign_checks")
    .select("*")
    .eq("user_id", uid)
    .gte("created_at", isoFrom)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as CampaignCheckRow[])
    .map(mappaDaRow)
    .filter((c): c is CampaignCheck => Boolean(c));
}

export async function inserisciCampaignCheck(
  input: NuovoCampaignCheck,
): Promise<CampaignCheck> {
  const uid = await requireAuthUserId();

  const { data: campagna, error: errCampagna } = await supabase
    .from("campaigns")
    .select("id, user_id")
    .eq("id", input.campaignId)
    .eq("user_id", uid)
    .maybeSingle();

  if (errCampagna) throw new Error(errCampagna.message);
  if (!campagna) {
    throw new Error("Campagna non trovata o non appartenente al tuo account.");
  }

  const ultimi = await leggiChecksCampagna(input.campaignId, 1);
  const ultimo = ultimi[0];
  if (ultimo && stessaGiornataLocale(ultimo.createdAt)) {
    throw new Error(
      "Hai già salvato un controllo oggi per questa campagna. Potrai salvarne un altro in una data diversa.",
    );
  }

  const payload = {
    campaign_id: input.campaignId,
    user_id: uid,
    days_active: input.daysActive,
    spend: input.spend,
    results_count: input.resultsCount,
    primary_cost: input.primaryCost,
    ctr: input.ctr,
    cpm: input.cpm,
    cpc: input.cpc,
    frequency: input.frequency,
    roas: input.roas,
    health_status: input.healthStatus,
    signal: input.signal,
    actions: input.actions,
    note: input.note?.trim() || null,
    objective: input.objective,
    threshold: input.threshold,
    threshold_mode: input.thresholdMode,
    source: input.source,
  };

  const { data, error } = await supabase
    .from("campaign_checks")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const mapped = mappaDaRow(data as CampaignCheckRow);
  if (!mapped) {
    throw new Error("Controllo salvato ma risposta non valida.");
  }
  return mapped;
}
