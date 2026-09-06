/**
 * M9.3A — load owned client context for brief (RLS via user JWT).
 */

import { createClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/meta/ids";
import type { AllyBriefExistingClientContext } from "@/lib/ally-brief/types";
import type { TargetAgeBand, TargetType } from "@/types/campagne";

function projectUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

function clientForBearer(token: string) {
  const url = projectUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) throw new Error("Supabase non configurato");
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asTargetType(raw: unknown): TargetType | null {
  if (raw === "B2B" || raw === "B2C") return raw;
  return null;
}

function asTargetAge(raw: unknown): TargetAgeBand | null {
  if (
    raw === "18-35" ||
    raw === "25-50" ||
    raw === "35-65+" ||
    raw === "all"
  ) {
    return raw;
  }
  return null;
}

/**
 * Load client by id for the authenticated user (RLS).
 * Returns null if not found / not owned.
 */
export async function loadAllyBriefExistingClient(
  token: string,
  clienteId: string | null,
): Promise<AllyBriefExistingClientContext | null> {
  if (!clienteId || !isUuid(clienteId)) return null;
  const sb = clientForBearer(token);
  const { data, error } = await sb
    .from("clients")
    .select(
      "id, name, elevator_pitch, website, target_type, target_age",
    )
    .eq("id", clienteId)
    .maybeSingle();
  if (error || !data) return null;

  // Optional campaign-level settore/citta: take latest campaign for this client if any
  const { data: camp } = await sb
    .from("campaigns")
    .select("settore, citta")
    .eq("client_id", clienteId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: String(data.id),
    nome: String(data.name ?? "").trim() || "Cliente",
    settore:
      typeof camp?.settore === "string" && camp.settore.trim()
        ? camp.settore.trim()
        : null,
    citta:
      typeof camp?.citta === "string" && camp.citta.trim()
        ? camp.citta.trim()
        : null,
    sitoWeb:
      typeof data.website === "string" && data.website.trim()
        ? data.website.trim()
        : null,
    note:
      typeof data.elevator_pitch === "string" && data.elevator_pitch.trim()
        ? data.elevator_pitch.trim()
        : null,
    targetType: asTargetType(data.target_type),
    targetAge: asTargetAge(data.target_age),
  };
}

function normalizeClientName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Among owned clients, return the id only when normalized name equals hint
 * for exactly one row. 0 or 2+ matches → null (no silent pick).
 */
export function pickUniqueExactClientId(
  clients: Array<{ id: string; name: string | null | undefined }>,
  nomeHint: string | null,
): string | null {
  const hint = normalizeClientName(nomeHint ?? "");
  if (hint.length < 3) return null;
  const hits = clients.filter((c) => {
    const n = normalizeClientName(String(c.name ?? ""));
    return n.length > 0 && n === hint;
  });
  if (hits.length !== 1) return null;
  return String(hits[0]!.id);
}

/**
 * Exact owned-client name match only (no fuzzy / substring / sector / city).
 * Requires exactly one canonical owned client with that name.
 */
export async function matchAllyBriefClientByName(
  token: string,
  nomeHint: string | null,
): Promise<AllyBriefExistingClientContext | null> {
  const hint = normalizeClientName(nomeHint ?? "");
  if (hint.length < 3) return null;
  const sb = clientForBearer(token);
  const { data, error } = await sb
    .from("clients")
    .select("id, name")
    .limit(40);
  if (error || !data?.length) return null;
  const id = pickUniqueExactClientId(data, nomeHint);
  if (!id) return null;
  return loadAllyBriefExistingClient(token, id);
}
