"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  etichettaHierarchyState,
  etichettaMetaDeliveryStatus,
  pluralizzaGruppi,
  pluralizzaInserzioni,
  type AllyHierarchyOperationalState,
  type HierarchyDataSufficiency,
} from "@/lib/meta/hierarchy-evaluate";

type ResultMappingConfidence = "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";

type HierarchyAd = {
  metaAdId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: ResultMappingConfidence;
  dataSufficiency: HierarchyDataSufficiency;
  operationalState: AllyHierarchyOperationalState;
  creativeThumbnailUrl: string | null;
  creativeTitle: string | null;
  creativeBody: string | null;
};

type HierarchyAdSet = {
  metaAdSetId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: ResultMappingConfidence;
  dataSufficiency: HierarchyDataSufficiency;
  operationalState: AllyHierarchyOperationalState;
  ads: HierarchyAd[];
};

type HierarchyPayload = {
  metaCampaignId: string;
  campaignName: string;
  adSets: HierarchyAdSet[];
  diagnosis: {
    focusAdSetName: string | null;
    focusAdName: string | null;
    lines: string[];
  };
  hierarchyAvailable: boolean;
};

const AMBIGUOUS_RESULTS_HINT =
  "Meta restituisce più tipi di risultato compatibili. Ally evita di scegliere arbitrariamente quale usare.";

const COST_RESULT_HINT =
  "Meta restituisce più tipi di risultato compatibili; Ally non calcola un costo per risultato senza evidenza sufficiente.";

function formatEuro(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNum(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("it-IT");
}

function isSafeThumbnailUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function MetaDeliveryBadge({ status }: { status: string | null }) {
  const label = etichettaMetaDeliveryStatus(status);
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--ink-muted)]">
      {label}
    </span>
  );
}

function InfoDot({ label }: { label: string }) {
  return (
    <span
      className="ml-0.5 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-[rgba(0,0,0,0.15)] text-[9px] leading-none text-[var(--ink-muted)]"
      title={label}
      aria-label={label}
    >
      i
    </span>
  );
}

function EntityMetrics({
  spend,
  results,
  costPerResult,
  resultMappingConfidence,
  dataSufficiency,
  operationalState,
}: {
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  resultMappingConfidence: ResultMappingConfidence;
  dataSufficiency: HierarchyDataSufficiency;
  operationalState: AllyHierarchyOperationalState;
}) {
  const insufficient = dataSufficiency === "INSUFFICIENT_DATA";
  const resultsAmbiguous =
    resultMappingConfidence === "AMBIGUOUS" ||
    (resultMappingConfidence === "UNKNOWN" &&
      spend != null &&
      spend > 0 &&
      results == null);
  const showCost =
    costPerResult != null &&
    Number.isFinite(costPerResult) &&
    resultMappingConfidence === "CONFIDENT";

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--ink-muted)]">
        <span>
          <span className="text-[var(--ink-muted)]">Spesa </span>
          <span className="font-medium text-[var(--ink)]">
            {formatEuro(spend)}
          </span>
        </span>
        <span className="inline-flex items-center">
          <span className="text-[var(--ink-muted)]">Risultati </span>
          {resultsAmbiguous ? (
            <>
              <span className="ml-1 font-medium text-[var(--ink)]">
                non determinabili
              </span>
              <InfoDot label={AMBIGUOUS_RESULTS_HINT} />
            </>
          ) : results != null ? (
            <span className="ml-1 font-medium text-[var(--ink)]">
              {formatNum(results)}
            </span>
          ) : (
            <span className="ml-1">—</span>
          )}
        </span>
        {showCost ? (
          <span>
            <span className="text-[var(--ink-muted)]">Costo per risultato </span>
            <span className="font-medium text-[var(--ink)]">
              {formatEuro(costPerResult)}
            </span>
          </span>
        ) : resultsAmbiguous ? (
          <span className="inline-flex items-center">
            <span className="text-[var(--ink-muted)]">Costo per risultato </span>
            <span className="ml-1">—</span>
            <InfoDot label={COST_RESULT_HINT} />
          </span>
        ) : null}
      </div>
      {insufficient ? (
        <div>
          <span className="inline-flex items-center rounded-full bg-[rgba(180,140,60,0.12)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink)]">
            Dati insufficienti
          </span>
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Servono più dati prima di valutare la performance.
          </p>
        </div>
      ) : operationalState !== "NEUTRAL" &&
        operationalState !== "INSUFFICIENT_DATA" ? (
        <span className="text-[10px] text-[var(--ink-muted)]">
          {etichettaHierarchyState(operationalState)}
        </span>
      ) : null}
    </div>
  );
}

