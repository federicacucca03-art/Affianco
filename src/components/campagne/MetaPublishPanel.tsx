"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MetaPublishPlan } from "@/lib/meta/publish/types";
import {
  ALLY_SPECIAL_AD_CATEGORY_CATALOG,
  decisionFromEasyModePickerValue,
} from "@/lib/meta/write/special-ad-categories";
import { formatGeoSearchHitLabelIt } from "@/lib/meta/write/geo-search-normalize";

type MetaPageOption = { id: string; name: string | null };
type GeoHit = {
  key: string;
  name: string;
  type: string | null;
  region?: string | null;
  countryCode?: string | null;
};

type Props = {
  campaignId: string;
  /** Guided / preferred destination from Ally campaign setup (e.g. WEBSITE). */
  preferredDestination?: string | null;
  destinationUrl?: string | null;
  pageId?: string;
  onPageIdChange?: (pageId: string) => void;
  onDestinationUrlChange?: (url: string) => void;
  /** When false, hide secondary dry-run tooling (wizard Step 6). */
  showDryRunTools?: boolean;
};

/**
 * M14 — Ally-first publish review (Campaign → Ad Set → Creative → Ad).
 * CTA executes FULL_PUBLISH_PAUSED via /api/meta/publish-plan when ENABLED.
 * Gated while QA live write env is off. Never claims published without Graph success.
 */
