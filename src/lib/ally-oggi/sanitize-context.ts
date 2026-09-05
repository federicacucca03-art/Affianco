/**
 * M9.1B — validate client-submitted brief context (structure only).
 */

import {
  ALLY_OGGI_MAX_CAMPAIGNS_IN_PROMPT,
  emptyAllyOggiWorkspaceSummary,
  type AllyOggiBriefContext,
  type AllyOggiCampaignFact,
  type AllyOggiWorkspaceSummary,
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

function nonNegInt(v: unknown): number {
  return Math.max(0, Math.floor(numOrNull(v) ?? 0));
}

function parseWorkspace(raw: unknown): AllyOggiWorkspaceSummary {
  const empty = emptyAllyOggiWorkspaceSummary();
  if (!raw || typeof raw !== "object") return empty;
  assertNoForbiddenKeys(raw, "workspace");
  const o = raw as Record<string, unknown>;
  return {
    totalWorkspaceCampaigns: nonNegInt(o.totalWorkspaceCampaigns),
    nativeCampaigns: nonNegInt(o.nativeCampaigns),
    metaCampaigns: nonNegInt(o.metaCampaigns),
    draftCampaigns: nonNegInt(o.draftCampaigns),
    revisionRequestedCampaigns: nonNegInt(o.revisionRequestedCampaigns),
    approvedCampaigns: nonNegInt(o.approvedCampaigns),
    monitorableCampaigns: nonNegInt(o.monitorableCampaigns),
    configurationRequiredCampaigns: nonNegInt(
      o.configurationRequiredCampaigns,
    ),
    insufficientDataCampaigns: nonNegInt(o.insufficientDataCampaigns),
    historicalCampaigns: nonNegInt(o.historicalCampaigns),
  };
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

  const workspace = parseWorkspace(o.workspace);
  const totalMonitored = numOrNull(o.totalMonitored) ?? campaigns.length;
  if (totalMonitored < 0 || totalMonitored > 500) {
    throw new Error("totalMonitored non valido.");
  }
  if (workspace.totalWorkspaceCampaigns > 500) {
    throw new Error("totalWorkspaceCampaigns non valido.");
  }

  return {
    workspace,
    totalMonitored,
    counts: {
      critical: nonNegInt(c.critical),
      needsAttention: nonNegInt(c.needsAttention),
      monitor: nonNegInt(c.monitor),
      stable: nonNegInt(c.stable),
      configurationRequired: nonNegInt(c.configurationRequired),
      insufficientData: nonNegInt(c.insufficientData),
      historical: nonNegInt(c.historical),
    },
    staleMetaCount: nonNegInt(o.staleMetaCount),
    campaigns,
  };
}

/** True when AI brief is allowed (active workspace with campaigns). */
export function shouldGenerateAllyOggiBrief(input: {
  isFirstRunOnboarding: boolean;
  totalWorkspaceCampaigns: number;
  totalMonitored?: number;
}): boolean {
  if (input.isFirstRunOnboarding) return false;
  return input.totalWorkspaceCampaigns > 0;
}
