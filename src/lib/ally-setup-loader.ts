"use client";

import { supabase } from "@/lib/supabase";
import { getClients } from "@/utils/clientStorage";
import {
  readSetupPathPreference,
  type AllySetupSignals,
} from "@/lib/ally-setup";
import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";

type DbClient = { id: string; name: string };

/**
 * Load setup signals from existing stores (no new tables).
 * Safe to call from authenticated Home.
 */
export async function loadAllySetupSignals(input: {
  hasNativeCampaign: boolean;
  hasMetaCampaign: boolean;
  attentionItems: readonly ControlRoomAttentionItem[];
}): Promise<AllySetupSignals> {
  const locali = getClients();
  let dbClients: DbClient[] = [];
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      dbClients = (data as DbClient[]).filter(
        (c) => c && typeof c.id === "string" && typeof c.name === "string",
      );
    }
  } catch {
    dbClients = [];
  }

  const hasDbClient = dbClients.length > 0;
  const hasLocalClient = locali.length > 0;
  const hasClient = hasDbClient || hasLocalClient;

  const primaryDb = dbClients[0] ?? null;
  const primaryLocal = locali[0] ?? null;

  // Prefer DB UUID (Meta / ownership). Fall back to local id for native planning.
  const primaryClientId = primaryDb?.id ?? primaryLocal?.id ?? null;
  const primaryClientName =
    primaryDb?.name ?? primaryLocal?.nome ?? null;

  let hasMetaConnection = false;
  let hasMetaAdAccount = false;

  if (hasDbClient) {
    try {
      const { data: conns } = await supabase
        .from("meta_connections")
        .select("id, client_id, status")
        .eq("status", "ACTIVE");
      const active = Array.isArray(conns) ? conns : [];
      hasMetaConnection = active.length > 0;
    } catch {
      hasMetaConnection = false;
    }

    try {
      const { data: accounts } = await supabase
        .from("client_ad_accounts")
        .select("id, client_id");
      hasMetaAdAccount = Array.isArray(accounts) && accounts.length > 0;
    } catch {
      hasMetaAdAccount = false;
    }
  }

  return {
    hasClient,
    hasDbClient,
    primaryClientId,
    primaryClientName,
    hasNativeCampaign: input.hasNativeCampaign,
    hasMetaCampaign: input.hasMetaCampaign,
    hasMetaConnection,
    hasMetaAdAccount,
    pathPreference: readSetupPathPreference(),
    attentionItems: input.attentionItems,
  };
}
