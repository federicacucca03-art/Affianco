import { MetaError } from "@/lib/meta/errors";

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