function CreativeThumb({
  url,
  hasCreativeText,
}: {
  url: string | null;
  hasCreativeText: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const safe = isSafeThumbnailUrl(url) && !broken;

  if (safe) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url!}
        alt=""
        className="h-10 w-10 shrink-0 rounded object-cover"
        onError={() => setBroken(true)}
      />
    );
  }

  if (hasCreativeText || (url && broken)) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded border border-dashed border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.02)] px-0.5 text-center"
        title="Anteprima non disponibile"
      >
        <span className="text-[8px] leading-tight text-[var(--ink-muted)]">
          Anteprima non disponibile
        </span>
      </div>
    );
  }

  return null;
}

async function getBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function MetaHierarchyPanel({
  clientId,
  campaignId,
}: {
  clientId: string;
  /** Ally UUID of meta_campaigns.id — not Meta Graph campaign id. */
  campaignId: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HierarchyPayload | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestGen = useRef(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const gen = ++requestGen.current;

    setLoading(true);
    setError(null);

    try {
      const token = await getBearerToken();
      if (!token) {
        if (gen !== requestGen.current) return;
        setError("Non riesco a caricare la struttura Meta.");
        setData(null);
        return;
      }

      const res = await fetch(
        `/api/meta/campaign-hierarchy?clientId=${encodeURIComponent(clientId)}&campaignId=${encodeURIComponent(campaignId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        },
      );

      if (gen !== requestGen.current) return;

      let json: { hierarchy?: HierarchyPayload; error?: string } = {};
      try {
        json = (await res.json()) as {
          hierarchy?: HierarchyPayload;
          error?: string;
        };
      } catch {
        json = {};
      }

      if (!res.ok) {
        setError("Non riesco a caricare la struttura Meta.");
        setData(null);
        return;
      }

      const hierarchy = json.hierarchy ?? null;
      if (
        !hierarchy ||
        typeof hierarchy !== "object" ||
        !Array.isArray(hierarchy.adSets)
      ) {
        setError("Non riesco a caricare la struttura Meta.");
        setData(null);
        return;
      }

      // Back-compat if older payloads omit confidence
      const normalized: HierarchyPayload = {
        ...hierarchy,
        adSets: hierarchy.adSets.map((as) => ({
          ...as,
          resultMappingConfidence:
            as.resultMappingConfidence ??
            (as.results == null && as.spend != null && as.spend > 0
              ? "AMBIGUOUS"
              : "UNKNOWN"),
          ads: (as.ads ?? []).map((ad) => ({
            ...ad,
            resultMappingConfidence:
              ad.resultMappingConfidence ??
              (ad.results == null && ad.spend != null && ad.spend > 0
                ? "AMBIGUOUS"
                : "UNKNOWN"),
          })),
        })),
      };

      setData(normalized);
      setError(null);
    } catch {
      if (controller.signal.aborted) return;
      if (gen !== requestGen.current) return;
      setError("Non riesco a caricare la struttura Meta.");
      setData(null);
    } finally {
      if (gen === requestGen.current) {
        setLoading(false);
      }
    }
  }, [clientId, campaignId]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setLoading(false);
      return;
    }
    if (data) return;
    if (error) return;
    void load();
  }, [open, clientId, campaignId, data, error, load]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    setExpanded({});
  }, [clientId, campaignId]);

  const adSetCount = data?.adSets.length ?? 0;
  const adCount =
    data?.adSets.reduce((sum, a) => sum + (a.ads?.length ?? 0), 0) ?? 0;
  const summaryReady = Boolean(data?.hierarchyAvailable);

  return (
    <div className="mt-4 border-t border-[rgba(0,0,0,0.06)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
            Struttura della campagna Meta
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {summaryReady
              ? `${pluralizzaGruppi(adSetCount)} · ${pluralizzaInserzioni(adCount)}`
              : open
                ? "Caricamento struttura…"
                : "Mostra struttura"}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--ink)]">
          {open ? "Nascondi ▴" : "Mostra struttura ▾"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && (
            <p className="text-xs text-[var(--ink-muted)]">Caricamento…</p>
          )}

          {!loading && error && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--ink)]">{error}</p>
              <p className="text-xs text-[var(--ink-muted)]">Riprova tra poco.</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setData(null);
                }}
                className="text-xs font-medium text-[var(--accent)]"
              >
                Riprova
              </button>
            </div>
          )}

          {!loading && !error && data && !data.hierarchyAvailable && (
            <p className="text-xs text-[var(--ink-muted)]">
              Nessun gruppo di inserzioni disponibile.
            </p>
          )}

          {!loading &&
            !error &&
            data?.hierarchyAvailable &&
            data.adSets.length === 0 && (
              <p className="text-xs text-[var(--ink-muted)]">
                Nessun gruppo di inserzioni disponibile.
              </p>
            )}

          {!loading &&
            !error &&
            data?.hierarchyAvailable &&
            data.adSets.length > 0 && (
              <div className="space-y-2">
                {data.diagnosis.lines.length > 0 && (
                  <ul className="space-y-1 text-xs text-[var(--ink)]">
                    {data.diagnosis.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}

                <div className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.015)] px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                    Gruppo di inserzioni
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--ink-muted)]">
                    Definisce pubblico, distribuzione e impostazioni condivise
                    dagli annunci.
                  </p>
                </div>

                <ul className="space-y-3">
                  {data.adSets.map((adSet) => {
                    const isOpen = Boolean(expanded[adSet.metaAdSetId]);
                    const adsN = adSet.ads.length;
                    return (
                      <li
                        key={adSet.metaAdSetId}
                        className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.06)] bg-[var(--ally-surface)] px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-[var(--ink)]">
                              {adSet.name}
                            </p>
                            <MetaDeliveryBadge
                              status={adSet.effectiveStatus ?? adSet.status}
                            />
                          </div>
                          <EntityMetrics
                            spend={adSet.spend}
                            results={adSet.results}
                            costPerResult={adSet.costPerResult}
                            resultMappingConfidence={
                              adSet.resultMappingConfidence
                            }
                            dataSufficiency={adSet.dataSufficiency}
                            operationalState={adSet.operationalState}
                          />
                        </div>

                        <button
                          type="button"
                          className="mt-2 text-xs font-medium text-[var(--ink)] underline-offset-2 hover:underline"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [adSet.metaAdSetId]: !prev[adSet.metaAdSetId],
                            }))
                          }
                          aria-expanded={isOpen}
                        >
                          {isOpen
                            ? adsN === 1
                              ? "Nascondi inserzione"
                              : "Nascondi inserzioni"
                            : `Mostra ${pluralizzaInserzioni(adsN)}`}
                        </button>

                        {isOpen && (
                          <div className="relative mt-3 ml-2 border-l-2 border-[rgba(0,0,0,0.08)] pl-3 sm:ml-3 sm:pl-4">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                              Inserzione
                            </p>
                            {adSet.ads.length === 0 ? (
                              <p className="text-xs text-[var(--ink-muted)]">
                                Nessuna inserzione disponibile.
                              </p>
                            ) : (
                              <ul className="space-y-3">
                                {adSet.ads.map((ad) => (
                                  <li
                                    key={ad.metaAdId}
                                    className="flex gap-2.5"
                                  >
                                    <CreativeThumb
                                      url={ad.creativeThumbnailUrl}
                                      hasCreativeText={Boolean(
                                        ad.creativeTitle || ad.creativeBody,
                                      )}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-[var(--ink)]">
                                          {ad.name}
                                        </p>
                                        <MetaDeliveryBadge
                                          status={
                                            ad.effectiveStatus ?? ad.status
                                          }
                                        />
                                      </div>
                                      <EntityMetrics
                                        spend={ad.spend}
                                        results={ad.results}
                                        costPerResult={ad.costPerResult}
                                        resultMappingConfidence={
                                          ad.resultMappingConfidence
                                        }
                                        dataSufficiency={ad.dataSufficiency}
                                        operationalState={ad.operationalState}
                                      />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
