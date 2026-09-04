export type AllyBadgeVariant =
  | "neutral"
  | "violet"
  | "success"
  | "warning"
  | "danger";

type Props = {
  children: React.ReactNode;
  variant?: AllyBadgeVariant;
  pill?: boolean;
  className?: string;
};

export function AllyBadge({
  children,
  variant = "neutral",
  pill = false,
  className = "",
}: Props) {
  return (
    <span
      className={`aff-badge aff-badge--${variant} ${
        pill ? "aff-badge--pill" : ""
      } ${className}`.trim()}
    >
      {children}
    </span>
  );
}
