/**
 * M10F.2 — Defensive sessionStorage read/write for Ally UI continuity.
 * SSR-safe. Malformed payloads → defaults.
 */

import {
  ALLY_SESSION_UI_VERSION,
  DEFAULT_ASK_ALLY_SESSION,
  DEFAULT_RESULTS_UI_SESSION,
  type AskAllySessionState,
  type ResultsUiSessionState,
} from "@/lib/ally-session-ui/types";
import { ALLY_COPILOT_MAX_HISTORY_TURNS } from "@/lib/ally-copilot/types";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function resultsUiSessionKey(
  userId: string,
  campaignId: string,
): string {
  return `ally:session:v${ALLY_SESSION_UI_VERSION}:user:${userId}:campaign:${campaignId}:results-ui`;
}

export function askAllySessionKey(
  userId: string,
  campaignId: string,
  source: string,
): string {
  return `ally:session:v${ALLY_SESSION_UI_VERSION}:user:${userId}:campaign:${campaignId}:source:${source}:ask-ally`;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function parseResultsUiSession(raw: unknown): ResultsUiSessionState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== ALLY_SESSION_UI_VERSION) return null;
  if (typeof o.hierarchyOpen !== "boolean") return null;
  if (typeof o.campaignConfigOpen !== "boolean") return null;
  if (typeof o.measurementDetailsOpen !== "boolean") return null;
  if (typeof o.diagnosisEvidenceOpen !== "boolean") return null;
  if (!isStringArray(o.adSetExpandedIds)) return null;
  if (!isStringArray(o.adSetConfigOpenIds)) return null;
  const adConfigOpenIds = isStringArray(o.adConfigOpenIds)
    ? o.adConfigOpenIds
    : [];
  return {
    version: ALLY_SESSION_UI_VERSION,
    hierarchyOpen: o.hierarchyOpen,
    adSetExpandedIds: o.adSetExpandedIds.slice(0, 50),
    campaignConfigOpen: o.campaignConfigOpen,
    measurementDetailsOpen: o.measurementDetailsOpen,
    diagnosisEvidenceOpen: o.diagnosisEvidenceOpen,
    adSetConfigOpenIds: o.adSetConfigOpenIds.slice(0, 50),
    adConfigOpenIds: adConfigOpenIds.slice(0, 50),
  };
}

export function parseAskAllySession(raw: unknown): AskAllySessionState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== ALLY_SESSION_UI_VERSION) return null;
  if (typeof o.draft !== "string") return null;
  if (!(o.error === null || typeof o.error === "string")) return null;
  if (!Array.isArray(o.history)) return null;

  const history: AskAllySessionState["history"] = [];
  for (const turn of o.history) {
    if (!turn || typeof turn !== "object") continue;
    const t = turn as Record<string, unknown>;
    if (t.role !== "user" && t.role !== "assistant") continue;
    if (typeof t.content !== "string") continue;
    const content = t.content.slice(0, 4000);
    if (!content.trim()) continue;
    history.push({ role: t.role, content });
  }

  let latest: AskAllySessionState["latest"] = null;
  if (o.latest && typeof o.latest === "object") {
    const l = o.latest as Record<string, unknown>;
    if (
      typeof l.answer === "string" &&
      typeof l.confidence === "string" &&
      Array.isArray(l.evidence) &&
      Array.isArray(l.hypotheses) &&
      Array.isArray(l.missingInformation) &&
      Array.isArray(l.suggestedNextQuestions) &&
      typeof l.fromAi === "boolean" &&
      (l.recommendedActionHref === null ||
        typeof l.recommendedActionHref === "string")
    ) {
      latest = {
        answer: l.answer.slice(0, 8000),
        confidence: l.confidence.slice(0, 32),
        evidence: l.evidence
          .filter((x): x is string => typeof x === "string")
          .slice(0, 12)
          .map((s) => s.slice(0, 500)),
        hypotheses: l.hypotheses
          .filter((x): x is string => typeof x === "string")
          .slice(0, 8)
          .map((s) => s.slice(0, 500)),
        missingInformation: l.missingInformation
          .filter((x): x is string => typeof x === "string")
          .slice(0, 8)
          .map((s) => s.slice(0, 500)),
        suggestedNextQuestions: l.suggestedNextQuestions
          .filter((x): x is string => typeof x === "string")
          .slice(0, 8)
          .map((s) => s.slice(0, 200)),
        recommendedActionHref:
          typeof l.recommendedActionHref === "string"
            ? l.recommendedActionHref.slice(0, 300)
            : null,
        fromAi: l.fromAi,
      };
    }
  }

  return {
    version: ALLY_SESSION_UI_VERSION,
    history: history.slice(-ALLY_COPILOT_MAX_HISTORY_TURNS),
    latest,
    draft: o.draft.slice(0, 500),
    error: typeof o.error === "string" ? o.error.slice(0, 300) : null,
  };
}

export function readResultsUiSession(
  userId: string,
  campaignId: string,
): ResultsUiSessionState {
  if (!isBrowser() || !userId || !campaignId) {
    return { ...DEFAULT_RESULTS_UI_SESSION };
  }
  try {
    const raw = sessionStorage.getItem(resultsUiSessionKey(userId, campaignId));
    if (!raw) return { ...DEFAULT_RESULTS_UI_SESSION };
    const parsed = parseResultsUiSession(JSON.parse(raw));
    return parsed ?? { ...DEFAULT_RESULTS_UI_SESSION };
  } catch {
    return { ...DEFAULT_RESULTS_UI_SESSION };
  }
}

export function writeResultsUiSession(
  userId: string,
  campaignId: string,
  state: ResultsUiSessionState,
): void {
  if (!isBrowser() || !userId || !campaignId) return;
  try {
    const safe = parseResultsUiSession(state) ?? {
      ...DEFAULT_RESULTS_UI_SESSION,
    };
    sessionStorage.setItem(
      resultsUiSessionKey(userId, campaignId),
      JSON.stringify(safe),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readAskAllySession(
  userId: string,
  campaignId: string,
  source: string,
): AskAllySessionState {
  if (!isBrowser() || !userId || !campaignId) {
    return { ...DEFAULT_ASK_ALLY_SESSION };
  }
  try {
    const raw = sessionStorage.getItem(
      askAllySessionKey(userId, campaignId, source),
    );
    if (!raw) return { ...DEFAULT_ASK_ALLY_SESSION };
    const parsed = parseAskAllySession(JSON.parse(raw));
    return parsed ?? { ...DEFAULT_ASK_ALLY_SESSION };
  } catch {
    return { ...DEFAULT_ASK_ALLY_SESSION };
  }
}

export function writeAskAllySession(
  userId: string,
  campaignId: string,
  source: string,
  state: AskAllySessionState,
): void {
  if (!isBrowser() || !userId || !campaignId) return;
  try {
    const safe = parseAskAllySession(state) ?? { ...DEFAULT_ASK_ALLY_SESSION };
    sessionStorage.setItem(
      askAllySessionKey(userId, campaignId, source),
      JSON.stringify(safe),
    );
  } catch {
    /* quota / private mode */
  }
}

/** Best-effort cleanup of Ally session UI keys for a user (logout). */
export function clearAllySessionUiForUser(userId: string): void {
  if (!isBrowser() || !userId) return;
  try {
    const prefix = `ally:session:v${ALLY_SESSION_UI_VERSION}:user:${userId}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function idsToRecord(ids: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ids) out[id] = true;
  return out;
}

export function recordToIds(rec: Record<string, boolean>): string[] {
  return Object.keys(rec).filter((k) => rec[k]);
}
