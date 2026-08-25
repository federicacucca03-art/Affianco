import { BarraBreakEven } from "@/components/nuova-contatti/BarraBreakEven";
import { EtichettaGiudizio } from "@/components/EtichettaGiudizio";
import { MockBrowser } from "@/components/landing/mock/MockBrowser";

export function MockEconomiaCard() {
  return (
    <MockBrowser titolo="affianco.app/campagne/nuova · Passo 2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
        Sostenibilità economica
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">
        Studio Dentistico Rossi
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { label: "Valore medio cliente", valore: "€1.000" },
          { label: "Tasso di chiusura", valore: "10%" },
          { label: "Margine", valore: "40%" },
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#c6e7c8] bg-[#f0faf1] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#3D8B57]">
            CPL target
          </p>
          <p className="mt-0.5 text-xl font-medium text-[var(--ink)]">€30</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5">
          <p className="text-[10px] text-[var(--ink-muted)]">CPL attuale</p>
          <p className="mt-0.5 text-xl font-medium text-[var(--ink)]">€18</p>
        </div>
      </div>

      <BarraBreakEven breakEven={50} targetProfitto={30} etichettaCosto="CPL" />

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#E8F5EE] px-3 py-2.5">
        <EtichettaGiudizio giudizio="Va bene" />
        <p className="text-xs font-medium text-[#3D8B57]">Campagna nella norma</p>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
        Il CPL target è una soglia economica di riferimento basata sui dati
        inseriti — non una previsione certa.
      </p>
    </MockBrowser>
  );
}
