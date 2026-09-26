import { MetaError } from "@/lib/meta/errors";

/** Write-upgrade must prove both before replacing the existing connection. */
export const META_WRITE_UPGRADE_REQUIRED_SCOPES = [
  "ads_read",
  "ads_management",
] as const;

export function connectionHasScope(
  connection: { scopes: string[] },
  scope: string,
): boolean {
  return connection.scopes.includes(scope);
}

export function assertMetaConnectionHasScope(
  connection: { scopes: string[] },
  scope: string,
): void {
  if (!connectionHasScope(connection, scope)) {
    throw new MetaError(
      "META_PERMISSION_MISSING",
      "Permesso Meta mancante.",
    );
  }
}

/** Authoritative granted-scope check for write_upgrade — before persist. */
export function writeUpgradeScopesComplete(scopes: string[]): boolean {
  const set = new Set(scopes.map((s) => s.trim()).filter(Boolean));
  return (
    set.has("ads_read") && set.has("ads_management")
  );
}

/**
 * Fail-closed before save when write-upgrade token lacks required scopes.
 * Preserves the existing encrypted connection when this throws.
 */
export function assertWriteUpgradeScopesForPersist(scopes: string[]): void {
  if (!writeUpgradeScopesComplete(scopes)) {
    throw new MetaError(
      "META_PERMISSION_MISSING",
      "Autorizzazione scrittura incompleta. Riprova e concedi i permessi di lettura e creazione campagne su Meta.",
    );
  }
}
