"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useAllyLogout } from "@/components/auth/useAllyLogout";

const STROKE = 1.75;

function inizialiDaEmail(email: string | null): string {
  if (!email) return "?";
  const locale = email.split("@")[0] ?? "";
  const pulito = locale.replace(/[^a-zA-Z0-9]/g, "");
  if (pulito.length >= 2) return pulito.slice(0, 2).toUpperCase();
  if (pulito.length === 1) return `${pulito}X`.toUpperCase();
  return "AF";
}

function nomeDaEmail(email: string | null): string | null {
  if (!email) return null;
  const locale = (email.split("@")[0] ?? "").trim();
  if (!locale) return null;
  const part = locale.split(/[._-]/)[0] ?? locale;
  if (!part) return null;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/** Top-right account menu: Impostazioni + Esci (shared logout handler). */
export function ProfileMenu() {
  const { esci, logoutErrore, logoutInCorso, email } = useAllyLogout();
  const [aperto, setAperto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const firstName = nomeDaEmail(email);

  const chiudi = useCallback(() => setAperto(false), []);

  useEffect(() => {
    if (!aperto) return;

    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        chiudi();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        chiudi();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [aperto, chiudi]);

  async function onEsci() {
    chiudi();
    await esci();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white py-1.5 pl-1.5 pr-2.5 hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        title={email ?? undefined}
        aria-label={email ? `Account ${email}` : "Menu account"}
        aria-haspopup="menu"
        aria-expanded={aperto}
        aria-controls={menuId}
        onClick={() => setAperto((v) => !v)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ally-violet-soft)] text-[11px] font-semibold text-[var(--ally-violet)]">
          {inizialiDaEmail(email)}
        </span>
        <div className="hidden min-w-0 flex-col leading-tight text-left md:flex">
          <span className="max-w-[12rem] truncate text-[13px] font-semibold text-[var(--ink)]">
            {firstName ?? "Account"}
          </span>
          <span className="max-w-[12rem] truncate text-[11px] text-[var(--ink-muted)]">
            {email ?? ""}
          </span>
        </div>
        <ChevronDown
          className={[
            "hidden h-4 w-4 text-[var(--ink-muted)] transition-transform md:block",
            aperto ? "rotate-180" : "",
          ].join(" ")}
          strokeWidth={STROKE}
          aria-hidden
        />
      </button>

      {aperto ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,14.5rem)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-card)]"
        >
          <Link
            href="/impostazioni/integrazioni"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] focus-visible:outline-none"
            onClick={chiudi}
          >
            <Settings
              className="h-4 w-4 shrink-0 text-[var(--ink-muted)]"
              strokeWidth={STROKE}
              aria-hidden
            />
            Impostazioni
          </Link>

          <div
            className="my-1 border-t border-[var(--border-soft)]"
            role="separator"
            aria-hidden
          />

          <button
            type="button"
            role="menuitem"
            disabled={logoutInCorso}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--lavender-muted)]/50 hover:text-[#7a3d58] focus-visible:bg-[var(--lavender-muted)]/50 focus-visible:outline-none disabled:opacity-60"
            onClick={() => void onEsci()}
          >
            <LogOut
              className="h-4 w-4 shrink-0 text-[var(--ink-muted)]"
              strokeWidth={STROKE}
              aria-hidden
            />
            {logoutInCorso ? "Uscita…" : "Esci"}
          </button>
        </div>
      ) : null}

      {logoutErrore ? (
        <p
          className="absolute right-0 top-full z-40 mt-1 max-w-[14.5rem] rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1.5 text-[11px] leading-snug text-[#7a3d58] shadow-[var(--shadow-card)]"
          role="alert"
        >
          {logoutErrore}
        </p>
      ) : null}
    </div>
  );
}
