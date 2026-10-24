/**
 * P0.12 — Campaign creation path + manual mode.
 *
 * Dimensions:
 *   creationPath: ALLY_ASSISTED | MANUAL
 *   manualMode:   EASY | FULL | null  (only when MANUAL)
 *
 * Same Ally campaign entity; path chooses UX only.
 * Persisted via front_end_offer marker (no new DB column) + local assets.
 * LIVE META WRITES: 0
 */

import {
  leggiAssetCampagnaLocale,
  salvaAssetCampagnaLocale,
} from "@/data/campagne-assets-store";
import { supabase } from "@/lib/supabase";

export type CampagnaCreationPath = "ALLY_ASSISTED" | "MANUAL";
export type CampagnaManualMode = "EASY" | "FULL";
/** @deprecated Prefer CampagnaManualMode — kept for P0.12 transition. */
export type CampagnaCreationMode = CampagnaManualMode;

export type CampagnaCreationState = {
  creationPath: CampagnaCreationPath | null;
  manualMode: CampagnaManualMode | null;
};

/** Marker: [ALLY_PATH:ALLY_ASSISTED] or [ALLY_PATH:MANUAL:EASY|FULL] */
const PATH_PREFIX_RE =
  /^\[ALLY_PATH:(ALLY_ASSISTED|MANUAL(?::(EASY|FULL))?)\]\n?/;
/** Legacy P0.12-early marker — treat as MANUAL + mode. */
const LEGACY_MODE_PREFIX_RE = /^\[ALLY_MODE:(EASY|FULL)\]\n?/;
/** Anywhere in string — user-facing sanitization (markers may be concatenated). */
const PATH_ANYWHERE_RE = /\[ALLY_PATH:[^\]]*\]\n?/g;
const LEGACY_ANYWHERE_RE = /\[ALLY_MODE:(EASY|FULL)\]\n?/g;

export function isCampagnaCreationPath(
  v: unknown,
): v is CampagnaCreationPath {
  return v === "ALLY_ASSISTED" || v === "MANUAL";
}

export function isCampagnaManualMode(v: unknown): v is CampagnaManualMode {
  return v === "EASY" || v === "FULL";
}

export function isCampagnaCreationMode(
  v: unknown,
): v is CampagnaCreationMode {
  return isCampagnaManualMode(v);
}

/** UX.5.1 — strip canon block when exposing human brief (also used before re-encode). */
const CANON_BLOCK_RE =
  /\[ALLY_CANON_V1\]\s*[\s\S]*?\s*\[\/ALLY_CANON_V1\]\n?/g;

/**
 * True when residual text is still Ally machine payload (not human ad copy).
 * Used after tag strip so orphaned / mis-stored canon JSON never reaches UI/Meta.
 */
function isResidualAllyMachinePayload(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\[\/?ALLY_/i.test(t)) return true;
  // Serialized Instant Form / unified draft mistaken for variante_a.
  if (
    t.startsWith("{") &&
    /"objectiveChoice"\s*:/.test(t) &&
    /"conversionChoice"\s*:/.test(t)
  ) {
    return true;
  }
  if (
    /"objectiveChoice"\s*:/.test(t) &&
    /"conversionChoice"\s*:/.test(t) &&
    /"metaGeoKey"\s*:/.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Strip Ally machine markers from campaign text.
 * Separates USER CONTENT from INTERNAL METADATA (path / canon JSON).
 * Safe for Ads Editor, copy assist, titles, Review, Ask Ally, Meta creative.
 */
export function stripCreationModeFromFrontEndOffer(
  offer: string | null | undefined,
): string {
  let s = offer ?? "";
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(PATH_ANYWHERE_RE, "")
      .replace(LEGACY_ANYWHERE_RE, "")
      .replace(CANON_BLOCK_RE, "");
    if (next === s) break;
    s = next;
  }
  // Malformed / truncated canon block — drop remainder from open tag.
  if (s.includes("[ALLY_CANON_V1]")) {
    s = s.replace(/\[ALLY_CANON_V1\][\s\S]*/, "");
  }
  // Any leftover Ally machine tags must never reach UI.
  s = s.replace(/\[\/?ALLY_[A-Z0-9_]+[^\]]*\]/g, "");
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (isResidualAllyMachinePayload(s)) return "";
  return s;
}

/** Alias — prefer this name at UI / API / Meta creative boundaries. */
export function userFacingCampaignText(
  offer: string | null | undefined,
): string {
  return stripCreationModeFromFrontEndOffer(offer);
}

