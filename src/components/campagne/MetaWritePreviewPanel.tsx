"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  MetaWriteFormState,
  MetaWritePreviewResult,
} from "@/lib/meta/write/types";
import {
  datetimeLocalToIso,
  formatDatetimeLocalDisplay,
  isoToDatetimeLocal,
} from "@/lib/meta/write/datetime-local";

type Props = {
  campaignId: string;
};

type GeoHit = {
  key: string;
  name: string;
  type: string | null;
  countryCode: string | null;
  region: string | null;
};

function hasVisibleUnresolved(input: {
  specialKind: string;
  destination: string;
  metaGeoKey: string | null;
  startAt: string;
  endAt: string;
}): boolean {
  return (
    input.specialKind === "UNRESOLVED" ||
    !input.destination ||
    !input.metaGeoKey ||
    !input.startAt ||
    !input.endAt
  );
}

/**
 * M11A.2F.1 — Canonical preview + gated confirmation.
 * Form hydrates from server canonical plan. Confirm is fingerprint-bound.
 * Live Meta creates require META_WRITES_LIVE=1 server-side — never auto.
 */
export function MetaWritePreviewPanel({ campaignId }: Props) {
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [preview, setPreview] = useState<MetaWritePreviewResult | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [liveWritesEnabled, setLiveWritesEnabled] = useState(false);
  const [verifiedFingerprint, setVerifiedFingerprint] = useState<string | null>(
    null,
  );
  const [formDirty, setFormDirty] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [adAccountId, setAdAccountId] = useState<string | null>(null);
  const [timezoneName, setTimezoneName] = useState<string>("Europe/Rome");

  const [specialKind, setSpecialKind] = useState<"UNRESOLVED" | "NONE">(
    "UNRESOLVED",
  );
  const [destination, setDestination] = useState<string>("");
  const [pageId, setPageId] = useState("");
  const [formId, setFormId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [geoQuery, setGeoQuery] = useState("");
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [metaGeoKey, setMetaGeoKey] = useState<string | null>(null);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("IT");

  function markDirty() {
    setFormDirty(true);
    setVerifiedFingerprint(null);
  }

  async function authHeaders(): Promise<HeadersInit | null> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function applyFormState(fs: MetaWriteFormState) {
    setSpecialKind(fs.specialKind === "NONE" ? "NONE" : "UNRESOLVED");
    setDestination(fs.destination || "");
    setCountryCode(fs.countryCode || "IT");
    setMetaGeoKey(fs.metaGeoKey);
    setGeoLabel(fs.geoLabel);
    if (fs.geoLabel) setGeoQuery(fs.geoLabel.split(",")[0]?.trim() || "");
    setPageId(fs.pageId || "");
    setFormId(fs.formId || "");
    const tz = fs.timezoneName?.trim() || "Europe/Rome";
    setTimezoneName(tz);
    setStartAt(isoToDatetimeLocal(fs.startAtIso, tz));
    setEndAt(isoToDatetimeLocal(fs.endAtIso, tz));
    setAccountLabel(fs.accountLabel);
    setAdAccountId(fs.adAccountId);
  }

  function planBody() {
    return {
      campaignId,
      specialAdCategories:
        specialKind === "NONE"
          ? { kind: "NONE" as const }
          : { kind: "UNRESOLVED" as const },
      countryCode,
      metaGeoKey,
      geoLabel,
      startAtIso: datetimeLocalToIso(startAt, timezoneName),
      endAtIso: datetimeLocalToIso(endAt, timezoneName),
      destination: destination || null,
      pageId: pageId || null,
      formId: formId || null,
    };
  }

  async function hydrateFromServer() {
    setHydrating(true);
    setErrore(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per caricare la configurazione Meta.");
        return;
      }
      const res = await fetch("/api/meta/write-preview", {
        method: "POST",
        headers,
        body: JSON.stringify({
          campaignId,
          hydrate: true,
          persist: true,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        preview?: MetaWritePreviewResult;
        formState?: MetaWriteFormState;
        liveWritesEnabled?: boolean;
      };
      if (!res.ok || !json.preview || !json.formState) {
        setErrore(json.error ?? "Caricamento configurazione non riuscito.");
        return;
      }
      applyFormState(json.formState);
      setPreview(json.preview);
      setLiveWritesEnabled(json.liveWritesEnabled === true);
      setFormDirty(false);
      if (json.preview.canWrite) {
        setVerifiedFingerprint(json.preview.fingerprint);
      } else {
        setVerifiedFingerprint(null);
      }
    } catch {
      setErrore("Caricamento configurazione non riuscito.");
    } finally {
      setHydrating(false);
    }
  }

  useEffect(() => {
    void hydrateFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount hydrate only
  }, [campaignId]);

  async function runPreview() {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    setConfirmMsg(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per generare l'anteprima.");
        return;
      }
      const res = await fetch("/api/meta/write-preview", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...planBody(), persist: true }),
      });
      const json = (await res.json()) as {
        error?: string;
        preview?: MetaWritePreviewResult;
        formState?: MetaWriteFormState;
        liveWritesEnabled?: boolean;
      };
      if (!res.ok || !json.preview) {
        setErrore(json.error ?? "Anteprima non riuscita.");
        setPreview(null);
        setVerifiedFingerprint(null);
        return;
      }
      setPreview(json.preview);
      setLiveWritesEnabled(json.liveWritesEnabled === true);
      if (json.formState) applyFormState(json.formState);
      setFormDirty(false);
      if (json.preview.canWrite) {
        setVerifiedFingerprint(json.preview.fingerprint);
      } else {
        setVerifiedFingerprint(null);
      }
    } catch {
      setErrore("Anteprima non riuscita.");
      setPreview(null);
      setVerifiedFingerprint(null);
    } finally {
      setBusy(false);
    }
  }

  async function searchGeo() {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per cercare la zona Meta.");
        return;
      }
      const res = await fetch("/api/meta/write-geo-search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          campaignId,
          query: geoQuery,
          countryCode,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        hits?: GeoHit[];
      };
      if (!res.ok) {
        setErrore(json.error ?? "Ricerca zona non riuscita.");
        return;
      }
      setGeoHits(json.hits ?? []);
    } catch {
      setErrore("Ricerca zona non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function upgradePermission() {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per autorizzare Meta.");
        return;
      }
      const res = await fetch("/api/meta/oauth/start", {
        method: "POST",
        headers,
        body: JSON.stringify({
          campaignId,
          purpose: "write_upgrade",
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        authorizationUrl?: string;
      };
      if (!res.ok || !json.authorizationUrl) {
        setErrore(
          json.error ??
            "Autorizzazione scrittura non disponibile. Serve META_WRITE_LOGIN_CONFIG_ID.",
        );
        return;
      }
      window.location.href = json.authorizationUrl;
    } catch {
      setErrore("Autorizzazione Meta non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCreate() {
    if (busy || !preview || !confirmEnabled) return;
    setBusy(true);
    setErrore(null);
    setConfirmMsg(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per confermare.");
        return;
      }
      const res = await fetch("/api/meta/write-confirm", {
        method: "POST",
        headers,
        body: JSON.stringify({
          campaignId,
          fingerprint: preview.fingerprint,
          humanConfirmed: true,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        result?: {
          executed: boolean;
          liveWritesGated: boolean;
          state: string;
          errorSafeMessage: string | null;
          metaCampaignId: string | null;
          metaAdSetId: string | null;
        };
        metaWrites?: number;
      };
      if (!res.ok || !json.result) {
        setErrore(json.error ?? "Conferma non riuscita.");
        return;
      }
      const r = json.result;
      if (r.liveWritesGated) {
        setConfirmMsg(
          r.errorSafeMessage ??
            "Conferma registrata. Creazione live ancora disabilitata.",
        );
      } else if (r.executed && r.state === "COMPLETED") {
        setConfirmMsg(
          preview?.resumeMode === "RESUME_ADSET"
            ? `Gruppo creato su Meta (PAUSED): ${r.metaAdSetId}. Campagna esistente non ricreata.`
            : `Creati su Meta (PAUSED): campagna ${r.metaCampaignId}, gruppo ${r.metaAdSetId}.`,
        );
      } else if (r.state === "PARTIALLY_CREATED") {
        setConfirmMsg(
          r.errorSafeMessage ??
            "Campagna creata, gruppo non riuscito. Nessuna eliminazione automatica.",
        );
      } else {
        setConfirmMsg(r.errorSafeMessage ?? `Stato: ${r.state}`);
      }
      await hydrateFromServer();
    } catch {
      setErrore("Conferma non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const unresolvedVisible = hasVisibleUnresolved({
    specialKind,
    destination,
    metaGeoKey,
    startAt,
    endAt,
  });

  const confirmEnabled =
    Boolean(preview?.canWrite) &&
    liveWritesEnabled &&
    !formDirty &&
    !unresolvedVisible &&
    verifiedFingerprint != null &&
    preview?.fingerprint === verifiedFingerprint &&
    !busy &&
    !hydrating;

  const adsOk = preview?.adsManagementPresent === true;
  const isResumeAdSet = preview?.resumeMode === "RESUME_ADSET";
  const writeAlreadyCompleted = preview?.writeAlreadyCompleted === true;

  return (
    <section className="mt-8 rounded-[12px] border border-[var(--border)] bg-white/70 p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        Configurazione Meta
      </h2>
      <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-muted)]">
        {writeAlreadyCompleted
          ? "Configurazione Meta già creata: campagna e gruppo esistono in stato non attivo (PAUSED). Nessuna nuova creazione."
          : isResumeAdSet
            ? "Ripresa gerarchia parziale: la campagna Meta esiste già (PAUSED). Alla conferma verrà creato solo il gruppo di inserzioni mancante. Nessuna nuova campagna, nessuna pubblicazione automatica."
            : "Anteprima allineata alla configurazione che Ally scriverà su Meta. La creazione produce 1 campagna e 1 gruppo in stato non attivo. Nessuna pubblicazione automatica."}
      </p>

      {hydrating ? (
        <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
          Caricamento configurazione canonica…
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[12.5px] text-[var(--ink-muted)]">
          Categoria speciale Meta
          <select
            className="mt-1 h-9 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px] text-[var(--ink)]"
            value={specialKind}
            onChange={(e) => {
              markDirty();
              setSpecialKind(e.target.value === "NONE" ? "NONE" : "UNRESOLVED");
            }}
          >
            <option value="UNRESOLVED">Da confermare</option>
            <option value="NONE">Nessuna</option>
          </select>
        </label>
        <label className="text-[12.5px] text-[var(--ink-muted)]">
          Destinazione
          <select
            className="mt-1 h-9 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px] text-[var(--ink)]"
            value={destination}
            onChange={(e) => {
              markDirty();
              setDestination(e.target.value);
            }}
          >
            <option value="">Da scegliere</option>
            <option value="META_LEAD_FORM">Modulo Meta</option>
            <option value="WEBSITE">Sito web</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PHONE">Telefono</option>
          </select>
        </label>
        {destination === "META_LEAD_FORM" ? (
          <>
            <label className="text-[12.5px] text-[var(--ink-muted)]">
              Page ID
              <input
                className="mt-1 h-9 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px]"
                value={pageId}
                onChange={(e) => {
                  markDirty();
                  setPageId(e.target.value);
                }}
              />
            </label>
            <label className="text-[12.5px] text-[var(--ink-muted)]">
              Form ID
              <input
                className="mt-1 h-9 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px]"
                value={formId}
                onChange={(e) => {
                  markDirty();
                  setFormId(e.target.value);
                }}
              />
            </label>
          </>
        ) : null}
        <label className="text-[12.5px] text-[var(--ink-muted)]">
          Inizio ({timezoneName})
          <input
            type="datetime-local"
            className="mt-1 h-9 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px]"
            value={startAt}
            onChange={(e) => {
              markDirty();
              setStartAt(e.target.value);
            }}
          />
        </label>
        <label className="text-[12.5px] text-[var(--ink-muted)]">
          Fine ({timezoneName})
          <input
            type="datetime-local"
            className="mt-1 h-9 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px]"
            value={endAt}
            onChange={(e) => {
              markDirty();
              setEndAt(e.target.value);
            }}
          />
        </label>
      </div>

      <div className="mt-3 rounded-[8px] border border-[var(--border)] p-3">
        <p className="text-[12px] font-medium text-[var(--ink)]">
          Zona Meta
        </p>
        {geoLabel && metaGeoKey ? (
          <p className="mt-1 text-[12.5px] text-[var(--ink)]">
            {geoLabel} — risolta da Meta
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
            Seleziona una località dai risultati ufficiali Meta.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="h-9 min-w-[140px] flex-1 rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px]"
            value={geoQuery}
            onChange={(e) => setGeoQuery(e.target.value)}
            placeholder="Cerca città"
          />
          <input
            className="h-9 w-16 rounded-[8px] border border-[var(--border)] bg-white px-2 text-[13px]"
            value={countryCode}
            onChange={(e) => {
              markDirty();
              setCountryCode(e.target.value.toUpperCase());
            }}
            placeholder="IT"
          />
          <button
            type="button"
            className="aff-btn-secondary"
            disabled={busy}
            onClick={() => void searchGeo()}
          >
            Cerca su Meta
          </button>
        </div>
        {geoHits.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {geoHits.map((h) => (
              <li key={h.key}>
                <button
                  type="button"
                  className="text-left text-[12.5px] text-[var(--ink)] underline-offset-2 hover:underline"
                  onClick={() => {
                    markDirty();
                    setMetaGeoKey(h.key);
                    const label = [h.name, h.region, h.countryCode]
                      .filter(Boolean)
                      .join(", ");
                    setGeoLabel(label || h.name);
                  }}
                >
                  {h.name}
                  {h.region ? ` · ${h.region}` : ""}
                  {h.countryCode ? ` · ${h.countryCode}` : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          className="aff-btn-secondary"
          disabled={busy || hydrating}
          onClick={() => void runPreview()}
        >
          {busy ? "Preparazione…" : "Verifica configurazione Meta"}
        </button>
        {adsOk ? (
          <p className="text-[12.5px] text-[var(--ink)]">
            Autorizzazione Meta attiva
            <button
              type="button"
              className="ml-2 text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
              disabled={busy}
              onClick={() => void upgradePermission()}
            >
              Rinnova
            </button>
          </p>
        ) : (
          <button
            type="button"
            className="aff-btn-secondary"
            disabled={busy}
            onClick={() => void upgradePermission()}
            title="Richiede Login for Business con ads_management"
          >
            Autorizza creazione su Meta
          </button>
        )}
        {!writeAlreadyCompleted ? (
          <button
            type="button"
            className="aff-btn-primary"
            disabled={!confirmEnabled}
            onClick={() => void confirmCreate()}
            title={
              confirmEnabled
                ? isResumeAdSet
                  ? "Completa solo il gruppo di inserzioni (PAUSED)"
                  : "Conferma creazione PAUSED"
                : formDirty || unresolvedVisible
                  ? "Risolvi i campi e verifica di nuovo"
                  : "Completa i campi e i permessi prima"
            }
          >
            {isResumeAdSet
              ? "Completa creazione del gruppo su Meta"
              : "Conferma creazione su Meta"}
          </button>
        ) : (
          <p className="text-[13px] font-medium text-[var(--ink)]">
            Configurazione Meta già creata
          </p>
        )}
      </div>
      <p className="mt-2 text-[12px] text-[var(--ink-muted)]">
        {writeAlreadyCompleted
          ? "Campagna e gruppo già presenti su Meta in stato non attivo. Nessuna nuova creazione disponibile."
          : isResumeAdSet
            ? "Verrà creato solo 1 gruppo di inserzioni in stato non attivo. La campagna Meta esistente non verrà ricreata. Nessuna attivazione automatica."
            : "Verranno creati 1 campagna e 1 gruppo di inserzioni in stato non attivo. Nessuna attivazione automatica."}
        {formDirty ? " Modifiche non verificate — conferma disabilitata." : ""}
      </p>

      {errore ? (
        <p className="mt-3 text-[13px] text-[var(--danger,#b42318)]">{errore}</p>
      ) : null}
      {confirmMsg ? (
        <p className="mt-3 text-[13px] text-[var(--ink)]">{confirmMsg}</p>
      ) : null}

      {preview && !formDirty ? (
        <div className="mt-4 space-y-3 text-[13px] text-[var(--ink)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
            {writeAlreadyCompleted
              ? "Riepilogo (già creato su Meta)"
              : isResumeAdSet
                ? "Riepilogo ripresa (solo gruppo mancante)"
                : "Riepilogo finale (cosa verrà creato)"}
          </p>
          <dl className="grid gap-1.5 sm:grid-cols-[11rem_1fr]">
            <dt className="text-[var(--ink-muted)]">Account</dt>
            <dd>
              {accountLabel || "Account collegato"}
              {adAccountId ? ` / ${adAccountId}` : ""}
            </dd>
            <dt className="text-[var(--ink-muted)]">
              {isResumeAdSet ? "Campagna Meta" : "Campagna"}
            </dt>
            <dd>{preview.campaign?.name ?? "—"}</dd>
            {isResumeAdSet ? (
              <>
                <dt className="text-[var(--ink-muted)]">Stato campagna</dt>
                <dd>Già creata — Non attiva (PAUSED)</dd>
                <dt className="text-[var(--ink-muted)]">Azione campagna</dt>
                <dd>NON verrà creata di nuovo</dd>
              </>
            ) : (
              <>
                <dt className="text-[var(--ink-muted)]">Obiettivo</dt>
                <dd>
                  {preview.summaryIt.campaignLines
                    .find((l) => l.startsWith("Obiettivo:"))
                    ?.replace("Obiettivo: ", "") ?? "—"}
                </dd>
                <dt className="text-[var(--ink-muted)]">Categoria speciale</dt>
                <dd>
                  {specialKind === "NONE" ? "Nessuna" : "Da confermare"}
                </dd>
              </>
            )}
            <dt className="text-[var(--ink-muted)]">Gruppo di inserzioni</dt>
            <dd>{preview.adSet?.name ?? "Gruppo principale"}</dd>
            {isResumeAdSet ? (
              <>
                <dt className="text-[var(--ink-muted)]">Stato gruppo</dt>
                <dd>Da creare — Non attivo (PAUSED)</dd>
              </>
            ) : null}
            <dt className="text-[var(--ink-muted)]">Località</dt>
            <dd>
              {geoLabel
                ? isResumeAdSet
                  ? geoLabel
                  : `${geoLabel} — risolta da Meta`
                : "Da risolvere"}
            </dd>
            <dt className="text-[var(--ink-muted)]">Budget</dt>
            <dd>
              {preview.summaryIt.adSetLines
                .find((l) => l.startsWith("Budget:"))
                ?.replace("Budget: ", "") ?? "—"}
            </dd>
            <dt className="text-[var(--ink-muted)]">Programmazione</dt>
            <dd>
              {startAt && endAt
                ? `${formatDatetimeLocalDisplay(startAt)} → ${formatDatetimeLocalDisplay(endAt)} (${timezoneName})`
                : "Da aggiornare"}
            </dd>
            <dt className="text-[var(--ink-muted)]">Ottimizzazione</dt>
            <dd>
              {preview.summaryIt.adSetLines
                .find((l) => l.startsWith("Ottimizzazione:"))
                ?.replace("Ottimizzazione: ", "") ?? "—"}
            </dd>
            <dt className="text-[var(--ink-muted)]">Fatturazione</dt>
            <dd>
              {preview.summaryIt.adSetLines
                .find((l) => l.startsWith("Fatturazione:"))
                ?.replace("Fatturazione: ", "") ?? "—"}
            </dd>
            <dt className="text-[var(--ink-muted)]">Strategia di offerta</dt>
            <dd>
              {preview.summaryIt.adSetLines
                .find((l) => l.startsWith("Strategia di offerta:"))
                ?.replace("Strategia di offerta: ", "") ?? "—"}
            </dd>
            {!isResumeAdSet && preview.adSet?.bid_strategy ? (
              <>
                <dt className="text-[var(--ink-muted)]">bid_strategy</dt>
                <dd>{preview.adSet.bid_strategy}</dd>
              </>
            ) : null}
            <dt className="text-[var(--ink-muted)]">Pubblico</dt>
            <dd>
              {preview.summaryIt.adSetLines
                .find((l) => l.startsWith("Pubblico:"))
                ?.replace("Pubblico: ", "") ?? "—"}
            </dd>
            {!isResumeAdSet &&
            preview.summaryIt.adSetLines.some((l) =>
              l.startsWith("targeting_automation.advantage_audience"),
            ) ? (
              <>
                <dt className="text-[var(--ink-muted)]">
                  targeting_automation.advantage_audience
                </dt>
                <dd>
                  {preview.summaryIt.adSetLines
                    .find((l) =>
                      l.startsWith("targeting_automation.advantage_audience"),
                    )
                    ?.split("=")[1]
                    ?.trim() ?? "—"}
                </dd>
              </>
            ) : null}
            <dt className="text-[var(--ink-muted)]">Età minima</dt>
            <dd>
              {preview.summaryIt.adSetLines
                .find((l) => l.startsWith("Età minima:"))
                ?.replace("Età minima: ", "") ?? "—"}
            </dd>
            {isResumeAdSet ? (
              <>
                <dt className="text-[var(--ink-muted)]">Età massima</dt>
                <dd>Nessun limite rigido</dd>
                <dt className="text-[var(--ink-muted)]">Fascia suggerita</dt>
                <dd>
                  {preview.summaryIt.adSetLines
                    .find((l) => l.startsWith("Fascia suggerita:"))
                    ?.replace("Fascia suggerita: ", "") ?? "Nessuna"}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-[var(--ink-muted)]">
                  Fascia d&apos;età suggerita
                </dt>
                <dd>
                  {preview.summaryIt.adSetLines
                    .find((l) => l.startsWith("Fascia d'età suggerita:"))
                    ?.replace("Fascia d'età suggerita: ", "") ?? "Nessuna"}
                </dd>
              </>
            )}
            <dt className="text-[var(--ink-muted)]">Destinazione finale</dt>
            <dd>
              {destination === "WEBSITE"
                ? "Sito web — URL da definire nella creatività"
                : destination === "META_LEAD_FORM"
                  ? "Modulo Meta"
                  : destination === "WHATSAPP"
                    ? "WhatsApp"
                    : destination === "PHONE"
                      ? "Telefono"
                      : "Da scegliere"}
            </dd>
            {!isResumeAdSet && destination === "WEBSITE" ? (
              <>
                <dt className="text-[var(--ink-muted)]">
                  Ad Set destination_type
                </dt>
                <dd>
                  {preview.adSet?.destination_type
                    ? preview.adSet.destination_type
                    : "Non inviato"}
                </dd>
              </>
            ) : null}
            <dt className="text-[var(--ink-muted)]">Distribuzione</dt>
            <dd>
              {isResumeAdSet
                ? "Advantage+ / automatica"
                : "Advantage+/automatica"}
            </dd>
            {!isResumeAdSet ? (
              <>
                <dt className="text-[var(--ink-muted)]">Stato campagna</dt>
                <dd>Non attiva (PAUSED)</dd>
                <dt className="text-[var(--ink-muted)]">Stato gruppo</dt>
                <dd>Non attivo (PAUSED)</dd>
              </>
            ) : null}
            <dt className="text-[var(--ink-muted)]">Creatività</dt>
            <dd>Non creata</dd>
            <dt className="text-[var(--ink-muted)]">Inserzione</dt>
            <dd>Non creata</dd>
            <dt className="text-[var(--ink-muted)]">Spesa automatica</dt>
            <dd>No</dd>
          </dl>
          {preview.summaryIt.missingLines.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                Da completare
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.summaryIt.missingLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[12px] text-[var(--ink-muted)]">
            {preview.summaryIt.footnote}
          </p>
          {confirmEnabled ? (
            <p className="text-[12px] text-[var(--ink)]">
              {isResumeAdSet
                ? "Configurazione pronta. Premi «Completa creazione del gruppo su Meta» solo dopo verifica esplicita — nessun write senza il tuo click."
                : "Configurazione pronta. Premi «Conferma creazione su Meta» solo dopo verifica esplicita — nessun write senza il tuo click."}
            </p>
          ) : null}
          {preview.metaValidation?.status === "PASS" ? (
            <p className="text-[12px] text-[var(--ink)]">
              Configurazione verificata anche da Meta.
            </p>
          ) : null}
          {preview.metaValidation?.status === "FAIL" ? (
            <p className="text-[12px] text-[var(--ink-muted)]">
              {preview.metaValidation.safeMessage ??
                "Meta ha segnalato un problema sulla configurazione. Creazione bloccata."}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
