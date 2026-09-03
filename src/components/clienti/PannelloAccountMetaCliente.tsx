"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MetaAdAccountSummary = {
  id: string;
  accountId: string | null;
  name: string | null;
  status: number | null;
  currency: string | null;
  timezoneName: string | null;
};

type Mapping = {
  clientId: string;
  metaAdAccountId: string;
  metaAdAccountName: string | null;
  metaAccountId: string | null;
  currency: string | null;
  timezoneName: string | null;
};

async function bearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function PannelloAccountMetaCliente({
  clientId,
}: {
  clientId: string | null;
}) {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [accounts, setAccounts] = useState<MetaAdAccountSummary[] | null>(null);
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [aperto, setAperto] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);

  const caricaMapping = useCallback(async () => {
    if (!clientId) {
      setCaricamento(false);
      return;
    }
    const token = await bearerToken();
    if (!token) {
      setErrore("Sessione assente.");
      setCaricamento(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/meta/client-account?clientId=${encodeURIComponent(clientId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as {
        mapping?: Mapping | null;
        code?: string;
        error?: string;
      };
      if (res.status === 403 && (data.code === "META_REAUTH_REQUIRED" || data.code === "META_TOKEN_EXPIRED")) {
        setReauth(true);
        setCaricamento(false);
        return;
      }
      if (!res.ok) {
        setErrore("Impossibile leggere il collegamento Meta.");
        setCaricamento(false);
        return;
      }
      setMapping(data.mapping ?? null);
    } catch {
      setErrore("Impossibile leggere il collegamento Meta.");
    } finally {
      setCaricamento(false);
    }
  }, [clientId]);

  useEffect(() => {
    void caricaMapping();
  }, [caricaMapping]);

  async function apriSelettore() {
    if (busy) return;
    setErrore(null);
    setReauth(false);
    setAperto(true);
    setAccounts(null);
    setSelezionato(null);
    const token = await bearerToken();
    if (!token) {
      setErrore("Sessione assente.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/meta/ad-accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        accounts?: MetaAdAccountSummary[];
        code?: string;
        error?: string;
      };
      if (
        res.status === 403 &&
        (data.code === "META_REAUTH_REQUIRED" || data.code === "META_TOKEN_EXPIRED")
      ) {
        setReauth(true);
        setAperto(false);
        return;
      }
      if (res.status === 404 && data.code === "META_CONNECTION_NOT_FOUND") {
        setReauth(true);
        setAperto(false);
        return;
      }
      if (!res.ok) {
        setErrore("Impossibile caricare gli account Meta.");
        return;
      }
      setAccounts(data.accounts ?? []);
    } catch {
      setErrore("Impossibile caricare gli account Meta.");
    } finally {
      setBusy(false);
    }
  }

  async function collega() {
    if (!clientId || !selezionato || busy) return;
    const token = await bearerToken();
    if (!token) return;
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/meta/client-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId, metaAdAccountId: selezionato }),
      });
      const data = (await res.json()) as { mapping?: Mapping; error?: string };
      if (!res.ok || !data.mapping) {
        setErrore("Collegamento account non riuscito.");
        return;
      }
      setMapping(data.mapping);
      setAperto(false);
    } catch {
      setErrore("Collegamento account non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function rimuovi() {
    if (!clientId || busy) return;
    const token = await bearerToken();
    if (!token) return;
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/meta/client-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        setErrore("Rimozione non riuscita.");
        return;
      }
      setMapping(null);
    } catch {
      setErrore("Rimozione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  if (!clientId) {
    return (
      <section className="mt-8 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-medium text-[var(--ink)]">Meta Ads</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Questo cliente non è ancora salvato nel profilo Affianco. Crea una
          campagna per poterlo collegare a un account pubblicitario Meta.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-medium text-[var(--ink)]">Meta Ads</h2>

      {caricamento ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : null}

      {reauth ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Ricollega Meta.{" "}
          <Link
            href="/impostazioni/integrazioni"
            className="text-[var(--accent)] hover:underline"
          >
            Apri integrazioni
          </Link>
        </p>
      ) : null}

      {!caricamento && !reauth && !mapping ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Nessun account pubblicitario collegato
        </p>
      ) : null}

      {mapping ? (
        <dl className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
          <div>
            <dt className="inline text-[var(--ink)]">Account: </dt>
            <dd className="inline">
              {mapping.metaAdAccountName || mapping.metaAdAccountId}
            </dd>
          </div>
          <div>
            <dt className="inline text-[var(--ink)]">ID: </dt>
            <dd className="inline">
              {mapping.metaAccountId || mapping.metaAdAccountId}
            </dd>
          </div>
          {mapping.currency ? (
            <div>
              <dt className="inline text-[var(--ink)]">Valuta: </dt>
              <dd className="inline">{mapping.currency}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {errore ? (
        <p className="mt-3 text-sm text-[#7a3d58]" role="status">
          {errore}
        </p>
      ) : null}

      {!reauth ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void apriSelettore()}
            disabled={busy}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {mapping ? "Cambia account" : "Seleziona account"}
          </button>
          {mapping ? (
            <button
              type="button"
              onClick={() => void rimuovi()}
              disabled={busy}
              className="rounded-full border border-[var(--ink)]/15 bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
            >
              Rimuovi
            </button>
          ) : null}
        </div>
      ) : null}

      {aperto ? (
        <div className="mt-5 rounded-2xl border border-[var(--ink)]/10 bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[var(--ink)]">
            Seleziona un account
          </p>
          {accounts === null ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Caricamento…</p>
          ) : accounts.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              Nessun account pubblicitario disponibile con questo accesso Meta.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => setSelezionato(account.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      selezionato === account.id
                        ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                        : "border-[var(--ink)]/10 bg-white"
                    }`}
                  >
                    <span className="block font-medium text-[var(--ink)]">
                      {account.name || account.id}
                    </span>
                    <span className="block text-[var(--ink-muted)]">
                      {[account.accountId || account.id, account.currency]
                        .filter(Boolean)
                        .join(" · ")}
                      {account.status != null ? ` · stato ${account.status}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void collega()}
              disabled={!selezionato || busy}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Collega questo account
            </button>
            <button
              type="button"
              onClick={() => setAperto(false)}
              className="rounded-full px-4 py-2 text-sm text-[var(--ink-muted)]"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