export function parseCreationStateFromFrontEndOffer(
  offer: string | null | undefined,
): CampagnaCreationState {
  const raw = offer ?? "";
  const pathMatch = raw.match(PATH_PREFIX_RE);
  if (pathMatch) {
    if (pathMatch[1] === "ALLY_ASSISTED") {
      return { creationPath: "ALLY_ASSISTED", manualMode: null };
    }
    const mode = pathMatch[2];
    return {
      creationPath: "MANUAL",
      manualMode: mode === "EASY" || mode === "FULL" ? mode : null,
    };
  }
  const legacy = raw.match(LEGACY_MODE_PREFIX_RE);
  if (legacy && (legacy[1] === "EASY" || legacy[1] === "FULL")) {
    return { creationPath: "MANUAL", manualMode: legacy[1] };
  }
  return { creationPath: null, manualMode: null };
}

/** @deprecated Use parseCreationStateFromFrontEndOffer */
export function parseCreationModeFromFrontEndOffer(
  offer: string | null | undefined,
): CampagnaCreationMode | null {
  const s = parseCreationStateFromFrontEndOffer(offer);
  return s.creationPath === "MANUAL" ? s.manualMode : null;
}

export function encodeFrontEndOfferWithCreationState(
  state: {
    creationPath: CampagnaCreationPath;
    manualMode?: CampagnaManualMode | null;
  },
  offer: string | null | undefined,
): string {
  const raw = offer ?? "";
  const canonMatch = raw.match(
    /\[ALLY_CANON_V1\]\s*[\s\S]*?\s*\[\/ALLY_CANON_V1\]/,
  );
  const canonBlock = canonMatch?.[0]?.trim() ?? "";
  const clean = stripCreationModeFromFrontEndOffer(offer);
  let marker: string;
  if (state.creationPath === "ALLY_ASSISTED") {
    marker = "[ALLY_PATH:ALLY_ASSISTED]";
  } else if (state.manualMode === "EASY" || state.manualMode === "FULL") {
    marker = `[ALLY_PATH:MANUAL:${state.manualMode}]`;
  } else {
    marker = "[ALLY_PATH:MANUAL]";
  }
  const parts = [marker, canonBlock, clean].filter(Boolean);
  return parts.join("\n");
}

/** @deprecated Use encodeFrontEndOfferWithCreationState */
export function encodeFrontEndOfferWithCreationMode(
  mode: CampagnaCreationMode,
  offer: string | null | undefined,
): string {
  return encodeFrontEndOfferWithCreationState(
    { creationPath: "MANUAL", manualMode: mode },
    offer,
  );
}

export function creationPathLabelIt(state: CampagnaCreationState): string {
  if (state.creationPath === "ALLY_ASSISTED") return "Preparata con Ally";
  if (state.creationPath === "MANUAL") {
    if (state.manualMode === "EASY") {
      return "Configurazione · Facile";
    }
    if (state.manualMode === "FULL") {
      return "Configurazione · Pro";
    }
    return "Configurazione";
  }
  return "Percorso non scelto";
}

export function creationModeLabelIt(mode: CampagnaCreationMode | null): string {
  if (mode === "EASY") return "Facile";
  if (mode === "FULL") return "Pro";
  return "Modalità non scelta";
}

export function resumeCtaLabelIt(state: CampagnaCreationState): string {
  if (state.creationPath === "ALLY_ASSISTED") return "Continua con Ally";
  if (state.creationPath === "MANUAL" && state.manualMode === "EASY") {
    return "Continua in Facile";
  }
  if (state.creationPath === "MANUAL" && state.manualMode === "FULL") {
    return "Continua configurazione";
  }
  if (state.creationPath === "MANUAL") return "Scegli livello di controllo";
  return "Scegli come creare la campagna";
}

/**
 * User-facing lifecycle label.
 * DRAFT without completed config must NOT say "In attesa di approvazione".
 */
export function lifecycleLabelForCampaignStatus(
  status: string | null | undefined,
  opts?: {
    hasCreationPath?: boolean;
    configurationComplete?: boolean;
    hasApprovalToken?: boolean;
  },
): string {
  const s = (status ?? "").toUpperCase();
  if (s === "REVISION_REQUESTED") return "Revisione cliente";
  if (s === "APPROVED") return "Pronta per Meta";
  if (s === "ACTIVE" || s === "RUNNING") return "Pubblicata";
  if (s === "DRAFT" || !s) {
    if (opts?.configurationComplete && opts?.hasApprovalToken) {
      return "In attesa di approvazione";
    }
    if (opts?.configurationComplete) return "In revisione";
    if (opts?.hasCreationPath === false) return "Scegli come creare";
    return "In configurazione";
  }
  return "In preparazione";
}

