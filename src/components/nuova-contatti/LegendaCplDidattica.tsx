/** Legenda interpretativa — guida visiva, non calcolo automatico. */
export function LegendaCplDidattica() {
  return (
    <ul className="mt-4 space-y-2 border-t border-[#c6e7c8] pt-4 text-xs leading-relaxed text-[var(--ink-muted)]">
      <li className="flex gap-2">
        <span className="shrink-0" aria-hidden>
          🟢
        </span>
        <span>
          Sotto il CPL target → situazione economicamente sana rispetto alla
          soglia definita
        </span>
      </li>
      <li className="flex gap-2">
        <span className="shrink-0" aria-hidden>
          🟡
        </span>
        <span>Vicino al CPL target → da monitorare</span>
      </li>
      <li className="flex gap-2">
        <span className="shrink-0" aria-hidden>
          🔴
        </span>
        <span>
          Sopra il break-even → situazione critica rispetto alla soglia
          economica
        </span>
      </li>
    </ul>
  );
}
