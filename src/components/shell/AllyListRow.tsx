import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

export function AllyListRow({
  title,
  meta,
  leading,
  trailing,
  href,
  onClick,
  className = "",
  children,
}: Props) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          {title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-[13.5px] leading-snug text-[var(--ink-muted)]">
            {meta}
          </p>
        ) : null}
        {children}
      </div>
      {trailing}
    </>
  );

  const classes = `aff-list-row ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
}