/**
 * True when a campaign should appear in Results with performance diagnosis.
 * Unpublished DRAFT shells must not look like live monitoring.
 */
export function campaignEligibleForResultsDiagnosis(input: {
  status?: string | null;
  approvedAt?: string | null;
  hasMetaLink?: boolean;
  hasDeliveryData?: boolean;
}): boolean {
  const s = (input.status ?? "").toUpperCase();
  if (s === "DRAFT" || !s) {
    if (input.hasDeliveryData) return true;
    if (input.hasMetaLink) return true;
    if ((input.approvedAt ?? "").trim()) return true;
    return false;
  }
  if (s === "REVISION_REQUESTED") return false;
  return true;
}

/**
 * UX.4 — primary configuration is the Unified Builder.
 * Legacy Instant Form Easy remains at /instant-form for review compatibility.
 */
export function easyBuilderHref(campaignId: string): string {
  return `/campagne/${encodeURIComponent(campaignId)}/configura`;
}

/** Legacy Easy Instant Form route (review / compatibility). */
export function legacyEasyInstantFormHref(campaignId: string): string {
  return `/campagne/${encodeURIComponent(campaignId)}/instant-form`;
}

export function fullWizardHref(campaignId: string): string {
  return `/campagne/nuova/richieste-contatto?campaignId=${encodeURIComponent(campaignId)}`;
}

/** First choice: HOW (Ally vs Manual). */
export function modeSelectorHref(campaignId: string): string {
  return `/campagne/${encodeURIComponent(campaignId)}/modalita`;
}

/** Second choice: Easy vs Full (manual only). */
export function manualModeSelectorHref(campaignId: string): string {
  return `/campagne/${encodeURIComponent(campaignId)}/manualita`;
}

/** Ally-assisted brief / interim Architect entry. */
export function allyAssistedHref(campaignId: string): string {
  return `/campagne/${encodeURIComponent(campaignId)}/con-ally`;
}

export function resumeHrefForCreationState(
  campaignId: string,
  state: CampagnaCreationState,
): string {
  if (state.creationPath === "ALLY_ASSISTED") {
    return allyAssistedHref(campaignId);
  }
  if (state.creationPath === "MANUAL") {
    if (state.manualMode === "EASY") return easyBuilderHref(campaignId);
    if (state.manualMode === "FULL") return fullWizardHref(campaignId);
    return manualModeSelectorHref(campaignId);
  }
  return modeSelectorHref(campaignId);
}

/** @deprecated Use resumeHrefForCreationState */
export function resumeHrefForCreationMode(
  campaignId: string,
  mode: CampagnaCreationMode | null,
): string {
  if (mode === "EASY" || mode === "FULL") {
    return resumeHrefForCreationState(campaignId, {
      creationPath: "MANUAL",
      manualMode: mode,
    });
  }
  return modeSelectorHref(campaignId);
}

export function readCreationStateLocal(
  campaignId: string,
): CampagnaCreationState {
  const assets = leggiAssetCampagnaLocale(campaignId) as {
    creationPath?: unknown;
    manualMode?: unknown;
    creationMode?: unknown;
  } | null;
  const path = isCampagnaCreationPath(assets?.creationPath)
    ? assets!.creationPath
    : null;
  const manual =
    isCampagnaManualMode(assets?.manualMode)
      ? assets!.manualMode
      : isCampagnaManualMode(assets?.creationMode)
        ? assets!.creationMode
        : null;
  if (path) return { creationPath: path, manualMode: manual };
  if (manual) return { creationPath: "MANUAL", manualMode: manual };
  return { creationPath: null, manualMode: null };
}

export function writeCreationStateLocal(
  campaignId: string,
  state: {
    creationPath: CampagnaCreationPath;
    manualMode?: CampagnaManualMode | null;
  },
): void {
  salvaAssetCampagnaLocale(campaignId, {
    creationPath: state.creationPath,
    manualMode: state.manualMode ?? undefined,
    creationMode:
      state.creationPath === "MANUAL" && state.manualMode
        ? state.manualMode
        : undefined,
  });
}

