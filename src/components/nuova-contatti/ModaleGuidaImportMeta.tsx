"use client";

type Props = {
  aperta: boolean;
  onChiudi: () => void;
};

const STEP = [
  "Apri il tuo Meta Ads Manager e seleziona l'account del cliente.",
  "In alto a sinistra, clicca sull'icona delle tre barrette / tasto «Importa».",
  "Seleziona «Importa file in blocco», carica il file .csv appena scaricato e clicca «Importa».",
];

export function ModaleGuidaImportMeta({ aperta, onChiudi }: Props) {
  if (!aperta) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guida-import-meta-title"
      onClick={onChiudi}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Anti-Fuffa · Import
        </p>
        <h2
          id="guida-import-meta-title"
          className="mt-1 text-lg font-medium tracking-tight text-[var(--ink)]"
        >
          Come importare la bozza in Ads Manager
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Il file CSV è in download. Completa identità, creatività e dettagli
          Meta in Ads Manager prima di pubblicare.
        </p>

        <ol className="mt-5 space-y-3">
          {STEP.map((testo, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-3.5 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
                {i + 1}
              </span>
              <p className="text-sm leading-snug text-[var(--ink)]">{testo}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col gap-2.5">
          <a
            href="https://adsmanager.facebook.com"
            target="_blank"
            rel="noreferrer"
            className="aff-btn-primary w-full"
          >
            Capito, vai ad Ads Manager
          </a>
          <button
            type="button"
            onClick={onChiudi}
            className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
