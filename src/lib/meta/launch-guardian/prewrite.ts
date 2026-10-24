/**
 * P0.16 / P0.16.2 — Deterministic PRE-WRITE Launch Guardian.
 * Inspects CanonicalPublishPreview / MetaWritePreview BEFORE any Meta write.
 * Does not call Graph. Does not mutate Meta. LIVE META WRITES: 0
 *
 * Status precedence (P0.16.2):
 * UNSUPPORTED — only when Ally cannot execute the design (capability / unsupported objective)
 * BLOCKED — supported design, missing inputs/assets/permissions
 * READY_WITH_CONFIRMATIONS — only confirmations remain
 * READY — supported and complete
 *
 * Future flow:
 * PRE-WRITE GUARDIAN → user authorization → Meta write → POST-WRITE READBACK (P0.6)
 */

import type { CanonicalPublishPreview } from "@/lib/meta/write/canonical-publish-preview";
import type { MetaWritePreviewResult } from "@/lib/meta/write/types";
import type { MetaWriteReadinessCode } from "@/lib/meta/write/types";
import type {
  CanonicalReviewStatus,
  DecisionProvenance,
  PreWriteEditTarget,
  PreWriteGuardianCheck,
  PreWriteGuardianResult,
} from "@/lib/meta/launch-guardian/prewrite-types";
import type { MetaExecutionPlan } from "@/lib/meta/execution-plan/types";
import { mergeExecutionPlanIntoGuardianChecks } from "@/lib/meta/execution-plan/guardian-v2";
import type { MetaWritePlan } from "@/lib/meta/write-plan/types";
import { mergeWritePlanIntoGuardianChecks } from "@/lib/meta/write-plan/guardian-write";

export type PreWriteGuardianInput = {
  preview: MetaWritePreviewResult | null | undefined;
  canonical?: CanonicalPublishPreview | null;
  /**
   * ADV.2.1 — Optional V2 MetaExecutionPlan (dry-run). Merges granular
   * blockers without deleting unsupported design state.
   */
  executionPlan?: MetaExecutionPlan | null;
  /**
   * ADV.2.3 — Optional MetaWritePlan (dry-run ops). Gate stays OFF;
   * merges write blockers + CREATE≠ACTIVATE safety checks.
   */
  writePlan?: MetaWritePlan | null;
  /**
   * Optional Ally capability (Architect). When NOT_YET_SUPPORTED / route NONE
   * for non-Easy designs (e.g. Sales), review becomes UNSUPPORTED.
   */
  executionSupport?: {
    level?: string | null;
    recommendedRoute?: string | null;
    summaryIt?: string | null;
    unsupported?: boolean;
  } | null;
  /** Optional provenance hints for a few high-confidence fields. */
  provenanceHints?: Partial<
    Record<
      "objective" | "conversionLocation" | "budget" | "sac" | "page" | "form",
      DecisionProvenance
    >
  >;
  /**
   * P0.16.1 — Easy Builder draft snapshot so Guardian can surface blockers
   * even when write-preview is unavailable (e.g. no Meta connection).
   */
  easyDraft?: {
    pageId?: string | null;
    formId?: string | null;
    specialKind?: string | null;
    creativitaCount?: number | null;
    primaryText?: string | null;
    headline?: string | null;
    budgetDailyMajor?: number | null;
    metaGeoKey?: string | null;
    objectiveChoice?: string | null;
    conversionChoice?: string | null;
    metaConnected?: boolean | null;
  } | null;
  /**
   * P0.17 — Canonical creative package blockers (Annuncio).
   * Same Guardian authority; no second readiness system.
   */
  creativePackage?: {
    status?: string | null;
    formatSupport?: string | null;
    blockers?: Array<{
      code: string;
      messageIt: string;
      editTarget: "annuncio" | "identita" | "modulo" | "obiettivo" | "review";
    }> | null;
  } | null;
};

type CodeMap = {
  /** Stable semantic issue id — one actionable card per id. */
  id: string;
  scope: PreWriteGuardianCheck["scope"];
  title: string;
  userMessage: string;
  editTarget: PreWriteEditTarget;
  bucket: "BLOCKERS" | "CONFIRMATIONS" | "WARNINGS";
};

