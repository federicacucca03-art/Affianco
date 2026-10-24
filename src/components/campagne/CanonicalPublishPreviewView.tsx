"use client";

import { useState } from "react";
import type { CanonicalPublishPreview } from "@/lib/meta/write/canonical-publish-preview";

type Props = {
  preview: CanonicalPublishPreview;
  /**
   * P0.16.3 — Raw CanonicalPublishPreview.blockers/warnings are a legacy
   * compatibility dump (often duplicate / wrong-matched messages like
   * “Collega Meta…”). User-facing issues belong to Pre-write Guardian only.
   * Keep false whenever this view sits above CanonicalCampaignReviewPanel.
   */
  showLegacyIssueLists?: boolean;
};

/**
 * P0.2 — Easy Mode “Ecco cosa Ally creerà su Meta” + expandable Pro details.
 * P0.16.3 — Does not own the blocker UX; Guardian does.
 */
export function CanonicalPublishPreviewView({
  preview,
  showLegacyIssueLists = false,
}: Props) {
  const [openReason, setOpenReason] = useState<string | null>(null);
  const [showTech, setShowTech] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-medium text-[var(--ink)]">
          {preview.headlineIt}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
          {preview.publishAllowed
            ? "Configurazione pronta per la creazione su Meta (sempre in pausa)."
            : "Completa i controlli Guardian sotto prima di creare su Meta."}
        </p>
      </div>

      {preview.sections.map((section) => (
        <div key={section.id} className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
            {section.titleIt}
          </p>
          <ul className="space-y-1">
            {section.fields
              .filter((f) => {
                // Easy Mode: hide pure technical / empty optional noise
                if (f.key === "adset.promoted_object") return false;
                if (f.key === "adset.destination_type") return false;
                if (f.key === "adset.attribution") return false;
                if (f.key === "creative.utm") return false;
                // Instant Form: show form name in Easy Mode; hide conversion event noise.
                if (
                  f.key === "adset.conversion_event" &&
                  (f.valueIt === "—" || f.valueIt.includes("consigliato"))
                ) {
                  return false;
                }
                if (
                  f.key === "creative.multi_copy" &&
                  f.supportStatus === "SUPPORTED" &&
                  f.valueIt === "Nessuno"
                ) {
                  return false;
                }
                if (
                  f.key === "creative.carousel" &&
                  f.supportStatus === "SUPPORTED"
                ) {
                  return false;
                }
                return true;
              })
              .map((f) => {
                const mark =
                  f.supportStatus === "BLOCKED"
                    ? "!"
                    : f.supportStatus === "NOT_YET_PUBLISHABLE"
                      ? "…"
                      : "✓";
                const reasonId = f.key;
                return (
                  <li
                    key={f.key}
                    className="rounded-[8px] border border-[var(--border)] px-2.5 py-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-[var(--ink)]">
                          <span className="text-[var(--ink-muted)]">{mark}</span>{" "}
                          <span className="font-medium">{f.labelIt}</span>
                          {": "}
                          {f.valueIt}
                        </p>
                        {f.supportStatus === "NOT_YET_PUBLISHABLE" ? (
                          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                            Non ancora pubblicabile su Meta in questo percorso.
                          </p>
                        ) : null}
                      </div>
                      {f.reason ? (
                        <button
                          type="button"
                          className="shrink-0 text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
                          onClick={() =>
                            setOpenReason((cur) =>
                              cur === reasonId ? null : reasonId,
                            )
                          }
                        >
                          Perché?
                        </button>
                      ) : null}
                    </div>
                    {openReason === reasonId && f.reason ? (
                      <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                        {f.reason.reasonText}
                      </p>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      {showLegacyIssueLists && preview.blockers.length > 0 ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50/50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-red-800">
            Blocchi
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-red-900">
            {preview.blockers.map((b) => (
              <li key={b.code}>{b.messageIt}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showLegacyIssueLists && preview.warnings.length > 0 ? (
        <div className="rounded-[8px] border border-[var(--border)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
            Avvisi
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-[var(--ink)]">
            {preview.warnings.map((w) => (
              <li key={w.code}>{w.messageIt}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="text-[12px] font-medium text-[var(--ink)] underline-offset-2 hover:underline"
          onClick={() => setShowTech((v) => !v)}
        >
          {showTech ? "Nascondi dettagli avanzati" : "Dettagli avanzati"}
        </button>
        {showTech ? (
          <dl className="mt-2 space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-muted,#f7f7f5)] p-3 text-[12px] leading-relaxed">
            {(
              [
                ["Obiettivo Meta", preview.technicalDetails.metaObjective],
                [
                  "Ottimizzazione",
                  preview.technicalDetails.optimizationGoal,
                ],
                ["Destinazione", preview.technicalDetails.destinationType],
                [
                  "Conversion location",
                  preview.technicalDetails.conversionLocation,
                ],
                [
                  "Pubblico Advantage+",
                  preview.technicalDetails.advantageAudience
                    ? "Sì"
                    : "No",
                ],
                [
                  "Posizionamenti",
                  preview.technicalDetails.placementsMode,
                ],
                ["Fatturazione", preview.technicalDetails.billingEvent],
                ["Strategia offerta", preview.technicalDetails.bidStrategy],
                ["Stato iniziale", preview.technicalDetails.status],
                [
                  "Pubblicazione consentita",
                  preview.publishAllowed ? "Sì" : "No",
                ],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt className="font-medium text-[var(--ink-muted)]">
                    {label}
                  </dt>
                  <dd className="text-[var(--ink)]">{String(value)}</dd>
                </div>
              ) : null,
            )}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
