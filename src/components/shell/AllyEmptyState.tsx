import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function AllyEmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = "",
}: Props) {
  return (
    <div className={`aff-empty ${className}`.trim()}>
      {Icon ? (
        <span className="aff-icon-wrap mb-3" aria-hidden>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      ) : null}
      <p className="aff-empty__title">{title}</p>
      {description ? <p className="aff-empty__body">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
