"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  logErroreSupabaseDev,
  messaggioErroreSupabase,
} from "@/lib/supabase-errori";
import { userFacingCampaignText } from "@/lib/campagne-creation-mode";
import { formatGeoSearchHitLabelIt } from "@/lib/meta/write/geo-search-normalize";
import type { Campagna } from "@/types/campagne";
import type {
  MetaWriteFormState,
  MetaWritePreviewResult,
} from "@/lib/meta/write/types";
import {
  ALLY_SPECIAL_AD_CATEGORY_CATALOG,
  decisionFromEasyModePickerValue,
  etichettaSpecialAdCategoryEasy,
} from "@/lib/meta/write/special-ad-categories";
import { CanonicalCampaignReviewPanel } from "@/components/campagne/CanonicalCampaignReviewPanel";
import { EasyBuilderSingleImageInput } from "@/components/campagne/EasyBuilderSingleImageInput";
import { runPreWriteLaunchGuardian } from "@/lib/meta/launch-guardian/prewrite";
import { canonicalV2FromInstantFormDraft } from "@/lib/campagne-canonical-v2";
import { buildMetaExecutionPlanFromV2 } from "@/lib/meta/execution-plan";
import {
  buildCreativePackageFromEasyDraft,
  type AllyCreativeCopySuggestion,
} from "@/lib/meta/creative";
import { hrefModificaConfigurazione } from "@/data/percorsi-nuova-campagna";
import type { CreativitaAsset, CreativitaMeta } from "@/lib/creativita";
import { creativitaToMeta } from "@/lib/creativita";
import {
  anteprimeDaCreativitaMeta,
  caricaCreativitaSuStorage,
  eliminaCreativitaDaStorage,
  pathsCreativitaRimossi,
} from "@/lib/creativita-storage";
import {
  EASY_BUSINESS_GOAL_OPTIONS,
  EASY_LEADS_LOCATION_OPTIONS,
  INSTANT_FORM_BUILDER_STEPS,
  type InstantFormBuilderDraft,
  type InstantFormBuilderStepId,
  type InstantFormBuilderTiming,
  activeSetupSeconds,
  buildEasyReviewSummary,
  builderDraftStorageKey,
  builderTimingStorageKey,
  computeBuilderMetrics,
  easyModeCtaLabelIt,
  easyModeExposesCarouselOrMultiCopy,
  easyModeExposesManualPlacements,
  canOpenBuilderReview,
  allyCampaignDailyBudgetUpdate,
  emptyInstantFormBuilderDraft,
  evaluateBuilderStep,
  instantFormCanonicalDestination,
  instantFormCanonicalObjectiveRaw,
  isEasyInstantFormPath,
  markBriefStarted,
  markReviewReady,
  monthlyBudgetHintIt,
  parseBuilderDraftSnapshot,
  parseBuilderTiming,
  isValidBudgetDailyMajor,
  resolveBudgetDailyMajorForDraft,
  reviewMatchesCreativeAsset,
} from "@/lib/meta/write/instant-form-builder";

type PageOption = { id: string; name: string | null };
type LeadgenFormOption = {
  id: string;
  name: string | null;
  status: string | null;
  pageId: string;
  usable: boolean;
  privacyPolicyUrl?: string | null;
};
type InstagramOption = {
  id: string;
  username: string | null;
  available: boolean;
  pageId: string;
};
type GeoHit = {
  key: string;
  name: string;
  type: string | null;
  countryCode: string | null;
  region: string | null;
};

type Props = {
  campaignId: string;
  campagna: Campagna;
};

function hydrateSpecialKind(fs: MetaWriteFormState): string {
  if (fs.specialKind === "NONE") return "NONE";
  if (fs.specialKind === "UNRESOLVED" || !fs.specialKind) return "UNRESOLVED";
  if (fs.specialKind === "CATEGORIES") {
    const cats = fs.specialCategories ?? [];
    return cats.length === 1 ? cats[0]! : cats.length === 0 ? "NONE" : "CATEGORIES";
  }
  return fs.specialKind;
}

