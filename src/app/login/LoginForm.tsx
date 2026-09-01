"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  logErroreAuthDev,
  messaggioErroreAuth,
} from "@/lib/auth-errori";

type Tab = "login" | "signup";

const PASSWORD_MIN = 6;

function destinazioneSicura(raw: string | null): string {
  if (!raw) return "/home";
  if (!raw.startsWith("/")) return "/home";
  if (raw.startsWith("//")) return "/home";
  if (raw.startsWith("/login")) return "/home";
  if (raw.startsWith("/approvazione")) return "/home";
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refresh } = useAuth();

  const nextPath = useMemo(
    () => destinazioneSicura(searchParams.get("next")),
    [searchParams],
  );

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(nextPath);
  }, [authLoading, user, router, nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInfo(null);

    const emailTrim = email.trim();
    if (!emailTrim) {
      setErrore("Inserisci la tua email.");
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setErrore(`La password deve avere almeno ${PASSWORD_MIN} caratteri.`);
      return;
    }

    if (tab === "signup" && password !== conferma) {
      setErrore("Le password non coincidono.");
      return;
    }

    setInCorso(true);
    try {
      if (tab === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password,
        });
        if (error) throw error;
        await refresh();
        router.replace(nextPath);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailTrim,
        password,
      });
      if (error) throw error;

      if (data.session) {
        await refresh();
        router.replace(nextPath);
        return;
      }

      setInfo(
        "Controlla la tua email per confermare l’account. Poi torna qui per accedere.",
      );
      setTab("login");
      setPassword("");
      setConferma("");
    } catch (err) {
      logErroreAuthDev(tab === "login" ? "login" : "signup", err);
      setErrore(
        messaggioErroreAuth(err, tab === "login" ? "login" : "signup"),
      );
    } finally {
      setInCorso(false);
    }
  }

  if (authLoading || user) {
    return (
      <p className="text-center text-sm text-[var(--ink-muted)]">
        {user ? "Accesso in corso…" : "Caricamento…"}
      </p>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[var(--radius)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="mb-6 flex rounded-full bg-[var(--surface-hover)] p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            tab === "login"
              ? "bg-white text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-muted)]"
          }`}
          onClick={() => {
            setTab("login");
            setErrore(null);
            setInfo(null);
          }}
        >
          Accedi
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            tab === "signup"
              ? "bg-white text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-muted)]"
          }`}
          onClick={() => {
            setTab("signup");
            setErrore(null);
            setInfo(null);
          }}
        >
          Crea account
        </button>
      </div>

      <h1 className="text-xl font-medium tracking-tight text-[var(--ink)]">
        {tab === "login" ? "Accedi ad Affianco" : "Crea il tuo account"}
      </h1>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        {tab === "login"
          ? "Entra per gestire campagne, clienti e approvazioni."
          : "Registrati con email e password per iniziare."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-xs font-medium text-[var(--ink-muted)]">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--ink-muted)]">
            Password
          </span>
          <input
            type="password"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </label>

        {tab === "signup" ? (
          <label className="block">
            <span className="text-xs font-medium text-[var(--ink-muted)]">
              Conferma password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN}
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        ) : null}

        {errore ? (
          <p className="text-sm text-[#C45C5C]" role="alert">
            {errore}
          </p>
        ) : null}
        {info ? (
          <p className="text-sm text-[var(--accent)]" role="status">
            {info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={inCorso}
          className="w-full rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {inCorso
            ? "Attendi…"
            : tab === "login"
              ? "Accedi"
              : "Crea account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--ink-muted)]">
        <Link href="/" className="text-[var(--accent)] hover:underline">
          Torna alla home
        </Link>
      </p>
    </div>
  );
}
