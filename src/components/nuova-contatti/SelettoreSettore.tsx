"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { suggerisciSettori, type SuggerimentoSettore } from "@/lib/sector-intel";
import {
  matchCanonicalSettore,
  resolveSettoreLabelForNewWrite,
} from "@/lib/settore-canonico";
import { SETTORE_ALTRO_LABEL } from "@/data/settoriPresets";

type Props = {
  value: string;
  onChange: (valore: string) => void;
  onSeleziona: (suggerimento: SuggerimentoSettore) => void;
  placeholder?: string;
  inputClassName: string;
  disabled?: boolean;
};

export function SelettoreSettore({
  value,
  onChange,
  onSeleziona,
  placeholder,
  inputClassName,
  disabled,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [aperto, setAperto] = useState(false);
  const [indice, setIndice] = useState(0);
  /** Draft while typing to search/filter — committed value is always canonical. */
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const suggerimenti = useMemo(
    () => suggerisciSettori(draft, 8),
    [draft],
  );

  useEffect(() => {
    setIndice(0);
  }, [draft, aperto]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setAperto(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commitResolved(raw: string) {
    const label = resolveSettoreLabelForNewWrite(raw);
    if (!label) {
      onChange("");
      setDraft("");
      return;
    }
    const match = matchCanonicalSettore(label);
    onChange(label);
    setDraft(label);
    onSeleziona({
      id: match.matched ? match.id : "altro",
      nome: label,
      macroCategoria: match.preset?.macroCategoria ?? "B2B/Professionisti",
      score: match.matched ? 100 : 0,
    });
  }

  function scegli(item: SuggerimentoSettore) {
    onSeleziona(item);
    onChange(item.nome);
    setDraft(item.nome);
    setAperto(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={aperto}
          aria-controls={listId}
          aria-autocomplete="list"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={`${inputClassName} pr-10`}
          onFocus={() => setAperto(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            setAperto(true);
          }}
          onBlur={() => {
            // Commit canonical (or Altro) — typing alone never persists free-form.
            commitResolved(draft);
            setAperto(false);
          }}
          onKeyDown={(e) => {
            if (!aperto && (e.key === "ArrowDown" || e.key === "Enter")) {
              setAperto(true);
              return;
            }
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
            if (e.key === "Enter") {
              e.preventDefault();
              if (aperto && suggerimenti[indice]) {
                scegli(suggerimenti[indice]);
              } else {
                commitResolved(draft);
                setAperto(false);
              }
            }
          }}
        />
        <ChevronsUpDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          aria-hidden
        />
      </div>
      {aperto ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-soft)]"
        >
          {suggerimenti.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-[var(--ink-muted)]">
              Nessuna corrispondenza nel catalogo — alla conferma useremo «
              {SETTORE_ALTRO_LABEL}».
            </li>
          ) : (
            suggerimenti.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === indice}>
                <button
                  type="button"
                  className={`flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left text-sm ${
                    i === indice
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                  }`}
                  onMouseEnter={() => setIndice(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => scegli(s)}
                >
                  <span className="font-medium">{s.nome}</span>
                  <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
                    {s.macroCategoria}
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
