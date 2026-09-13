/**
 * Home card presentation copy for "Perché?" — deterministic, 0 AI calls.
 * Does not change M6 state / next-action resolution — display only.
 */

import { isSmallSample } from "@/lib/campaign-next-action";
import type { CampaignNextAction } from "@/lib/campaign-next-action";
import type { ControlRoomAttentionItem } from "@/lib/monday-control-room";
import { isHomeRevisionItem } from "@/lib/home-priorities";

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function similar(a: string, b: string): boolean {
  const na = norm(a).toLowerCase();
  const nb = norm(b).toLowerCase();
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  // Stem-level overlap for Italian revision / sample phrasing.
  const tokens = (s: string) =>
    s
      .split(/[^a-zàèéìòù0-9]+/i)
      .filter((t) => t.length > 3);
  const aTok = new Set(tokens(na));
  const shared = tokens(nb).filter((t) => aTok.has(t));
  return shared.length >= 2;
}

const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

/** Home metadata date: "Agosto 2026" — presentation only. */
export function formatHomeCardMetaDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = MONTHS_IT[d.getUTCMonth()];
  if (!month) return null;
  return `${month} ${d.getUTCFullYear()}`;
}

/**
 * Single visible reason line for the card — never restates the state badge.
 */
export function buildHomeCardReason(item: ControlRoomAttentionItem): string {
  if (isHomeRevisionItem(item)) {
    return "Il cliente ha richiesto modifiche alla campagna.";
  }
  const reason = norm(item.reason ?? "");
  if (/ha richiesto una revisione/i.test(reason)) {
    return "Il cliente ha richiesto modifiche alla campagna.";
  }
  return reason;
}

/**
 * Expanded "Perché?" copy — forward-looking, no repeat of the card reason.
 */
export function buildHomeActionExplanation(
  item: ControlRoomAttentionItem,
  action: CampaignNextAction,
): string {
  const cardReason = buildHomeCardReason(item);
  const rationale = norm(action.rationale ?? "");

  if (isHomeRevisionItem(item) || action.actionType === "CONTACT_CLIENT") {
    return "Prima di proseguire, gestisci la revisione richiesta.";
  }

  if (
    action.actionType === "WAIT_FOR_MORE_DATA" ||
    isSmallSample(item.resultsCount)
  ) {
    if (rationale && !similar(rationale, cardReason)) {
      return rationale.endsWith(".") ? rationale : `${rationale}.`;
    }
    const n = item.resultsCount ?? 0;
    if (n === 1) {
      return "I dati non sono ancora sufficienti: c’è solo 1 risultato.";
    }
    if (n < 2) {
      return "I dati non sono ancora sufficienti: ci sono meno di 2 risultati.";
    }
    return "I dati non sono ancora sufficienti per giustificare una modifica.";
  }

  if (rationale && !similar(rationale, cardReason) && !similar(rationale, item.reason ?? "")) {
    return rationale.endsWith(".") ? rationale : `${rationale}.`;
  }

  if (action.title) {
    return `Per questo la prossima azione è «${action.title}».`;
  }

  return "Lo stato e i dati disponibili portano a questa prossima azione.";
}

export const HOME_ASK_PROMPTS = [
  "Cosa guardo oggi?",
  "Dove interverresti prima?",
  "Cosa posso lasciare stare?",
] as const;

export const CAMPAIGN_FOLLOWUP_PROMPTS = [
  "Quanto aspetteresti?",
  "Cosa controlleresti nel frattempo?",
  "Qual è il rischio se intervengo ora?",
] as const;
