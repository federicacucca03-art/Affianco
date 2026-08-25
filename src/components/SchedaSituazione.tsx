import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { Situazione } from "@/types/campagne";

export type ColoreSituazione = {
  fondo: string;
  icona: string;
};

type Props = {
  situazione: Situazione;
  icona: LucideIcon;
  colore?: ColoreSituazione;
  href?: string;
  onClick?: () => void;
  /** false = "IN ARRIVO" (opacity + no click); true = "ATTIVO" + link. */
  attiva?: boolean;
  /** Override testo badge da config scheda. */
  badge?: "ATTIVO" | "IN ARRIVO";
};

const coloreFallback: ColoreSituazione = {
  fondo: "#E8F0FE",
  icona: "#2F6FED",
};

const TOOLTIP_IN_ARRIVO =
  "Disponibile nelle prossime versioni. Attualmente sono attivi Lead Generation, Prenotazioni e Vendite Online.";

export function SchedaSituazione({
  situazione,
  icona: Icona,
  colore = coloreFallback,
  href,
  onClick,
  attiva = false,
  badge,
}: Props) {
  const testoBadge = badge ?? (attiva ? "ATTIVO" : "IN ARRIVO");

  const contenuto = (
    <>
      {attiva ? (
        <span className="absolute top-2.5 right-2.5 z-10 rounded-md bg-[#E8F0FE] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2F6FED]">
          {testoBadge}
        </span>
      ) : (
        <span className="absolute top-2.5 right-2.5 z-10 rounded-md bg-[#EEF0F3] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">
          {testoBadge}
        </span>
      )}
      <span
        aria-hidden
        className="flex aspect-[4/3] w-full items-center justify-center"
        style={{ backgroundColor: colore.fondo }}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70">
          <Icona
            className="h-6 w-6"
            style={{ color: colore.icona }}
            strokeWidth={1.75}
          />
        </span>
      </span>
      <div className="flex flex-1 flex-col px-3.5 py-3">
        <p className="text-sm font-medium leading-snug text-[var(--ink)]">
          {situazione.titolo}
        </p>
        <p className="mt-1 text-xs leading-snug text-[var(--ink-muted)]">
          {situazione.esempio}
        </p>
      </div>
    </>
  );

  // Solo schede non attive: opacity + no click.
  if (!attiva) {
    return (
      <div className="group relative h-full">
        <div
          className="pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-[var(--radius)] bg-white text-left opacity-60 shadow-[var(--shadow-soft)]"
          aria-disabled="true"
        >
          {contenuto}
        </div>
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-center text-[11px] leading-snug text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        >
          {TOOLTIP_IN_ARRIVO}
        </div>
      </div>
    );
  }

  const classiAttiva =
    "relative flex h-full w-full flex-col overflow-hidden rounded-[var(--radius)] border border-[#2F6FED]/35 bg-white text-left shadow-[var(--shadow-soft)] ring-1 ring-[#2F6FED]/10 transition-colors hover:bg-[var(--surface-hover)]";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classiAttiva}>
        {contenuto}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={classiAttiva}>
        {contenuto}
      </Link>
    );
  }

  return (
    <div className={`${classiAttiva} cursor-default`}>{contenuto}</div>
  );
}
