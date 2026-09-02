"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ConnectionPayload = {
  connected: boolean;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "REAUTH_REQUIRED" | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  metaUserId: string | null;
  error?: string;
};

type UiState =
  | "LOADING"
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "REAUTH_REQUIRED"
  | "ERROR";

function statoDaPayload(data: ConnectionPayload): UiState {
  if (!data.connected && !data.status) return "NOT_CONNECTED";
  if (data.status === "ACTIVE") return "CONNECTED";
  if (
    data.status === "REAUTH_REQUIRED" ||
    data.status === "EXPIRED" ||
    data.status === "REVOKED"
  ) {
    return "REAUTH_REQUIRED";
  }
  return "NOT_CONNECTED";
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

export function PannelloIntegrazioneMeta() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ui, setUi] = useState<UiState>("LOADING");
  const [payload, setPayload] = useState<ConnectionPayload | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carica = useCallback(async () => {
    const token = await bearerToken();
    if (!token) {
      setUi("ERROR");
      setFeedback("Sessione assente. Accedi di nuovo.");
      return;
    }
    try {
      const res = await fetch("/api/meta/connection", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as ConnectionPayload;
      if (!res.ok) {
        setUi("ERROR");
        setFeedback("Impossibile leggere lo stato della connessione.");
        return;
      }
      setPayload(data);
      setUi(statoDaPayload(data));
    } catch {
      setUi("ERROR");
      setFeedback("Impossibile leggere lo stato della connessione.");
    }
  }, []);

  useEffect(() => {
    const meta = searchParams.get("meta");
    const msg = messaggioQuery(meta);
    if (msg) setFeedback(msg);
    if (meta) {
      router.replace("/impostazioni/integrazioni");
    }
    void carica();
  }, [carica, router, searchParams]);

  async function collega() {
    if (busy) return;
    setBusy(true);
    setUi("CONNECTING");
    setFeedback(null);
    try {
      const token = await bearerToken();
      if (!token) {
        setUi("ERROR");
        setFeedback("Sessione assente. Accedi di nuovo.");
        return;
      }
      const res = await fetch("/api/meta/oauth/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        authorizationUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.authorizationUrl) {
        setUi(payload ? statoDaPayload(payload) : "NOT_CONNECTED");
        setFeedback("Collegamento Meta non riuscito.");
        return;
      }
      window.location.assign(data.authorizationUrl);
    } catch {
      setUi(payload ? statoDaPayload(payload) : "NOT_CONNECTED");
      setFeedback("Collegamento Meta non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnetti() {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const token = await bearerToken();
      if (!token) {
        setUi("ERROR");
        setFeedback("Sessione assente. Accedi di nuovo.");
        return;
      }
      const res = await fetch("/api/meta/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFeedback("Disconnessione non riuscita.");
        return;
      }
      setPayload(null);
      setUi("NOT_CONNECTED");
      setFeedback("Account Meta disconnesso.");
    } catch {
      setFeedback("Disconnessione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const collegato = ui === "CONNECTED";
  const daRicollegare = ui === "REAUTH_REQUIRED";

  return (
    <section className="mt-8 rounded-[var(--radius)] border border-[var(--ink)]/10 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-[var(--ink)]">Meta Ads</h2>
          <p className="mt-1 max-w-md text-sm text-[var(--ink-muted)]">
            Collega il tuo account Meta per importare in seguito account
            pubblicitari, campagne e dati di performance.
          </p>
        </div>
        {collegato ? (
          <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
            Connesso
          </span>
        ) : null}
        {daRicollegare ? (
          <span className="rounded-full bg-[#f4e6ec] px-3 py-1 text-xs font-medium text-[#7a3d58]">
            Da ricollegare
          </span>
        ) : null}
      </div>

      {collegato || daRicollegare ? (
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          L&apos;accesso iniziale è in sola lettura.
        </p>
      ) : null}

      {payload && (collegato || daRicollegare) ? (
        <dl className="mt-4 space-y-1 text-sm text-[var(--ink-muted)]">
          {payload.metaUserId ? (
            <div>
              <dt className="inline text-[var(--ink)]">Utente Meta: </dt>
              <dd className="inline">{payload.metaUserId}</dd>
            </div>
          ) : null}
          {payload.scopes.length > 0 ? (
            <div>
              <dt className="inline text-[var(--ink)]">Permessi: </dt>
              <dd className="inline">{payload.scopes.join(", ")}</dd>
            </div>
          ) : null}
          {payload.tokenExpiresAt ? (
            <div>
              <dt className="inline text-[var(--ink)]">Scadenza token: </dt>
              <dd className="inline">
                {new Date(payload.tokenExpiresAt).toLocaleString("it-IT")}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {feedback ? (
        <p className="mt-4 text-sm text-[var(--ink)]" role="status">
          {feedback}
        </p>
      ) : null}

      {ui === "LOADING" ? (
        <p className="mt-5 text-sm text-[var(--ink-muted)]">Caricamento…</p>
      ) : null}

      {ui === "CONNECTING" ? (
        <p className="mt-5 text-sm text-[var(--ink-muted)]">Reindirizzamento a Meta…</p>
      ) : null}

      {ui === "ERROR" && !payload ? (
        <p className="mt-5 text-sm text-[#7a3d58]">
          Non è stato possibile verificare la connessione.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {ui === "NOT_CONNECTED" ||
        ui === "ERROR" ||
        ui === "REAUTH_REQUIRED" ||
        ui === "CONNECTING" ? (
          <button
            type="button"
            onClick={() => void collega()}
            disabled={busy || ui === "CONNECTING"}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Collega Meta
          </button>
        ) : null}
        {collegato || daRicollegare ? (
          <button
            type="button"
            onClick={() => void disconnetti()}
            disabled={busy}
            className="rounded-full border border-[var(--ink)]/15 bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
          >
            Disconnetti
          </button>
        ) : null}
      </div>
    </section>
  );
}
