/**
 * Canonical client + campaign count inventory (Supabase only).
 * Never reads browser campaign memory.
 */

import { supabase } from "@/lib/supabase";

export type ClienteDbRow = {
  id: string;
  name: string;
};

/** Owned clients for the current session (RLS). */
export async function leggiClientiDaSupabase(): Promise<ClienteDbRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClienteDbRow[]).filter(
    (c) => c && typeof c.id === "string" && typeof c.name === "string",
  );
}

/** Count native campaigns per client_id (canonical). */
export async function contaCampagneNativePerCliente(): Promise<
  Record<string, number>
> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, client_id");
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as {
    id: string;
    client_id: string | null;
  }[]) {
    const cid = row.client_id;
    if (!cid) continue;
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
}

/** Count Meta campaigns per client_id (canonical). */
export async function contaCampagneMetaPerCliente(): Promise<
  Record<string, number>
> {
  const { data, error } = await supabase
    .from("meta_campaigns")
    .select("id, client_id");
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as {
    id: string;
    client_id: string | null;
  }[]) {
    const cid = row.client_id;
    if (!cid) continue;
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
}

/** True if client has any canonical native or Meta campaign. */
export async function clienteHaCampagneCanoniche(
  clientId: string,
): Promise<{ hasNative: boolean; hasMeta: boolean }> {
  const [{ count: nativeCount }, { count: metaCount }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("meta_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);
  return {
    hasNative: (nativeCount ?? 0) > 0,
    hasMeta: (metaCount ?? 0) > 0,
  };
}
