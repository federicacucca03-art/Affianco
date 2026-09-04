"use client";

import { useState } from "react";
import type { CopyRecommendation, CopyVariantId } from "@/lib/raccomanda-copy";
import { ctaUsaVariantePrimaria } from "@/lib/raccomanda-copy";

export function CopyRecommendationCard({
  recommendation,
  onUsaVariante,
}: {
  recommendation: CopyRecommendation | null;
  onUsaVariante?: (variante: Exclude<CopyVariantId, "A">) => void;
}) {
  const [conferma, setConferma] = useState<Exclude<CopyVariantId, "A"> | null>(
    null,
  );
  const [feedback, setFeedback] = useState(false);

  if (!recommendation) return null;

  const azioni = onUsaVariante ? ctaUsaVariantePrimaria(recommendation) : [];

  function chiediConferma(variante: Exclude<CopyVariantId, "A">) {
    setFeedback(false);
    setConferma(variante);
  }

  function applica() {
    if (!conferma || !onUsaVariante) return;
    const scelta = conferma;
    onUsaVariante(scelta);
    setConferma(null);
    setFeedback(true);
  }

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

      {feedback ? (
        <p
          data-affianco-swap-feedback
          className="mt-2 text-xs leading-relaxed text-[var(--accent)]"
        >
          Variante impostata come principale.
        </p>
      ) : null}

      {conferma ? (
        <div
          data-affianco-swap-confirm={conferma}
          className="mt-3 rounded-md border border-[var(--accent-muted)] bg-white px-3 py-2.5"
        >
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            Vuoi impostare la Variante {conferma} come testo principale?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
            Il testo attualmente usato per il lancio resterà disponibile come
            alternativa.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConferma(null)}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
            >
              Annulla
            </button>
            <button
              type="button"
              data-affianco-swap-confirm-apply
              onClick={applica}
              className="aff-btn-primary min-h-8 px-3 text-xs"
            >
              Usa Variante {conferma}
            </button>
          </div>
        </div>
      ) : azioni.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {azioni.map((variante) => (
            <button
              key={variante}
              type="button"
              data-affianco-usa-variante={variante}
              onClick={() => chiediConferma(variante)}
              className="rounded-full border border-[var(--accent)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
            >
              {azioni.length === 1 &&
              recommendation.recommendedVariants.length === 1
                ? "Usa questa variante"
                : `Usa Variante ${variante}`}
            </button>
          ))}
        </div>
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
        : "aff-badge aff-badge--danger aff-badge--pill";
  return (
    <span
      data-affianco-copy-badge={status}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stile}`}
    >
      {etichetta}
    </span>
  );
}
