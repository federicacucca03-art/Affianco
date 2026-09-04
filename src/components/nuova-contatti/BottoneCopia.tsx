"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  valore: string;
  etichetta?: string;
};

export function BottoneCopia({ valore, etichetta = "Copia" }: Props) {
  const [copiato, setCopiato] = useState(false);

  async function copia() {
    try {
      await navigator.clipboard.writeText(valore);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 2000);
    } catch {
      // Fallback silenzioso se clipboard non disponibile.
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copia();
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all ${
        copiato
          ? "aff-btn-secondary border-[var(--ally-success)] text-[var(--ally-success)]"
          : "border-[var(--border)] bg-white text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
      title={copiato ? "Copiato!" : `Copia: ${valore}`}
    >
      {copiato ? (
        <>
          <Check className="h-3 w-3" strokeWidth={2} />
          Copiato!
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" strokeWidth={1.75} />
          {etichetta}
        </>
      )}
    </button>
  );
}
