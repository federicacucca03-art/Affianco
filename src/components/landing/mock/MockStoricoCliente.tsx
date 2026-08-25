import { MockBrowser } from "@/components/landing/mock/MockBrowser";

const STORICO = [
  { nome: "Prima visita", cpl: 18 },
  { nome: "Implantologia", cpl: 22 },
  { nome: "Invisalign", cpl: 26 },
];

export function MockStoricoCliente() {
  return (
    <MockBrowser titolo="affianco.app/clienti">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
          SR
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">
            Studio Dentistico Rossi
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Dentista · Milano · Lead generation
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Campagne", valore: "7" },
          { label: "CPL medio storico", valore: "€21" },
          { label: "CPL target medio", valore: "€25" },
          { label: "Creatività migliore", valore: "Video testimonial" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-[var(--surface-hover)] px-3 py-2.5"
          >
            <p className="text-[10px] text-[var(--ink-muted)]">{item.label}</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">
              {item.valore}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          Storico campagne
        </p>
        <ul className="mt-2 space-y-2">
          {STORICO.map((campagna) => (
            <li
              key={campagna.nome}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
            >
              <span className="font-medium text-[var(--ink)]">
                {campagna.nome}
              </span>
              <span className="text-[var(--ink-muted)]">€{campagna.cpl} CPL</span>
            </li>
          ))}
        </ul>
      </div>
    </MockBrowser>
  );
}
