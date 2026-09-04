import type { ReactNode } from "react";

type Variant = "default" | "compact" | "subtle";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  as?: "section" | "div" | "article";
};

const VARIANT: Record<Variant, string> = {
  default: "aff-panel-white",
  compact: "aff-panel-white p-4",
  subtle: "rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--lavender-muted)]/40",
};

export function AllyPanel({
  children,
  className = "",
  variant = "default",
  as: Tag = "section",
}: Props) {
  return (
    <Tag className={`${VARIANT[variant]} ${className}`.trim()}>{children}</Tag>
  );
}
