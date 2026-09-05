/**
 * M9.2 — sanitize client-sent question + history (never trust client context).
 */

import type { AllyCopilotHistoryTurn } from "@/lib/ally-copilot/types";
import {
  ALLY_COPILOT_MAX_HISTORY_TURNS,
  ALLY_COPILOT_MAX_QUESTION_CHARS,
} from "@/lib/ally-copilot/types";

export function sanitizeAllyCopilotQuestion(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("Domanda non valida.");
  }
  const q = raw.trim().replace(/\s+/g, " ");
  if (!q) throw new Error("Scrivi una domanda.");
  if (q.length > ALLY_COPILOT_MAX_QUESTION_CHARS) {
    throw new Error("Domanda troppo lunga.");
  }
  return q;
}

export function sanitizeAllyCopilotHistory(
  raw: unknown,
): AllyCopilotHistoryTurn[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error("Cronologia non valida.");
  const out: AllyCopilotHistoryTurn[] = [];
  for (const item of raw.slice(-ALLY_COPILOT_MAX_HISTORY_TURNS)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "user" || o.role === "assistant" ? o.role : null;
    const content =
      typeof o.content === "string" ? o.content.trim().slice(0, 800) : "";
    if (!role || !content) continue;
    out.push({ role, content });
  }
  return out;
}
