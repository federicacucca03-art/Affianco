"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { suggerisciSettori, type SuggerimentoSettore } from "@/lib/sector-intel";
import {
  matchCanonicalSettore,
  resolveSettoreLabelForNewWrite,
} from "@/lib/settore-canonico";
import {
  MACRO_CATEGORIE,
  SETTORE_ALTRO_LABEL,
  type MacroCategoria,
} from "@/data/settoriPresets";

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

  /** Full catalog when empty; scored matches when searching (no popular-8 cap). */
  const suggerimenti = useMemo(() => suggerisciSettori(draft), [draft]);
  const browseVuoto = !draft.trim();

  const gruppiBrowse = useMemo(() => {
    if (!browseVuoto) return null;
    const byMacro = new Map<MacroCategoria, SuggerimentoSettore[]>();
    for (const s of suggerimenti) {
      const list = byMacro.get(s.macroCategoria) ?? [];
      list.push(s);
      byMacro.set(s.macroCategoria, list);
    }
    return MACRO_CATEGORIE.map((macro) => ({
      macro,
      items: byMacro.get(macro) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [browseVuoto, suggerimenti]);

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

  function renderOption(s: SuggerimentoSettore, i: number) {
    return (
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
          {!browseVuoto ? (
            <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
              {s.macroCategoria}
            </span>
          ) : null}
        </button>
      </li>
    );
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
              setIndice((i) =>
                Math.min(Math.max(0, suggerimenti.length - 1), i + 1),
              );
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
          className="absolute z-30 mt-1 max-h-[min(24rem,50vh)] w-full overflow-auto rounded-xl border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-soft)]"
        >
          {suggerimenti.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-[var(--ink-muted)]">
              Nessuna corrispondenza nel catalogo — alla conferma useremo «
              {SETTORE_ALTRO_LABEL}».
            </li>
          ) : gruppiBrowse ? (
            (() => {
              let flat = 0;
              return gruppiBrowse.map((g) => (
                <Fragment key={g.macro}>
                  <li
                    role="presentation"
                    className="sticky top-0 z-10 bg-[var(--lavender-muted)] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]"
                  >
                    {g.macro}
                  </li>
                  {g.items.map((s) => {
                    const i = flat;
                    flat += 1;
                    return renderOption(s, i);
                  })}
                </Fragment>
              ));
            })()
          ) : (
            suggerimenti.map((s, i) => renderOption(s, i))
          )}
        </ul>
      ) : null}
    </div>
  );
}
