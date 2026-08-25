type Props = {
  eyebrow?: string;
  titolo: React.ReactNode;
  descrizione?: React.ReactNode;
  allineamento?: "sinistra" | "centro";
  className?: string;
};

export function LandingSectionHeader({
  eyebrow,
  titolo,
  descrizione,
  allineamento = "sinistra",
  className = "",
}: Props) {
  const centered = allineamento === "centro";

  return (
    <header className={`${centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`${eyebrow ? "mt-3" : ""} text-3xl font-medium tracking-tight text-[var(--ink)] sm:text-4xl`}
      >
        {titolo}
      </h2>
      {descrizione ? (
        <p className="mt-4 text-base leading-relaxed text-[var(--ink-muted)]">
          {descrizione}
        </p>
      ) : null}
    </header>
  );
}
