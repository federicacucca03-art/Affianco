/**
 * M8.5B — import-first Meta onboarding helpers (client-side).
 * Creates a real owner-scoped clients row before OAuth (Option A).
 * No local-only / fake clients.
 */

import { trovaOCreaCliente } from "@/lib/campagne-db";
import { saveClient } from "@/utils/clientStorage";
import { notifyAllySetupChanged } from "@/lib/ally-setup-shell-loader";
import { writeSetupPathPreference } from "@/lib/ally-setup";
import { supabase } from "@/lib/supabase";

/** Temporary display name until Meta ad-account name is known. */
export const META_IMPORT_CLIENT_PLACEHOLDER = "Cliente Meta";

export function isMetaImportPlaceholderName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return n === META_IMPORT_CLIENT_PLACEHOLDER;
}

function isLikelyUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Ensure a canonical DB client exists for the Import branch.
 * Reuses an existing placeholder-named client when present (orphan recovery).
 */
export async function ensureMetaImportClient(): Promise<{
  id: string;
  name: string;
}> {
  const row = await trovaOCreaCliente({
    name: META_IMPORT_CLIENT_PLACEHOLDER,
  });
  saveClient({
    id: row.id,
    nome: row.name,
    settore: "",
    citta: "",
  });
  notifyAllySetupChanged();
  return { id: row.id, name: row.name };
}

/**
 * Resolve client for workspace "Importa da Meta" without fabricating business data.
 * Prefer an unambiguous route client, else an existing owned client, else placeholder.
 */
export async function resolveMetaImportClientId(
  preferredClientId?: string | null,
): Promise<string> {
  const preferred = (preferredClientId ?? "").trim();
  if (preferred && isLikelyUuid(preferred)) {
    return preferred;
  }

  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data && typeof (data as { id: string }).id === "string") {
      return (data as { id: string }).id;
    }
  } catch {
    /* fall through */
  }

  const created = await ensureMetaImportClient();
  return created.id;
}

/** Build the safe client-scoped Meta import href and mark Import branch intent. */
export async function startMetaImportHref(
  preferredClientId?: string | null,
): Promise<string> {
  writeSetupPathPreference("meta");
  const id = await resolveMetaImportClientId(preferredClientId);
  return `/clienti/${encodeURIComponent(id)}?focus=meta`;
}

/** Extract client id from /clienti/{uuid} when present. */
export function clientIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/clienti\/([^/]+)\/?$/);
  if (!m?.[1]) return null;
  const id = decodeURIComponent(m[1]);
  return isLikelyUuid(id) ? id : null;
}

/**
 * Prefer unambiguous client from route: client detail, or campaign detail's client_id.
 */
export async function preferredClientIdFromPathname(
  pathname: string,
): Promise<string | null> {
  const fromClient = clientIdFromPathname(pathname);
  if (fromClient) return fromClient;

  const m = pathname.match(/^\/campagne\/([^/]+)/);
  if (!m?.[1]) return null;
  const campaignId = decodeURIComponent(m[1]);
  if (!isLikelyUuid(campaignId)) return null;

  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("client_id")
      .eq("id", campaignId)
      .maybeSingle();
    if (error || !data) return null;
    const clientId = (data as { client_id?: string | null }).client_id;
    return clientId && isLikelyUuid(clientId) ? clientId : null;
  } catch {
    return null;
  }
}
