/**
 * M9.1 — parse + sanitize Ally oggi AI JSON against canonical facts.
 */

import {
  ALLY_OGGI_MAX_CONFIGURATION,
  ALLY_OGGI_MAX_PRIORITY,
  ALLY_OGGI_MAX_WATCH,
  type AllyOggiBrief,
  type AllyOggiBriefContext,
  type AllyOggiBriefItem,
  type AllyOggiCampaignFact,
} from "@/lib/ally-oggi/types";

const PROHIBITED = [
  /grande lavoro/i,
  /ottimo!/i,
  /potenzia le tue campagne/i,
  /ai-powered/i,
  /aumenta il budget/i,
  /riduci il budget/i,
  /metti in pausa/i,
  /pausa la campagna/i,
];

function stripCodeFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : t;
}

function asString(v: unknown, max = 280): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s.slice(0, max);
}

function factKey(id: string, source: string): string {
  return `${source}:${id}`;
}

function indexFacts(
  context: AllyOggiBriefContext,
): Map<string, AllyOggiCampaignFact> {
  const m = new Map<string, AllyOggiCampaignFact>();
  for (const c of context.campaigns) {
    m.set(factKey(c.campaignId, c.source), c);
  }
  return m;
}

function sanitizeItem(
  raw: unknown,
  facts: Map<string, AllyOggiCampaignFact>,
): AllyOggiBriefItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const campaignId = asString(o.campaignId, 64);
  const sourceRaw = asString(o.source, 16);
  const title = asString(o.title, 120);
  const sentence = asString(o.sentence, 280);
  if (!campaignId || !sourceRaw || !title || !sentence) return null;
  if (sourceRaw !== "NATIVE" && sourceRaw !== "META") return null;
  const fact = facts.get(factKey(campaignId, sourceRaw));
  if (!fact) return null;
  if (PROHIBITED.some((re) => re.test(sentence) || re.test(title))) return null;
  return {
    campaignId,
    source: sourceRaw,
    title,
    sentence,
    recommendedHref: fact.href,
  };
}

function sanitizeList(
  raw: unknown,
  facts: Map<string, AllyOggiCampaignFact>,
  max: number,
): AllyOggiBriefItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AllyOggiBriefItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (out.length >= max) break;
    const item = sanitizeItem(row, facts);
    if (!item) continue;
    const k = factKey(item.campaignId, item.source);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function parseAllyOggiBrief(
  rawText: string,
  context: AllyOggiBriefContext,
): AllyOggiBrief {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(rawText));
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("INVALID_SHAPE");
  }
  const o = parsed as Record<string, unknown>;
  const facts = indexFacts(context);
  const headline = asString(o.headline, 160);
  const summary = asString(o.summary, 400);
  if (!headline || !summary) throw new Error("MISSING_FIELDS");
  if (PROHIBITED.some((re) => re.test(headline) || re.test(summary))) {
    throw new Error("PROHIBITED_COPY");
  }

  const closingRaw = o.closing_note ?? o.closingNote;
  const closingNote =
    closingRaw == null ? null : asString(closingRaw, 220);

  return {
    headline,
    summary,
    priorityItems: sanitizeList(
      o.priority_items ?? o.priorityItems,
      facts,
      ALLY_OGGI_MAX_PRIORITY,
    ),
    watchItems: sanitizeList(
      o.watch_items ?? o.watchItems,
      facts,
      ALLY_OGGI_MAX_WATCH,
    ),
    configurationItems: sanitizeList(
      o.configuration_items ?? o.configurationItems,
      facts,
      ALLY_OGGI_MAX_CONFIGURATION,
    ),
    closingNote,
    fromAi: true,
  };
}