/** @deprecated Use writeCreationStateLocal */
export function writeCreationModeLocal(
  campaignId: string,
  mode: CampagnaCreationMode,
): void {
  writeCreationStateLocal(campaignId, {
    creationPath: "MANUAL",
    manualMode: mode,
  });
}

export function readCreationModeLocal(
  campaignId: string,
): CampagnaCreationMode | null {
  const s = readCreationStateLocal(campaignId);
  return s.creationPath === "MANUAL" ? s.manualMode : null;
}

/**
 * Resolve state: local assets first, then front_end_offer marker.
 */
export function resolveCreationState(input: {
  campaignId: string;
  frontEndOffer?: string | null;
}): CampagnaCreationState {
  const local = readCreationStateLocal(input.campaignId);
  if (local.creationPath) return local;
  return parseCreationStateFromFrontEndOffer(input.frontEndOffer);
}

export function resolveCreationMode(input: {
  campaignId: string;
  frontEndOffer?: string | null;
}): CampagnaCreationMode | null {
  const s = resolveCreationState(input);
  return s.creationPath === "MANUAL" ? s.manualMode : null;
}

/** Persist path (+ optional manual mode) locally + on campaigns.front_end_offer. */
export async function persistCreationState(input: {
  campaignId: string;
  creationPath: CampagnaCreationPath;
  manualMode?: CampagnaManualMode | null;
  currentFrontEndOffer?: string | null;
}): Promise<void> {
  writeCreationStateLocal(input.campaignId, {
    creationPath: input.creationPath,
    manualMode: input.manualMode ?? null,
  });
  const encoded = encodeFrontEndOfferWithCreationState(
    {
      creationPath: input.creationPath,
      manualMode: input.manualMode ?? null,
    },
    input.currentFrontEndOffer,
  );
  const { error } = await supabase
    .from("campaigns")
    .update({ front_end_offer: encoded })
    .eq("id", input.campaignId);
  if (error) throw new Error(error.message);
}

/** @deprecated Use persistCreationState */
export async function persistCreationMode(input: {
  campaignId: string;
  mode: CampagnaCreationMode;
  currentFrontEndOffer?: string | null;
}): Promise<void> {
  await persistCreationState({
    campaignId: input.campaignId,
    creationPath: "MANUAL",
    manualMode: input.mode,
    currentFrontEndOffer: input.currentFrontEndOffer,
  });
}

export const HOW_SELECTOR_COPY = {
  title: "Come vuoi creare la campagna?",
  allyTitle: "Preparala con Ally",
  allyBody:
    "Racconta cosa vuoi ottenere. Ally prepara la struttura della campagna e ti spiega le scelte.",
  allySupport: "Potrai controllare e modificare tutto prima della pubblicazione.",
  allyCta: "Parla con Ally",
  manualTitle: "Configurala tu",
  manualBody:
    "Imposta direttamente la campagna scegliendo il livello di controllo.",
  manualSupport: "Facile o Pro — stessa campagna Ally.",
  manualCta: "Configura manualmente",
} as const;

export const MANUAL_MODE_COPY = {
  title: "Quanto controllo vuoi?",
  easyTitle: "Facile",
  easyBody: "Tu scegli il risultato. Ally configura la parte tecnica.",
  easySupport:
    "Pensata per creare una campagna professionale senza dover conoscere Ads Manager.",
  easyCta: "Inizia in Facile",
  fullTitle: "Pro",
  fullBody: "Gestisci più impostazioni e personalizza la configurazione.",
  fullSupport:
    "Per chi vuole gestire più dettagli tecnici Meta disponibili in Ally.",
  fullCta: "Inizia in Pro",
} as const;

/** @deprecated Use HOW_SELECTOR_COPY / MANUAL_MODE_COPY */
export const MODE_SELECTOR_COPY = {
  title: HOW_SELECTOR_COPY.title,
  easyTitle: MANUAL_MODE_COPY.easyTitle,
  easyBody: MANUAL_MODE_COPY.easyBody,
  easySupport: MANUAL_MODE_COPY.easySupport,
  easyCta: MANUAL_MODE_COPY.easyCta,
  fullTitle: MANUAL_MODE_COPY.fullTitle,
  fullBody: MANUAL_MODE_COPY.fullBody,
  fullSupport: MANUAL_MODE_COPY.fullSupport,
  fullCta: MANUAL_MODE_COPY.fullCta,
} as const;