/** Semantic issue identities (P0.16.2 dedup). */
export const GUARDIAN_ISSUE = {
  META_CONNECTION_MISSING: "META_CONNECTION_MISSING",
  AD_ACCOUNT_MISSING: "AD_ACCOUNT_MISSING",
  ADS_MANAGEMENT_PERMISSION_MISSING: "ADS_MANAGEMENT_PERMISSION_MISSING",
  PAGE_MISSING: "PAGE_MISSING",
  FORM_MISSING: "FORM_MISSING",
  FORM_PAGE_MISMATCH: "FORM_PAGE_MISMATCH",
  GEO_MISSING: "GEO_MISSING",
  CREATIVE_MEDIA_MISSING: "CREATIVE_MEDIA_MISSING",
  CREATIVE_PRIMARY_TEXT_MISSING: "CREATIVE_PRIMARY_TEXT_MISSING",
  CREATIVE_HEADLINE_MISSING: "CREATIVE_HEADLINE_MISSING",
  CREATIVE_FORMAT_UNSUPPORTED: "CREATIVE_FORMAT_UNSUPPORTED",
  SAC_UNRESOLVED: "SAC_UNRESOLVED",
  SAC_COUNTRY_REQUIRED: "SAC_COUNTRY_REQUIRED",
  OBJECTIVE_MISSING: "OBJECTIVE_MISSING",
  OBJECTIVE_UNSUPPORTED: "OBJECTIVE_UNSUPPORTED",
  DESTINATION_MISSING: "DESTINATION_MISSING",
  BUDGET_MISSING: "BUDGET_MISSING",
  TRACKING_MISSING: "TRACKING_MISSING",
  INSTAGRAM_SELECTION: "INSTAGRAM_SELECTION",
  IG_PAGE_MISMATCH: "IG_PAGE_MISMATCH",
  DESTINATION_URL_MALFORMED: "DESTINATION_URL_MALFORMED",
  BILLING_UNSUPPORTED: "BILLING_UNSUPPORTED",
  CONFIGURATION_UNSUPPORTED: "CONFIGURATION_UNSUPPORTED",
  CAPABILITY_UNSUPPORTED: "CAPABILITY_UNSUPPORTED",
  PLACEMENTS_MANUAL_UNSUPPORTED: "PLACEMENTS_MANUAL_UNSUPPORTED",
  LIVE_WRITES_GATED: "LIVE_WRITES_GATED",
  FABRICATED_IDS: "FABRICATED_IDS",
} as const;

