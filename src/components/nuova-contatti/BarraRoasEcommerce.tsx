"use client";

type Props = {
  breakEvenRoas: number;
  targetRoas: number;
  /** ROAS di riferimento mostrato (es. target). */
  roasRiferimento?: number;
};

/**
 * Indicatore ROAS minimo: rosso sotto break-even, arancio fino al target, verde oltre.
 */
export function BarraRoasEcommerce({
  breakEvenRoas,
  targetRoas,
  roasRiferimento,
}: Props) {
  if (breakEvenRoas <= 0 || targetRoas <= 0) return null;

  const maxScala = Math.max(targetRoas * 1.15, breakEvenRoas * 1.4, 1);
  const rossoPct = Math.min(100, (breakEvenRoas / maxScala) * 100);
  const arancioPct = Math.min(
    100 - rossoPct,
    Math.max(0, ((targetRoas - breakEvenRoas) / maxScala) * 100),
  );
  const verdePct = Math.max(0, 100 - rossoPct - arancioPct);
  const cursore =
    roasRiferimento != null && roasRiferimento > 0
      ? Math.min(100, (roasRiferimento / maxScala) * 100)
      : null;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Indicatore ROAS minimo
      </p>
      <div className="relative">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-[#EEF0F3]"
          role="img"
          aria-label={`Break-even ROAS ${breakEvenRoas}x, target ${targetRoas}x`}
        >
          <div
            className="h-full bg-[#C45C4A] transition-all"
            style={{ width: `${rossoPct}%` }}
            title={`Perdita: ROAS < ${breakEvenRoas}x`}
          />
          <div
            className="h-full bg-[#E6A817] transition-all"
            style={{ width: `${arancioPct}%` }}
            title={`Pareggio: ${breakEvenRoas}x – ${targetRoas}x`}
          />
          <div
            className="h-full bg-[#3D8B57] transition-all"
            style={{ width: `${verdePct}%` }}
            title={`Utile target: ROAS ≥ ${targetRoas}x`}
          />
        </div>
        {cursore != null ? (
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-[var(--ink)]"
            style={{ left: `calc(${cursore}% - 1px)` }}
            title={`ROAS target ${roasRiferimento}x`}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--ink)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#C45C4A]" />
          Rosso · ROAS &lt; {breakEvenRoas}x (perdita)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#E6A817]" />
          Arancione · fino a {targetRoas}x (pareggio)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3D8B57]" />
          Verde · ≥ {targetRoas}x (utile target)
        </span>
      </div>
    </div>
  );
}
