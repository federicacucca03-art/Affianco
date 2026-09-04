type Props = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

export function AllyMetric({ label, value, hint, className = "" }: Props) {
  return (
    <div className={`aff-metric ${className}`.trim()}>
      <p className="aff-metric__label">{label}</p>
      <p className="aff-metric__value">{value}</p>
      {hint ? <p className="aff-metric__hint">{hint}</p> : null}
    </div>
  );
}
