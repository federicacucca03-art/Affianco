import { MockBrowser } from "@/components/landing/mock/MockBrowser";
import { StatoChip } from "@/components/nuova-contatti/StatoChip";

const CONTROLLI = [
  { titolo: "Offerta e brief", stato: "ok" as const, label: "OK" },
  { titolo: "Targeting", stato: "ok" as const, label: "OK" },
  { titolo: "Copy", stato: "ok" as const, label: "OK" },
  { titolo: "Creatività", stato: "ok" as const, label: "OK" },
  {
    titolo: "Coerenza creatività",
    stato: "watch" as const,
    label: "Da verificare",
  },
];

/** Illustrative pre-launch diagnosis mock — technical OK vs semantic tip. */
export function MockPreLancio() {
  return (
    <MockBrowser titolo="Pre-lancio">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
        Controllo prima di spendere
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatoChip kind="ok" label="5 controlli OK" />
        <StatoChip kind="watch" label="1 consiglio" />
        <StatoChip kind="critico" label="0 da correggere" />
      </div>

      <ul className="mt-4 space-y-2">
        {CONTROLLI.map((c) => (
          <li
            key={c.titolo}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5"
          >
            <span className="text-sm text-[var(--ink)]">{c.titolo}</span>
            <StatoChip kind={c.stato} label={c.label} />
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
        Creatività tecnica e coerenza semantica restano controlli separati. Un
        consiglio non blocca il lancio.
      </p>
    </MockBrowser>
  );
}
