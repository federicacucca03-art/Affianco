/**
 * M10B — Guided Meta campaign architecture (planning only).
 * No Meta writes. No Ads Manager publish permissions.
 * Deterministic configuration.
 */

/**
 * Provenance contract (strict):
 * EXPLICIT — user explicitly selected or typed it
 * BRIEF — explicitly present in brief
 * INFERRED — Ally derived/proposed from context
 * EXISTING — already canonical for client/campaign
 * MISSING — not known / requires decision
 * META_MANAGED — Ally does not configure it in this milestone
 *
 * "Scelta tua" may render ONLY for EXPLICIT.
 */
export type GuidedProvenance =
  | "EXPLICIT"
  | "BRIEF"
  | "INFERRED"
  | "EXISTING"
  | "MISSING"
  | "META_MANAGED";

/** Canonical Meta outcome objectives Ally may propose for planning. */
export type GuidedMetaObjectiveCode =
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT";

export type GuidedAudienceStrategy =
  | "PROSPECTING"
  | "LOCAL"
  | "BROAD"
  | "RETARGETING"
  | "UNKNOWN";

export type GuidedDestinationKind =
  | "META_LEAD_FORM"
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE"
  | "INSTAGRAM_DM"
  | "MAPS"
  | "UNKNOWN"
  | "NOT_REQUIRED";

export type GuidedBudgetLevel = "CAMPAIGN" | "AD_SET" | "UNKNOWN";

export type GuidedPlacementsStrategy =
  | "ADVANTAGE_PLUS"
  | "MANUAL"
  | "META_DEFAULT";

export type GuidedFieldState<T> = {
  value: T | null;
  provenance: GuidedProvenance;
  /** User-facing short note when useful. */
  note: string | null;
};

export type GuidedAdSetPlan = {
  id: string;
  name: string;
  /** Beginner-facing name (no raw "Prospecting" as primary). */
  nameBeginner: string;
  /** Professional secondary descriptor. */
  strategyLabel: string | null;
  audienceStrategy: GuidedAudienceStrategy;
  geographySummary: string | null;
  ageSummary: string | null;
  destination: GuidedDestinationKind;
  budgetNote: string | null;
  whySingleOrSplit: string;
};

export type GuidedAdPlan = {
  id: string;
  name: string;
  adSetId: string;
  messagePreview: string | null;
  creativeSlot: "A" | "B" | "C" | null;
};

export type GuidedMissingRequirement = {
  id: string;
  label: string;
  severity: "BLOCKER" | "WARNING" | "INFO";
  /** Planning vs Meta technical readiness. */
  scope: "PLANNING" | "META_TECHNICAL";
};

/**
 * Canonical guided architecture proposal.
 * Derived from wizard state — not a parallel campaign truth.
 */
export type GuidedMetaPlan = {
  businessGoal: GuidedFieldState<string>;
  businessGoalCode: string;
  metaObjective: GuidedFieldState<GuidedMetaObjectiveCode>;
  destination: GuidedFieldState<GuidedDestinationKind>;
  audienceStrategy: GuidedFieldState<GuidedAudienceStrategy>;
  /** Geographic facts (city / radius) — separate from audience strategy. */
  geographyFacts: GuidedFieldState<string>;
  /** Age facts — separate from audience strategy. */
  ageFacts: GuidedFieldState<string>;
  budgetDaily: GuidedFieldState<number>;
  budgetLevel: GuidedFieldState<GuidedBudgetLevel>;
  optimizationGoal: GuidedFieldState<string>;
  /** User-facing optimization label (never raw API as primary). */
  optimizationGoalLabel: GuidedFieldState<string>;
  placementsStrategy: GuidedFieldState<GuidedPlacementsStrategy>;
  bidStrategy: GuidedFieldState<"META_DEFAULT">;
  attribution: GuidedFieldState<"CONFIGURE_IN_META">;
  adSets: GuidedAdSetPlan[];
  ads: GuidedAdPlan[];
  missingRequirements: GuidedMissingRequirement[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Ally planning only — never implies created on Meta. */
  lifecycle: "ALLY_PLANNING";
  whySummary: string[];
};

export type BuildGuidedMetaPlanInput = {
  objective: string | null | undefined;
  nomeCampagna: string | null | undefined;
  citta: string | null | undefined;
  raggioKm: number | null | undefined;
  etaMin: number | null | undefined;
  etaMax: number | null | undefined;
  budgetGiornaliero: number | null | undefined;
  bookingChannel: string | null | undefined;
  destinationUrl: string | null | undefined;
  whatsappNumber: string | null | undefined;
  pageId: string | null | undefined;
  formId: string | null | undefined;
  targetType: string | null | undefined;
  retargetingAudienceSource: string | null | undefined;
  cboAttivo: boolean | null | undefined;
  posizionamentiAdvantage: boolean | null | undefined;
  varianteA: string | null | undefined;
  varianteB: string | null | undefined;
  varianteC: string | null | undefined;
  titoloAnnuncio: string | null | undefined;
  creativitaCount: number | null | undefined;
  /**
   * Explicit guided destination choice (session / user decision).
   * Prefer over inferred hints when set.
   */
  explicitDestination?:
    | "META_LEAD_FORM"
    | "WEBSITE"
    | "WHATSAPP"
    | "PHONE"
    | "INSTAGRAM_DM"
    | "MAPS"
    | null
    | undefined;
  /**
   * True only when the user explicitly toggled budget level / CBO
   * (wizard defaults must NOT count as EXPLICIT).
   */
  budgetLevelUserChosen?: boolean | null | undefined;
  /**
   * True only when the user explicitly toggled placements strategy.
   */
  placementsUserChosen?: boolean | null | undefined;
  /**
   * True only when the user explicitly changed booking channel
   * (default WHATSAPP for BOOKINGS must not be EXPLICIT).
   */
  bookingChannelUserChosen?: boolean | null | undefined;
  /** Field-level provenance overrides (e.g. brief → BRIEF). */
  fromBrief?: {
    budgetGiornaliero?: boolean;
    citta?: boolean;
    raggioKm?: boolean;
    etaMin?: boolean;
    etaMax?: boolean;
    objective?: boolean;
  } | null;
};
