"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Cliente } from "@/types/clienti";
import { cercaClienti, getClients } from "@/utils/clientStorage";

type Props = {
  onSeleziona: (cliente: Cliente) => void;
  clienteCaricatoId?: string | null;
};

export function SelettoreClienteEsistente({
  onSeleziona,
  clienteCaricatoId,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [aperto, setAperto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [lista, setLista] = useState<Cliente[]>([]);

  useEffect(() => {
    setLista(getClients());
  }, []);

  const suggerimenti = useMemo(
    () => (query.trim() ? cercaClienti(query, 8) : lista.slice(0, 8)),
    [query, lista],
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setAperto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (lista.length === 0) return null;

  const caricato = lista.find((c) => c.id === clienteCaricatoId);

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-1.5 text-xs font-medium text-[var(--ink-muted)]">
        📂 Carica da Cliente Esistente
      </p>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          aria-hidden
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={aperto}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder="Cerca per nome, settore o città…"
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]"
          onFocus={() => setAperto(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setAperto(true);
            setIndice(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setAperto(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndice((i) => Math.min(suggerimenti.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndice((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && aperto && suggerimenti[indice]) {
              e.preventDefault();
              onSeleziona(suggerimenti[indice]);
              setQuery(suggerimenti[indice].nome);
              setAperto(false);
            }
          }}
        />
      </div>
      {caricato ? (
        <p className="mt-1.5 text-xs text-[var(--accent)]">
          Profilo caricato: {caricato.nome}
          {caricato.citta ? ` · ${caricato.citta}` : ""}
        </p>
      ) : null}
      {aperto ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-soft)]"
        >
          {suggerimenti.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-[var(--ink-muted)]">
              Nessun cliente trovato.
            </li>
          ) : (
            suggerimenti.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === indice}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3.5 py-2 text-left ${
                    i === indice
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[var(--surface-hover)]"
                  }`}
                  onMouseEnter={() => setIndice(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSeleziona(c);
                    setQuery(c.nome);
                    setAperto(false);
                  }}
                >
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {c.nome}
                  </span>
                  <span className="text-xs text-[var(--ink-muted)]">
                    {[c.settore, c.citta].filter(Boolean).join(" · ") ||
                      "Scheda cliente"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
