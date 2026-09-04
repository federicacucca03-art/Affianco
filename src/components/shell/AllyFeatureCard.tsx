import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const STROKE_CARD = 1.85;

/** Home-approved gradient families only (aff-quick-card--1…4). */
export type AllyFeatureTone = 1 | 2 | 3 | 4;

type Props = {
  title: string;
  body: string;
  icon: LucideIcon;
  /** Maps to Home aff-quick-card--N / aff-card-icon--N only. */
  tone: AllyFeatureTone;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * Single shared feature card for Home quick actions and Campagne objectives.
 * Visual metrics are fixed in .aff-quick-card / .aff-card-icon — not overridable.
 */
export function AllyFeatureCard({
  title,
  body,
  icon: Icon,
  tone,
  href,
  onClick,
  disabled = false,
}: Props) {
  const classes = [
    "aff-quick-card",
    `aff-quick-card--${tone}`,
    "min-w-0",
    disabled ? "opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className={`aff-card-icon aff-card-icon--${tone}`}>
        <Icon className="h-7 w-7" strokeWidth={STROKE_CARD} />
      </span>
      <div>
        <p className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          {title}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--ink-muted)]">
          {body}
        </p>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className={classes} aria-disabled="true">
        {inner}
      </div>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return <div className={classes}>{inner}</div>;
}
