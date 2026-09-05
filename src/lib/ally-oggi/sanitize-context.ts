/**
 * M9.1 — validate client-submitted brief context (structure only).
 * Strips unknown fields. Rejects oversized / secret-like keys.
 */

import {
  ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT,
  type AllyOggiBriefContext,
  type AllyOggiCampaignFact,
} from "@/lib/ally-oggi/types";

const FORBIDDEN_KEY_RE =
  /(token|secret|password|authorization|email|api[_-]?key|service.?role|graph|raw)/i;

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function strOrNull(v: unknown, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function assertNoForbiddenKeys(obj: unknown, path: string): void {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  for (const key of Object.keys(obj as object)) {
    if (FORBIDDEN_KEY_RE.test(key)) {
      throw new Error(`Campo non consentito: ${path}.${key}`);
    }
  }
}

function parseFact(raw: unknown): AllyOggiCampaignFact | null {
  if (!raw || typeof raw !== "object") return null;
  assertNoForbiddenKeys(raw, "campaign");
  const o = raw as Record<string, unknown>;
  const campaignId = strOrNull(o.campaignId, 64);
  const source = strOrNull(o.source, 16);
  const clientName = strOrNull(o.clientName, 80);
  const campaignName = strOrNull(o.campaignName, 120);
  const attentionState = strOrNull(o.attentionState, 40);
  const urgencyLevel = strOrNull(o.urgencyLevel, 16);
  const href = strOrNull(o.href, 200);
  if (
    !campaignId ||
    (source !== "NATIVE" && source !== "META") ||
    !clientName ||
    !campaignName ||
    !attentionState ||
    !urgencyLevel ||
    !href
  ) {
    return null;
  }
  if (!href.startsWith("/")) return null;

  return {
    campaignId,
    source,
    clientName,
    campaignName,
    attentionState,
    urgencyLevel,
    healthStatus: strOrNull(o.healthStatus, 32),
    trend: strOrNull(o.trend, 24) ?? "UNKNOWN",
    configurationKind: strOrNull(o.configurationKind, 40),
    resultsCount: numOrNull(o.resultsCount),
    primaryMetric: strOrNull(o.primaryMetric, 24),
    primaryMetricValue: numOrNull(o.primaryMetricValue),
    targetValue: numOrNull(o.targetValue),
    nextActionType: strOrNull(o.nextActionType, 40),
    nextActionTitle: strOrNull(o.nextActionTitle, 120),
    smallSample: o.smallSample === true,
    staleMeta: o.staleMeta === true,
    href,
  };
}

export function sanitizeAllyOggiBriefContext(
  raw: unknown,
): AllyOggiBriefContext {
  if (!raw || typeof raw !== "object") {
    throw new Error("Contesto non valido.");
  }
  assertNoForbiddenKeys(raw, "context");
  const o = raw as Record<string, unknown>;
  const countsRaw = o.counts;
  if (!countsRaw || typeof countsRaw !== "object") {
    throw new Error("counts mancanti.");
  }
  assertNoForbiddenKeys(countsRaw, "counts");
  const c = countsRaw as Record<string, unknown>;

  const campaignsIn = Array.isArray(o.campaigns) ? o.campaigns : [];
  if (campaignsIn.length > ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT) {
    throw new Error("Troppe campagne nel contesto.");
  }
  const campaigns: AllyOggiCampaignFact[] = [];
  for (const row of campaignsIn) {
    const fact = parseFact(row);
    if (fact) campaigns.push(fact);
  }

  const totalMonitored = numOrNull(o.totalMonitored) ?? campaigns.length;
  if (totalMonitored < 0 || totalMonitored > 500) {
    throw new Error("totalMonitored non valido.");
  }

  return {
    totalMonitored,
    counts: {
      critical: Math.max(0, Math.floor(numOrNull(c.critical) ?? 0)),
      needsAttention: Math.max(0, Math.floor(numOrNull(c.needsAttention) ?? 0)),
      monitor: Math.max(0, Math.floor(numOrNull(c.monitor) ?? 0)),
      stable: Math.max(0, Math.floor(numOrNull(c.stable) ?? 0)),
      configurationRequired: Math.max(
        0,
        Math.floor(numOrNull(c.configurationRequired) ?? 0),
      ),
      insufficientData: Math.max(
        0,
        Math.floor(numOrNull(c.insufficientData) ?? 0),
      ),
      historical: Math.max(0, Math.floor(numOrNull(c.historical) ?? 0)),
    },
    staleMetaCount: Math.max(0, Math.floor(numOrNull(o.staleMetaCount) ?? 0)),
    campaigns,
  };
}

/** True when AI brief is allowed (workspace with campaigns). */
export function shouldGenerateAllyOggiBrief(input: {
  isFirstRunOnboarding: boolean;
  totalMonitored: number;
}): boolean {
  if (input.isFirstRunOnboarding) return false;
  return input.totalMonitored > 0;
}
