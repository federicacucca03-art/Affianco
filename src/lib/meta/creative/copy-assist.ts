/**
 * P0.17 — Ally creative copy assist (proposal only, not auto-approved).
 * No performance claims. No Brand Brain mutation. META MUTATIONS: 0
 */

import type { AllyCreativeCopySuggestion } from "@/lib/meta/creative/types";
import { userFacingCampaignText } from "@/lib/campagne-creation-mode";
import { allyMetaCtaLabelIt, INSTANT_FORM_META_CTA_TYPE } from "@/lib/meta/creative/cta";

export type CreativeCopyAssistInput = {
  offerSummary: string;
  angle?: string | null;
  existingMessage?: string | null;
  brandTone?: string | null;
  geography?: string | null;
  conversionLocation?: "INSTANT_FORM" | "WEBSITE" | null;
};

const FORBIDDEN_CLAIM =
  /\b(best performing|high converting|\+\s*\d+\s*%|winner|proven result|più convertente|garantito\s*\d+)/i;

export function buildCreativeCopyAssistSystemPrompt(): string {
  return `Sei Ally, assistente copy per Meta Ads in italiano.
Proponi UNA sola variante di annuncio SINGLE IMAGE (non carousel).
Regole:
- Nessuna claim di performance inventata (no "best", "+30%", "winner", "garantito").
- Non inventare Page ID, Form ID, Pixel, URL.
- Rispondi SOLO JSON valido:
{"primaryText":"...","headline":"...","description":null|"...","angleIt":"..."}
- primaryText: 1-3 frasi chiare, utile al pubblico.
- headline: breve (max ~40 caratteri consigliati).
- description: opzionale, può essere null.
- angleIt: angolo creativo in italiano, una riga.`;
}

export function buildCreativeCopyAssistUserPrompt(
  input: CreativeCopyAssistInput,
): string {
  const offer = userFacingCampaignText(input.offerSummary);
  const existing = userFacingCampaignText(input.existingMessage);
  const lines = [
    `Offerta / messaggio: ${offer || "(non indicato)"}`,
    `Angolo richiesto: ${(input.angle ?? "").trim() || "(libero)"}`,
    `Messaggio esistente: ${existing || "(nessuno)"}`,
    `Tono Brand Brain (opzionale, non confermato=bassa confidenza): ${(input.brandTone ?? "").trim() || "(n/d)"}`,
    `Zona: ${(input.geography ?? "").trim() || "(n/d)"}`,
    `Destinazione: ${input.conversionLocation ?? "INSTANT_FORM"}`,
  ];
  return lines.join("\n");
}

export function parseAllyCreativeCopySuggestion(
  rawText: string,
): AllyCreativeCopySuggestion | null {
  const trimmed = (rawText ?? "").trim();
  if (!trimmed) return null;
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const primaryText = String(parsed.primaryText ?? "").trim();
    const headline = String(parsed.headline ?? "").trim();
    const descriptionRaw = parsed.description;
    const description =
      descriptionRaw == null || descriptionRaw === ""
        ? null
        : String(descriptionRaw).trim() || null;
    const angleIt =
      parsed.angleIt == null ? null : String(parsed.angleIt).trim() || null;
    if (!primaryText || !headline) return null;
    const blob = `${primaryText}\n${headline}\n${description ?? ""}\n${angleIt ?? ""}`;
    if (FORBIDDEN_CLAIM.test(blob)) return null;
    return {
      primaryText,
      headline,
      description,
      callToActionLabelIt: allyMetaCtaLabelIt(INSTANT_FORM_META_CTA_TYPE),
      provenance: "ALLY",
      angleIt,
    };
  } catch {
    return null;
  }
}

/** Deterministic fallback when Anthropic unavailable — still provenance ALLY proposal. */
export function fallbackAllyCreativeCopySuggestion(
  input: CreativeCopyAssistInput,
): AllyCreativeCopySuggestion {
  const offer =
    userFacingCampaignText(input.offerSummary) ||
    userFacingCampaignText(input.existingMessage) ||
    "la tua offerta";
  const geo = (input.geography ?? "").trim();
  const primaryText = geo
    ? `Cerchi ${offer} a ${geo}? Lascia i tuoi dati: ti ricontattiamo senza impegno.`
    : `Cerchi ${offer}? Lascia i tuoi dati: ti ricontattiamo senza impegno.`;
  const headline =
    offer.length > 36 ? `${offer.slice(0, 33).trim()}…` : offer;
  return {
    primaryText,
    headline,
    description: null,
    callToActionLabelIt: allyMetaCtaLabelIt(INSTANT_FORM_META_CTA_TYPE),
    provenance: "ALLY",
    angleIt: (input.angle ?? "").trim() || "Chiarezza e contatto diretto",
  };
}

export function stripForbiddenPerformanceClaims(text: string): string {
  return text.replace(FORBIDDEN_CLAIM, "").replace(/\s{2,}/g, " ").trim();
}