const CODE_MAP: Partial<Record<MetaWriteReadinessCode, CodeMap>> = {
  MISSING_OBJECTIVE: {
    id: GUARDIAN_ISSUE.OBJECTIVE_MISSING,
    scope: "CAMPAIGN",
    title: "Obiettivo mancante",
    userMessage: "Scegli l'obiettivo della campagna.",
    editTarget: "obiettivo",
    bucket: "BLOCKERS",
  },
  UNSUPPORTED_OBJECTIVE: {
    id: GUARDIAN_ISSUE.OBJECTIVE_UNSUPPORTED,
    scope: "EXECUTION",
    title: "Obiettivo non eseguibile",
    userMessage:
      "Ally ha capito l'obiettivo, ma non può ancora configurarlo fedelmente.",
    editTarget: "obiettivo",
    bucket: "BLOCKERS",
  },
  UNSUPPORTED_CONFIGURATION: {
    id: GUARDIAN_ISSUE.CONFIGURATION_UNSUPPORTED,
    scope: "EXECUTION",
    title: "Configurazione non supportata",
    userMessage:
      "Questa combinazione non è ancora eseguibile in Ally. La proposta resta visibile.",
    editTarget: "review",
    bucket: "BLOCKERS",
  },
  MISSING_SPECIAL_AD_CATEGORY_DECISION: {
    id: GUARDIAN_ISSUE.SAC_UNRESOLVED,
    scope: "CAMPAIGN",
    title: "Categoria speciale da confermare",
    userMessage:
      "Conferma se la campagna rientra in una categoria speciale. Ally non la conferma al posto tuo.",
    editTarget: "categoria",
    bucket: "CONFIRMATIONS",
  },
  SPECIAL_AD_CATEGORY_REQUIRED: {
    id: GUARDIAN_ISSUE.SAC_UNRESOLVED,
    scope: "CAMPAIGN",
    title: "Categoria speciale da confermare",
    userMessage:
      "Conferma se la campagna rientra in una categoria speciale. Ally non la conferma al posto tuo.",
    editTarget: "categoria",
    bucket: "CONFIRMATIONS",
  },
  SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION: {
    id: GUARDIAN_ISSUE.SAC_UNRESOLVED,
    scope: "CAMPAIGN",
    title: "Categoria speciale da confermare",
    userMessage: "Verifica la categoria speciale prima della creazione.",
    editTarget: "categoria",
    bucket: "CONFIRMATIONS",
  },
  SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED: {
    id: GUARDIAN_ISSUE.SAC_COUNTRY_REQUIRED,
    scope: "CAMPAIGN",
    title: "Paese categoria speciale",
    userMessage: "Per questa categoria speciale Meta richiede il paese.",
    editTarget: "categoria",
    bucket: "BLOCKERS",
  },
  MISSING_BUDGET: {
    id: GUARDIAN_ISSUE.BUDGET_MISSING,
    scope: "AD_SET",
    title: "Budget mancante",
    userMessage: "Inserisci un budget giornaliero maggiore di zero.",
    editTarget: "budget",
    bucket: "BLOCKERS",
  },
  MISSING_GEO: {
    id: GUARDIAN_ISSUE.GEO_MISSING,
    scope: "AD_SET",
    title: "Area geografica mancante",
    userMessage: "Seleziona dove mostrare gli annunci.",
    editTarget: "pubblico",
    bucket: "BLOCKERS",
  },
  MISSING_GEO_RESOLUTION: {
    id: GUARDIAN_ISSUE.GEO_MISSING,
    scope: "AD_SET",
    title: "Area geografica mancante",
    userMessage: "Seleziona una zona valida dall'elenco suggerito.",
    editTarget: "pubblico",
    bucket: "BLOCKERS",
  },
  MISSING_DESTINATION: {
    id: GUARDIAN_ISSUE.DESTINATION_MISSING,
    scope: "AD_SET",
    title: "Destinazione mancante",
    userMessage: "Scegli dove vuoi raccogliere i contatti o inviare il traffico.",
    editTarget: "obiettivo",
    bucket: "BLOCKERS",
  },
  MISSING_PAGE: {
    id: GUARDIAN_ISSUE.PAGE_MISSING,
    scope: "IDENTITY",
    title: "Pagina Facebook mancante",
    userMessage: "Seleziona una Pagina Facebook reale già collegata.",
    editTarget: "identita",
    bucket: "BLOCKERS",
  },
  MISSING_FORM: {
    id: GUARDIAN_ISSUE.FORM_MISSING,
    scope: "IDENTITY",
    title: "Modulo Instant Form mancante",
    userMessage: "Seleziona un modulo Instant Form collegato alla Pagina.",
    editTarget: "modulo",
    bucket: "BLOCKERS",
  },
  FORM_PAGE_MISMATCH: {
    id: GUARDIAN_ISSUE.FORM_PAGE_MISMATCH,
    scope: "IDENTITY",
    title: "Modulo non della Pagina",
    userMessage:
      "Il modulo non appartiene alla Pagina selezionata. Scegline un altro.",
    editTarget: "modulo",
    bucket: "BLOCKERS",
  },
  MISSING_TRACKING_CONFIG: {
    id: GUARDIAN_ISSUE.TRACKING_MISSING,
    scope: "AD_SET",
    title: "Tracking mancante",
    userMessage:
      "Serve Pixel/Dataset e evento di conversione. Ally non degrada a Link Clicks.",
    editTarget: "tracking",
    bucket: "BLOCKERS",
  },
  MISSING_CREATIVE_ASSET: {
    id: GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING,
    scope: "CREATIVE",
    title: "Creatività mancante",
    userMessage: "Aggiungi almeno un'immagine all'annuncio.",
    editTarget: "annuncio",
    bucket: "BLOCKERS",
  },
  MISSING_INSTAGRAM_SELECTION: {
    id: GUARDIAN_ISSUE.INSTAGRAM_SELECTION,
    scope: "IDENTITY",
    title: "Instagram da scegliere",
    userMessage:
      "Scegli un account Instagram collegato oppure pubblica solo con la Pagina.",
    editTarget: "identita",
    bucket: "CONFIRMATIONS",
  },
  IG_PAGE_MISMATCH: {
    id: GUARDIAN_ISSUE.IG_PAGE_MISMATCH,
    scope: "IDENTITY",
    title: "Instagram non della Pagina",
    userMessage: "L'account Instagram non corrisponde alla Pagina selezionata.",
    editTarget: "identita",
    bucket: "BLOCKERS",
  },
  MALFORMED_DESTINATION_URL: {
    id: GUARDIAN_ISSUE.DESTINATION_URL_MALFORMED,
    scope: "CREATIVE",
    title: "URL destinazione non valido",
    userMessage: "Controlla l'URL del sito: formato non valido.",
    editTarget: "annuncio",
    bucket: "BLOCKERS",
  },
  MISSING_META_CONNECTION: {
    id: GUARDIAN_ISSUE.META_CONNECTION_MISSING,
    scope: "EXECUTION",
    title: "Meta non collegato",
    userMessage: "Collega Meta per questa attività prima della creazione.",
    editTarget: "preparazione",
    bucket: "BLOCKERS",
  },
  MISSING_AD_ACCOUNT: {
    id: GUARDIAN_ISSUE.AD_ACCOUNT_MISSING,
    scope: "EXECUTION",
    title: "Account pubblicitario mancante",
    userMessage: "Seleziona un account pubblicitario Meta.",
    editTarget: "preparazione",
    bucket: "BLOCKERS",
  },
  MISSING_META_PERMISSION: {
    id: GUARDIAN_ISSUE.ADS_MANAGEMENT_PERMISSION_MISSING,
    scope: "EXECUTION",
    title: "Permesso ads_management mancante",
    userMessage: "Serve il permesso di gestione ads su Meta.",
    editTarget: "preparazione",
    bucket: "BLOCKERS",
  },
  UNSUPPORTED_BILLING_EVENT: {
    id: GUARDIAN_ISSUE.BILLING_UNSUPPORTED,
    scope: "AD_SET",
    title: "Evento di fatturazione non supportato",
    userMessage: "Questa configurazione di fatturazione non è supportata.",
    editTarget: "review",
    bucket: "BLOCKERS",
  },
};

