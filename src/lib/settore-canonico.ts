/**
 * M9.3C — Single canonical settore mapping for Ally brief + shared resolvers.
 * Source of truth for keys/labels/aliases: src/data/settoriPresets.ts
 */

import {
  SETTORI_PRESETS,
  SETTORE_ALTRO_ID,
  SETTORE_ALTRO_LABEL,
  type SettorePreset,
} from "@/data/settoriPresets";
import {
  normalizzaChiaveSettore,
  risolviSettoreIntel,
} from "@/lib/sector-intel";

export { SETTORE_ALTRO_ID, SETTORE_ALTRO_LABEL };

export type CanonicalSettoreMatch = {
  id: string;
  label: string;
  matched: boolean;
  preset: SettorePreset | null;
};

/** Nicchie + macro (no duplicate Altro row in presets). */
export function listCanonicalSettoreOptions(): Array<{
  id: string;
  label: string;
  macro: string;
}> {
  return SETTORI_PRESETS.filter((p) => !p.id.startsWith("macro-")).map((p) => ({
    id: p.id,
    label: p.nome,
    macro: p.macroCategoria,
  }));
}

export function formatCanonicalSettoreEnumForPrompt(): string {
  const opts = listCanonicalSettoreOptions();
  return opts.map((o) => `${o.label} (${o.id})`).join(" | ");
}

/**
 * Resolve a free-form phrase to a catalog preset.
 * Prefers niche over macro. Uses alias containment for longer brief/site text.
 */
export function matchCanonicalSettore(
  raw: string | null | undefined,
): CanonicalSettoreMatch {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return {
      id: SETTORE_ALTRO_ID,
      label: SETTORE_ALTRO_LABEL,
      matched: false,
      preset: null,
    };
  }

  const direct = risolviSettoreIntel(text);
  if (direct && !direct.id.startsWith("macro-")) {
    return {
      id: direct.id,
      label: direct.nome,
      matched: true,
      preset: direct,
    };
  }

  const q = normalizzaChiaveSettore(text);
  let best: { preset: SettorePreset; score: number } | null = null;

  for (const preset of SETTORI_PRESETS) {
    if (preset.id.startsWith("macro-")) continue;
    for (const alias of preset.aliases) {
      const a = normalizzaChiaveSettore(alias);
      if (a.length < 4) continue;
      if (q === a) {
        const score = 100;
        if (!best || score > best.score) best = { preset, score };
        continue;
      }
      if (q.includes(a)) {
        // Longer alias matches beat short accidental hits.
        const score = 70 + Math.min(25, a.length);
        if (!best || score > best.score) best = { preset, score };
      }
    }
  }

  if (best && best.score >= 70) {
    return {
      id: best.preset.id,
      label: best.preset.nome,
      matched: true,
      preset: best.preset,
    };
  }

  if (direct) {
    return {
      id: direct.id,
      label: direct.nome,
      matched: true,
      preset: direct,
    };
  }

  return {
    id: SETTORE_ALTRO_ID,
    label: SETTORE_ALTRO_LABEL,
    matched: false,
    preset: null,
  };
}

/**
 * Normalize Ally brief settore field to a canonical user-facing label.
 * EXISTING values are left as-is (legacy display compatibility).
 * EXPLICIT / WEBSITE / INFERRED new writes: catalog label or Altro only.
 * Original free-form wording must live in elevatorPitch / brief, not settore.
 */
export function canonicalizeAllyBriefSettore(
  raw: string | null | undefined,
  provenance: string,
): { value: string | null; note?: string; discardedFreeForm?: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { value: null };
  }
  const trimmed = raw.trim().slice(0, 280);
  if (provenance === "EXISTING") {
    return { value: trimmed };
  }

  const match = matchCanonicalSettore(trimmed);
  if (match.matched) {
    return { value: match.label };
  }

  return {
    value: SETTORE_ALTRO_LABEL,
    note: "Settore fuori catalogo — Altro",
    discardedFreeForm: trimmed,
  };
}

export function legacySettoreStillRenderable(raw: string): boolean {
  // Any non-empty persisted string remains displayable; match is optional.
  return raw.trim().length > 0;
}

/**
 * NEW-WRITE only: resolve typed/selected text to a catalog label or Altro.
 * Never returns arbitrary free-form as the committed settore value.
 */
export function resolveSettoreLabelForNewWrite(
  raw: string | null | undefined,
): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return "";
  const match = matchCanonicalSettore(text);
  return match.matched ? match.label : SETTORE_ALTRO_LABEL;
}

export function isCanonicalSettoreLabelOrAltro(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (t === SETTORE_ALTRO_LABEL) return true;
  return SETTORI_PRESETS.some((p) => p.nome === t || p.id === t);
}