function readLocalDraft(campaignId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(builderDraftStorageKey(campaignId));
    return parseBuilderDraftSnapshot(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

/**
 * P0.7 / P0.8 — 5-Minute Instant Form Easy Builder.
 * Thin UI over write-preview + Ally campaign fields. No Graph mutations.
 */
export function InstantFormEasyBuilder({ campaignId, campagna }: Props) {
  const localSnap = useMemo(() => readLocalDraft(campaignId), [campaignId]);
  const [stepId, setStepId] = useState<InstantFormBuilderStepId>(
    () => localSnap?.stepId ?? "obiettivo",
  );
  const [draft, setDraft] = useState<InstantFormBuilderDraft>(() => {
    const seededPrimary =
      userFacingCampaignText(localSnap?.draft.primaryText) ||
      userFacingCampaignText(campagna.varianteA) ||
      "";
    const seededHeadline =
      userFacingCampaignText(localSnap?.draft.headline) ||
      userFacingCampaignText(campagna.titoloAnnuncio) ||
      "";
    return emptyInstantFormBuilderDraft({
      ...(localSnap?.draft ?? {}),
      budgetDailyMajor: resolveBudgetDailyMajorForDraft(
        localSnap?.draft.budgetDailyMajor,
        campagna.budgetGiornaliero,
      ),
      etaMin: localSnap?.draft.etaMin ?? campagna.etaMin ?? null,
      etaMax: localSnap?.draft.etaMax ?? campagna.etaMax ?? null,
      // Never seed Annuncio / Meta copy from Ally machine markers or canon JSON.
      primaryText: seededPrimary,
      headline: seededHeadline,
      creativitaCount:
        localSnap?.draft.creativitaCount ||
        campagna.creativitaMeta?.length ||
        0,
      pageId: localSnap?.draft.pageId || campagna.pageId || "",
      pageName: localSnap?.draft.pageName || campagna.pageName || null,
      formId: localSnap?.draft.formId || campagna.formId || "",
      formName: localSnap?.draft.formName ?? null,
      formRelation: localSnap?.draft.formRelation ?? "UNCHECKED",
      geoQuery:
        localSnap?.draft.geoQuery || campagna.citta || "",
    });
  });
  const [imageAsset, setImageAsset] = useState<CreativitaAsset | null>(null);
  const [preview, setPreview] = useState<MetaWritePreviewResult | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [loadHint, setLoadHint] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [leadForms, setLeadForms] = useState<LeadgenFormOption[]>([]);
  const [igAccounts, setIgAccounts] = useState<InstagramOption[]>([]);
  const [igEmptyReason, setIgEmptyReason] = useState<
    "NONE" | "NO_ACCOUNTS" | "PERMISSION" | "PAGE_INVALID" | "UNCHECKED"
  >("UNCHECKED");
  const [pagesHint, setPagesHint] = useState<string | null>(null);
  const [formsHint, setFormsHint] = useState<string | null>(null);
  const [igHint, setIgHint] = useState<string | null>(null);
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timing, setTiming] = useState<InstantFormBuilderTiming>(() => {
    if (typeof window === "undefined") {
      return {
        brief_started_at: null,
        review_ready_at: null,
        publish_clicked_at: null,
      };
    }
    try {
      const raw = window.localStorage.getItem(
        builderTimingStorageKey(campaignId),
      );
      return parseBuilderTiming(raw ? JSON.parse(raw) : null);
    } catch {
      return {
        brief_started_at: null,
        review_ready_at: null,
        publish_clicked_at: null,
      };
    }
  });
  const [publishGateMsg, setPublishGateMsg] = useState<string | null>(null);
  const [liveWritesEnabled, setLiveWritesEnabled] = useState(false);
  const [offerAssist, setOfferAssist] = useState("");
  const [angleAssist, setAngleAssist] = useState("");
  const [allySuggestion, setAllySuggestion] =
    useState<AllyCreativeCopySuggestion | null>(null);
  const [allyCopyHint, setAllyCopyHint] = useState<string | null>(null);
  const [previewSurface, setPreviewSurface] = useState<"FEED" | "STORIES">(
    "FEED",
  );
  const prevMetaRef = useRef<CreativitaMeta[]>(campagna.creativitaMeta ?? []);
  const draftPersistReady = useRef(false);

  const stepDef = useMemo(
    () => INSTANT_FORM_BUILDER_STEPS.find((s) => s.id === stepId)!,
    [stepId],
  );
  const stepGate = useMemo(
    () =>
      evaluateBuilderStep({
        stepId,
        draft: {
          ...draft,
          creativitaCount: imageAsset ? 1 : 0,
        },
      }),
    [stepId, draft, imageAsset],
  );
  const metrics = useMemo(
    () => computeBuilderMetrics(preview?.instantFormEasyReadiness, preview),
    [preview],
  );
  const reviewRows = useMemo(
    () =>
      buildEasyReviewSummary({
        draft: { ...draft, creativitaCount: imageAsset ? 1 : 0 },
        preview: preview?.canonicalPublishPreview,
      }),
    [draft, preview, imageAsset],
  );
  const creativePackage = useMemo(() => {
    const assetMeta: CreativitaMeta | null = imageAsset
      ? creativitaToMeta([imageAsset])[0] ?? null
      : null;
    return buildCreativePackageFromEasyDraft({
      pageId: draft.pageId,
      pageName: draft.pageName,
      formId: draft.formId,
      formName: draft.formName,
      instagramUserId: draft.instagramUserId,
      preferPageOnly: draft.preferPageOnly,
      primaryText: draft.primaryText,
      headline: draft.headline,
      description: draft.description,
      asset: assetMeta,
      creativitaCount: imageAsset ? 1 : draft.creativitaCount,
      objectiveChoice: draft.objectiveChoice,
      conversionChoice: draft.conversionChoice,
      geoLabel: draft.geoLabel,
      primaryTextProvenance: draft.primaryTextProvenance,
      headlineProvenance: draft.headlineProvenance,
      descriptionProvenance: draft.descriptionProvenance,
    });
  }, [draft, imageAsset]);
  /** ADV.2.1 — same V2 → Execution Plan for Facile Review (dry-run). */
  const executionPlan = useMemo(() => {
    const v2 = canonicalV2FromInstantFormDraft({
      campaignId,
      clientId: campagna.clienteId ?? null,
      name: campagna.nomeCampagna ?? null,
      draft,
      creativeAssetId: imageAsset?.id ?? null,
      creativeNomeFile: imageAsset?.nomeFile ?? null,
      creativeStoragePath: imageAsset?.storagePath ?? null,
    });
    return buildMetaExecutionPlanFromV2(v2);
  }, [campaignId, campagna.clienteId, campagna.nomeCampagna, draft, imageAsset]);

  const preWriteGuardian = useMemo(() => {
    const noMetaHint =
      /nessuna connessione meta/i.test(pagesHint ?? "") ||
      /nessuna connessione meta/i.test(loadHint ?? "");
    return runPreWriteLaunchGuardian({
      preview,
      canonical: preview?.canonicalPublishPreview,
      executionPlan,
      provenanceHints: {
        objective: draft.objectiveChoice ? "USER_SELECTED" : "UNKNOWN",
        conversionLocation: draft.conversionChoice
          ? "USER_SELECTED"
          : "UNKNOWN",
        budget: isValidBudgetDailyMajor(draft.budgetDailyMajor)
          ? "USER_SELECTED"
          : "UNKNOWN",
        sac:
          draft.specialKind && draft.specialKind !== "UNRESOLVED"
            ? "USER_SELECTED"
            : "UNKNOWN",
        page: draft.pageId.trim() ? "META_DISCOVERED" : "UNKNOWN",
        form: draft.formId.trim() ? "META_DISCOVERED" : "UNKNOWN",
      },
      easyDraft: {
        pageId: draft.pageId,
        formId: draft.formId,
        specialKind: draft.specialKind,
        creativitaCount: imageAsset ? 1 : draft.creativitaCount,
        primaryText: draft.primaryText,
        headline: draft.headline,
        budgetDailyMajor: draft.budgetDailyMajor,
        metaGeoKey: draft.metaGeoKey,
        objectiveChoice: draft.objectiveChoice,
        conversionChoice: draft.conversionChoice,
        metaConnected: noMetaHint
          ? false
          : pages.length > 0 || Boolean(draft.pageId.trim())
            ? true
            : null,
      },
      creativePackage: {
        status: creativePackage.status,
        formatSupport: creativePackage.formatSupport,
        blockers: creativePackage.blockers,
      },
    });
  }, [
    preview,
    draft,
    imageAsset,
    pagesHint,
    loadHint,
    pages.length,
    creativePackage,
    executionPlan,
  ]);
  const hrefWizard = hrefModificaConfigurazione(
    campaignId,
    campagna.objective ?? "LEADS",
  );
  const ctaLabel = easyModeCtaLabelIt();
  const igDisplay = draft.preferPageOnly
    ? "Solo Pagina Facebook"
    : igAccounts.find((a) => a.id === draft.instagramUserId)?.username
      ? `@${igAccounts.find((a) => a.id === draft.instagramUserId)!.username}`
      : draft.instagramUserId
        ? "Account selezionato"
        : "—";

  const persistLocalDraft = useCallback(
    (nextStep: InstantFormBuilderStepId, nextDraft: InstantFormBuilderDraft, asset: CreativitaAsset | null) => {
      try {
        window.localStorage.setItem(
          builderDraftStorageKey(campaignId),
          JSON.stringify({
            stepId: nextStep,
            draft: { ...nextDraft, creativitaCount: asset ? 1 : 0 },
            creativeAssetId: asset?.id ?? null,
            creativeNomeFile: asset?.nomeFile ?? null,
            creativeStoragePath: asset?.storagePath ?? null,
          }),
        );
      } catch {
        // ignore
      }
    },
    [campaignId],
  );

  useEffect(() => {
    if (!draftPersistReady.current) return;
    persistLocalDraft(stepId, draft, imageAsset);
  }, [stepId, draft, imageAsset, persistLocalDraft]);

  async function authHeaders(): Promise<HeadersInit | null> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function patchDraft(patch: Partial<InstantFormBuilderDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function planBody() {
    const instantFormConfirmed = isEasyInstantFormPath(draft);
    const sacDecision = decisionFromEasyModePickerValue(draft.specialKind);
    return {
      campaignId,
      // Omit UNRESOLVED so write-preview cannot overwrite persisted NONE/CATEGORIES.
      ...(sacDecision.kind !== "UNRESOLVED"
        ? { specialAdCategories: sacDecision }
        : {}),
      countryCode: draft.countryCode,
      metaGeoKey: draft.metaGeoKey,
      geoLabel: draft.geoLabel,
      startAtIso: null,
      endAtIso: null,
      destination: instantFormCanonicalDestination(),
      // Preserve Easy-selected LEADS into canonical preview even before DB persist.
      ...(instantFormConfirmed
        ? { objectiveRaw: instantFormCanonicalObjectiveRaw() }
        : {}),
      pageId: draft.pageId || null,
      formId: draft.formId || null,
      formPrivacyPolicyUrl: draft.formPrivacyPolicyUrl || null,
      pageName: draft.pageName || null,
      instantFormName: draft.formName || null,
      instantFormRelation: draft.formRelation,
      websiteTracking: null,
      destinationTrackingMode: "NONE" as const,
      instagramUserId: draft.preferPageOnly
        ? null
        : draft.instagramUserId.trim() || null,
      preferPageOnly: draft.preferPageOnly,
      instagramDiscovery:
        draft.pageId && igEmptyReason !== "UNCHECKED"
          ? {
              accounts: igAccounts,
              emptyReason: igEmptyReason,
            }
          : null,
      persist: true,
    };
  }

  async function runPreview(opts?: { hydrate?: boolean }) {
    const headers = await authHeaders();
    if (!headers) {
      setLoadHint("Accedi per usare Facile.");
      return null;
    }
    const body = opts?.hydrate
      ? {
          campaignId,
          hydrate: true,
          persist: true,
          destination: instantFormCanonicalDestination(),
        }
      : planBody();
    const res = await fetch("/api/meta/write-preview", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      error?: string;
      preview?: MetaWritePreviewResult;
      formState?: MetaWriteFormState;
      liveWritesEnabled?: boolean;
    };
    if (!res.ok || !json.preview) {
      setErrore(json.error ?? "Anteprima non riuscita.");
      return null;
    }
    setPreview(json.preview);
    setLiveWritesEnabled(json.liveWritesEnabled === true);
    setErrore(null);
    const summaryBudget = json.preview.safePayloadSummary?.budgetDailyMajor;
    const previewBudgetMajor =
      typeof summaryBudget === "number" ? summaryBudget : null;
    if (json.formState) {
      const fs = json.formState;
      setClientId(fs.clientId ?? null);
      setDraft((d) => {
        const next = {
          ...d,
          specialKind: hydrateSpecialKind(fs),
          pageId: fs.pageId || d.pageId,
          formId: fs.formId || d.formId,
          metaGeoKey: fs.metaGeoKey ?? d.metaGeoKey,
          geoLabel: fs.geoLabel ?? d.geoLabel,
          countryCode: fs.countryCode || d.countryCode,
          instagramUserId: fs.instagramUserId?.trim() || d.instagramUserId,
          preferPageOnly:
            fs.preferPageOnly == null
              ? d.preferPageOnly
              : fs.preferPageOnly === true,
          budgetDailyMajor: resolveBudgetDailyMajorForDraft(
            d.budgetDailyMajor,
            previewBudgetMajor ?? campagna.budgetGiornaliero,
          ),
        };
        if (fs.geoLabel) {
          next.geoQuery = fs.geoLabel.split(",")[0]?.trim() || d.geoQuery;
        }
        return next;
      });
    } else {
      setDraft((d) => ({
        ...d,
        budgetDailyMajor: resolveBudgetDailyMajorForDraft(
          d.budgetDailyMajor,
          previewBudgetMajor ?? campagna.budgetGiornaliero,
        ),
      }));
    }
    return json.preview;
  }

  async function saveAllyCampaignFields() {
    let creativitaMeta: CreativitaMeta[] = prevMetaRef.current;
    if (imageAsset) {
      creativitaMeta = await caricaCreativitaSuStorage(
        [imageAsset],
        prevMetaRef.current,
      );
      const uploaded = creativitaMeta[0];
      if (uploaded) {
        setImageAsset((cur) =>
          cur
            ? {
                ...cur,
                id: uploaded.id,
                storagePath: uploaded.storagePath,
                nomeFile: uploaded.nomeFile,
                width: uploaded.width,
                height: uploaded.height,
                avvisoFormato: uploaded.avvisoFormato,
              }
            : cur,
        );
      }
      const rimossi = pathsCreativitaRimossi(
        prevMetaRef.current,
        creativitaMeta,
      );
      if (rimossi.length > 0) {
        try {
          await eliminaCreativitaDaStorage(rimossi);
        } catch {
          // best-effort cleanup
        }
      }
      prevMetaRef.current = creativitaMeta;
    } else if (prevMetaRef.current.length > 0) {
      const rimossi = pathsCreativitaRimossi(prevMetaRef.current, []);
      if (rimossi.length > 0) {
        try {
          await eliminaCreativitaDaStorage(rimossi);
        } catch {
          // best-effort
        }
      }
      creativitaMeta = [];
      prevMetaRef.current = [];
    }

    // Instant Form confirm: persist Ally LEADS + Page/form identity columns only.
    // Meta destination (META_LEAD_FORM) lives in write-preview / plan payloads — not campaigns.*.
    // Budget: only write campaigns.daily_budget when draft has a valid positive major value
    // so a later step cannot null out a previously saved budget.
    const instantFormConfirmed = isEasyInstantFormPath(draft);
    const payload: Record<string, unknown> = {
      ...allyCampaignDailyBudgetUpdate(draft.budgetDailyMajor),
      eta_min: draft.etaMin,
      eta_max: draft.etaMax,
      variante_a: userFacingCampaignText(draft.primaryText) || null,
      titolo_annuncio: userFacingCampaignText(draft.headline) || null,
      page_id: draft.pageId.trim() || null,
      page_name: draft.pageName?.trim() || null,
      form_id: draft.formId.trim() || null,
      citta: draft.geoLabel?.split(",")[0]?.trim() || draft.geoQuery || null,
      objective: instantFormConfirmed ? "LEADS" : campagna.objective ?? "LEADS",
      creativita: creativitaMeta,
    };
    const { error } = await supabase
      .from("campaigns")
      .update(payload)
      .eq("id", campaignId);
    if (error) {
      logErroreSupabaseDev("instant-form.saveAllyCampaignFields", error);
      throw new Error(messaggioErroreSupabase(error, "salva"));
    }
    patchDraft({ creativitaCount: creativitaMeta.length });
  }

  async function loadPages(forClientId: string) {
    setPagesHint(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/meta/pages?clientId=${encodeURIComponent(forClientId)}`,
        { headers },
      );
      const json = (await res.json()) as {
        error?: string;
        pages?: PageOption[];
      };
      if (!res.ok) {
        setPages([]);
        setPagesHint(json.error ?? "Pagine non disponibili.");
        return;
      }
      const list = Array.isArray(json.pages) ? json.pages : [];
      setPages(list);
      if (list.length === 0) {
        setPagesHint("Nessuna Pagina Facebook disponibile.");
      }
      // page_id persisted without page_name → resolve label from discovery (no re-select).
      setDraft((d) => {
        const id = d.pageId.trim();
        if (!id || d.pageName?.trim()) return d;
        const hit = list.find((p) => p.id === id);
        const name = hit?.name?.trim();
        if (!name) return d;
        return { ...d, pageName: name };
      });
    } catch {
      setPages([]);
      setPagesHint("Lettura Pagine non riuscita.");
    }
  }

  async function loadLeadForms(forClientId: string, forPageId: string) {
    setFormsHint(null);
    setLeadForms([]);
    if (!forPageId) return;
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/meta/leadgen-forms?clientId=${encodeURIComponent(forClientId)}&pageId=${encodeURIComponent(forPageId)}`,
        { headers },
      );
      const json = (await res.json()) as {
        error?: string;
        forms?: LeadgenFormOption[];
        mutationsPerformed?: number;
      };
      if (json.mutationsPerformed != null && json.mutationsPerformed !== 0) {
        setFormsHint("Errore: discovery non deve scrivere su Meta.");
      }
      if (!res.ok) {
        setLeadForms([]);
        setFormsHint(json.error ?? "Moduli non disponibili.");
        return;
      }
      const list = Array.isArray(json.forms) ? json.forms : [];
      setLeadForms(list);
      if (list.length === 0) {
        setFormsHint(
          "Non ci sono moduli Instant Form per questa Pagina. Creali in Meta Business Suite, poi torna qui.",
        );
      }
      setDraft((d) => {
        if (d.formId) {
          const hit = list.find((f) => f.id === d.formId);
          if (hit) {
            return {
              ...d,
              formRelation: "VERIFIED",
              formName: hit.name,
              formPrivacyPolicyUrl: hit.privacyPolicyUrl?.trim() || null,
            };
          }
          if (list.length > 0) return { ...d, formRelation: "MISMATCH" };
          return d;
        }
        // Single usable Instant Form → pre-select for Lead preview (no Meta write).
        const usable = list.filter((f) => f.usable !== false);
        if (usable.length === 1) {
          const only = usable[0]!;
          return {
            ...d,
            formId: only.id,
            formName: only.name ?? null,
            formPrivacyPolicyUrl: only.privacyPolicyUrl?.trim() || null,
            formRelation: "VERIFIED",
          };
        }
        return d;
      });
    } catch {
      setLeadForms([]);
      setFormsHint("Lettura moduli non riuscita.");
    }
  }

  async function loadInstagramAccounts(forClientId: string, forPageId: string) {
    setIgHint(null);
    setIgAccounts([]);
    setIgEmptyReason("UNCHECKED");
    if (!forPageId) return;
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/meta/instagram-accounts?clientId=${encodeURIComponent(forClientId)}&pageId=${encodeURIComponent(forPageId)}`,
        { headers },
      );
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        accounts?: InstagramOption[];
        emptyReason?: string;
        mutationsPerformed?: number;
      };
      if (json.mutationsPerformed != null && json.mutationsPerformed !== 0) {
        setIgHint("Errore: discovery Instagram non deve scrivere su Meta.");
      }
      if (
        json.code === "PERMISSION_REQUIRED" ||
        json.emptyReason === "PERMISSION"
      ) {
        setIgEmptyReason("PERMISSION");
        // Page-only Lead Ads remains valid — soft info, not a blocker.
        setIgHint(
          "Instagram non disponibile. La campagna può essere pubblicata usando solo la Pagina Facebook.",
        );
        setDraft((d) => ({
          ...d,
          preferPageOnly: true,
          instagramUserId: "",
        }));
        return;
      }
      if (!res.ok) {
        setIgEmptyReason("NO_ACCOUNTS");
        setIgHint(json.error ?? "Account Instagram non disponibili.");
        return;
      }
      const list = Array.isArray(json.accounts) ? json.accounts : [];
      setIgAccounts(list);
      setIgEmptyReason(list.length === 0 ? "NO_ACCOUNTS" : "NONE");
      if (list.length === 0) {
        setIgHint(
          "Nessun Instagram collegato — Ally userà solo la Pagina Facebook dove Meta lo consente.",
        );
        setDraft((d) => ({
          ...d,
          preferPageOnly: true,
          instagramUserId: "",
        }));
      } else if (list.length === 1) {
        setDraft((d) => {
          if (d.instagramUserId || d.preferPageOnly) return d;
          return {
            ...d,
            instagramUserId: list[0]!.id,
            preferPageOnly: false,
          };
        });
      }
    } catch {
      setIgEmptyReason("NO_ACCOUNTS");
      setIgHint("Lettura Instagram non riuscita.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHydrating(true);
      setTiming((prev) => {
        const next = markBriefStarted(prev);
        try {
          window.localStorage.setItem(
            builderTimingStorageKey(campaignId),
            JSON.stringify(next),
          );
        } catch {
          // ignore
        }
        return next;
      });
      try {
        const meta = campagna.creativitaMeta ?? [];
        prevMetaRef.current = meta;
        if (meta.length > 0) {
          const assets = await anteprimeDaCreativitaMeta(meta);
          const preferred =
            assets.find((a) => a.ruolo === "principale") ?? assets[0] ?? null;
          if (!cancelled && preferred?.url) {
            setImageAsset(preferred);
            patchDraft({ creativitaCount: 1 });
          }
        }
        const p = await runPreview({ hydrate: true });
        if (cancelled) return;
        if (!p) setLoadHint((h) => h ?? "Configurazione ancora incompleta.");
        setDraft((d) => {
          const summaryBudget = p?.safePayloadSummary?.budgetDailyMajor;
          const previewBudgetMajor =
            typeof summaryBudget === "number" ? summaryBudget : null;
          return {
            ...d,
            budgetDailyMajor: resolveBudgetDailyMajorForDraft(
              d.budgetDailyMajor,
              previewBudgetMajor ?? campagna.budgetGiornaliero,
            ),
            primaryText:
              userFacingCampaignText(d.primaryText) ||
              userFacingCampaignText(campagna.varianteA) ||
              "",
            headline:
              userFacingCampaignText(d.headline) ||
              userFacingCampaignText(campagna.titoloAnnuncio) ||
              "",
            etaMin: d.etaMin ?? campagna.etaMin ?? null,
            etaMax: d.etaMax ?? campagna.etaMax ?? null,
          };
        });
      } finally {
        if (!cancelled) {
          setHydrating(false);
          draftPersistReady.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    if (!clientId) return;
    void loadPages(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !draft.pageId) return;
    void loadLeadForms(clientId, draft.pageId);
    void loadInstagramAccounts(clientId, draft.pageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, draft.pageId]);

  useEffect(() => {
    if (stepId !== "review") return;
    const gate = evaluateBuilderStep({
      stepId: "review",
      draft: { ...draft, creativitaCount: imageAsset ? 1 : 0 },
    });
    if (!gate.canContinue) return;
    setTiming((prev) => {
      const next = markReviewReady(prev);
      if (next === prev) return prev;
      try {
        window.localStorage.setItem(
          builderTimingStorageKey(campaignId),
          JSON.stringify(next),
        );
      } catch {
        // ignore
      }
      return next;
    });
  }, [stepId, draft, imageAsset, campaignId]);

  async function goNext() {
    const gate = evaluateBuilderStep({
      stepId,
      draft: { ...draft, creativitaCount: imageAsset ? 1 : 0 },
    });
    if (!gate.canContinue) {
      setErrore(gate.blockers[0] ?? "Completa questo passaggio.");
      return;
    }
    setErrore(null);
    setBusy(true);
    try {
      if (
        stepId === "pubblico" ||
        stepId === "budget" ||
        stepId === "annuncio" ||
        stepId === "identita" ||
        stepId === "modulo" ||
        stepId === "categoria"
      ) {
        await saveAllyCampaignFields();
        await runPreview();
      }
      const idx = INSTANT_FORM_BUILDER_STEPS.findIndex((s) => s.id === stepId);
      const next = INSTANT_FORM_BUILDER_STEPS[idx + 1];
      if (next) setStepId(next.id);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    const idx = INSTANT_FORM_BUILDER_STEPS.findIndex((s) => s.id === stepId);
    const prev = INSTANT_FORM_BUILDER_STEPS[idx - 1];
    if (prev) setStepId(prev.id);
    setErrore(null);
  }

  /**
   * P0.16.1 — Open Riepilogo even when Continua is disabled.
   * Guardian owns readiness; step validation stays inline.
   */
  async function openCampaignReview() {
    if (!canOpenBuilderReview(draft)) return;
    setBusy(true);
    try {
      // Persist Easy objective/destination before preview so canonical state
      // matches the Builder summary (Generare contatti → LEADS).
      if (isEasyInstantFormPath(draft)) {
        await saveAllyCampaignFields().catch(() => null);
      }
      // Best-effort preview — incomplete configs still open review.
      await runPreview().catch(() => null);
    } finally {
      // Guardian uses easyDraft even if preview API failed (no Meta / no Page).
      setErrore(null);
      setBusy(false);
      setStepId("review");
    }
  }

  async function requestAllyCopy() {
    setBusy(true);
    setAllyCopyHint(null);
    setErrore(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per chiedere una proposta Ally.");
        return;
      }
      const res = await fetch("/api/ally-creative-copy", {
        method: "POST",
        headers,
        body: JSON.stringify({
          offerSummary: offerAssist,
          angle: angleAssist || null,
          existingMessage: draft.primaryText || null,
          geography: draft.geoLabel || draft.geoQuery || null,
          conversionLocation: draft.conversionChoice ?? "INSTANT_FORM",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        suggestion?: AllyCreativeCopySuggestion;
        noteIt?: string;
        autoApproved?: boolean;
        brandBrainMutated?: boolean;
        metaMutations?: number;
      };
      if (!res.ok || !json.ok || !json.suggestion) {
        setErrore(json.error ?? "Proposta Ally non riuscita.");
        setAllySuggestion(null);
        return;
      }
      if (json.metaMutations != null && json.metaMutations !== 0) {
        setErrore("Sicurezza: Meta mutations non ammesse in questo passo.");
        return;
      }
      if (json.brandBrainMutated) {
        setErrore("Sicurezza: Brand Brain non deve essere mutato.");
        return;
      }
      setAllySuggestion(json.suggestion);
      setAllyCopyHint(
        json.noteIt ??
          "Proposta Ally pronta. Non è auto-approvata: puoi usarla e modificarla.",
      );
    } catch {
      setErrore("Proposta Ally non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  function applyAllySuggestion(s: AllyCreativeCopySuggestion) {
    patchDraft({
      primaryText: s.primaryText,
      headline: s.headline,
      description: s.description ?? draft.description,
      primaryTextProvenance: "ALLY",
      headlineProvenance: "ALLY",
      descriptionProvenance: s.description ? "ALLY" : draft.descriptionProvenance,
    });
    setAllyCopyHint(
      "Proposta applicata (fonte ALLY). Se modifichi i campi, diventa USER.",
    );
  }

  async function searchGeo() {
    setBusy(true);
    setErrore(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setErrore("Accedi per cercare la zona.");
        return;
      }
      const res = await fetch("/api/meta/write-geo-search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          campaignId,
          query: draft.geoQuery,
          countryCode: draft.countryCode,
        }),
      });
      const json = (await res.json()) as { error?: string; hits?: GeoHit[] };
      if (!res.ok) {
        setErrore(json.error ?? "Ricerca zona non riuscita.");
        setGeoHits([]);
        return;
      }
      setGeoHits(Array.isArray(json.hits) ? json.hits : []);
    } catch {
      setErrore("Ricerca zona non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const setupSeconds = activeSetupSeconds(timing);
  const reviewAssetOk = reviewMatchesCreativeAsset({
    reviewAssetId: imageAsset?.id,
    canonicalAssetId: imageAsset?.id,
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--primary)]">
          Facile · Modulo istantaneo
        </p>
        <h1 className="text-[clamp(22px,3vw,28px)] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Crea una campagna Meta professionale in circa 5 minuti
        </h1>
        <p className="mt-1 text-[14px] text-[var(--ink-muted)]">
          Ally automatizza la complessità, ma non ti toglie il controllo.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--ink-muted)]">
          <span>
            Passaggio {stepDef.index} di {INSTANT_FORM_BUILDER_STEPS.length}
          </span>
          <span aria-hidden>·</span>
          <span>Completamento {metrics.builderProgressPercent}%</span>
          {setupSeconds != null ? (
            <>
              <span aria-hidden>·</span>
              <span>Setup attivo {setupSeconds}s</span>
            </>
          ) : null}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={metrics.builderProgressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width]"
            style={{ width: `${metrics.builderProgressPercent}%` }}
          />
        </div>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto pb-1"
        aria-label="Passaggi Facile"
      >
        {INSTANT_FORM_BUILDER_STEPS.map((s) => {
          const active = s.id === stepId;
          const completed =
            s.index < stepDef.index &&
            evaluateBuilderStep({
              stepId: s.id,
              draft: { ...draft, creativitaCount: imageAsset ? 1 : 0 },
            }).canContinue;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id === "review") {
                  void openCampaignReview();
                } else {
                  setStepId(s.id);
                }
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : completed
                    ? "border border-[var(--primary)]/40 bg-[color-mix(in_srgb,var(--accent-soft)_40%,white)] text-[var(--ink)]"
                    : "border border-[var(--border)] text-[var(--ink-muted)]"
              }`}
            >
              {s.index}. {s.titleIt}
            </button>
          );
        })}
      </nav>

      <section className="rounded-[14px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-[18px] font-semibold text-[var(--ink)]">
          {stepDef.questionIt}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {stepDef.helpIt}
        </p>

        {hydrating ? (
          <p className="mt-6 text-[13px] text-[var(--ink-muted)]">
            Caricamento configurazione…
          </p>
        ) : null}

        {!hydrating && stepId === "obiettivo" ? (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-[var(--ink)]">
                Cosa vuoi ottenere?
              </p>
              {EASY_BUSINESS_GOAL_OPTIONS.map((opt) => {
                const selected = draft.objectiveChoice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      patchDraft({
                        objectiveChoice: opt.id,
                        conversionChoice:
                          opt.id === "GENERATE_LEADS"
                            ? draft.conversionChoice
                            : null,
                      })
                    }
                    className={`w-full rounded-[10px] border px-3 py-2.5 text-left ${
                      selected
                        ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--accent-soft)_28%,white)]"
                        : "border-[var(--border)] bg-white hover:bg-[var(--surface)]"
                    }`}
                  >
                    <p className="text-[14px] font-medium text-[var(--ink)]">
                      {opt.labelIt}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                      {opt.descriptionIt}
                    </p>
                    {opt.status === "COMING_SOON" ? (
                      <p className="mt-1 text-[11px] font-medium text-[var(--ink-muted)]">
                        Disponibile prossimamente
                      </p>
                    ) : null}
                    {opt.status === "AVAILABLE_FULL_PATH" ? (
                      <p className="mt-1 text-[11px] font-medium text-[var(--ink-muted)]">
                        Usa percorso completo
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {draft.objectiveChoice === "GENERATE_LEADS" ? (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--ink)]">
                  Dove vuoi raccogliere i contatti?
                </p>
                {EASY_LEADS_LOCATION_OPTIONS.map((opt) => {
                  const selected = draft.conversionChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        patchDraft({ conversionChoice: opt.id })
                      }
                      className={`w-full rounded-[10px] border px-3 py-2.5 text-left ${
                        selected
                          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--accent-soft)_28%,white)]"
                          : "border-[var(--border)] bg-white hover:bg-[var(--surface)]"
                      }`}
                    >
                      <p className="text-[14px] font-medium text-[var(--ink)]">
                        {opt.labelIt}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                        {opt.descriptionIt}
                      </p>
                      {opt.status === "AVAILABLE_FULL_PATH" ? (
                        <p className="mt-1 text-[11px] font-medium text-[var(--ink-muted)]">
                          Usa percorso completo
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {!hydrating && stepId === "identita" ? (
          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Pagina Facebook
              </span>
              <select
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5 text-[14px]"
                value={draft.pageId}
                onChange={(e) => {
                  const id = e.target.value;
                  const hit = pages.find((p) => p.id === id);
                  patchDraft({
                    pageId: id,
                    pageName: hit?.name ?? null,
                    formId: "",
                    formName: null,
                    formRelation: "UNCHECKED",
                    instagramUserId: "",
                    preferPageOnly: false,
                  });
                }}
              >
                <option value="">Seleziona una pagina…</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name?.trim() || "Pagina senza nome"}
                  </option>
                ))}
              </select>
            </label>
            {pagesHint ? (
              <p className="text-[12px] text-[var(--ink-muted)]">{pagesHint}</p>
            ) : null}
            {draft.pageId ? (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--ink)]">
                  Instagram
                </p>
                {igAccounts.length > 1 ? (
                  <select
                    className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5 text-[14px]"
                    value={
                      draft.preferPageOnly
                        ? "__page_only__"
                        : draft.instagramUserId
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__page_only__") {
                        patchDraft({
                          preferPageOnly: true,
                          instagramUserId: "",
                        });
                      } else {
                        patchDraft({
                          preferPageOnly: false,
                          instagramUserId: v,
                        });
                      }
                    }}
                  >
                    {igAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username ? `@${a.username}` : "Account Instagram"}
                      </option>
                    ))}
                    <option value="__page_only__">Solo Pagina Facebook</option>
                  </select>
                ) : igAccounts.length === 1 ? (
                  <p className="rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px] text-[var(--ink)]">
                    Consigliato: @
                    {igAccounts[0]!.username?.trim() || "account collegato"}
                  </p>
                ) : (
                  <p className="text-[12px] text-[var(--ink-muted)]">
                    {igHint ??
                      "Nessun Instagram — si pubblicherà con la Pagina."}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {!hydrating && stepId === "modulo" ? (
          <div className="mt-6 space-y-3">
            {!draft.pageId ? (
              <p className="text-[13px] text-[var(--ink-muted)]">
                Torna indietro e seleziona prima una Pagina.
              </p>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-[var(--ink)]">
                  Modulo Instant Form
                </span>
                <select
                  className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5 text-[14px]"
                  value={draft.formId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const hit = leadForms.find((f) => f.id === id);
                    patchDraft({
                      formId: id,
                      formName: hit?.name ?? null,
                      formPrivacyPolicyUrl:
                        hit?.privacyPolicyUrl?.trim() || null,
                      formRelation: hit ? "VERIFIED" : "UNCHECKED",
                    });
                  }}
                >
                  <option value="">Seleziona un modulo…</option>
                  {leadForms.map((f) => (
                    <option
                      key={f.id}
                      value={f.id}
                      disabled={f.usable === false}
                    >
                      {f.name?.trim() || "Modulo"}
                      {f.status ? ` · ${f.status}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {formsHint ? (
              <p className="text-[12px] text-[var(--ink-muted)]">{formsHint}</p>
            ) : null}
            {draft.formRelation === "MISMATCH" ? (
              <p className="text-[12px] text-red-700">
                Questo modulo non appartiene alla Pagina selezionata.
              </p>
            ) : null}
          </div>
        ) : null}

        {!hydrating && stepId === "pubblico" ? (
          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Zona geografica
              </span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                  value={draft.geoQuery}
                  onChange={(e) => patchDraft({ geoQuery: e.target.value })}
                  placeholder="Es. Roma"
                />
                <button
                  type="button"
                  className="aff-btn-secondary shrink-0"
                  disabled={busy}
                  onClick={() => void searchGeo()}
                >
                  Cerca
                </button>
              </div>
            </label>
            {draft.geoLabel ? (
              <p className="text-[12px] text-[var(--ink-muted)]">
                Selezionata: {draft.geoLabel}
              </p>
            ) : null}
            {geoHits.length > 0 ? (
              <ul className="space-y-1">
                {geoHits.map((h) => (
                  <li key={h.key}>
                    <button
                      type="button"
                      className="w-full rounded-[8px] border border-[var(--border)] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-soft,#f7f7fa)]"
                      onClick={() =>
                        patchDraft({
                          metaGeoKey: h.key,
                          geoLabel: formatGeoSearchHitLabelIt(h),
                          countryCode: h.countryCode || draft.countryCode,
                          geoQuery: h.name,
                        })
                      }
                    >
                      {formatGeoSearchHitLabelIt(h)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-[var(--ink)]">
                  Età da
                </span>
                <input
                  type="number"
                  min={13}
                  max={65}
                  className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                  value={draft.etaMin ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      etaMin:
                        e.target.value === ""
                          ? null
                          : Number(e.target.value),
                    })
                  }
                  placeholder="25"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-[var(--ink)]">
                  Età a
                </span>
                <input
                  type="number"
                  min={13}
                  max={65}
                  className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                  value={draft.etaMax ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      etaMax:
                        e.target.value === ""
                          ? null
                          : Number(e.target.value),
                    })
                  }
                  placeholder="55"
                />
              </label>
            </div>
            <div className="rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--ink-muted)]">
              Pubblico: Advantage+ Audience (consigliato).
            </div>
            {easyModeExposesManualPlacements() ? null : (
              <p className="text-[11px] text-[var(--ink-muted)]">
                Posizionamenti manuali non disponibili in Facile.
              </p>
            )}
          </div>
        ) : null}

        {!hydrating && stepId === "budget" ? (
          <div className="mt-6 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Budget giornaliero (€)
              </span>
              <input
                type="number"
                min={1}
                step={1}
                className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                value={draft.budgetDailyMajor ?? ""}
                onChange={(e) =>
                  patchDraft({
                    budgetDailyMajor:
                      e.target.value === ""
                        ? null
                        : Number(e.target.value),
                  })
                }
                placeholder="20"
              />
            </label>
            {monthlyBudgetHintIt(draft.budgetDailyMajor) ? (
              <p className="text-[12px] text-[var(--ink-muted)]">
                {monthlyBudgetHintIt(draft.budgetDailyMajor)}
              </p>
            ) : null}
            <p className="text-[12px] text-[var(--ink-muted)]">
              Programmazione continua. La campagna viene creata in pausa.
            </p>
          </div>
        ) : null}

        {!hydrating && stepId === "annuncio" ? (
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-[var(--ink)]">
                Immagine
              </p>
              <EasyBuilderSingleImageInput
                asset={imageAsset}
                disabled={busy}
                onChange={(asset) => {
                  setImageAsset(asset);
                  patchDraft({ creativitaCount: asset ? 1 : 0 });
                }}
              />
              <p className="text-[11px] text-[var(--ink-muted)]">
                Carica qui l&apos;immagine principale. Non serve aprire lo studio
                creatività per il percorso facile. Stesso upload P0.8 — package
                creativo canonico, senza ritaglio automatico.
              </p>
              {creativePackage.media.formatReadiness.summaryIt ? (
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Formato: Feed 1:1{" "}
                  {creativePackage.media.formatReadiness.feed1x1} · 4:5{" "}
                  {creativePackage.media.formatReadiness.feed4x5} · Stories 9:16{" "}
                  {creativePackage.media.formatReadiness.stories9x16}.{" "}
                  {creativePackage.media.formatReadiness.summaryIt}
                </p>
              ) : null}
            </div>

            <div className="rounded-[12px] border border-[var(--border)] px-3 py-3 space-y-2">
              <p className="text-[12px] font-medium text-[var(--ink)]">
                Prepara copy con Ally
              </p>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Proposta modificabile — non approvata automaticamente. Brand Brain
                non viene modificato.
              </p>
              <input
                className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-[14px]"
                value={offerAssist}
                onChange={(e) => setOfferAssist(e.target.value)}
                placeholder="Es. preventivo infissi a Roma"
              />
              <input
                className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2 text-[14px]"
                value={angleAssist}
                onChange={(e) => setAngleAssist(e.target.value)}
                placeholder="Angolo opzionale (es. senza impegno)"
              />
              <button
                type="button"
                className="aff-btn-secondary text-[13px]"
                disabled={busy || !offerAssist.trim()}
                onClick={() => void requestAllyCopy()}
              >
                Chiedi proposta Ally
              </button>
              {allyCopyHint ? (
                <p className="text-[11px] text-[var(--ink-muted)]">{allyCopyHint}</p>
              ) : null}
              {allySuggestion ? (
                <div className="rounded-[10px] border border-dashed border-[var(--border)] px-3 py-2 text-[13px]">
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Fonte: ALLY · non auto-approvata
                    {allySuggestion.angleIt
                      ? ` · ${allySuggestion.angleIt}`
                      : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{allySuggestion.primaryText}</p>
                  <p className="mt-1 font-semibold">{allySuggestion.headline}</p>
                  <button
                    type="button"
                    className="mt-2 text-[12px] font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                    onClick={() => applyAllySuggestion(allySuggestion)}
                  >
                    Usa proposta (poi puoi modificarla)
                  </button>
                </div>
              ) : null}
            </div>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Testo principale
                {draft.primaryTextProvenance === "ALLY" ? (
                  <span className="ml-1 font-normal text-[var(--ink-muted)]">
                    (da Ally — modificabile)
                  </span>
                ) : null}
              </span>
              <textarea
                className="min-h-[96px] w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                value={draft.primaryText}
                onChange={(e) =>
                  patchDraft({
                    primaryText: e.target.value,
                    primaryTextProvenance: "USER",
                  })
                }
                placeholder="Descrivi l'offerta in modo chiaro…"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Titolo
                {draft.headlineProvenance === "ALLY" ? (
                  <span className="ml-1 font-normal text-[var(--ink-muted)]">
                    (da Ally — modificabile)
                  </span>
                ) : null}
              </span>
              <input
                className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                value={draft.headline}
                onChange={(e) =>
                  patchDraft({
                    headline: e.target.value,
                    headlineProvenance: "USER",
                  })
                }
                placeholder="Titolo breve"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Descrizione (opzionale)
              </span>
              <input
                className="w-full rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px]"
                value={draft.description}
                onChange={(e) =>
                  patchDraft({
                    description: e.target.value,
                    descriptionProvenance: "USER",
                  })
                }
                placeholder="Opzionale"
              />
            </label>

            <div className="rounded-[10px] border border-[var(--border)] px-3 py-2.5">
              <p className="text-[12px] font-medium text-[var(--ink)]">CTA</p>
              <p className="mt-0.5 text-[14px] text-[var(--ink)]">{ctaLabel}</p>
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                Ally la deriva dal percorso Instant Form (
                {creativePackage.copy.callToActionType ?? "—"}). Non inventa URL.
              </p>
            </div>

            {easyModeExposesCarouselOrMultiCopy() ? null : (
              <p className="text-[11px] text-[var(--ink-muted)]">
                Carousel e multi-copy non sono pubblicabili in Facile.
                Video / flexible: NOT_YET_SUPPORTED — nessuna conversione silenziosa
                a singola immagine.
              </p>
            )}

            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft,#f7f7fa)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                  Anteprima indicativa
                </p>
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    previewSurface === "FEED"
                      ? "bg-[var(--ink)] text-white"
                      : "border border-[var(--border)] text-[var(--ink-muted)]"
                  }`}
                  onClick={() => setPreviewSurface("FEED")}
                >
                  Feed
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                    previewSurface === "STORIES"
                      ? "bg-[var(--ink)] text-white"
                      : "border border-[var(--border)] text-[var(--ink-muted)]"
                  }`}
                  onClick={() => setPreviewSurface("STORIES")}
                >
                  Stories / Reels
                </button>
              </div>
              <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                {draft.pageName?.trim() || "Pagina mancante"} · {igDisplay} ·{" "}
                Instant Form
                {draft.formName ? ` · ${draft.formName}` : ""}
              </p>
              {imageAsset?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageAsset.url}
                  alt=""
                  className={
                    previewSurface === "STORIES"
                      ? "mt-3 aspect-[9/16] w-full max-w-[200px] rounded-[10px] object-cover"
                      : "mt-3 aspect-square w-full max-w-[280px] rounded-[10px] object-cover"
                  }
                />
              ) : (
                <div className="mt-3 flex h-40 max-w-[280px] items-center justify-center rounded-[10px] border border-dashed border-[var(--border)] text-[12px] text-[var(--ink-muted)]">
                  Media mancante
                </div>
              )}
              {previewSurface === "STORIES" &&
              creativePackage.media.formatReadiness.stories9x16 !==
                "AVAILABLE" ? (
                <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
                  Stories:{" "}
                  {creativePackage.media.formatReadiness.stories9x16} — Ally non
                  ritaglia l&apos;immagine.
                </p>
              ) : null}
              <p className="mt-3 whitespace-pre-wrap text-[13px] text-[var(--ink)]">
                {draft.primaryText.trim() || "Testo principale…"}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">
                {draft.headline.trim() || "Titolo…"}
              </p>
              <p className="mt-3 inline-block rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-medium text-white">
                {ctaLabel}
              </p>
            </div>

            <p className="text-[11px] text-[var(--ink-muted)]">
              Opzionale:{" "}
              <Link
                href={hrefWizard}
                className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
              >
                apri studio avanzato
              </Link>{" "}
              solo se ti serve altro oltre a un&apos;immagine.
            </p>
          </div>
        ) : null}

        {!hydrating && stepId === "categoria" ? (
          <div className="mt-6 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--ink)]">
                Categoria speciale
              </span>
              <select
                className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5 text-[14px]"
                value={draft.specialKind}
                onChange={(e) => patchDraft({ specialKind: e.target.value })}
              >
                <option value="UNRESOLVED">Seleziona…</option>
                <option value="NONE">
                  No — non rientra in una categoria speciale
                </option>
                {ALLY_SPECIAL_AD_CATEGORY_CATALOG.map((c) => (
                  <option key={c.graphValue} value={c.graphValue}>
                    {etichettaSpecialAdCategoryEasy(c.graphValue)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[12px] text-[var(--ink-muted)]">
              Perché? Meta richiede questa dichiarazione. Ally non la completa
              in silenzio.
            </p>
          </div>
        ) : null}

        {!hydrating && stepId === "review" ? (
          <div className="mt-6 space-y-5">
            <ul className="space-y-2">
              {reviewRows.map((row) => (
                <li
                  key={row.labelIt}
                  className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-2 text-[13px]"
                >
                  <span className="text-[var(--ink-muted)]">{row.labelIt}</span>
                  <span className="text-right font-medium text-[var(--ink)]">
                    {row.valueIt}
                  </span>
                </li>
              ))}
            </ul>

            {imageAsset ? (
              <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageAsset.url}
                  alt=""
                  className="h-14 w-14 rounded-[8px] object-cover"
                />
                <div className="min-w-0 text-[12px] text-[var(--ink-muted)]">
                  <p className="truncate font-medium text-[var(--ink)]">
                    {imageAsset.nomeFile}
                  </p>
                  <p>
                    Stesso asset Ally del piano creativo
                    {reviewAssetOk ? " · allineato" : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <CanonicalCampaignReviewPanel
              canonical={preview?.canonicalPublishPreview}
              guardian={preWriteGuardian}
              creativePackage={creativePackage}
              executionPlan={executionPlan}
              showCanonicalDetail={Boolean(preview?.canonicalPublishPreview)}
              onEditTarget={(target) => {
                if (
                  target === "obiettivo" ||
                  target === "identita" ||
                  target === "modulo" ||
                  target === "pubblico" ||
                  target === "budget" ||
                  target === "annuncio" ||
                  target === "categoria"
                ) {
                  setStepId(target);
                }
              }}
            />

            <button
              type="button"
              className="text-[12px] text-[var(--primary)] underline-offset-2 hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Nascondi dettagli avanzati" : "Dettagli tecnici Easy"}
            </button>
            {showAdvanced ? (
              <div className="space-y-2 text-[12px] text-[var(--ink-muted)]">
                <p>
                  Prontezza Easy: {metrics.readiness} · Input{" "}
                  {metrics.completedInputsCount}/{metrics.requiredInputsCount} ·
                  Decisioni automatiche {metrics.automaticDecisionsCount} ·
                  publishAllowed:{" "}
                  {preview?.publishAllowed === true || preview?.canWrite === true
                    ? "sì"
                    : "no"}{" "}
                  · blocking: {metrics.blockingIssuesCount}
                </p>
                {preview?.instantFormEasyReadiness?.automaticDecisions.map(
                  (d) => (
                    <p key={d.reasonCode}>
                      <span className="font-medium text-[var(--ink)]">
                        {d.reasonTitle}:
                      </span>{" "}
                      {d.reasonText}
                    </p>
                  ),
                )}
              </div>
            ) : null}
            {publishGateMsg ? (
              <p className="text-[12px] text-[var(--ink-muted)]" role="status">
                {publishGateMsg}
              </p>
            ) : null}
          </div>
        ) : null}

        {errore ? (
          <p className="mt-4 text-[13px] text-red-700" role="alert">
            {errore}
          </p>
        ) : null}
        {loadHint && !errore ? (
          <p className="mt-4 text-[12px] text-[var(--ink-muted)]">{loadHint}</p>
        ) : null}
        {!stepGate.canContinue && stepId !== "review" ? (
          <div className="mt-4 space-y-2">
            <ul className="space-y-1 text-[12px] text-amber-800">
              {stepGate.blockers.map((b) => (
                <li key={b}>Continua disabilitato: {b}</li>
              ))}
            </ul>
            <p className="text-[12px] text-[var(--ink-muted)]">
              Puoi comunque aprire il riepilogo: il Launch Guardian indica cosa
              manca, senza pubblicare su Meta.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="aff-btn-tertiary"
            onClick={goBack}
            disabled={stepId === "obiettivo" || busy}
          >
            Indietro
          </button>
          {stepId !== "review" ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                className="aff-btn-secondary w-full sm:w-auto"
                disabled={busy}
                onClick={() => void openCampaignReview()}
              >
                {busy ? "Apertura…" : "Rivedi stato campagna"}
              </button>
              <button
                type="button"
                className="aff-btn-primary w-full sm:w-auto"
                disabled={busy || !stepGate.canContinue}
                onClick={() => void goNext()}
              >
                {busy ? "Salvataggio…" : "Continua"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="aff-btn-secondary"
              disabled={busy}
              onClick={() => void runPreview()}
            >
              Aggiorna riepilogo
            </button>
          )}
        </div>
      </section>

      <p className="text-center text-[12px] text-[var(--ink-muted)]">
        <Link
          href={`/campagne/${campaignId}`}
          className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Torna alla campagna
        </Link>
      </p>
    </div>
  );
}
