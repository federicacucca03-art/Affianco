"use client";

import type { GuidanceItem, GuidanceLevel } from "@/lib/guidance";

/**
 * Placement helpers for Step 1 inline UX.
 * Do not change quality rules — only pick existing GuidanceItem.
 */
export const IDS_GUIDANCE_INLINE_OFFERTA = [
  "step1-offerta-generica",
  "step1-offerta-poco-chiara",
] as const;

export const ID_GUIDANCE_INLINE_BRIEF = "step1-brief-corto";
export const ID_GUIDANCE_INLINE_MISMATCH = "step1-mismatch";
export const ID_GUIDANCE_INLINE_ETA = "step1-eta-ampia";
export const ID_GUIDANCE_INLINE_CITTA = "step1-citta-assente";
export const ID_GUIDANCE_INLINE_TARGET_TYPE = "step1-target-type-mismatch";
export const ID_GUIDANCE_INLINE_RAGGIO = "targeting-raggio-stretto";
export const ID_GUIDANCE_INLINE_BUDGET_RAGGIO = "targeting-budget-raggio";

const IDS_INLINE_STEP1 = new Set<string>([
  ...IDS_GUIDANCE_INLINE_OFFERTA,
  ID_GUIDANCE_INLINE_BRIEF,
  ID_GUIDANCE_INLINE_MISMATCH,
  ID_GUIDANCE_INLINE_ETA,
  ID_GUIDANCE_INLINE_CITTA,
  ID_GUIDANCE_INLINE_TARGET_TYPE,
  ID_GUIDANCE_INLINE_RAGGIO,
  ID_GUIDANCE_INLINE_BUDGET_RAGGIO,
]);

function primoPerId(
  items: GuidanceItem[],
  ids: readonly string[],
): GuidanceItem | undefined {
  return items.find((item) => ids.includes(item.id));
}

export function guidanceInlineOfferta(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return primoPerId(items, IDS_GUIDANCE_INLINE_OFFERTA);
}

/** Mismatch ha priorità sulla guidance di qualità del brief. */
export function guidanceInlineBrief(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return (
    primoPerId(items, [ID_GUIDANCE_INLINE_MISMATCH]) ??
    primoPerId(items, [ID_GUIDANCE_INLINE_BRIEF])
  );
}

export function guidanceInlineEta(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return primoPerId(items, [ID_GUIDANCE_INLINE_ETA]);
}

export function guidanceInlineCitta(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return primoPerId(items, [ID_GUIDANCE_INLINE_CITTA]);
}

export function guidanceInlineTargetType(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return primoPerId(items, [ID_GUIDANCE_INLINE_TARGET_TYPE]);
}

export function guidanceInlineRaggio(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return primoPerId(items, [ID_GUIDANCE_INLINE_RAGGIO]);
}

export function guidanceInlineBudgetRaggio(
  items: GuidanceItem[],
): GuidanceItem | undefined {
  return primoPerId(items, [ID_GUIDANCE_INLINE_BUDGET_RAGGIO]);
}

export function guidanceStep1NonInline(
  items: GuidanceItem[],
): GuidanceItem[] {
  return items.filter((item) => !IDS_INLINE_STEP1.has(item.id));
}

const STILE_INLINE: Record<
  GuidanceLevel,
  { wrap: string; label: string }
> = {
  INFO: {
    wrap: "bg-[var(--primary-soft)]",
    label: "text-[var(--primary)]",
  },
  SUGGESTION: {
    wrap: "bg-[var(--lavender-muted)]",
    label: "text-[var(--primary)]",
  },
  WARNING: {
    wrap: "bg-[var(--yellow-soft)]/85",
    label: "text-[#6b5420]",
  },
  BLOCKER: {
    wrap: "bg-[#fde5ee]",
    label: "text-[#a85a72]",
  },
};

type InlineGuidanceProps = {
  item?: GuidanceItem | null;
  level?: GuidanceLevel;
  title?: string;
  description?: string;
  actionLabel?: string;
};

export function InlineGuidance({
  item,
  level,
  title,
  description,
}: InlineGuidanceProps) {
  const livello = item?.level ?? level;
  const titolo = item?.title ?? title;
  const testo = item?.description ?? description;
  if (!livello || !titolo || !testo) return null;

  const stile = STILE_INLINE[livello];

  return (
    <div
      data-affianco-inline-guidance={item?.id ?? livello}
      className={`mt-2 w-full min-w-0 rounded-[16px] px-3.5 py-2.5 ${stile.wrap}`}
      role="status"
    >
      <p
        className={`text-[12px] font-medium ${stile.label}`}
      >
        Affianco suggerisce
      </p>
      <p className="mt-1 text-sm font-medium leading-snug text-[var(--ink)]">
        {titolo}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
        {testo}
      </p>
    </div>
  );
}
