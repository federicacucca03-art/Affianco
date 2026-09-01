"use client";

import type { CopyRecommendation } from "@/lib/raccomanda-copy";

export function CopyRecommendationCard({
  recommendation,
}: {
  recommendation: CopyRecommendation | null;
}) {
  if (!recommendation) return null;

  return (
    <section
      data-affianco-copy-recommendation
      className="rounded-lg border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-4 py-3"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
        Affianco consiglia
      </p>
      <p className="mt-1 text-base font-medium leading-snug text-[var(--ink)]">
        {recommendation.title}
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-[var(--ink-muted)]">
        {recommendation.description}
      </p>
      {recommendation.reasons.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {recommendation.reasons.slice(0, 3).map((motivo) => (
            <li
              key={motivo}
              className="text-xs leading-relaxed text-[var(--ink)]"
            >
              ✓ {motivo}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function BadgeCopyVariant({
  status,
}: {
  status: "RECOMMENDED" | "ALTERNATIVE" | "REVIEW" | null;
}) {
  if (!status) return null;
  const etichetta =
    status === "RECOMMENDED"
      ? "Consigliata"
      : status === "ALTERNATIVE"
        ? "Alternativa"
        : "Da rivedere";
  const stile =
    status === "RECOMMENDED"
      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
      : status === "ALTERNATIVE"
        ? "bg-[var(--surface-hover)] text-[var(--ink-muted)]"
        : "bg-[#fff4f0] text-[#c2410c]";
  return (
    <span
      data-affianco-copy-badge={status}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stile}`}
    >
      {etichetta}
    </span>
  );
}
