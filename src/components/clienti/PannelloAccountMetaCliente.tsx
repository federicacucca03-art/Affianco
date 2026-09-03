"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type ImportedCampaign = {
  metaCampaignId: string;
  name: string;
  rawObjective: string | null;
  effectiveStatus: string | null;
  status: string | null;
  startAt: string | null;
  stopAt: string | null;
  lastSyncedAt: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};

type ConnectionPayload = {
  connected: boolean;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "REAUTH_REQUIRED" | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  metaUserId: string | null;
};

function etichettaStatoMeta(effectiveStatus: string | null, status: string | null): string {
  const raw = (effectiveStatus || status || "").trim();
  return raw || "Stato Meta non disponibile";
}

function formatDataMeta(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("it-IT");
}

function messaggioQuery(meta: string | null): string | null {
  if (meta === "connected") return "Account Meta collegato.";
  if (meta === "cancelled") return "Connessione annullata.";
  if (meta === "error") return "Collegamento Meta non riuscito.";
  return null;
}

async function bearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function PannelloAccountMetaCliente({
  clientId,
}: {
  clientId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState<MetaAdAccountSummary[] | null>(null);
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [aperto, setAperto] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [campagne, setCampagne] = useState<ImportedCampaign[]>([]);
  const [truncated, setTruncated] = useState(false);

  const carica = useCallback(async () => {
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
      const [connRes, mapRes, campRes] = await Promise.all([
        fetch(`/api/meta/connection?clientId=${encodeURIComponent(clientId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `/api/meta/client-account?clientId=${encodeURIComponent(clientId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        fetch(`/api/meta/campaigns?clientId=${encodeURIComponent(clientId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const connData = (await connRes.json()) as ConnectionPayload & {
        error?: string;
      };
      const mapData = (await mapRes.json()) as {
        mapping?: Mapping | null;
        error?: string;
      };
      if (!connRes.ok) {
        setErrore("Impossibile leggere la connessione Meta.");
        setCaricamento(false);
        return;
      }
      setConnected(Boolean(connData.connected && connData.status === "ACTIVE"));
      if (mapRes.ok) {
        setMapping(mapData.mapping ?? null);
      } else {
        setMapping(null);
      }
      if (campRes.ok) {
        const campData = (await campRes.json()) as {
          campaigns?: ImportedCampaign[];
        };
        setCampagne(campData.campaigns ?? []);
      } else {
        setCampagne([]);
      }
    } catch {
      setErrore("Impossibile leggere la connessione Meta.");
    } finally {
      setCaricamento(false);
    }
  }, [clientId]);

  useEffect(() => {
    void carica();
  }, [carica]);

  useEffect(() => {
    const meta = searchParams.get("meta");
    const msg = messaggioQuery(meta);
    if (msg) setFeedback(msg);
    if (meta && clientId) {
      router.replace(`/clienti/${clientId}`);
    }
  }, [clientId, router, searchParams]);

  async function collegaMeta() {
    if (!clientId || busy) return;
    setBusy(true);
    setErrore(null);
    setFeedback(null);
    try {
      const token = await bearerToken();
      if (!token) {
        setErrore("Sessione assente.");
        return;
      }
      const res = await fetch("/api/meta/oauth/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as {
        authorizationUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.authorizationUrl) {
        setErrore("Collegamento Meta non riuscito.");
        return;
      }
      window.location.assign(data.authorizationUrl);
    } catch {
      setErrore("Collegamento Meta non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function apriSelettore() {
    if (!clientId || busy) return;
    setErrore(null);
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
      const res = await fetch(
        `/api/meta/ad-accounts?clientId=${encodeURIComponent(clientId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as {
        accounts?: MetaAdAccountSummary[];
        code?: string;
        error?: string;
      };
      if (res.status === 404 && data.code === "META_CONNECTION_NOT_FOUND") {
        setConnected(false);
        setAperto(false);
        return;
      }
      if (!res.ok) {
        setErrore("Impossibile caricare gli account Meta.");
        setAperto(false);
        return;
      }
      setAccounts(data.accounts ?? []);
    } catch {
      setErrore("Impossibile caricare gli account Meta.");
      setAperto(false);
    } finally {
      setBusy(false);
    }
  }

  async function collegaAccount() {
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

  async function disconnettiMeta() {
    if (!clientId || busy) return;
    const token = await bearerToken();
    if (!token) return;
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/meta/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        setErrore("Disconnessione non riuscita.");
        return;
      }
      setConnected(false);
      setMapping(null);
      setCampagne([]);
      setAperto(false);
      setFeedback("Account Meta disconnesso per questo cliente.");
    } catch {
      setErrore("Disconnessione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function importaCampagne() {
    if (!clientId || busy) return;
    const token = await bearerToken();
    if (!token) return;
    setBusy(true);
    setErrore(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/meta/campaigns/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as {
        imported?: number;
        updated?: number;
        truncated?: boolean;
        campaigns?: ImportedCampaign[];
        code?: string;
        error?: string;
      };
      if (res.status === 404 && data.code === "META_AD_ACCOUNT_NOT_SELECTED") {
        setErrore("Seleziona prima un account pubblicitario Meta.");
        return;
      }
      if (!res.ok) {
        setErrore("Importazione campagne Meta non riuscita.");
        return;
      }
      setCampagne(data.campaigns ?? []);
      setTruncated(Boolean(data.truncated));
      const imported = data.imported ?? 0;
      const updated = data.updated ?? 0;
      setFeedback(
        `${imported} campagne importate · ${updated} aggiornate · 0 errori`,
      );
    } catch {
      setErrore("Importazione campagne Meta non riuscita.");
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

  const mapped = Boolean(mapping);
  const notConnected = !caricamento && !connected;
  const connectedNoAccount = !caricamento && connected && !mapped;

  return (
    <section className="mt-8 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-medium text-[var(--ink)]">Meta Ads</h2>
        {connected ? (
          <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
            Meta collegato
          </span>
        ) : null}
      </div>

      {caricamento ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : null}

      {notConnected ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Nessuna connessione Meta per questo cliente.
        </p>
      ) : null}

      {connectedNoAccount ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Meta collegato. Seleziona l&apos;account pubblicitario.
        </p>
      ) : null}

      {mapped ? (
        <dl className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
          <div>
            <dt className="inline text-[var(--ink)]">Account: </dt>
            <dd className="inline">
              {mapping?.metaAdAccountName || mapping?.metaAdAccountId}
            </dd>
          </div>
          <div>
            <dt className="inline text-[var(--ink)]">ID: </dt>
            <dd className="inline">
              {mapping?.metaAccountId || mapping?.metaAdAccountId}
            </dd>
          </div>
          {mapping?.currency ? (
            <div>
              <dt className="inline text-[var(--ink)]">Valuta: </dt>
              <dd className="inline">{mapping.currency}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {feedback ? (
        <p className="mt-3 text-sm text-[var(--ink)]" role="status">
          {feedback}
        </p>
      ) : null}

      {errore ? (
        <p className="mt-3 text-sm text-[#7a3d58]" role="status">
          {errore}
        </p>
      ) : null}

      {!caricamento ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {notConnected ? (
            <button
              type="button"
              onClick={() => void collegaMeta()}
              disabled={busy}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Collega Meta
            </button>
          ) : null}
          {connected ? (
            <button
              type="button"
              onClick={() => void apriSelettore()}
              disabled={busy}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {mapped ? "Cambia account" : "Seleziona account"}
            </button>
          ) : null}
          {mapped ? (
            <button
              type="button"
              onClick={() => void importaCampagne()}
              disabled={busy}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Importa campagne Meta
            </button>
          ) : null}
          {connected ? (
            <button
              type="button"
              onClick={() => void disconnettiMeta()}
              disabled={busy}
              className="rounded-full border border-[var(--ink)]/15 bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
            >
              Disconnetti Meta
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
              onClick={() => void collegaAccount()}
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

      {mapped && campagne.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-[var(--ink)]">
            Campagne Meta importate
          </p>
          {truncated ? (
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Elenco parziale: raggiunto il limite di lettura Meta.
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {campagne.map((campagna) => {
              const inizio = formatDataMeta(campagna.startAt);
              const fine = formatDataMeta(campagna.stopAt);
              return (
                <li
                  key={campagna.metaCampaignId}
                  className="rounded-xl border border-[var(--ink)]/10 bg-[var(--surface)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {campagna.name}
                    </span>
                    <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                      Meta
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {etichettaStatoMeta(campagna.effectiveStatus, campagna.status)}
                    {campagna.rawObjective ? ` · ${campagna.rawObjective}` : ""}
                  </p>
                  {inizio || fine ? (
                    <p className="text-sm text-[var(--ink-muted)]">
                      {[inizio, fine].filter(Boolean).join(" – ")}
                    </p>
                  ) : null}
                  {campagna.lastSyncedAt ? (
                    <p className="text-xs text-[var(--ink-muted)]">
                      Sync {formatDataMeta(campagna.lastSyncedAt)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
