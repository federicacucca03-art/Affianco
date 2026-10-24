import { MetaError } from "@/lib/meta/errors";
import {
  META_WRITE_UPGRADE_REQUIRED_SCOPES,
  writeUpgradeScopesComplete as writeUpgradeScopesCompleteCentral,
} from "@/lib/meta/oauth-scopes";

export {
  META_ALLY_REQUIRED_SCOPES,
  META_WRITE_UPGRADE_REQUIRED_SCOPES,
  META_OAUTH_SCOPE_MATRIX,
  META_SCOPES_NOT_REQUIRED_FOR_ADV24,
  LEADS_RETRIEVAL_DECISION,
  missingRequiredScopes,
  isMetaReauthRequiredForAllyFeatures,
  normalizeScopeList,
} from "@/lib/meta/oauth-scopes";

/** @deprecated Prefer META_WRITE_UPGRADE_REQUIRED_SCOPES from oauth-scopes. */
export const META_WRITE_UPGRADE_BASE_SCOPES = [
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
  return writeUpgradeScopesCompleteCentral(scopes);
}

/**
 * Fail-closed before save when write-upgrade token lacks required scopes.
 * Preserves the existing encrypted connection when this throws.
 */
export function assertWriteUpgradeScopesForPersist(scopes: string[]): void {
  if (!writeUpgradeScopesComplete(scopes)) {
    const missing = META_WRITE_UPGRADE_REQUIRED_SCOPES.filter(
      (s) => !scopes.map((x) => x.trim()).includes(s),
    );
    void missing;
    throw new MetaError(
      "META_PERMISSION_MISSING",
      "Autorizzazione incompleta. Riprova e concedi i permessi necessari per leggere i moduli Instant Form e creare campagne su Meta.",
    );
  }
}
