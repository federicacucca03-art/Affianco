/**
 * M9.3A — temporary session storage for accepted brief proposals.
 * No DB migration.
 */

import type { CampagnaObjective } from "@/types/campagne";
import {
  ALLY_BRIEF_SESSION_KEY,
  OBJECTIVES_CANONICI,
  type AllyBriefAcceptedPayload,
  type AllyBriefField,
  type AllyBriefFieldId,
  type AllyBriefFieldValue,
  type AllyBriefProposal,
} from "@/lib/ally-brief/types";

export function proposalToAcceptedPayload(
  brief: string,
  proposal: AllyBriefProposal,
  overrides?: Partial<Record<AllyBriefFieldId, AllyBriefFieldValue>>,
): AllyBriefAcceptedPayload | null {
  const values: AllyBriefAcceptedPayload["values"] = {};
  for (const f of proposal.fields) {
    const v = overrides && f.id in overrides ? overrides[f.id] : f.value;
    if (v != null && v !== "") values[f.id] = v;
  }
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (v == null || v === "") {
      delete values[k as AllyBriefFieldId];
    } else {
      values[k as AllyBriefFieldId] = v;
    }
  }

  const objRaw = values.objective;
  const objective =
    typeof objRaw === "string" &&
    (OBJECTIVES_CANONICI as string[]).includes(objRaw)
      ? (objRaw as CampagnaObjective)
      : null;
  if (!objective) return null;

  return {
    version: 1,
    brief: brief.slice(0, 6000),
    acceptedAt: new Date().toISOString(),
    objective,
    matchedClienteId: proposal.matchedClienteId,
    values,
  };
}

export function saveAcceptedAllyBrief(
  payload: AllyBriefAcceptedPayload,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ALLY_BRIEF_SESSION_KEY, JSON.stringify(payload));
}

export function readAcceptedAllyBrief(): AllyBriefAcceptedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ALLY_BRIEF_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AllyBriefAcceptedPayload;
    if (parsed?.version !== 1 || !parsed.objective) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAcceptedAllyBrief(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ALLY_BRIEF_SESSION_KEY);
}

export function editableValuesFromProposal(
  proposal: AllyBriefProposal,
): Record<AllyBriefFieldId, AllyBriefFieldValue> {
  const out = {} as Record<AllyBriefFieldId, AllyBriefFieldValue>;
  for (const f of proposal.fields) {
    out[f.id] = f.value;
  }
  return out;
}

export function fieldMap(proposal: AllyBriefProposal): Map<
  AllyBriefFieldId,
  AllyBriefField
> {
  return new Map(proposal.fields.map((f) => [f.id, f]));
}
