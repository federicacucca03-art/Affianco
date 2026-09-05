/**
 * M8.5B — import-first Meta onboarding helpers (client-side).
 * Creates a real owner-scoped clients row before OAuth (Option A).
 * No local-only / fake clients.
 */

import { trovaOCreaCliente } from "@/lib/campagne-db";
import { saveClient } from "@/utils/clientStorage";
import { notifyAllySetupChanged } from "@/lib/ally-setup-shell-loader";

/** Temporary display name until Meta ad-account name is known. */
export const META_IMPORT_CLIENT_PLACEHOLDER = "Cliente Meta";

export function isMetaImportPlaceholderName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return n === META_IMPORT_CLIENT_PLACEHOLDER;
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