function semanticIdFromReadinessCode(
  code: string,
): string | null {
  const map = CODE_MAP[code as MetaWriteReadinessCode];
  return map?.id ?? null;
}

function inferSemanticFromMessage(messageIt: string): string | null {
  const m = messageIt.toLowerCase();
  if (/collega meta|connessione meta|meta non colleg/.test(m)) {
    return GUARDIAN_ISSUE.META_CONNECTION_MISSING;
  }
  if (/account pubblicitario/.test(m)) {
    return GUARDIAN_ISSUE.AD_ACCOUNT_MISSING;
  }
  if (/ads_management|permesso/.test(m)) {
    return GUARDIAN_ISSUE.ADS_MANAGEMENT_PERMISSION_MISSING;
  }
  if (/pagina facebook|indica la pagina/.test(m)) {
    return GUARDIAN_ISSUE.PAGE_MISSING;
  }
  if (/modulo instant|indica il modulo/.test(m)) {
    return GUARDIAN_ISSUE.FORM_MISSING;
  }
  if (/categoria speciale/.test(m)) {
    return GUARDIAN_ISSUE.SAC_UNRESOLVED;
  }
  if (/obiettivo meta non determinato|scegli l'obiettivo/.test(m)) {
    return GUARDIAN_ISSUE.OBJECTIVE_MISSING;
  }
  if (/area geografica|zona:|zona meta|geo/.test(m)) {
    return GUARDIAN_ISSUE.GEO_MISSING;
  }
  if (/asset creativo|creativit|immagine/.test(m)) {
    return GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING;
  }
  if (/budget/.test(m)) {
    return GUARDIAN_ISSUE.BUDGET_MISSING;
  }
  return null;
}

function fromCode(
  code: MetaWriteReadinessCode,
  technicalExtra?: string,
): PreWriteGuardianCheck | null {
  const map = CODE_MAP[code];
  if (!map) return null;
  const status =
    map.bucket === "CONFIRMATIONS"
      ? ("CONFIRM" as const)
      : map.bucket === "WARNINGS"
        ? ("WARN" as const)
        : ("FAIL" as const);
  return {
    id: map.id,
    scope: map.scope,
    status,
    bucket: map.bucket,
    title: map.title,
    userMessage: map.userMessage,
    technicalReason: technicalExtra
      ? `${code}: ${technicalExtra}`
      : `readinessCode=${code}`,
    editTarget: map.editTarget,
  };
}

function pass(
  id: string,
  scope: PreWriteGuardianCheck["scope"],
  title: string,
  userMessage: string,
  technicalReason: string,
  provenance?: DecisionProvenance,
): PreWriteGuardianCheck {
  return {
    id,
    scope,
    status: "PASS",
    bucket: "PASSED",
    title,
    userMessage,
    technicalReason,
    editTarget: null,
    provenance,
  };
}

function isEasyInstantFormSupported(
  draft: PreWriteGuardianInput["easyDraft"],
): boolean {
  return (
    draft?.objectiveChoice === "GENERATE_LEADS" &&
    draft?.conversionChoice === "INSTANT_FORM"
  );
}

function reviewStatusFrom(input: {
  unsupported: boolean;
  blockers: PreWriteGuardianCheck[];
  confirmations: PreWriteGuardianCheck[];
  publishAllowed: boolean;
}): CanonicalReviewStatus {
  if (input.unsupported) return "UNSUPPORTED";
  if (input.blockers.length > 0) return "BLOCKED";
  if (input.confirmations.length > 0) return "READY_WITH_CONFIRMATIONS";
  if (input.publishAllowed) return "READY";
  // Supported path but not yet writeable — treat outstanding gaps as blocked.
  return "BLOCKED";
}

function headlineFor(status: CanonicalReviewStatus, remaining: number): string {
  if (status === "READY") return "Configurazione completa";
  if (status === "READY_WITH_CONFIRMATIONS") {
    return remaining === 1
      ? "Ancora 1 cosa da completare"
      : `Ancora ${remaining} cose da completare`;
  }
  if (status === "UNSUPPORTED") {
    return "Configurazione compresa, non ancora eseguibile in Ally";
  }
  return remaining > 0
    ? `Ancora ${remaining} cose da completare`
    : "Configurazione bloccata";
}

/**
 * Run deterministic pre-write Guardian over an existing write preview.
 * Never invents asset IDs. Never mutates Meta.
 */
