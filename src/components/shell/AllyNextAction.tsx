import Link from "next/link";

type Props = {
  title: string;
  reason?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  /** Defaults to Home Control Room copy. */
  eyebrow?: string;
  className?: string;
};

/** Compact “Prossimo passo” — visual source of truth from Home Control Room. */
export function AllyNextAction({
  title,
  reason,
  ctaLabel,
  ctaHref,
  eyebrow = "Prossimo passo",
  className = "",
}: Props) {
  return (
    <div className={`aff-next-action ${className}`.trim()}>
      <p className="aff-next-action__eyebrow">{eyebrow}</p>
      <p className="aff-next-action__title">{title}</p>
      {reason ? <p className="aff-next-action__reason">{reason}</p> : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className="aff-next-action__cta">
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
