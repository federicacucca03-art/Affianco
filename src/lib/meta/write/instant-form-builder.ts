/**
 * P0.7 — Instant Form Easy Mode Builder (pure logic).
 * UI over the existing canonical Meta write plan — no parallel campaign object.
 * Deterministic. No AI. No Graph writes.
 */

import type { InstantFormEasyReadiness } from "@/lib/meta/write/instant-form-readiness";
import type { CanonicalPublishPreview } from "@/lib/meta/write/canonical-publish-preview";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";
import {
  isValidMetaLeadFormTechnicalUrl,
  normalizeMetaLeadFormTechnicalUrl,
} from "@/lib/meta/publish/payloads";

export const INSTANT_FORM_BUILDER_FLOW = "INSTANT_FORM_LEADS" as const;

/** User-visible Easy Builder steps (≤ 8). */
export type InstantFormBuilderStepId =
  | "obiettivo"
  | "identita"
  | "modulo"
  | "pubblico"
  | "budget"
  | "annuncio"
  | "categoria"
  | "review";

export type InstantFormBuilderStepDef = {
  id: InstantFormBuilderStepId;
  index: number;
  titleIt: string;
  questionIt: string;
  helpIt: string;
};

export const INSTANT_FORM_BUILDER_STEPS: readonly InstantFormBuilderStepDef[] = [
  {
    id: "obiettivo",
    index: 1,
    titleIt: "Obiettivo",
    questionIt: "Cosa vuoi ottenere?",
    helpIt:
      "Tu scegli il risultato. Ally configura la parte tecnica su Meta.",
  },
  {
    id: "identita",
    index: 2,
    titleIt: "Identità",
    questionIt: "Con quale attività vuoi pubblicare?",
    helpIt:
      "Scegli la Pagina Facebook. Se c'è un Instagram collegato, Ally lo propone automaticamente.",
  },
  {
    id: "modulo",
    index: 3,
    titleIt: "Modulo",
    questionIt: "Quale modulo vuoi usare?",
    helpIt:
      "Le persone compileranno il modulo direttamente su Facebook o Instagram, senza lasciare l'app.",
  },
  {
    id: "pubblico",
    index: 4,
    titleIt: "Pubblico",
    questionIt: "Chi vuoi raggiungere?",
    helpIt:
      "Indica la zona e, se serve, la fascia di età. Ally usa Advantage+ Audience per il resto.",
  },
  {
    id: "budget",
    index: 5,
    titleIt: "Budget",
    questionIt: "Quanto vuoi investire?",
    helpIt:
      "Imposta il budget giornaliero. Ally crea sempre la campagna in pausa: niente spesa automatica.",
  },
  {
    id: "annuncio",
    index: 6,
    titleIt: "Annuncio",
    questionIt: "Cosa vuoi mostrare?",
    helpIt:
      "Serve un'immagine, il testo principale e un titolo. Carousel e varianti multiple non sono in Facile.",
  },
  {
    id: "categoria",
    index: 7,
    titleIt: "Categoria speciale",
    questionIt: "Questa campagna riguarda una categoria speciale?",
    helpIt:
      "Devi confermare esplicitamente. Ally non assume nessuna categoria al posto tuo.",
  },
  {
    id: "review",
    index: 8,
    titleIt: "Riepilogo",
    questionIt: "Ecco cosa Ally creerà su Meta",
    helpIt:
      "Controlla le scelte. La creazione su Meta resta in pausa e passa dai controlli di sicurezza Ally.",
  },
] as const;

/** Ally business goals shown in Easy Mode Step 1 (never raw Meta enums). */
export type EasyBusinessGoalId =
  | "GENERATE_LEADS"
  | "TRAFFIC"
  | "SELL_ONLINE"
  | "ENGAGEMENT"
  | "AWARENESS";

/** Where contacts are collected after Generare contatti. */
export type EasyLeadsLocationId = "INSTANT_FORM" | "WEBSITE";

export type EasySupportStatus =
  | "SUPPORTED_EASY"
  | "AVAILABLE_FULL_PATH"
  | "COMING_SOON";

export type EasyBusinessGoalOption = {
  id: EasyBusinessGoalId;
  labelIt: string;
  descriptionIt: string;
  status: EasySupportStatus;
  /** Legacy wizard route when AVAILABLE_FULL_PATH. */
  legacyHref: string | null;
};

