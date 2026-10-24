/**
 * ADV.2.4.0.3 — Central Meta OAuth scope catalog (no secrets).
 *
 * Login for Business still uses config_id for the dialog URL; this module is
 * the Ally-side source of truth for expected granted scopes, diagnostics, and
 * write-upgrade persist checks. Keep Meta Login Configs aligned with it.
 */

export type MetaScopeDecision = "retain" | "add" | "do_not_add";

export type MetaScopeMatrixRow = {
  name: string;
  currentlyRequestedViaLoginConfig: boolean;
  allyFeature: string;
  requiredForAdv24LeadsInstantForm: boolean;
  decision: MetaScopeDecision;
  notes: string;
};

/** Minimum scopes Ally expects after a successful write-capable connect. */
export const META_ALLY_REQUIRED_SCOPES = [
  "ads_read",
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
] as const;

export type MetaAllyRequiredScope = (typeof META_ALLY_REQUIRED_SCOPES)[number];

/** Scopes historically required before ADV.2.4.0.3 (write upgrade persist). */
export const META_WRITE_UPGRADE_BASE_SCOPES = [
  "ads_read",
  "ads_management",
] as const;

/**
 * Write-upgrade persist must prove these before replacing the connection.
 * Includes pages_manage_ads for Instant Form discovery (Graph #200).
 */
export const META_WRITE_UPGRADE_REQUIRED_SCOPES = [
  ...META_ALLY_REQUIRED_SCOPES,
] as const;

/** Explicitly NOT requested for ADV.2.4 Form listing / Ad reference. */
export const META_SCOPES_NOT_REQUIRED_FOR_ADV24 = [
  "leads_retrieval",
  "business_management",
  "pages_manage_metadata",
] as const;

export const META_OAUTH_SCOPE_MATRIX: MetaScopeMatrixRow[] = [
  {
    name: "ads_read",
    currentlyRequestedViaLoginConfig: true,
    allyFeature: "Import campagne, insights, hierarchy read",
    requiredForAdv24LeadsInstantForm: true,
    decision: "retain",
    notes: "Baseline read",
  },
  {
    name: "ads_management",
    currentlyRequestedViaLoginConfig: true,
    allyFeature: "Create PAUSED Campaign/AdSet/Creative/Ad",
    requiredForAdv24LeadsInstantForm: true,
    decision: "retain",
    notes: "Write upgrade Login Config",
  },
  {
    name: "pages_show_list",
    currentlyRequestedViaLoginConfig: true,
    allyFeature: "Page discovery",
    requiredForAdv24LeadsInstantForm: true,
    decision: "retain",
    notes: "Already on QA token",
  },
  {
    name: "pages_read_engagement",
    currentlyRequestedViaLoginConfig: true,
    allyFeature: "Page engagement / identity reads",
    requiredForAdv24LeadsInstantForm: true,
    decision: "retain",
    notes: "Already on QA token",
  },
  {
    name: "pages_manage_ads",
    currentlyRequestedViaLoginConfig: false,
    allyFeature: "GET /{page}/leadgen_forms Instant Form discovery",
    requiredForAdv24LeadsInstantForm: true,
    decision: "add",
    notes: "Graph #200 on Design Soup leadgen_forms",
  },
  {
    name: "public_profile",
    currentlyRequestedViaLoginConfig: true,
    allyFeature: "Basic Meta user identity",
    requiredForAdv24LeadsInstantForm: false,
    decision: "retain",
    notes: "Platform default",
  },
  {
    name: "leads_retrieval",
    currentlyRequestedViaLoginConfig: false,
    allyFeature: "Reading submitted lead payloads / outcome ingestion",
    requiredForAdv24LeadsInstantForm: false,
    decision: "do_not_add",
    notes: "NOT_REQUIRED_FOR_CURRENT_TEST — Form list/reference only",
  },
  {
    name: "business_management",
    currentlyRequestedViaLoginConfig: false,
    allyFeature: "Business Manager asset admin",
    requiredForAdv24LeadsInstantForm: false,
    decision: "do_not_add",
    notes: "Speculative — not needed for ADV.2.4 path",
  },
  {
    name: "pages_manage_metadata",
    currentlyRequestedViaLoginConfig: false,
    allyFeature: "Page settings mutation",
    requiredForAdv24LeadsInstantForm: false,
    decision: "do_not_add",
    notes: "Not needed for Form GET",
  },
];

export function normalizeScopeList(scopes: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of scopes) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function missingRequiredScopes(
  granted: readonly string[],
  required: readonly string[] = META_ALLY_REQUIRED_SCOPES,
): string[] {
  const set = new Set(normalizeScopeList(granted));
  return required.filter((r) => !set.has(r));
}

export function isMetaReauthRequiredForAllyFeatures(
  granted: readonly string[],
): boolean {
  return missingRequiredScopes(granted).length > 0;
}

export function writeUpgradeScopesComplete(scopes: string[]): boolean {
  const set = new Set(normalizeScopeList(scopes));
  return META_WRITE_UPGRADE_REQUIRED_SCOPES.every((s) => set.has(s));
}

export const LEADS_RETRIEVAL_DECISION = {
  decision: "NOT_REQUIRED_FOR_CURRENT_TEST" as const,
  reasonIt:
    "ADV.2.4 seleziona e referenzia Instant Form esistenti; non legge i lead inviati.",
  addToOAuthRequest: false,
};
