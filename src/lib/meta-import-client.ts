/**
 * M8.5B / M8.5C.1 — import-first Meta helpers (client-side).
 * Creates a real owner-scoped clients row before OAuth (Option A).
 * No local-only / fake clients. No arbitrary client pick for generic Import.
 */

import { trovaOCreaCliente } from "@/lib/campagne-db";
import { saveClient } from "@/utils/clientStorage";
import { notifyAllySetupChanged } from "@/lib/ally-setup-shell-loader";
import { writeSetupPathPreference } from "@/lib/ally-setup";
import { supabase } from "@/lib/supabase";

/** Temporary display name until Meta ad-account name is known. */
export const META_IMPORT_CLIENT_PLACEHOLDER = "Cliente Meta";

export function isMetaImportPlaceholderName(
  name: string | null | undefined,
): boolean {
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
 * Resolve client for Meta Import.
 * - Explicit preferred id → use it (client context).
 * - Otherwise → reuse/create provisional import client only.
 * Never pick an arbitrary named Ally client for generic Import.
 */
export async function resolveMetaImportClientId(
  preferredClientId?: string | null,
): Promise<string> {
  const preferred = (preferredClientId ?? "").trim();
  if (preferred && isLikelyUuid(preferred)) {
    return preferred;
  }

  const provisional = await ensureMetaImportClient();
  return provisional.id;
}

/** Build the client Meta panel href and mark Import branch intent. */
export async function startMetaImportHref(
  preferredClientId?: string | null,
): Promise<string> {
  writeSetupPathPreference("meta");
  const id = await resolveMetaImportClientId(preferredClientId);
  return `/clienti/${encodeURIComponent(id)}?focus=meta`;
}

export type MetaImportStartResult =
  | { mode: "oauth"; authorizationUrl: string; clientId: string }
  | { mode: "panel"; href: string; clientId: string };

/**
 * Canonical Import start: provision if needed, then OAuth or Meta panel.
 * Zero Ally clients is supported — no manual client form.
 */
export async function startMetaImportFlow(
  preferredClientId: string | null | undefined,
  bearerToken: string,
): Promise<MetaImportStartResult> {
  writeSetupPathPreference("meta");
  const clientId = await resolveMetaImportClientId(preferredClientId);
  const auth = { Authorization: `Bearer ${bearerToken}` };

  let connected = false;
  try {
    const connRes = await fetch(
      `/api/meta/connection?clientId=${encodeURIComponent(clientId)}`,
      { headers: auth },
    );
    if (connRes.ok) {
      const conn = (await connRes.json()) as { connected?: boolean };
      connected = conn.connected === true;
    }
  } catch {
    connected = false;
  }

  if (connected) {
    return {
      mode: "panel",
      href: `/clienti/${encodeURIComponent(clientId)}?focus=meta`,
      clientId,
    };
  }

  const oauthRes = await fetch("/api/meta/oauth/start", {
    method: "POST",
    headers: {
      ...auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId }),
  });
  const oauth = (await oauthRes.json()) as {
    authorizationUrl?: string;
    error?: string;
  };
  if (!oauthRes.ok || !oauth.authorizationUrl) {
    throw new Error(oauth.error || "Collegamento Meta non riuscito.");
  }
  return {
    mode: "oauth",
    authorizationUrl: oauth.authorizationUrl,
    clientId,
  };
}

/** Apply startMetaImportFlow result (OAuth redirect or in-app navigation). */
export function applyMetaImportStart(
  result: MetaImportStartResult,
  navigate: (href: string) => void,
): void {
  if (result.mode === "oauth") {
    window.location.assign(result.authorizationUrl);
    return;
  }
  navigate(result.href);
}

export async function readBearerToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
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