export function runPreWriteLaunchGuardian(
  input: PreWriteGuardianInput,
): PreWriteGuardianResult {
  const preview = input.preview ?? null;
  const canonical =
    input.canonical ?? preview?.canonicalPublishPreview ?? null;
  const codes = new Set(preview?.readinessCodes ?? []);
  const publishAllowed =
    preview?.publishAllowed === true ||
    preview?.canWrite === true ||
    canonical?.publishAllowed === true;

  const draft = input.easyDraft ?? null;
  const easyInstantForm = isEasyInstantFormSupported(draft);
  const easyObjectiveSelected =
    draft?.objectiveChoice === "GENERATE_LEADS" ||
    draft?.objectiveChoice === "SELL_ONLINE" ||
    draft?.objectiveChoice === "GET_TRAFFIC" ||
    Boolean(draft?.objectiveChoice);

  const checks: PreWriteGuardianCheck[] = [];
  const seen = new Set<string>();
  const push = (c: PreWriteGuardianCheck | null) => {
    if (!c || seen.has(c.id)) return;
    seen.add(c.id);
    checks.push(c);
  };

  const exec = input.executionSupport;
  // Capability-driven unsupported (Architect Sales etc.) — never fake Ready to publish.
  const capabilityUnsupported =
    exec?.unsupported === true ||
    (exec?.level === "NOT_YET_SUPPORTED" &&
      (exec?.recommendedRoute === "NONE" || !exec?.recommendedRoute));

  // P0.16.2 / P0.17 — UNSUPPORTED only for designs Ally cannot execute
  // (capability, unsupported objective, or creative format NOT_YET_SUPPORTED).
  // Missing Meta / Page / Form / geo / media must NOT flip Instant Form to UNSUPPORTED.
  const creativeUnsupported =
    input.creativePackage?.status === "UNSUPPORTED" ||
    input.creativePackage?.formatSupport === "NOT_YET_SUPPORTED";
  const unsupported =
    capabilityUnsupported ||
    creativeUnsupported ||
    (!easyInstantForm && codes.has("UNSUPPORTED_OBJECTIVE"));

  if (unsupported) {
    push({
      id: GUARDIAN_ISSUE.CAPABILITY_UNSUPPORTED,
      scope: "EXECUTION",
      status: "FAIL",
      bucket: "BLOCKERS",
      title: "Esecuzione non disponibile",
      userMessage:
        exec?.summaryIt?.trim() ||
        "Ally ha progettato la campagna, ma questa configurazione non è ancora completamente eseguibile in Ally.",
      technicalReason: `capability level=${exec?.level ?? "?"} route=${exec?.recommendedRoute ?? "?"} codes=${[...codes].join(",")}`,
      editTarget: "review",
    });
  }

  // P0.16.1 — draft-backed blockers when preview/codes are thin or missing.
  if (draft) {
    if (draft.metaConnected === false) {
      push(
        fromCode("MISSING_META_CONNECTION") ?? {
          id: GUARDIAN_ISSUE.META_CONNECTION_MISSING,
          scope: "EXECUTION",
          status: "FAIL",
          bucket: "BLOCKERS",
          title: "Meta non collegato",
          userMessage: "Collega Meta per questa attività prima della creazione.",
          technicalReason: "easyDraft.metaConnected=false",
          editTarget: "preparazione",
        },
      );
    }
    if (!(draft.pageId ?? "").trim()) {
      push(fromCode("MISSING_PAGE"));
    }
    if (
      draft.conversionChoice === "INSTANT_FORM" &&
      !(draft.formId ?? "").trim()
    ) {
      push(fromCode("MISSING_FORM"));
    }
    if (
      draft.budgetDailyMajor == null ||
      !(Number(draft.budgetDailyMajor) > 0)
    ) {
      push(fromCode("MISSING_BUDGET"));
    }
    if (!(draft.metaGeoKey ?? "").trim()) {
      push(fromCode("MISSING_GEO"));
    }
    if (!draft.creativitaCount || draft.creativitaCount < 1) {
      push(fromCode("MISSING_CREATIVE_ASSET"));
    }
    if (!(draft.primaryText ?? "").trim()) {
      push({
        id: GUARDIAN_ISSUE.CREATIVE_PRIMARY_TEXT_MISSING,
        scope: "CREATIVE",
        status: "FAIL",
        bucket: "BLOCKERS",
        title: "Testo principale mancante",
        userMessage: "Inserisci il testo principale dell'annuncio.",
        technicalReason: "easyDraft.primaryText empty",
        editTarget: "annuncio",
      });
    }
    if (!(draft.headline ?? "").trim()) {
      push({
        id: GUARDIAN_ISSUE.CREATIVE_HEADLINE_MISSING,
        scope: "CREATIVE",
        status: "FAIL",
        bucket: "BLOCKERS",
        title: "Titolo mancante",
        userMessage: "Inserisci il titolo dell'annuncio.",
        technicalReason: "easyDraft.headline empty",
        editTarget: "annuncio",
      });
    }
    if (!draft.specialKind || draft.specialKind === "UNRESOLVED") {
      push(fromCode("MISSING_SPECIAL_AD_CATEGORY_DECISION"));
    }
  }

  // P0.17 — creative package blockers (semantic, once)
  const creativePkg = input.creativePackage ?? null;
  if (creativePkg?.formatSupport === "NOT_YET_SUPPORTED") {
    push({
      id: GUARDIAN_ISSUE.CREATIVE_FORMAT_UNSUPPORTED,
      scope: "CREATIVE",
      status: "FAIL",
      bucket: "BLOCKERS",
      title: "Formato creativo non supportato",
      userMessage:
        "Questo formato non è ancora pubblicabile da Ally. Nessuna conversione silenziosa.",
      technicalReason: `creativePackage.status=${creativePkg.status ?? "?"}`,
      editTarget: "annuncio",
    });
  }
  for (const b of creativePkg?.blockers ?? []) {
    const id =
      b.code === "CREATIVE_MEDIA_MISSING"
        ? GUARDIAN_ISSUE.CREATIVE_MEDIA_MISSING
        : b.code === "CREATIVE_PRIMARY_TEXT_MISSING"
          ? GUARDIAN_ISSUE.CREATIVE_PRIMARY_TEXT_MISSING
          : b.code === "CREATIVE_HEADLINE_MISSING"
            ? GUARDIAN_ISSUE.CREATIVE_HEADLINE_MISSING
            : b.code === "CREATIVE_FORMAT_UNSUPPORTED"
              ? GUARDIAN_ISSUE.CREATIVE_FORMAT_UNSUPPORTED
              : b.code === "CREATIVE_PAGE_MISSING"
                ? GUARDIAN_ISSUE.PAGE_MISSING
                : b.code === "CREATIVE_FORM_MISSING"
                  ? GUARDIAN_ISSUE.FORM_MISSING
                  : `creative.${b.code}`;
    push({
      id,
      scope: "CREATIVE",
      status: "FAIL",
      bucket: "BLOCKERS",
      title:
        b.code === "CREATIVE_MEDIA_MISSING"
          ? "Creatività mancante"
          : b.code === "CREATIVE_PRIMARY_TEXT_MISSING"
            ? "Testo principale mancante"
            : b.code === "CREATIVE_HEADLINE_MISSING"
              ? "Titolo mancante"
              : "Creatività",
      userMessage: b.messageIt,
      technicalReason: `creativePackage.${b.code}`,
      editTarget: b.editTarget,
    });
  }

  // Map readiness codes (deduped by semantic id)
  for (const code of codes) {
    if (code === "READY_TO_PREVIEW" || code === "READY_TO_WRITE") continue;
    if (code === "LIVE_WRITES_GATED") {
      push({
        id: GUARDIAN_ISSUE.LIVE_WRITES_GATED,
        scope: "SAFETY",
        status: "WARN",
        bucket: "WARNINGS",
        title: "Scritture Meta non attive in QA",
        userMessage:
          "In questo ambiente la creazione Meta resta disattivata. La revisione è solo di controllo.",
        technicalReason: "LIVE_WRITES_GATED",
        editTarget: null,
      });
      continue;
    }

    // Easy already selected LEADS — never contradict with objective_missing.
    if (
      code === "MISSING_OBJECTIVE" &&
      (easyInstantForm || draft?.objectiveChoice === "GENERATE_LEADS")
    ) {
      continue;
    }

    // Supported Instant Form: incomplete inputs are BLOCKERS, not "config unsupported".
    if (code === "UNSUPPORTED_CONFIGURATION" && easyInstantForm) {
      continue;
    }

    // When overall status is capability-unsupported, skip redundant CONFIGURATION_UNSUPPORTED.
    if (code === "UNSUPPORTED_CONFIGURATION" && unsupported) {
      continue;
    }

    push(fromCode(code));
  }

  // Canonical blockers — only surface issues not already covered by readiness/draft.
  // Avoid generic "Blocco anteprima" duplicates for the same underlying requirement.
  for (const b of canonical?.blockers ?? []) {
    const semantic =
      semanticIdFromReadinessCode(b.code) ??
      inferSemanticFromMessage(b.messageIt);
    if (semantic && seen.has(semantic)) continue;
    // Readiness-mapped codes were already handled above.
    if (semanticIdFromReadinessCode(b.code)) continue;
    // Suppress objective-missing echo when Easy already selected LEADS.
    if (
      semantic === GUARDIAN_ISSUE.OBJECTIVE_MISSING &&
      (easyInstantForm || draft?.objectiveChoice === "GENERATE_LEADS")
    ) {
      continue;
    }
    if (semantic === GUARDIAN_ISSUE.CONFIGURATION_UNSUPPORTED && easyInstantForm) {
      continue;
    }
    if (!semantic) {
      // Unknown unique canonical issue — keep once under stable id.
      push({
        id: `canonical.unique.${b.code}`,
        scope: "SAFETY",
        status: "FAIL",
        bucket: "BLOCKERS",
        title: "Blocco anteprima",
        userMessage: b.messageIt,
        technicalReason: `canonical blocker ${b.code} field=${b.fieldKey ?? "—"}`,
        editTarget: b.fieldKey?.includes("form")
          ? "modulo"
          : b.fieldKey?.includes("page")
            ? "identita"
            : b.fieldKey?.includes("budget")
              ? "budget"
              : "review",
      });
      continue;
    }
    const mapped = fromCode(b.code as MetaWriteReadinessCode);
    if (mapped) {
      push(mapped);
    } else {
      push({
        id: semantic,
        scope: "SAFETY",
        status: "FAIL",
        bucket: "BLOCKERS",
        title:
          semantic === GUARDIAN_ISSUE.META_CONNECTION_MISSING
            ? "Meta non collegato"
            : "Blocco anteprima",
        userMessage: b.messageIt,
        technicalReason: `canonical blocker ${b.code}`,
        editTarget:
          semantic === GUARDIAN_ISSUE.META_CONNECTION_MISSING
            ? "preparazione"
            : b.fieldKey?.includes("form")
              ? "modulo"
              : b.fieldKey?.includes("page")
                ? "identita"
                : "review",
      });
    }
  }

  for (const w of canonical?.warnings ?? []) {
    const semantic =
      semanticIdFromReadinessCode(w.code) ??
      inferSemanticFromMessage(w.messageIt);
    if (semantic && seen.has(semantic)) continue;
    if (semantic === GUARDIAN_ISSUE.SAC_UNRESOLVED) continue;
    push({
      id: `canonical.warning.${w.code}`,
      scope: "SAFETY",
      status: "WARN",
      bucket: "WARNINGS",
      title: "Avviso anteprima",
      userMessage: w.messageIt,
      technicalReason: `canonical warning ${w.code}`,
      editTarget: null,
    });
  }

  // Manual placements integrity — never silent Advantage+ switch
  const placements = canonical?.technicalDetails.placementsMode;
  if (placements === "MANUAL_UNSUPPORTED") {
    push({
      id: GUARDIAN_ISSUE.PLACEMENTS_MANUAL_UNSUPPORTED,
      scope: "AD_SET",
      status: "FAIL",
      bucket: "BLOCKERS",
      title: "Posizionamenti manuali non supportati",
      userMessage:
        "I posizionamenti manuali non sono pubblicabili da Ally. Non sostituiamo Advantage+ in silenzio.",
      technicalReason: "placementsMode=MANUAL_UNSUPPORTED",
      editTarget: "review",
    });
  }

  // Website Leads tracking: never Link Clicks disguise
  const plan = preview?.conversionPublishPlan;
  if (
    plan &&
    plan.needsTracking &&
    !plan.valid &&
    codes.has("MISSING_TRACKING_CONFIG")
  ) {
    // TRACKING_MISSING already pushed from readiness — keep single card.
    if (!seen.has(GUARDIAN_ISSUE.TRACKING_MISSING)) {
      push({
        id: GUARDIAN_ISSUE.TRACKING_MISSING,
        scope: "AD_SET",
        status: "FAIL",
        bucket: "BLOCKERS",
        title: "Tracking obbligatorio",
        userMessage:
          "Senza Pixel/Dataset Ally non pubblica e non degrada a Traffico / Link Clicks.",
        technicalReason: `needsTracking=${plan.needsTracking} opt=${plan.optimizationGoal}`,
        editTarget: "tracking",
      });
    }
  }

  // Fabricated ID safety — scan canonical technical dump for invent-looking claims
  const tech = JSON.stringify(canonical?.technicalDetails ?? {});
  if (/\b(page_id|form_id|pixel_id)\s*[:=]\s*['\"]?(invent|fake|demo)/i.test(tech)) {
    push({
      id: GUARDIAN_ISSUE.FABRICATED_IDS,
      scope: "SAFETY",
      status: "FAIL",
      bucket: "BLOCKERS",
      title: "ID Meta non validi",
      userMessage: "Ally non inventa Page, Form o Pixel. Collega asset reali.",
      technicalReason: "fabricated id pattern in technicalDetails",
      editTarget: "identita",
    });
  } else {
    push(
      pass(
        "safety.no_fabricated_ids",
        "SAFETY",
        "Nessun ID inventato",
        "Page, Form e Pixel restano solo asset reali o da collegare.",
        "no fabricated id markers",
        "DEFAULT_SAFE",
      ),
    );
  }

  // Positive checks when evidence present
  const hints = input.provenanceHints ?? {};
  const objectiveFromPreview = preview?.campaign?.objective;
  const objectiveKnown =
    Boolean(objectiveFromPreview) ||
    easyInstantForm ||
    draft?.objectiveChoice === "GENERATE_LEADS";
  if (objectiveKnown) {
    const objLabel =
      objectiveFromPreview ||
      (draft?.objectiveChoice === "GENERATE_LEADS" ? "OUTCOME_LEADS" : "impostato");
    push(
      pass(
        "campaign.objective_ok",
        "CAMPAIGN",
        "Obiettivo impostato",
        `Obiettivo: ${objLabel}`,
        `objective=${objLabel}`,
        hints.objective ?? (easyObjectiveSelected ? "USER_SELECTED" : undefined),
      ),
    );
  }
  if (preview?.campaign?.status === "PAUSED") {
    push(
      pass(
        "campaign.status_paused",
        "CAMPAIGN",
        "Stato iniziale in pausa",
        "Alla creazione la campagna resta in pausa. Nessuna attivazione automatica.",
        "status=PAUSED",
        "DEFAULT_SAFE",
      ),
    );
  }
  if (
    (plan?.conversionLocation === "INSTANT_FORM" &&
      plan.optimizationGoal === "LEAD_GENERATION") ||
    (easyInstantForm && draft?.conversionChoice === "INSTANT_FORM")
  ) {
    push(
      pass(
        "adset.instant_form_opt",
        "AD_SET",
        "Ottimizzazione Lead (Instant Form)",
        "Conversione su modulo istantaneo, senza Pixel obbligatorio.",
        "INSTANT_FORM + LEAD_GENERATION",
        hints.conversionLocation ?? "ALLY_DERIVED",
      ),
    );
  }
  if (plan?.conversionLocation === "WEBSITE" && plan.valid) {
    push(
      pass(
        "adset.website_tracking_ok",
        "AD_SET",
        "Tracking sito valido",
        "Destinazione sito con tracking configurato (nessun downgrade a Link Clicks).",
        `WEBSITE opt=${plan.optimizationGoal} event=${plan.conversionEvent}`,
        hints.conversionLocation ?? "USER_SELECTED",
      ),
    );
  }
  if (placements === "ADVANTAGE_PLUS") {
    push(
      pass(
        "adset.placements_advantage",
        "AD_SET",
        "Posizionamenti Advantage+",
        "Meta distribuirà automaticamente gli annunci.",
        "placementsMode=ADVANTAGE_PLUS",
        "DEFAULT_SAFE",
      ),
    );
  }

  // ADV.2.1 — merge Execution Plan granular requirements (never strip design)
  if (input.executionPlan) {
    const merged = mergeExecutionPlanIntoGuardianChecks(
      checks,
      input.executionPlan,
    );
    checks.length = 0;
    checks.push(...merged);
    // Multi-AdSet awareness — informational pass when N>1
    if (input.executionPlan.adSets.length > 1) {
      push(
        pass(
          "exec.multi_adset",
          "AD_SET",
          "Più gruppi di inserzioni",
          `${input.executionPlan.adSets.length} gruppi nel piano — nessun flatten.`,
          `adSetCount=${input.executionPlan.adSets.length}`,
          "ALLY_DERIVED",
        ),
      );
    }
  }

  // ADV.2.3 — merge Write Plan readiness (gate OFF; no live execution)
  if (input.writePlan) {
    const mergedWp = mergeWritePlanIntoGuardianChecks(checks, input.writePlan);
    checks.length = 0;
    checks.push(...mergedWp);
  }

  const blockers = checks.filter((c) => c.bucket === "BLOCKERS");
  const confirmations = checks.filter((c) => c.bucket === "CONFIRMATIONS");
  const warnings = checks.filter((c) => c.bucket === "WARNINGS");
  const passed = checks.filter((c) => c.bucket === "PASSED");

  const finalStatus = reviewStatusFrom({
    unsupported,
    blockers,
    confirmations,
    publishAllowed: unsupported ? false : publishAllowed,
  });

  const remaining = blockers.length + confirmations.length;
  const headlineIt = headlineFor(finalStatus, remaining);
  const summaryIt =
    finalStatus === "READY"
      ? "Pronta per il controllo finale. Nessuna scrittura Meta in questo passaggio."
      : finalStatus === "UNSUPPORTED"
        ? "La comprensione resta valida, ma Ally non espone un lancio finto."
        : finalStatus === "READY_WITH_CONFIRMATIONS"
          ? "Configurazione supportata: completa le conferme indicate sotto."
          : "Completa i blocchi prima di un futuro lancio su Meta.";

  return {
    phase: "PRE_WRITE",
    reviewStatus: finalStatus,
    headlineIt,
    summaryIt,
    checks,
    blockers,
    confirmations,
    warnings,
    passed,
    futureLaunchEligible: finalStatus === "READY",
    mutationsPerformed: 0,
    publishAllowed: unsupported ? false : Boolean(publishAllowed),
  };
}

export function editTargetLabelIt(target: PreWriteEditTarget): string | null {
  if (!target) return null;
  const map: Record<Exclude<PreWriteEditTarget, null>, string> = {
    obiettivo: "Obiettivo",
    identita: "Identità",
    modulo: "Modulo",
    pubblico: "Pubblico",
    budget: "Budget",
    annuncio: "Annuncio",
    categoria: "Categoria speciale",
    tracking: "Tracking",
    review: "Revisione",
    preparazione: "Preparazione Meta",
  };
  return map[target] ?? null;
}

/** Count occurrences of a semantic issue id in actionable lists (tests). */
export function countActionableIssue(
  result: PreWriteGuardianResult,
  issueId: string,
): number {
  return [...result.blockers, ...result.confirmations].filter(
    (c) => c.id === issueId,
  ).length;
}
