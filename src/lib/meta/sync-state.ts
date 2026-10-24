/**
 * M13 — Product sync state (Ally ↔ Meta). Pure logic, safe for client + server.
 * HTTP Meta read success ≠ synchronized (see last_verified_sync_at on row).
 */

export type MetaCampaignSyncStatus =
  | "UNLINKED"
  | "NEEDS_VERIFICATION"
  | "SYNCED"
  | "ALLY_CHANGES_PENDING"
  | "META_CHANGES_DETECTED"
  | "SYNC_ERROR"
  | "BOTH_CHANGES";

export type MetaSyncPersistRow = {
  affianco_campaign_id: string | null;
  sync_status: MetaCampaignSyncStatus;
  last_verified_sync_at: string | null;
  last_sync_error_at: string | null;
  last_sync_error_message: string | null;
  verified_ally_fingerprint: string | null;
  verified_meta_fingerprint: string | null;
  current_ally_fingerprint: string | null;
  current_meta_fingerprint: string | null;
};

export type ChangeDetection = {
  allyChangedSinceVerification: boolean;
  metaChangedSinceVerification: boolean;
  bothChanged: boolean;
  neitherChanged: boolean;
  hasVerificationBaseline: boolean;
};

export type ProductSyncUiKind =
  | "non_collegata"
  | "collegata"
  | "sincronizzata"
  | "modifiche_ally"
  | "modifiche_meta"
  | "conflitto"
  | "problema";

export const SYNC_CONFLICT_SUPPORT_COPY =
  "Sono state rilevate modifiche sia in Ally sia su Meta. Rivedile prima di sincronizzare.";

export function detectSyncChanges(row: MetaSyncPersistRow): ChangeDetection {
  const hasVerificationBaseline = Boolean(row.last_verified_sync_at);
  const vAlly = row.verified_ally_fingerprint;
  const vMeta = row.verified_meta_fingerprint;
  const cAlly = row.current_ally_fingerprint;
  const cMeta = row.current_meta_fingerprint;

  const allyChangedSinceVerification =
    hasVerificationBaseline &&
    vAlly != null &&
    cAlly != null &&
    cAlly !== vAlly;
  const metaChangedSinceVerification =
    hasVerificationBaseline &&
    vMeta != null &&
    cMeta != null &&
    cMeta !== vMeta;

  return {
    allyChangedSinceVerification,
    metaChangedSinceVerification,
    bothChanged:
      allyChangedSinceVerification && metaChangedSinceVerification,
    neitherChanged:
      hasVerificationBaseline &&
      !allyChangedSinceVerification &&
      !metaChangedSinceVerification,
    hasVerificationBaseline,
  };
}

/** Recompute persisted sync_status from fingerprints (not from last_synced_at). */
export function deriveSyncStatusFromFingerprints(
  row: MetaSyncPersistRow,
): MetaCampaignSyncStatus {
  if (!row.affianco_campaign_id) {
    return "UNLINKED";
  }
  if (row.sync_status === "SYNC_ERROR") {
    return "SYNC_ERROR";
  }
  const changes = detectSyncChanges(row);
  if (!changes.hasVerificationBaseline) {
    return "NEEDS_VERIFICATION";
  }
  if (changes.bothChanged) {
    return "BOTH_CHANGES";
  }
  if (changes.allyChangedSinceVerification) {
    return "ALLY_CHANGES_PENDING";
  }
  if (changes.metaChangedSinceVerification) {
    return "META_CHANGES_DETECTED";
  }
  return "SYNCED";
}

export function resolveProductSyncUi(
  row: Pick<
    MetaSyncPersistRow,
    "affianco_campaign_id" | "sync_status" | "last_verified_sync_at"
  >,
): ProductSyncUiKind {
  if (!row.affianco_campaign_id) {
    return "non_collegata";
  }
  if (row.sync_status === "SYNC_ERROR") {
    return "problema";
  }
  switch (row.sync_status) {
    case "SYNCED":
      return row.last_verified_sync_at ? "sincronizzata" : "collegata";
    case "BOTH_CHANGES":
      return "conflitto";
    case "ALLY_CHANGES_PENDING":
      return "modifiche_ally";
    case "META_CHANGES_DETECTED":
      return "modifiche_meta";
    case "NEEDS_VERIFICATION":
    case "UNLINKED":
    default:
      return "collegata";
  }
}

/** Short line for campaign workspace: "Meta · …" */
export function etichettaSyncMetaWorkspace(kind: ProductSyncUiKind): string | null {
  switch (kind) {
    case "non_collegata":
      return null;
    case "collegata":
      return "Meta · Collegata";
    case "sincronizzata":
      return "Meta · Sincronizzata";
    case "modifiche_ally":
      return "Meta · Modifiche da sincronizzare";
    case "modifiche_meta":
      return "Meta · Modifiche rilevate su Meta";
    case "conflitto":
      return "Meta · Conflitto di sincronizzazione";
    case "problema":
      return "Meta · Problema di sincronizzazione";
    default:
      return "Meta · Collegata";
  }
}

/** Compact Results badge (only when attention needed or synced). */
export function etichettaSyncResultsBadge(kind: ProductSyncUiKind): string | null {
  switch (kind) {
    case "modifiche_ally":
      return "Sync Ally";
    case "modifiche_meta":
      return "Meta aggiornata";
    case "conflitto":
      return "Conflitto";
    case "problema":
      return "Sync";
    default:
      return null;
  }
}

export function isFalseSyncedDisplay(
  row: MetaSyncPersistRow,
  kind: ProductSyncUiKind,
): boolean {
  return kind === "sincronizzata" && !row.last_verified_sync_at;
}