export function MetaPublishPanel({
  campaignId,
  preferredDestination = null,
  destinationUrl = null,
  pageId: pageIdProp,
  onPageIdChange,
  onDestinationUrlChange,
  showDryRunTools = true,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<MetaPublishPlan | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [dryMsg, setDryMsg] = useState<string | null>(null);
  const [pages, setPages] = useState<MetaPageOption[]>([]);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState(pageIdProp ?? "");
  const [urlLocal, setUrlLocal] = useState(destinationUrl ?? "");
  const [specialKind, setSpecialKind] = useState<string>("UNRESOLVED");
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [geoKey, setGeoKey] = useState<string>("");
  const [geoLabel, setGeoLabel] = useState<string>("");
  const [needsWriteUpgrade, setNeedsWriteUpgrade] = useState(false);
  const [humanConfirm, setHumanConfirm] = useState(false);

  // Parent props may arrive empty before campaign load — never wipe hydrated values.
  useEffect(() => {
    const next = (pageIdProp ?? "").trim();
    if (next) setSelectedPageId(next);
  }, [pageIdProp]);

  useEffect(() => {
    const next = (destinationUrl ?? "").trim();
    if (next) setUrlLocal(next);
  }, [destinationUrl]);

  async function authHeaders(): Promise<HeadersInit | null> {
    const data = await supabase.auth.getSession();
    const token = data.data.session?.access_token?.trim();
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  type FormHydrateState = {
    specialKind: string;
    specialCategories?: string[];
    destinationUrl: string;
    pageId: string;
    metaGeoKey: string | null;
    geoLabel: string | null;
    countryCode: string;
  };

  async function persistCanonical(opts: {
    pageId?: string;
    destination?: string | null;
    specialKind?: string;
    metaGeoKey?: string | null;
    geoLabel?: string | null;
    countryCode?: string | null;
    startAtIso?: string | null;
    endAtIso?: string | null;
  }) {
    const headers = await authHeaders();
    if (!headers) return null;
    const dest =
      opts.destination ||
      preferredDestination ||
      plan?.review.destinationKind ||
      null;
    const page =
      (opts.pageId ?? selectedPageId ?? "").trim() || "";
    const res = await fetch("/api/meta/write-preview", {
      method: "POST",
      headers,
      body: JSON.stringify({
        campaignId,
        destination: dest,
        ...(page ? { pageId: page } : {}),
        specialAdCategories: decisionFromEasyModePickerValue(
          opts.specialKind ?? specialKind,
        ),
        metaGeoKey: opts.metaGeoKey ?? (geoKey || null),
        geoLabel: opts.geoLabel ?? (geoLabel || null),
        countryCode: opts.countryCode ?? "IT",
        // Schedule is optional for PAUSED create — never invent start/end dates.
        ...(opts.startAtIso !== undefined
          ? { startAtIso: opts.startAtIso }
          : {}),
        ...(opts.endAtIso !== undefined ? { endAtIso: opts.endAtIso } : {}),
        persist: true,
      }),
    });
    const json = (await res.json()) as {
      preview?: { readinessCodes?: string[] };
      formState?: FormHydrateState;
      error?: string;
    };
    if (!res.ok) {
      setErrore(json.error ?? "Salvataggio configurazione non riuscito.");
      return null;
    }
    const codes = json.preview?.readinessCodes ?? [];
    setNeedsWriteUpgrade(codes.includes("MISSING_META_PERMISSION"));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ally-meta-canonical-updated", {
          detail: { campaignId },
        }),
      );
    }
    return json;
  }

  function applyFormHydration(fs: FormHydrateState | null | undefined) {
    if (!fs) return;
    let sac = "UNRESOLVED";
    if (fs.specialKind === "NONE") sac = "NONE";
    else if (fs.specialKind === "CATEGORIES") {
      const cats = fs.specialCategories ?? [];
      sac = cats.length === 1 ? cats[0]! : cats.length === 0 ? "NONE" : "CATEGORIES";
    } else if (fs.specialKind && fs.specialKind !== "UNRESOLVED") {
      sac = fs.specialKind;
    }
    setSpecialKind(sac);
    const page = (fs.pageId ?? "").trim();
    if (page) {
      setSelectedPageId(page);
      onPageIdChange?.(page);
    }
    const url = (fs.destinationUrl ?? "").trim();
    if (url) {
      setUrlLocal(url);
      onDestinationUrlChange?.(url);
    }
    if (fs.metaGeoKey?.trim()) {
      setGeoKey(fs.metaGeoKey.trim());
      setGeoLabel((fs.geoLabel ?? "").trim());
    }
  }

  async function saveWebsiteUrl(clientId: string, url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    await supabase.from("clients").update({ website: trimmed }).eq("id", clientId);
  }

  function pagesErrorFromCode(
    code: string | undefined,
    fallback: string | undefined,
  ): string {
    switch (code) {
      case "META_PERMISSION_MISSING":
        return (
          fallback ??
          "Permesso Pages mancante sul collegamento Meta. Riautorizza l’accesso alle Pagine Facebook."
        );
      case "META_TOKEN_EXPIRED":
      case "META_REAUTH_REQUIRED":
        return fallback ?? "Sessione Meta scaduta. Ricollega Meta per continuare.";
      case "META_NO_PAGES":
        return (
          fallback ??
          "Nessuna Pagina Facebook disponibile per questa identità Meta."
        );
      case "META_ACCOUNT_DISCOVERY_FAILED":
      case "META_RATE_LIMIT":
      case "META_TEMPORARY_ERROR":
        return fallback ?? "Errore API Meta durante la lettura delle Pagine.";
      default:
        return (
          fallback ??
          "Pagine Facebook non disponibili con questo collegamento Meta."
        );
    }
  }

  async function caricaPagine(clientId: string) {
    setPagesLoading(true);
    setPagesError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setPagesError("Sessione assente.");
        return;
      }
      const res = await fetch(
        `/api/meta/pages?clientId=${encodeURIComponent(clientId)}`,
        { headers, cache: "no-store" },
      );
      const json = (await res.json()) as {
        pages?: MetaPageOption[];
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setPages([]);
        setPagesError(pagesErrorFromCode(json.code, json.error));
        return;
      }
      const list = json.pages ?? [];
      setPages(list);
      if (list.length === 0) {
        setPagesError(pagesErrorFromCode(json.code ?? "META_NO_PAGES", json.error));
      } else {
        // Keep campaigns.page_name aligned with selected page_id after discovery.
        const selected = (selectedPageId || pageIdProp || "").trim();
        const match = list.find((p) => p.id === selected);
        const resolvedName = match?.name?.trim();
        if (selected && resolvedName) {
          void supabase
            .from("campaigns")
            .update({ page_id: selected, page_name: resolvedName })
            .eq("id", campaignId);
        }
      }
    } catch {
      setPages([]);
      setPagesError("Errore API Meta durante la lettura delle Pagine.");
    } finally {
      setPagesLoading(false);
    }
  }

  async function resolveGeoIfNeeded(opts?: {
    specialKind?: string;
    skipIfGeoPresent?: string;
  }) {
    const headers = await authHeaders();
    if (!headers) return;
    if ((opts?.skipIfGeoPresent ?? geoKey).trim()) return;
    const res = await fetch("/api/meta/write-geo-search", {
      method: "POST",
      headers,
      body: JSON.stringify({ campaignId, query: "Roma", countryCode: "IT" }),
    });
    const json = (await res.json()) as {
      hits?: GeoHit[];
      plannedCity?: string | null;
      error?: string;
    };
    if (!res.ok) {
      setErrore(json.error ?? "Ricerca zona Meta non riuscita.");
      return;
    }
    const hits = json.hits ?? [];
    setGeoHits(hits);
    const planned = (json.plannedCity ?? "").trim().toLowerCase();
    const preferred =
      hits.find((h) => h.name.toLowerCase() === planned) ??
      hits.find((h) => h.name.toLowerCase().includes("roma")) ??
      hits[0];
    if (preferred) {
      setGeoKey(preferred.key);
      setGeoLabel(preferred.name);
      await persistCanonical({
        metaGeoKey: preferred.key,
        geoLabel: preferred.name,
        countryCode: "IT",
        specialKind: opts?.specialKind ?? specialKind,
      });
    }
  }

  async function caricaPiano() {
    setBusy(true);
    setErrore(null);
    setDryMsg(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Sessione assente. Accedi di nuovo.");
        return;
      }

      // Hydrate from persisted canonical plan + campaign/client rows.
      // Never re-persist local React defaults (that wiped NONE / page / URL).
      const hydrateRes = await fetch("/api/meta/write-preview", {
        method: "POST",
        headers,
        body: JSON.stringify({ campaignId, hydrate: true }),
      });
      const hydrateJson = (await hydrateRes.json()) as {
        formState?: FormHydrateState;
        error?: string;
      };
      if (hydrateRes.ok) {
        applyFormHydration(hydrateJson.formState);
      }

      const hydratedSpecial = (() => {
        const sk = hydrateJson.formState?.specialKind;
        if (sk === "NONE") return "NONE";
        if (!sk || sk === "UNRESOLVED") return "UNRESOLVED";
        if (sk === "CATEGORIES") {
          const cats = hydrateJson.formState?.specialCategories ?? [];
          return cats.length === 1 ? cats[0]! : "UNRESOLVED";
        }
        return sk;
      })();
      const hydratedGeo = (hydrateJson.formState?.metaGeoKey ?? "").trim();

      const res = await fetch(
        `/api/meta/publish-plan?allyCampaignId=${encodeURIComponent(campaignId)}`,
        { headers, cache: "no-store" },
      );
      const json = (await res.json()) as {
        plan?: MetaPublishPlan;
        error?: string;
      };
      if (!res.ok || !json.plan) {
        setErrore(json.error ?? "Impossibile caricare il piano Meta.");
        setPlan(null);
        return;
      }
      setPlan(json.plan);
      setNeedsWriteUpgrade(
        json.plan.blockingIssues.some((b) => b.code === "MISSING_META_PERMISSION") ||
          json.plan.writePreview.readinessCodes.includes(
            "MISSING_META_PERMISSION",
          ),
      );

      // Keep form aligned with publish-review sources (campaign page_id + client website).
      const reviewPage =
        json.plan.creative?.object_story_spec.page_id?.trim() ||
        (hydrateJson.formState?.pageId ?? "").trim();
      if (reviewPage) {
        setSelectedPageId(reviewPage);
        onPageIdChange?.(reviewPage);
      }
      const link =
        json.plan.creative?.object_story_spec.link_data?.link?.trim() ||
        (hydrateJson.formState?.destinationUrl ?? "").trim();
      if (link) {
        setUrlLocal(link);
        onDestinationUrlChange?.(link);
      }

      void caricaPagine(json.plan.clientId);
      void resolveGeoIfNeeded({
        specialKind: hydratedSpecial,
        skipIfGeoPresent: hydratedGeo,
      });
    } catch {
      setErrore("Impossibile caricare il piano Meta.");
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void caricaPiano();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, preferredDestination]);

  async function onSelectPage(nextId: string) {
    const trimmed = nextId.trim();
    if (!trimmed) return;
    setSelectedPageId(trimmed);
    onPageIdChange?.(trimmed);
    if (!plan) return;
    const pageName =
      pages.find((p) => p.id === trimmed)?.name?.trim() || null;
    setBusy(true);
    try {
      await supabase
        .from("campaigns")
        .update({
          page_id: trimmed,
          ...(pageName ? { page_name: pageName } : {}),
        })
        .eq("id", campaignId);
      await persistCanonical({ pageId: trimmed, specialKind });
      await caricaPiano();
    } finally {
      setBusy(false);
    }
  }

  async function onSaveUrl() {
    if (!plan) return;
    const trimmed = urlLocal.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await saveWebsiteUrl(plan.clientId, trimmed);
      onDestinationUrlChange?.(trimmed);
      await persistCanonical({
        destination: preferredDestination || "WEBSITE",
        specialKind,
        pageId: selectedPageId,
      });
      await caricaPiano();
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmSpecial(next: string) {
    setSpecialKind(next);
    setBusy(true);
    try {
      await persistCanonical({
        specialKind: next,
        pageId: selectedPageId,
      });
      await caricaPiano();
    } finally {
      setBusy(false);
    }
  }

  async function onPickGeo(hit: GeoHit) {
    setGeoKey(hit.key);
    setGeoLabel(hit.name);
    setBusy(true);
    try {
      await persistCanonical({
        metaGeoKey: hit.key,
        geoLabel: hit.name,
        countryCode: "IT",
        specialKind,
      });
      await caricaPiano();
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
            "Upgrade scrittura Meta non disponibile in questo ambiente.",
        );
        return;
      }
      // Authorization only — no Meta object create.
      window.location.href = json.authorizationUrl;
    } catch {
      setErrore("Autorizzazione scrittura Meta non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function onDryRun() {
    setBusy(true);
    setErrore(null);
    setDryMsg(null);
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
          action: "dry_run",
        }),
      });
      const json = (await res.json()) as {
        result?: {
          failedAt: string | null;
          markedSynced: boolean;
          markedPublished: boolean;
          steps: Array<{ step: string; status: string; messageIt: string | null }>;
          plan: MetaPublishPlan;
        };
        error?: string;
      };
      if (!res.ok || !json.result) {
        setErrore(json.error ?? "Dry-run non riuscito.");
        return;
      }
      setPlan(json.result.plan);
      const okSteps = json.result.steps.filter((s) => s.status === "VALID").length;
      setDryMsg(
        json.result.failedAt
          ? `Dry-run: blocco a ${json.result.failedAt}. SYNCED=${json.result.markedSynced ? "sì" : "no"}.`
          : `Dry-run OK — ${okSteps} step validi. Nessuna scrittura Meta. Pubblicata=${json.result.markedPublished ? "sì" : "no"}; SYNCED=${json.result.markedSynced ? "sì" : "no"}.`,
      );
    } catch {
      setErrore("Dry-run non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function onExecuteFullPublish() {
    if (!plan || busy) return;
    if (plan.review.ctaState !== "ENABLED") return;
    if (!humanConfirm) {
      setErrore("Conferma esplicita richiesta prima di creare su Meta.");
      return;
    }
    setBusy(true);
    setErrore(null);
    setDryMsg(null);
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
        result?: {
          executed: boolean;
          liveWritesGated: boolean;
          failedAt: string | null;
          metaCampaignId: string | null;
          metaAdSetId: string | null;
          metaCreativeId: string | null;
          metaAdId: string | null;
          errorSafeMessage: string | null;
        };
        error?: string;
      };
      if (!res.ok || !json.result) {
        setErrore(json.error ?? "Pubblicazione Meta non riuscita.");
        return;
      }
      const r = json.result;
      if (r.liveWritesGated && !r.executed) {
        setDryMsg(
          r.errorSafeMessage ??
            "Creazione su Meta non disponibile in questo ambiente (gate scrittura).",
        );
        return;
      }
      if (r.executed) {
        setDryMsg(
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
        await caricaPiano();
        return;
      }
      setDryMsg(
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
  const destKind = (
    preferredDestination ||
    review?.destinationKind ||
    ""
  ).toUpperCase();
  const showWebsiteUrl = destKind === "WEBSITE" || Boolean(urlLocal.trim());

  return (
    <section className="aff-panel-white overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Pubblica su Meta
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Ally pubblica la campagna su Meta come delivery platform. Stato
          iniziale sempre in pausa. Nessuna pubblicazione automatica.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {errore ? (
          <p className="mb-3 text-sm aff-text-danger" role="alert">
            {errore}
          </p>
        ) : null}
        {busy && !plan ? (
          <p className="text-sm text-[var(--ink-muted)]">Caricamento piano…</p>
        ) : null}

        {review ? (
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--primary)]">
                {review.productStatusLabelIt}
              </p>
              <p className="mt-1 text-[18px] font-semibold text-[var(--ink)]">
                {review.headlineIt}
              </p>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--ink-muted)]">Account Meta</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.adAccountLine}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-muted)]">Obiettivo</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.objectiveLine}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--ink-muted)]">Campagna</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.campaignLine}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-muted)]">Budget</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.budgetLine}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-muted)]">Pubblico / zona</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {geoLabel || review.audienceLine}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-muted)]">Destinazione</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.destinationLine}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ink-muted)]">Stato iniziale</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.initialStatusLine}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--ink-muted)]">Creatività Ally</dt>
                <dd className="font-medium text-[var(--ink)]">
                  {review.creativeAssetLine}
                </dd>
                <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                  {review.creativeLine}
                </p>
              </div>
            </dl>

            {showWebsiteUrl ? (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">
                  URL di destinazione
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    className="aff-input flex-1"
                    value={urlLocal}
                    onChange={(e) => setUrlLocal(e.target.value)}
                    placeholder="https://…"
                  />
                  <button
                    type="button"
                    className="aff-btn-secondary"
                    disabled={busy}
                    onClick={() => void onSaveUrl()}
                  >
                    Salva URL
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">
                Questa campagna riguarda una categoria speciale?
              </label>
              <select
                className="aff-input"
                value={specialKind}
                disabled={busy}
                onChange={(e) => void onConfirmSpecial(e.target.value)}
              >
                <option value="UNRESOLVED">Da confermare…</option>
                <option value="NONE">Nessuna categoria speciale</option>
                {ALLY_SPECIAL_AD_CATEGORY_CATALOG.filter(
                  (c) => c.easyModeSelectable,
                ).map((c) => (
                  <option key={c.graphValue} value={c.graphValue}>
                    {c.labelIt}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                Meta applica regole specifiche ad alcune campagne. Seleziona la
                categoria corretta prima della pubblicazione — Ally non la
                decide in silenzio.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">
                Zona Meta
              </label>
              {geoKey ? (
                <p className="text-sm font-medium text-[var(--ink)]">
                  {geoLabel || geoKey}
                </p>
              ) : geoHits.length > 0 ? (
                <ul className="space-y-1">
                  {geoHits.slice(0, 5).map((h) => (
                    <li key={h.key}>
                      <button
                        type="button"
                        className="text-sm text-[var(--primary)] underline"
                        disabled={busy}
                        onClick={() => void onPickGeo(h)}
                      >
                        {formatGeoSearchHitLabelIt({
                          key: h.key,
                          name: h.name,
                          type: h.type,
                          region: h.region ?? null,
                          countryCode: h.countryCode ?? null,
                        })}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  type="button"
                  className="aff-btn-secondary"
                  disabled={busy}
                  onClick={() => void resolveGeoIfNeeded()}
                >
                  Risolvi zona da città pianificata
                </button>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">
                Pagina Facebook
              </label>
              {pagesLoading && !selectedPageId ? (
                <p className="text-sm text-[var(--ink-muted)]">
                  Caricamento pagine…
                </p>
              ) : pages.length > 0 || selectedPageId ? (
                <select
                  className="aff-input"
                  value={selectedPageId}
                  disabled={busy || pagesLoading}
                  onChange={(e) => void onSelectPage(e.target.value)}
                >
                  <option value="">Seleziona una pagina…</option>
                  {selectedPageId &&
                  !pages.some((p) => p.id === selectedPageId) ? (
                    <option value={selectedPageId}>
                      {pagesLoading
                        ? "Pagina salvata (caricamento…)"
                        : `Pagina salvata (${selectedPageId.slice(0, 4)}…)`}
                    </option>
                  ) : null}
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name?.trim() || `Pagina ${p.id.slice(0, 4)}…`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                  <p className="text-[13px] text-[var(--ink-muted)]">
                    {pagesError ??
                      "Selezione pagine non disponibile. Non inventiamo una pagina."}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                    Attuale: {review.pageLine}
                  </p>
                  {pagesError &&
                  (pagesError.includes("permesso") ||
                    pagesError.includes("Permesso") ||
                    pagesError.includes("scaduta") ||
                    pagesError.includes("Ricollega") ||
                    pagesError.includes("Riautorizza")) ? (
                    <button
                      type="button"
                      className="aff-btn-secondary mt-2"
                      disabled={busy}
                      onClick={() => void upgradePermission()}
                    >
                      Riautorizza accesso Pagine Meta
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {needsWriteUpgrade ? (
              <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
                <p className="text-[13px] font-medium text-[var(--ink)]">
                  Serve autorizzazione scrittura Meta (ads_management)
                </p>
                <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                  La connessione in lettura resta valida. Nessun oggetto Meta
                  viene creato durante l&apos;autorizzazione.
                </p>
                <button
                  type="button"
                  className="aff-btn-secondary mt-2"
                  disabled={busy}
                  onClick={() => void upgradePermission()}
                >
                  Autorizza creazione su Meta
                </button>
              </div>
            ) : null}

            {review.productRequirementLines.length > 0 ? (
              <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
                <p className="text-[13px] font-medium text-[var(--ink)]">
                  Requisito Ally (prodotto)
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-[var(--ink-muted)]">
                  {review.productRequirementLines.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--ink-muted)]">
                Approvazione cliente: ok per questo stato, oppure già
                soddisfatta.
              </p>
            )}

            {review.metaRequirementLines.length > 0 ? (
              <div>
                <p className="text-[13px] font-medium text-[var(--ink)]">
                  Requisiti tecnici Meta
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-[var(--ink-muted)]">
                  {review.metaRequirementLines.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {review.warnings.length > 0 ? (
              <div>
                <p className="text-[13px] font-medium text-[var(--ink)]">
                  Da rivedere
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-[var(--ink-muted)]">
                  {review.warnings.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {review.gatedNoteIt ? (
              <p className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--ink-muted)]">
                {review.gatedNoteIt}
              </p>
            ) : null}

            {dryMsg ? (
              <p className="text-[12px] text-[var(--ink-muted)]">{dryMsg}</p>
            ) : null}

            <label className="flex items-start gap-2 text-[13px] text-[var(--ink)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={humanConfirm}
                disabled={busy}
                onChange={(e) => setHumanConfirm(e.target.checked)}
              />
              <span>
                Confermo: crea Campagna, Gruppo, Creatività e Annuncio su Meta
                in <strong>PAUSA</strong>. Nessuna attivazione.
              </span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="aff-btn-secondary"
                disabled={busy}
                onClick={() => void caricaPiano()}
              >
                Aggiorna revisione
              </button>
              {showDryRunTools ? (
                <button
                  type="button"
                  className="aff-btn-secondary"
                  disabled={busy}
                  onClick={() => void onDryRun()}
                >
                  Verifica piano (dry-run)
                </button>
              ) : null}
              <button
                type="button"
                className="aff-btn-primary"
                disabled={
                  busy ||
                  !humanConfirm ||
                  review.ctaState === "DISABLED_NOT_READY" ||
                  review.ctaState === "HIDDEN" ||
                  review.ctaState === "GATED_LIVE_OFF"
                }
                title={
                  review.ctaState === "GATED_LIVE_OFF"
                    ? "Write live non attive"
                    : !humanConfirm
                      ? "Conferma richiesta"
                      : undefined
                }
                onClick={() => void onExecuteFullPublish()}
              >
                {review.ctaLabelIt}
              </button>
            </div>
            <p className="text-[12px] text-[var(--ink-muted)]">
              Lo stato «pubblicata» e SYNCED appaiono solo dopo successo Graph
              reale. Ora: nessuna write.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
