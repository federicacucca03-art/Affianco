import { MockBrowser } from "@/components/landing/mock/MockBrowser";

type RigaCliente = {
  iniziali: string;
  nome: string;
  cplAttuale: number;
  cplTarget: number;
  stato: "ok" | "attenzione";
  statoLabel: string;
};

const CLIENTI: RigaCliente[] = [
  {
    iniziali: "SR",
    nome: "Studio Dentistico Rossi",
    cplAttuale: 18,
    cplTarget: 25,
    stato: "ok",
    statoLabel: "Nella norma",
  },
  {
    iniziali: "CF",
    nome: "Centro Fitness Milano",
    cplAttuale: 29,
    cplTarget: 24,
    stato: "attenzione",
    statoLabel: "Richiede attenzione",
  },
  {
    iniziali: "AB",
    nome: "Autoscuola Bianchi",
    cplAttuale: 14,
    cplTarget: 22,
    stato: "ok",
    statoLabel: "Nella norma",
  },
];

function StatoDot({ stato }: { stato: RigaCliente["stato"] }) {
  const color =
    stato === "ok" ? "bg-[#3D8B57]" : "bg-[#C45C5C]";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
      aria-hidden
    />
  );
}

export function MockDashboardHero() {
  return (
    <MockBrowser titolo="affianco.app/campagne">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
            Control room
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">
            I tuoi clienti attivi
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-[10px] text-[var(--ink-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3D8B57]" />
            6 ok
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C45C5C]" />
            1 att.
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {CLIENTI.map((cliente) => (
          <li
            key={cliente.nome}
            className="flex items-center gap-3 rounded-xl bg-[var(--surface-hover)] px-3 py-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-medium text-[var(--accent)]">
              {cliente.iniziali}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--ink)]">
                {cliente.nome}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                CPL attuale: €{cliente.cplAttuale} · CPL target: €
                {cliente.cplTarget}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatoDot stato={cliente.stato} />
              <span
                className={`hidden text-[10px] font-medium sm:inline ${
                  cliente.stato === "ok" ? "text-[#3D8B57]" : "text-[#C45C5C]"
                }`}
              >
                {cliente.statoLabel}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </MockBrowser>
  );
}
