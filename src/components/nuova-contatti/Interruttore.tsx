"use client";

type Props = {
  attivo: boolean;
  onCambia: (attivo: boolean) => void;
  etichetta: string;
  descrizione?: string;
};

export function Interruttore({
  attivo,
  onCambia,
  etichetta,
  descrizione,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--ink)]">{etichetta}</p>
        {descrizione ? (
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{descrizione}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={attivo}
        onClick={() => onCambia(!attivo)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          attivo ? "bg-[var(--accent)]" : "bg-[#d1d5db]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            attivo ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