export type EasyLeadsLocationOption = {
  id: EasyLeadsLocationId;
  labelIt: string;
  descriptionIt: string;
  status: EasySupportStatus;
};

export const EASY_BUSINESS_GOAL_OPTIONS: readonly EasyBusinessGoalOption[] = [
  {
    id: "GENERATE_LEADS",
    labelIt: "Generare contatti",
    descriptionIt: "Richieste, lead, moduli o form sul sito.",
    status: "SUPPORTED_EASY",
    legacyHref: "/campagne/nuova/richieste-contatto",
  },
  {
    id: "TRAFFIC",
    labelIt: "Portare traffico al sito",
    descriptionIt: "Visite al sito o a una landing page.",
    status: "COMING_SOON",
    legacyHref: null,
  },
  {
    id: "SELL_ONLINE",
    labelIt: "Vendere online",
    descriptionIt: "Acquisti e conversioni e-commerce.",
    status: "AVAILABLE_FULL_PATH",
    legacyHref: "/campagne/nuova/vendite",
  },
  {
    id: "ENGAGEMENT",
    labelIt: "Aumentare interazioni",
    descriptionIt: "Messaggi, commenti, coinvolgimento.",
    status: "COMING_SOON",
    legacyHref: null,
  },
  {
    id: "AWARENESS",
    labelIt: "Aumentare notorietà",
    descriptionIt: "Far conoscere il brand o un’apertura.",
    status: "AVAILABLE_FULL_PATH",
    legacyHref: "/campagne/nuova/apertura",
  },
] as const;

export const EASY_LEADS_LOCATION_OPTIONS: readonly EasyLeadsLocationOption[] = [
  {
    id: "INSTANT_FORM",
    labelIt: "Modulo istantaneo Facebook/Instagram",
    descriptionIt:
      "Le persone compilano il modulo senza lasciare l’app. Non serve Pixel.",
    status: "SUPPORTED_EASY",
  },
  {
    id: "WEBSITE",
    labelIt: "Sito web",
    descriptionIt:
      "Contatti dal sito con tracking conversioni. Richiede Pixel/configurazione.",
    status: "AVAILABLE_FULL_PATH",
  },
] as const;

/** UX.4 — placement configuration on the shared builder draft (not view-only). */
export type BuilderPlacementsMode = "ADVANTAGE" | "MANUAL";

export type BuilderManualPlacementId =
  | "facebook_feed"
  | "instagram_feed"
  | "instagram_stories"
  | "instagram_reels"
  | "facebook_stories";

export const BUILDER_MANUAL_PLACEMENT_OPTIONS: readonly {
  id: BuilderManualPlacementId;
  labelIt: string;
}[] = [
  { id: "facebook_feed", labelIt: "Facebook Feed" },
  { id: "instagram_feed", labelIt: "Instagram Feed" },
  { id: "instagram_stories", labelIt: "Instagram Stories" },
  { id: "instagram_reels", labelIt: "Instagram Reels" },
  { id: "facebook_stories", labelIt: "Facebook Stories" },
] as const;

export type InstantFormBuilderDraft = {
  /** User business goal — null until explicitly chosen in Step 1. */
  objectiveChoice: EasyBusinessGoalId | null;
  /** Leads collection location — only when objective is GENERATE_LEADS. */
  conversionChoice: EasyLeadsLocationId | null;
  pageId: string;
  pageName: string | null;
  formId: string;
  formName: string | null;
  /** Instant Form privacy_policy_url from discovery — Creative technical link. */
  formPrivacyPolicyUrl: string | null;
  formRelation: "VERIFIED" | "MISMATCH" | "UNCHECKED";
  instagramUserId: string;
  preferPageOnly: boolean;
  metaGeoKey: string | null;
  geoLabel: string | null;
  geoQuery: string;
  countryCode: string;
  etaMin: number | null;
  etaMax: number | null;
  allyAudienceMode: "ADVANTAGE_AUDIENCE" | "CUSTOM";
  budgetDailyMajor: number | null;
  primaryText: string;
  headline: string;
  /** Optional ad description (link description). */
  description: string;
  /** P0.17 — copy provenance for Guardian / review honesty. */
  primaryTextProvenance: "USER" | "ALLY" | "UNKNOWN";
  headlineProvenance: "USER" | "ALLY" | "UNKNOWN";
  descriptionProvenance: "USER" | "ALLY" | "UNKNOWN";
  /** Creative asset count from campaign (images). */
  creativitaCount: number;
  specialKind: string;
  /** UX.4 — Advantage+ vs manual placements (shared Facile↔Pro). */
  placementsMode: BuilderPlacementsMode;
  /** UX.4 — selected manual placements when placementsMode === MANUAL. */
  placementsManual: BuilderManualPlacementId[];
};

