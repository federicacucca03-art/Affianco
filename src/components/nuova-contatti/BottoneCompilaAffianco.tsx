"use client";

type Props = {
  className?: string;
};

const TOOLTIP =
  "Presto Affianco potrà precompilare i campi dal brief.";

/** CTA placeholder — nessuna logica AI collegata per ora. */
export function BottoneCompilaAffianco({ className = "" }: Props) {
  return (
    <button
      type="button"
      disabled
      title={TOOLTIP}
      aria-label={`Compila con Affianco. ${TOOLTIP}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] opacity-70 cursor-not-allowed ${className}`}
    >
      ✨ Compila con Affianco
    </button>
  );
}
