/**
 * M11A.1 — Stable payload fingerprint (preview == confirm).
 * No timestamps / random IDs / presentation-only fields.
 */

import { createHash } from "node:crypto";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue;
      out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function fingerprintPayload(value: unknown): string {
  const body = canonicalJson(value);
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function buildIdempotencyKey(input: {
  userId: string;
  allyCampaignId: string;
  operationType: string;
  fingerprint: string;
}): string {
  return fingerprintPayload({
    u: input.userId,
    c: input.allyCampaignId,
    t: input.operationType,
    f: input.fingerprint,
  });
}