export type InstantFormBuilderStepGate = {
  canContinue: boolean;
  blockers: string[];
};

/** Canonical Instant Form mapping (only after user confirms Instant Form). */
export function instantFormCanonicalDestination(): "META_LEAD_FORM" {
  return "META_LEAD_FORM";
}

export function instantFormCanonicalObjectiveRaw(): "OUTCOME_LEADS" {
  return "OUTCOME_LEADS";
}

/** True when Easy Mode may continue into Instant Form steps 2–8. */
export function isEasyInstantFormPath(
  draft: Pick<InstantFormBuilderDraft, "objectiveChoice" | "conversionChoice">,
): boolean {
  return (
    draft.objectiveChoice === "GENERATE_LEADS" &&
    draft.conversionChoice === "INSTANT_FORM"
  );
}

export function easyBusinessGoalLabelIt(
  id: EasyBusinessGoalId | null | undefined,
): string {
  if (!id) return "Da scegliere";
  return (
    EASY_BUSINESS_GOAL_OPTIONS.find((o) => o.id === id)?.labelIt ?? "Da scegliere"
  );
}

export function easyLeadsLocationLabelIt(
  id: EasyLeadsLocationId | null | undefined,
): string {
  if (!id) return "Da scegliere";
  return (
    EASY_LEADS_LOCATION_OPTIONS.find((o) => o.id === id)?.labelIt ??
    "Da scegliere"
  );
}

export function easyGoalSupportStatus(
  id: EasyBusinessGoalId | null | undefined,
): EasySupportStatus | null {
  if (!id) return null;
  return EASY_BUSINESS_GOAL_OPTIONS.find((o) => o.id === id)?.status ?? null;
}

export function easyLeadsLocationSupportStatus(
  id: EasyLeadsLocationId | null | undefined,
): EasySupportStatus | null {
  if (!id) return null;
  return EASY_LEADS_LOCATION_OPTIONS.find((o) => o.id === id)?.status ?? null;
}

/** Ally campaign.objective after Instant Form Easy confirmation. */
export function allyObjectiveAfterEasyConfirm(
  draft: Pick<InstantFormBuilderDraft, "objectiveChoice" | "conversionChoice">,
): "LEADS" | null {
  if (!isEasyInstantFormPath(draft)) return null;
  return "LEADS";
}

export function emptyInstantFormBuilderDraft(
  partial?: Partial<InstantFormBuilderDraft>,
): InstantFormBuilderDraft {
  return {
    objectiveChoice: null,
    conversionChoice: null,
    pageId: "",
    pageName: null,
    formId: "",
    formName: null,
    formPrivacyPolicyUrl: null,
    formRelation: "UNCHECKED",
    instagramUserId: "",
    preferPageOnly: false,
    metaGeoKey: null,
    geoLabel: null,
    geoQuery: "",
    countryCode: "IT",
    etaMin: null,
    etaMax: null,
    allyAudienceMode: "ADVANTAGE_AUDIENCE",
    budgetDailyMajor: null,
    primaryText: "",
    headline: "",
    description: "",
    primaryTextProvenance: "UNKNOWN",
    headlineProvenance: "UNKNOWN",
    descriptionProvenance: "UNKNOWN",
    creativitaCount: 0,
    specialKind: "UNRESOLVED",
    placementsMode: "ADVANTAGE",
    placementsManual: [],
    ...partial,
  };
}

export function placementsSummaryIt(draft: InstantFormBuilderDraft): string {
  if (draft.placementsMode === "MANUAL" && draft.placementsManual.length > 0) {
    const n = draft.placementsManual.length;
    return n === 1
      ? "Personalizzati (1 posizionamento)"
      : `Personalizzati (${n} posizionamenti)`;
  }
  if (draft.placementsMode === "MANUAL") return "Personalizzati";
  return "Automatici (Advantage+)";
}

