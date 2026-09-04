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

type InsightSummary = {
  metaCampaignId: string;
  syncedAt: string | null;
  emptyValid: boolean;
  lookbackTruncated: boolean;
  since: string | null;
  until: string | null;
  currency: string | null;
  inserted?: number;
  updated?: number;
  aggregate: {
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    linkClicks: number | null;
    periodReach: number | null;
    periodFrequency: number | null;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    primaryResultType: string | null;
    primaryResults: number | null;
    resultMappingConfidence: string;
    cpl: number | null;
  } | null;
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
  if (meta === "connected") {
    return "Meta collegato. Seleziona l'account pubblicitario, poi importa le campagne.";
  }
  if (meta === "cancelled") return "Connessione annullata.";
  if (meta === "error") return "Collegamento Meta non riuscito.";
  return null;
}

function formatNumero(n: number, max = 2): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: max,
    minimumFractionDigits: 0,
  }).format(n);
}

function formatValuta(n: number, currency: string | null): string {
  const code = currency?.trim() || "EUR";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: code,
    }).format(n);
  } catch {
    return `${formatNumero(n)} ${code}`;
  }
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
  const [insightsByCampaign, setInsightsByCampaign] = useState<
    Record<string, InsightSummary>
  >({});
  const [syncingCampaign, setSyncingCampaign] = useState<string | null>(null);
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
      const [connRes, mapRes, campRes, insightRes] = await Promise.all([
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
        fetch(
          `/api/meta/campaign-insights?clientId=${encodeURIComponent(clientId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
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
      if (insightRes.ok) {
        const insightData = (await insightRes.json()) as {
          insights?: InsightSummary[];
        };
        const map: Record<string, InsightSummary> = {};
        for (const item of insightData.insights ?? []) {
          map[item.metaCampaignId] = item;
        }
        setInsightsByCampaign(map);
      } else {
        setInsightsByCampaign({});
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

  async function sincronizzaInsights(metaCampaignId: string) {
    if (!clientId || busy || syncingCampaign) return;
    const token = await bearerToken();
    if (!token) return;
    setSyncingCampaign(metaCampaignId);
    setErrore(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/meta/campaign-insights/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId, campaignId: metaCampaignId }),
      });
      const data = (await res.json()) as {
        insight?: InsightSummary;
        code?: string;
        error?: string;
      };
      if (!res.ok) {
        setErrore("Sincronizzazione Insights Meta non riuscita.");
        return;
      }
      if (data.insight) {
        setInsightsByCampaign((prev) => ({
          ...prev,
          [data.insight!.metaCampaignId]: data.insight!,
        }));
        if (data.insight.emptyValid) {
          setFeedback("Nessun dato di delivery disponibile per il periodo.");
        } else {
          setFeedback(
            `${data.insight.inserted ?? 0} giorni importati · ${data.insight.updated ?? 0} aggiornati`,
          );
        }
      }
    } catch {
      setErrore("Sincronizzazione Insights Meta non riuscita.");
    } finally {
      setSyncingCampaign(null);
    }
  }

  if (!clientId) {
    return (
      <section className="aff-panel-white mt-8 p-5">
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
    <section className="aff-panel-white mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-medium text-[var(--ink)]">Meta Ads</h2>
        {connected ? (
          <span className="aff-badge aff-badge--violet">
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
        <p className="mt-3 text-sm aff-text-danger" role="status">
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
              className="aff-btn-primary"
            >
              Collega Meta
            </button>
          ) : null}
          {connected ? (
            <button
              type="button"
              onClick={() => void apriSelettore()}
              disabled={busy}
              className="aff-btn-primary"
            >
              {mapped ? "Cambia account" : "Seleziona account"}
            </button>
          ) : null}
          {mapped ? (
            <button
              type="button"
              onClick={() => void importaCampagne()}
              disabled={busy}
              className="aff-btn-primary"
            >
              Importa campagne Meta
            </button>
          ) : null}
          {connected ? (
            <button
              type="button"
              onClick={() => void disconnettiMeta()}
              disabled={busy}
              className="aff-btn-secondary"
            >
              Disconnetti Meta
            </button>
          ) : null}
        </div>
      ) : null}

      {aperto ? (
        <div className="mt-5 rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-surface)] p-4">
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
                    className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm ${
                      selezionato === account.id
                        ? "border-[var(--ally-violet-border)] bg-[var(--ally-violet-soft)]"
                        : "border-[var(--border-soft)] bg-white"
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
              className="aff-btn-primary"
            >
              Collega questo account
            </button>
            <button
              type="button"
              onClick={() => setAperto(false)}
              className="aff-btn-tertiary"
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
              const insight = insightsByCampaign[campagna.metaCampaignId];
              const agg = insight?.aggregate ?? null;
              const currency = insight?.currency ?? mapping?.currency ?? null;
              const hasData = Boolean(agg);
              const mostraCpl =
                agg?.resultMappingConfidence === "CONFIDENT" &&
                agg.cpl != null;
              return (
                <li
                  key={campagna.metaCampaignId}
                  className="rounded-[var(--radius)] border border-[var(--border-soft)] bg-[var(--ally-surface)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {campagna.name}
                    </span>
                    <span className="aff-badge aff-badge--violet">
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
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        void sincronizzaInsights(campagna.metaCampaignId)
                      }
                      disabled={busy || syncingCampaign != null}
                      className="aff-btn-secondary min-h-8 text-xs"
                    >
                      {syncingCampaign === campagna.metaCampaignId
                        ? "Sincronizzazione…"
                        : insight?.syncedAt
                          ? "Sincronizza dati"
                          : "Importa dati Meta"}
                    </button>
                  </div>
                  {insight?.lookbackTruncated ? (
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      Intervallo Insights limitato agli ultimi 90 giorni.
                    </p>
                  ) : null}
                  {insight?.emptyValid && !hasData ? (
                    <p className="mt-2 text-sm text-[var(--ink-muted)]">
                      Nessun dato di delivery disponibile per il periodo.
                    </p>
                  ) : null}
                  {hasData && agg ? (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
                      {agg.spend != null ? (
                        <>
                          <dt>Spesa</dt>
                          <dd className="text-[var(--ink)]">
                            {formatValuta(agg.spend, currency)}
                          </dd>
                        </>
                      ) : null}
                      {agg.impressions != null ? (
                        <>
                          <dt>Impression</dt>
                          <dd className="text-[var(--ink)]">
                            {formatNumero(agg.impressions, 0)}
                          </dd>
                        </>
                      ) : null}
                      {agg.linkClicks != null ? (
                        <>
                          <dt>Clic sul link</dt>
                          <dd className="text-[var(--ink)]">
                            {formatNumero(agg.linkClicks, 0)}
                          </dd>
                        </>
                      ) : null}
                      {agg.ctr != null ? (
                        <>
                          <dt>CTR</dt>
                          <dd className="text-[var(--ink)]">
                            {formatNumero(agg.ctr)}%
                          </dd>
                        </>
                      ) : null}
                      {agg.cpc != null ? (
                        <>
                          <dt>CPC</dt>
                          <dd className="text-[var(--ink)]">
                            {formatValuta(agg.cpc, currency)}
                          </dd>
                        </>
                      ) : null}
                      {agg.periodFrequency != null ? (
                        <>
                          <dt>Frequenza</dt>
                          <dd className="text-[var(--ink)]">
                            {formatNumero(agg.periodFrequency)}
                          </dd>
                        </>
                      ) : null}
                      {agg.resultMappingConfidence === "CONFIDENT" &&
                      agg.primaryResults != null ? (
                        <>
                          <dt>Risultati Meta</dt>
                          <dd className="text-[var(--ink)]">
                            {formatNumero(agg.primaryResults)}
                          </dd>
                        </>
                      ) : null}
                      {mostraCpl ? (
                        <>
                          <dt>
                            {agg.primaryResultType === "lead"
                              ? "CPL Meta"
                              : "Costo per risultato Meta"}
                          </dt>
                          <dd className="text-[var(--ink)]">
                            {formatValuta(agg.cpl as number, currency)}
                          </dd>
                        </>
                      ) : null}
                    </dl>
                  ) : null}
                  {hasData ? (
                    <p className="mt-2 text-[10px] text-[var(--ink-muted)]">
                      Metriche riportate da Meta. Non sono conversioni definitive.
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
