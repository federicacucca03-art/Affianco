"use client";

/**
 * Normal Ally full-publish CTA → FULL_PUBLISH_PAUSED
 * (Campaign → Ad Set → Creative → Ad, all PAUSED).
 * Uses /api/meta/publish-plan only. Never temp QA create routes.
 * LIVE META WRITES: only when server gate allows (META_WRITES_LIVE + QA scope).
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MetaPublishPlan } from "@/lib/meta/publish/types";

type ExecuteResult = {
  executed: boolean;
  liveWritesGated: boolean;
  failedAt: string | null;
  operationId: string | null;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaCreativeId: string | null;
  metaAdId: string | null;
  errorSafeMessage: string | null;
  steps?: Array<{ step: string; status: string; messageIt: string | null }>;
};

type Props = {
  campaignId: string;
  /** Compact layout for Instant Form Easy review. */
  compact?: boolean;
  onExecuted?: (result: ExecuteResult) => void;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const data = await supabase.auth.getSession();
  const token = data.data.session?.access_token?.trim();
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function MetaFullPublishCta({
  campaignId,
  compact = false,
  onExecuted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<MetaPublishPlan | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [humanConfirm, setHumanConfirm] = useState(false);

  const loadPlan = useCallback(async () => {
    setBusy(true);
    setErrore(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Sessione assente. Accedi di nuovo.");
        return;
      }
      const res = await fetch(
        `/api/meta/publish-plan?allyCampaignId=${encodeURIComponent(campaignId)}`,
        { headers },
      );
      const json = (await res.json()) as {
        plan?: MetaPublishPlan;
        error?: string;
      };
      if (!res.ok || !json.plan) {
        setErrore(json.error ?? "Piano pubblicazione non disponibile.");
        setPlan(null);
        return;
      }
      setPlan(json.plan);
    } catch {
      setErrore("Caricamento piano pubblicazione non riuscito.");
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function onExecute() {
    if (!plan || busy) return;
    if (plan.review.ctaState !== "ENABLED") return;
    if (!humanConfirm) {
      setErrore("Conferma esplicita richiesta prima di creare su Meta.");
      return;
    }
    setBusy(true);
    setErrore(null);
    setStatusMsg(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Sessione assente. Accedi di nuovo.");
        return;
      }
      const res = await fetch("/api/meta/publish-plan", {
        method: "POST",
        headers,
        body: JSON.stringify({
          allyCampaignId: campaignId,
          action: "execute",
          fingerprint: plan.fingerprint,
          humanConfirmed: true,
        }),
      });
      const json = (await res.json()) as {
        result?: ExecuteResult;
        error?: string;
      };
      if (!res.ok || !json.result) {
        setErrore(json.error ?? "Pubblicazione Meta non riuscita.");
        return;
      }
      const r = json.result;
      onExecuted?.(r);
      if (r.liveWritesGated && !r.executed) {
        setStatusMsg(
          r.errorSafeMessage ??
            "Creazione su Meta non disponibile in questo ambiente (gate scrittura).",
        );
        return;
      }
      if (r.executed) {
        setStatusMsg(
          [
            "Creati su Meta in PAUSA:",
            r.metaCampaignId ? `campagna ${r.metaCampaignId}` : null,
            r.metaAdSetId ? `gruppo ${r.metaAdSetId}` : null,
            r.metaCreativeId ? `creatività ${r.metaCreativeId}` : null,
            r.metaAdId ? `annuncio ${r.metaAdId}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        );
        void loadPlan();
        return;
      }
      setStatusMsg(
        r.errorSafeMessage ??
          (r.failedAt
            ? `Operazione interrotta a ${r.failedAt}. Nessuna attivazione.`
            : "Operazione non completata. Nessuna attivazione."),
      );
    } catch {
      setErrore("Pubblicazione Meta non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const review = plan?.review;
  const ctaState = review?.ctaState ?? "DISABLED_NOT_READY";
  const canExecute = ctaState === "ENABLED" && humanConfirm && !busy;
  const privacyBlocked =
    plan?.blockingIssues.some((b) => b.code === "MISSING_FORM_TECHNICAL_URL") ===
    true;

  return (
    <div
      className={
        compact
          ? "space-y-3 rounded-[12px] border border-[var(--border)] px-4 py-3"
          : "space-y-3"
      }
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--primary)]">
          Pubblica su Meta · gerarchia completa
        </p>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
          Ally crea Campagna → Gruppo → Creatività → Annuncio. Stato iniziale:{" "}
          <span className="font-medium text-[var(--ink)]">PAUSA</span>. Nessuna
          attivazione automatica.
        </p>
      </div>

      {review ? (
        <ul className="space-y-1 text-[12px] text-[var(--ink-muted)]">
          <li>Campagna: {review.campaignLine}</li>
          <li>Gruppo: {review.adSetLine}</li>
          <li>Creatività: {review.creativeLine}</li>
          <li>Annuncio: {review.adLine}</li>
          <li>Stato iniziale: {review.initialStatusLine}</li>
          <li>Destinazione: {review.destinationLine}</li>
          <li>Pagina: {review.pageLine}</li>
          <li>Budget: {review.budgetLine}</li>
          <li>Pubblico: {review.audienceLine}</li>
        </ul>
      ) : (
        <p className="text-[12px] text-[var(--ink-muted)]">
          {busy ? "Caricamento piano…" : "Piano non ancora disponibile."}
        </p>
      )}

      {review?.gatedNoteIt ? (
        <p className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--ink-muted)]">
          {review.gatedNoteIt}
        </p>
      ) : null}

      {privacyBlocked ? (
        <p className="text-[12px] text-amber-800" role="status">
          Il modulo Instant Form selezionato non fornisce un URL esterno valido
          (informativa privacy) richiesto da Meta. Completa la selezione del
          modulo prima di pubblicare.
        </p>
      ) : null}

      {review?.metaRequirementLines && review.metaRequirementLines.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-[12px] text-[var(--ink-muted)]">
          {review.metaRequirementLines.slice(0, 5).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      <label className="flex items-start gap-2 text-[13px] text-[var(--ink)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={humanConfirm}
          disabled={busy || ctaState === "HIDDEN"}
          onChange={(e) => setHumanConfirm(e.target.checked)}
        />
        <span>
          Confermo: crea Campagna, Gruppo, Creatività e Annuncio su Meta in{" "}
          <strong>PAUSA</strong>. Nessuna attivazione.
        </span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="aff-btn-secondary"
          disabled={busy}
          onClick={() => void loadPlan()}
        >
          Aggiorna piano
        </button>
        <button
          type="button"
          className="aff-btn-primary"
          disabled={
            busy ||
            !plan ||
            ctaState === "DISABLED_NOT_READY" ||
            ctaState === "HIDDEN" ||
            ctaState === "GATED_LIVE_OFF" ||
            !humanConfirm ||
            privacyBlocked
          }
          title={
            ctaState === "GATED_LIVE_OFF"
              ? "Write live non attive in questo ambiente"
              : !humanConfirm
                ? "Conferma richiesta"
                : undefined
          }
          onClick={() => void onExecute()}
        >
          {busy
            ? "Pubblicazione…"
            : review?.ctaLabelIt ?? "Pubblica su Meta"}
        </button>
      </div>

      {!canExecute && ctaState === "ENABLED" && !humanConfirm ? (
        <p className="text-[11px] text-[var(--ink-muted)]">
          Spunta la conferma per abilitare la creazione in PAUSA.
        </p>
      ) : null}

      {errore ? (
        <p className="text-[13px] text-red-700" role="alert">
          {errore}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="text-[12px] text-[var(--ink-muted)]" role="status">
          {statusMsg}
        </p>
      ) : null}
    </div>
  );
}
