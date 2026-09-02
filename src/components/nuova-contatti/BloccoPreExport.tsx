"use client";

import type { MetaExportValidation } from "@/lib/meta-export-readiness";
import {
  COPY_PROMESSA_EXPORT,
  COPY_SPIEGAZIONE_EXPORT,
  NOTE_PUBBLICO_EXPORT,
  testoStatoExport,
  vociPreExport,
} from "@/lib/meta-export-readiness";

type Props = {
  validation: MetaExportValidation;
  haNomeFileCreativita?: boolean;
  destinationUrl?: string;
};

export function BloccoPreExport({
  validation,
  haNomeFileCreativita,
  destinationUrl,
}: Props) {
  const voci = vociPreExport(validation, {
    haNomeFileCreativita,
    destinationUrl,
  });
  const badge = testoStatoExport(validation.status);

  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Controlla prima dell&apos;export
      </p>
      <p className="mt-1.5 text-sm font-medium text-[var(--ink)]">{badge}</p>
      {voci.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {voci.map((voce) => (
            <li
              key={`${voce.tone}-${voce.text}`}
              className="text-xs leading-relaxed text-[var(--ink-muted)]"
            >
              {voce.text}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2.5 text-xs leading-relaxed text-[var(--ink-muted)]">
        {COPY_SPIEGAZIONE_EXPORT}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
        {COPY_PROMESSA_EXPORT}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
        {NOTE_PUBBLICO_EXPORT}
      </p>
    </div>
  );
}