export function audienceSummaryIt(draft: InstantFormBuilderDraft): string {
  if (draft.allyAudienceMode === "CUSTOM") return "Personalizzato";
  return "Advantage+";
}

export function hasAdvancedBuilderConfig(draft: InstantFormBuilderDraft): boolean {
  return (
    draft.placementsMode === "MANUAL" ||
    draft.allyAudienceMode === "CUSTOM" ||
    (draft.etaMin != null && draft.etaMin !== 18) ||
    (draft.etaMax != null && draft.etaMax !== 65)
  );
}

export function monthlyBudgetHintIt(dailyMajor: number | null): string | null {
  if (dailyMajor == null || !(dailyMajor > 0)) return null;
  const monthly = Math.round(dailyMajor * 30);
  return `Circa €${monthly} al mese (indicativo, non è una previsione di risultati).`;
}

/** Positive finite major-unit daily budget (Ally UI / campaigns.daily_budget). */
export function isValidBudgetDailyMajor(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Campaign UPDATE fragment for daily_budget.
 * Omits the column when draft budget is missing/invalid so later saves
 * cannot null out a previously persisted positive budget.
 */
export function allyCampaignDailyBudgetUpdate(
  budgetDailyMajor: number | null | undefined,
): { daily_budget: number } | Record<string, never> {
  if (!isValidBudgetDailyMajor(budgetDailyMajor)) return {};
  return { daily_budget: budgetDailyMajor };
}

/** Prefer valid draft budget; else hydrate from campaigns.daily_budget (major units). */
export function resolveBudgetDailyMajorForDraft(
  draftBudget: number | null | undefined,
  campaignBudgetMajor: number | null | undefined,
): number | null {
  if (isValidBudgetDailyMajor(draftBudget)) return draftBudget;
  if (isValidBudgetDailyMajor(campaignBudgetMajor)) return campaignBudgetMajor;
  return null;
}

export function evaluateBuilderStep(input: {
  stepId: InstantFormBuilderStepId;
  draft: InstantFormBuilderDraft;
}): InstantFormBuilderStepGate {
  const d = input.draft;
  const blockers: string[] = [];

  switch (input.stepId) {
    case "obiettivo": {
      if (!d.objectiveChoice) {
        blockers.push("Scegli cosa vuoi ottenere.");
        break;
      }
      const goalStatus = easyGoalSupportStatus(d.objectiveChoice);
      if (d.objectiveChoice !== "GENERATE_LEADS") {
        if (goalStatus === "COMING_SOON") {
          blockers.push(
            "Questo obiettivo non è ancora disponibile in Facile.",
          );
        } else if (goalStatus === "AVAILABLE_FULL_PATH") {
          blockers.push(
            "Questo obiettivo non è ancora in Facile. Usa la configurazione Pro.",
          );
        } else {
          blockers.push("Obiettivo non supportato in Facile.");
        }
        break;
      }
      if (!d.conversionChoice) {
        blockers.push("Scegli dove vuoi raccogliere i contatti.");
        break;
      }
      if (d.conversionChoice === "WEBSITE") {
        blockers.push(
          "La raccolta sul sito non è ancora pronta in Facile. Usa Pro oppure scegli il modulo istantaneo.",
        );
        break;
      }
      if (!isEasyInstantFormPath(d)) {
        blockers.push("Seleziona il modulo istantaneo per continuare.");
      }
      break;
    }
    case "identita":
      if (!d.pageId.trim()) blockers.push("Seleziona una Pagina Facebook.");
      break;
    case "modulo":
      if (!d.formId.trim()) blockers.push("Seleziona un modulo Instant Form.");
      if (d.formRelation === "MISMATCH") {
        blockers.push(
          "Il modulo non appartiene alla Pagina selezionata. Scegline un altro.",
        );
      }
      if (
        d.formId.trim() &&
        d.formRelation !== "MISMATCH" &&
        !isValidMetaLeadFormTechnicalUrl(d.formPrivacyPolicyUrl)
      ) {
        blockers.push(
          "Questo modulo Instant Form non ha un URL esterno valido (informativa privacy) richiesto da Meta.",
        );
      }
      break;
    case "pubblico":
      if (!d.metaGeoKey?.trim()) {
        blockers.push("Seleziona una zona geografica.");
      }
      if (
        d.etaMin != null &&
        d.etaMax != null &&
        (d.etaMin < 13 || d.etaMax > 65 || d.etaMin > d.etaMax)
      ) {
        blockers.push("Controlla la fascia di età (valori non validi).");
      }
      break;
    case "budget":
      if (!isValidBudgetDailyMajor(d.budgetDailyMajor)) {
        blockers.push("Inserisci un budget giornaliero maggiore di zero.");
      }
      break;
    case "annuncio":
      if (d.creativitaCount < 1) {
        blockers.push("Aggiungi almeno un'immagine all'annuncio.");
      }
      if (!d.primaryText.trim()) {
        blockers.push("Inserisci il testo principale dell'annuncio.");
      }
      if (!d.headline.trim()) {
        blockers.push("Inserisci il titolo dell'annuncio.");
      }
      break;
    case "categoria":
      if (!d.specialKind || d.specialKind === "UNRESOLVED") {
        blockers.push(
          "Conferma se la campagna rientra in una categoria speciale.",
        );
      }
      break;
    case "review":
      for (const step of INSTANT_FORM_BUILDER_STEPS) {
        if (step.id === "review") continue;
        const g = evaluateBuilderStep({ stepId: step.id, draft: d });
        for (const b of g.blockers) {
          if (!blockers.includes(b)) blockers.push(b);
        }
      }
      break;
    default:
      break;
  }

  return { canContinue: blockers.length === 0, blockers };
}

/**
 * P0.16.1 — Step continue gate (inline validation). Not the same as review/launch.
 */
export function canContinueBuilderStep(input: {
  stepId: InstantFormBuilderStepId;
  draft: InstantFormBuilderDraft;
}): boolean {
  return evaluateBuilderStep(input).canContinue;
}

/**
 * P0.16.1 — Canonical review is always reachable from Easy Builder.
 * Guardian owns publish-readiness; missing Page/Form/SAC become review blockers.
 */
export function canOpenBuilderReview(_draft?: InstantFormBuilderDraft): boolean {
  return true;
}

/**
 * P0.16.1 — Launch only when pre-write Guardian says READY (future milestone).
 */
export function canLaunchFromBuilderReview(input: {
  futureLaunchEligible: boolean;
  reviewStatus: string;
}): boolean {
  return (
    input.futureLaunchEligible === true && input.reviewStatus === "READY"
  );
}

export function computeBuilderProgressPercent(
  readiness: InstantFormEasyReadiness | null | undefined,
): number {
  if (!readiness || readiness.requiredInputsCount <= 0) return 0;
  const pct = Math.round(
    (readiness.completedInputsCount / readiness.requiredInputsCount) * 100,
  );
  return Math.max(0, Math.min(100, pct));
}

export type InstantFormBuilderMetrics = {
  requiredInputsCount: number;
  completedInputsCount: number;
  automaticDecisionsCount: number;
  advancedFieldsHiddenCount: number;
  blockingIssuesCount: number;
  estimatedUserSteps: number;
  builderProgressPercent: number;
  readiness: InstantFormEasyReadiness["readiness"] | "UNKNOWN";
  happyPathReady: boolean;
};

export function computeBuilderMetrics(
  readiness: InstantFormEasyReadiness | null | undefined,
  preview: MetaWritePreviewResult | null | undefined,
): InstantFormBuilderMetrics {
  const progress = computeBuilderProgressPercent(readiness);
  if (!readiness) {
    return {
      requiredInputsCount: 0,
      completedInputsCount: 0,
      automaticDecisionsCount: 0,
      advancedFieldsHiddenCount: 0,
      blockingIssuesCount:
        preview?.canonicalPublishPreview?.blockers.length ?? 0,
      estimatedUserSteps: INSTANT_FORM_BUILDER_STEPS.length,
      builderProgressPercent: progress,
      readiness: "UNKNOWN",
      happyPathReady: false,
    };
  }
  return {
    requiredInputsCount: readiness.requiredInputsCount,
    completedInputsCount: readiness.completedInputsCount,
    automaticDecisionsCount: readiness.automaticDecisionsCount,
    advancedFieldsHiddenCount: readiness.advancedFieldsHiddenCount,
    blockingIssuesCount: readiness.blockingIssues.length,
    estimatedUserSteps: readiness.estimatedUserSteps,
    builderProgressPercent: progress,
    readiness: readiness.readiness,
    happyPathReady:
      readiness.readiness === "READY" &&
      readiness.estimatedUserSteps <= 8 &&
      readiness.formRelation !== "MISMATCH" &&
      (preview?.publishAllowed === true || preview?.canWrite === true),
  };
}

export type EasyReviewSummaryRow = {
  labelIt: string;
  valueIt: string;
};

/** Compact Easy review rows — values from draft + canonical preview when present. */
export function buildEasyReviewSummary(input: {
  draft: InstantFormBuilderDraft;
  preview: CanonicalPublishPreview | null | undefined;
}): EasyReviewSummaryRow[] {
  const d = input.draft;
  const field = (key: string): string | null => {
    const sections = input.preview?.sections ?? [];
    for (const s of sections) {
      const hit = s.fields.find((f) => f.key === key);
      if (hit?.valueIt) return hit.valueIt;
    }
    return null;
  };

  const igValue = d.preferPageOnly
    ? "Solo Pagina Facebook"
    : d.instagramUserId
      ? (field("creative.instagram") ?? "Account selezionato")
      : "Nessuno (solo Pagina, se supportato)";

  const sacValue =
    d.specialKind === "NONE"
      ? "Nessuna categoria speciale"
      : d.specialKind === "UNRESOLVED"
        ? "Da confermare"
        : (field("campaign.special_ad_categories") ?? d.specialKind);

  return [
    {
      labelIt: "Obiettivo",
      valueIt: easyBusinessGoalLabelIt(d.objectiveChoice),
    },
    {
      labelIt: "Raccolta contatti",
      valueIt:
        d.objectiveChoice === "GENERATE_LEADS"
          ? easyLeadsLocationLabelIt(d.conversionChoice)
          : "—",
    },
    {
      labelIt: "Pagina",
      valueIt: d.pageName?.trim() || field("creative.page") || "—",
    },
    { labelIt: "Instagram", valueIt: igValue },
    {
      labelIt: "Modulo",
      valueIt: d.formName?.trim() || field("creative.instant_form") || "—",
    },
    {
      labelIt: "Budget",
      valueIt: isValidBudgetDailyMajor(d.budgetDailyMajor)
        ? `€${d.budgetDailyMajor}/giorno`
        : field("adset.daily_budget") || "—",
    },
    {
      labelIt: "Pubblico",
      valueIt: [
        d.geoLabel?.trim() || field("adset.geo") || "Zona da definire",
        d.etaMin != null && d.etaMax != null
          ? `Età ${d.etaMin}–${d.etaMax}`
          : null,
        "Advantage+ Audience",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { labelIt: "Posizionamenti", valueIt: "Advantage+" },
    {
      labelIt: "Creatività",
      valueIt:
        d.creativitaCount > 0
          ? `${d.creativitaCount} immagine · ${d.headline.trim() || "titolo"}`
          : "Mancante",
    },
    { labelIt: "Categoria speciale", valueIt: sacValue },
    { labelIt: "Status", valueIt: "In pausa" },
  ];
}

/** Time-to-ready instrumentation (internal / local only). */
export type InstantFormBuilderTiming = {
  brief_started_at: string | null;
  review_ready_at: string | null;
  publish_clicked_at: string | null;
};

export function emptyBuilderTiming(): InstantFormBuilderTiming {
  return {
    brief_started_at: null,
    review_ready_at: null,
    publish_clicked_at: null,
  };
}

export function markBriefStarted(
  timing: InstantFormBuilderTiming,
  nowIso = new Date().toISOString(),
): InstantFormBuilderTiming {
  if (timing.brief_started_at) return timing;
  return { ...timing, brief_started_at: nowIso };
}

export function markReviewReady(
  timing: InstantFormBuilderTiming,
  nowIso = new Date().toISOString(),
): InstantFormBuilderTiming {
  if (timing.review_ready_at) return timing;
  return { ...timing, review_ready_at: nowIso };
}

export function markPublishClicked(
  timing: InstantFormBuilderTiming,
  nowIso = new Date().toISOString(),
): InstantFormBuilderTiming {
  return { ...timing, publish_clicked_at: nowIso };
}

export function activeSetupSeconds(
  timing: InstantFormBuilderTiming,
): number | null {
  if (!timing.brief_started_at || !timing.review_ready_at) return null;
  const a = Date.parse(timing.brief_started_at);
  const b = Date.parse(timing.review_ready_at);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 1000);
}

export function builderTimingStorageKey(campaignId: string): string {
  return `ally_if_builder_timing_v1:${campaignId}`;
}

export function parseBuilderTiming(raw: unknown): InstantFormBuilderTiming {
  if (!raw || typeof raw !== "object") return emptyBuilderTiming();
  const o = raw as Record<string, unknown>;
  const pick = (k: string): string | null =>
    typeof o[k] === "string" && (o[k] as string).trim()
      ? (o[k] as string).trim()
      : null;
  return {
    brief_started_at: pick("brief_started_at"),
    review_ready_at: pick("review_ready_at"),
    publish_clicked_at: pick("publish_clicked_at"),
  };
}

/** Manual placements must never appear as Easy-supported controls. */
export function easyModeExposesManualPlacements(): boolean {
  return false;
}

/** Carousel / multi-copy are not Easy publishable features. */
export function easyModeExposesCarouselOrMultiCopy(): boolean {
  return false;
}

/** Pixel absence must not block Instant Form Easy. */
export function pixelAbsenceBlocksInstantFormEasy(
  readiness: InstantFormEasyReadiness | null | undefined,
): boolean {
  if (!readiness) return false;
  return readiness.blockingIssues.some((b) => /pixel|dataset/i.test(b));
}

/**
 * Italian CTA label for Instant Form Easy (derived, not user-edited).
 * UX.4.5.2 — must match execution Meta enum SIGN_UP → "Iscriviti"
 * (see ALLY_META_CTA_LABEL_IT / INSTANT_FORM_META_CTA_TYPE).
 */
export function easyModeCtaLabelIt(): string {
  return "Iscriviti";
}

/** Meta CTA type Instant Form Easy actually publishes. */
export function easyModeCtaType(): "SIGN_UP" {
  return "SIGN_UP";
}

/** Core fields the Builder must persist via campaign + canonical plan. */
export const BUILDER_PERSISTABLE_CORE_FIELDS = [
  "pageId",
  "pageName",
  "instagramUserId",
  "preferPageOnly",
  "formId",
  "formName",
  "formPrivacyPolicyUrl",
  "metaGeoKey",
  "geoLabel",
  "etaMin",
  "etaMax",
  "budgetDailyMajor",
  "creativitaMeta",
  "primaryText",
  "headline",
  "ctaDerived",
  "specialKind",
] as const;

export type BuilderPersistableCoreField =
  (typeof BUILDER_PERSISTABLE_CORE_FIELDS)[number];

export function builderDraftStorageKey(campaignId: string): string {
  return `ally_if_builder_draft_v1:${campaignId}`;
}

export type PersistedBuilderDraftSnapshot = {
  stepId: InstantFormBuilderStepId;
  draft: InstantFormBuilderDraft;
  creativeAssetId: string | null;
  creativeNomeFile: string | null;
  creativeStoragePath: string | null;
};

export function parseBuilderDraftSnapshot(
  raw: unknown,
): PersistedBuilderDraftSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stepId = o.stepId;
  const validSteps = new Set(INSTANT_FORM_BUILDER_STEPS.map((s) => s.id));
  if (typeof stepId !== "string" || !validSteps.has(stepId as InstantFormBuilderStepId)) {
    return null;
  }
  const draftRaw = o.draft;
  if (!draftRaw || typeof draftRaw !== "object") return null;
  const d = draftRaw as Partial<InstantFormBuilderDraft>;
  return {
    stepId: stepId as InstantFormBuilderStepId,
    draft: emptyInstantFormBuilderDraft({
      pageId: typeof d.pageId === "string" ? d.pageId : "",
      pageName: typeof d.pageName === "string" ? d.pageName : null,
      formId: typeof d.formId === "string" ? d.formId : "",
      formName: typeof d.formName === "string" ? d.formName : null,
      formPrivacyPolicyUrl: normalizeMetaLeadFormTechnicalUrl(
        typeof d.formPrivacyPolicyUrl === "string"
          ? d.formPrivacyPolicyUrl
          : null,
      ),
      formRelation:
        d.formRelation === "VERIFIED" ||
        d.formRelation === "MISMATCH" ||
        d.formRelation === "UNCHECKED"
          ? d.formRelation
          : "UNCHECKED",
      instagramUserId:
        typeof d.instagramUserId === "string" ? d.instagramUserId : "",
      preferPageOnly: d.preferPageOnly === true,
      metaGeoKey: typeof d.metaGeoKey === "string" ? d.metaGeoKey : null,
      geoLabel: typeof d.geoLabel === "string" ? d.geoLabel : null,
      geoQuery: typeof d.geoQuery === "string" ? d.geoQuery : "",
      countryCode: typeof d.countryCode === "string" ? d.countryCode : "IT",
      etaMin: typeof d.etaMin === "number" ? d.etaMin : null,
      etaMax: typeof d.etaMax === "number" ? d.etaMax : null,
      budgetDailyMajor: isValidBudgetDailyMajor(d.budgetDailyMajor)
        ? d.budgetDailyMajor
        : null,
      primaryText: typeof d.primaryText === "string" ? d.primaryText : "",
      headline: typeof d.headline === "string" ? d.headline : "",
      description: typeof d.description === "string" ? d.description : "",
      primaryTextProvenance:
        d.primaryTextProvenance === "USER" ||
        d.primaryTextProvenance === "ALLY" ||
        d.primaryTextProvenance === "UNKNOWN"
          ? d.primaryTextProvenance
          : "UNKNOWN",
      headlineProvenance:
        d.headlineProvenance === "USER" ||
        d.headlineProvenance === "ALLY" ||
        d.headlineProvenance === "UNKNOWN"
          ? d.headlineProvenance
          : "UNKNOWN",
      descriptionProvenance:
        d.descriptionProvenance === "USER" ||
        d.descriptionProvenance === "ALLY" ||
        d.descriptionProvenance === "UNKNOWN"
          ? d.descriptionProvenance
          : "UNKNOWN",
      creativitaCount:
        typeof d.creativitaCount === "number" ? d.creativitaCount : 0,
      specialKind: typeof d.specialKind === "string" ? d.specialKind : "UNRESOLVED",
      objectiveChoice:
        d.objectiveChoice === "GENERATE_LEADS" ||
        d.objectiveChoice === "TRAFFIC" ||
        d.objectiveChoice === "SELL_ONLINE" ||
        d.objectiveChoice === "ENGAGEMENT" ||
        d.objectiveChoice === "AWARENESS"
          ? d.objectiveChoice
          : null,
      conversionChoice:
        d.conversionChoice === "INSTANT_FORM" ||
        d.conversionChoice === "WEBSITE"
          ? d.conversionChoice
          : null,
      allyAudienceMode:
        d.allyAudienceMode === "CUSTOM" ? "CUSTOM" : "ADVANTAGE_AUDIENCE",
      placementsMode: d.placementsMode === "MANUAL" ? "MANUAL" : "ADVANTAGE",
      placementsManual: Array.isArray(d.placementsManual)
        ? (d.placementsManual.filter((p) =>
            BUILDER_MANUAL_PLACEMENT_OPTIONS.some((o) => o.id === p),
          ) as BuilderManualPlacementId[])
        : [],
    }),
    creativeAssetId:
      typeof o.creativeAssetId === "string" ? o.creativeAssetId : null,
    creativeNomeFile:
      typeof o.creativeNomeFile === "string" ? o.creativeNomeFile : null,
    creativeStoragePath:
      typeof o.creativeStoragePath === "string" ? o.creativeStoragePath : null,
  };
}

/** Review image must match the same Ally asset id as the creative plan. */
export function reviewMatchesCreativeAsset(input: {
  reviewAssetId: string | null | undefined;
  canonicalAssetId: string | null | undefined;
}): boolean {
  const a = (input.reviewAssetId ?? "").trim();
  const b = (input.canonicalAssetId ?? "").trim();
  if (!a || !b) return false;
  return a === b;
}

/** Easy Builder must not require leaving for the required single image. */
export function easyBuilderRequiresExternalStudioForImage(): boolean {
  return false;
}
