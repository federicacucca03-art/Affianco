/**
 * M7A — Deterministic Meta insights freshness (no health/urgency mutation).
 * Aligned with Hobby daily cron (once/day): normal sync must not look STALE at ~24h.
 */

export type MetaDataFreshness = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

/** Daily cadence: FRESH ≤30h, AGING ≤48h, else STALE. */
export const FRESH_MAX_MS = 30 * 60 * 60 * 1000;
export const AGING_MAX_MS = 48 * 60 * 60 * 1000;

export function resolveMetaDataFreshness(
  insightsLastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
): MetaDataFreshness {
  if (!insightsLastSyncedAt) return "UNKNOWN";
  const t = Date.parse(insightsLastSyncedAt);
  if (!Number.isFinite(t)) return "UNKNOWN";
  const age = nowMs - t;
  if (age < 0) return "FRESH";
  if (age <= FRESH_MAX_MS) return "FRESH";
  if (age <= AGING_MAX_MS) return "AGING";
  return "STALE";
}

/** Italian supporting copy — never implies health/urgency. */
export function etichettaFreshness(
  freshness: MetaDataFreshness,
  insightsLastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (freshness === "UNKNOWN") return "Dati Meta non ancora sincronizzati";
  if (freshness === "STALE") return "Dati da aggiornare";
  if (!insightsLastSyncedAt) return null;
  const t = Date.parse(insightsLastSyncedAt);
  if (!Number.isFinite(t)) return null;
  const ageMs = Math.max(0, nowMs - t);
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(ageMs / (60 * 1000)));
    return `Dati aggiornati ${mins} min fa`;
  }
  if (hours === 1) return "Dati aggiornati 1 ora fa";
  return `Dati aggiornati ${hours} ore fa`;
}
