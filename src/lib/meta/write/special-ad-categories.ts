/**
 * P0.4 — Special Ad Category (SAC) catalog + canonical selection.
 * Values verified against Meta Marketing API Special Ad Category docs (2025+).
 * CREDIT deprecated 2025-01-14 → FINANCIAL_PRODUCTS_SERVICES.
 * No Graph writes. No silent NONE.
 */

export type AllySpecialAdCategoryCode =
  | "FINANCIAL_PRODUCTS_SERVICES"
  | "EMPLOYMENT"
  | "HOUSING"
  | "ISSUES_ELECTIONS_POLITICS";

/** Deprecated Graph values still seen on imports. */
export type DeprecatedSpecialAdCategoryCode = "CREDIT";

export type KnownSpecialAdCategoryCode =
  | AllySpecialAdCategoryCode
  | DeprecatedSpecialAdCategoryCode
  | "ONLINE_GAMBLING_AND_GAMING"
  | "NONE";

export type SpecialAdCategorySelectionStatus =
  | "UNRESOLVED"
  | "CONFIRMED_NONE"
  | "CONFIRMED_CATEGORY"
  | "NEEDS_META_VERIFICATION";

export type SpecialAdCategorySource =
  | "USER"
  | "ALLY_RULE"
  | "META_IMPORT";

export type SpecialAdCategoryCatalogEntry = {
  graphValue: AllySpecialAdCategoryCode;
  labelIt: string;
  explanationIt: string;
  /** Known Meta targeting consequences (honest, not invented beyond docs). */
  targetingConsequencesIt: string;
  allySupport: "SUPPORTED" | "PARTIAL" | "NEEDS_META_VERIFICATION";
  /** When true, Ally should send special_ad_category_country with geo country. */
  requiresCategoryCountry: boolean;
  easyModeSelectable: boolean;
};

/**
 * Current Easy Mode + publish-supported categories (post-CREDIT deprecation).
 * Source: developers.facebook.com/docs/marketing-api/audiences/special-ad-category
 */
export const ALLY_SPECIAL_AD_CATEGORY_CATALOG: readonly SpecialAdCategoryCatalogEntry[] =
  [
    {
      graphValue: "FINANCIAL_PRODUCTS_SERVICES",
      labelIt: "Credito / prodotti e servizi finanziari",
      explanationIt:
        "Promozione di prodotti o servizi finanziari (inclusi crediti, prestiti, carte). Sostituisce la vecchia categoria CREDIT.",
      targetingConsequencesIt:
        "Meta applica restrizioni di pubblico simili a Casa e Lavoro (opzioni di targeting dettagliato limitate).",
      allySupport: "PARTIAL",
      requiresCategoryCountry: true,
      easyModeSelectable: true,
    },
    {
      graphValue: "EMPLOYMENT",
      labelIt: "Lavoro",
      explanationIt:
        "Annunci relativi a offerte di lavoro, opportunità professionali o reclutamento.",
      targetingConsequencesIt:
        "Meta limita età, genere e targeting dettagliato per ridurre discriminazioni.",
      allySupport: "PARTIAL",
      requiresCategoryCountry: true,
      easyModeSelectable: true,
    },
    {
      graphValue: "HOUSING",
      labelIt: "Casa / alloggi",
      explanationIt:
        "Annunci relativi a immobili, affitti, mutui o opportunità abitative.",
      targetingConsequencesIt:
        "Meta limita età, genere e targeting dettagliato per ridurre discriminazioni.",
      allySupport: "PARTIAL",
      requiresCategoryCountry: true,
      easyModeSelectable: true,
    },
    {
      graphValue: "ISSUES_ELECTIONS_POLITICS",
      labelIt: "Temi sociali, elezioni o politica",
      explanationIt:
        "Annunci su temi sociali, elezioni o politica. In UE queste campagne possono essere vietate o fortemente limitate.",
      targetingConsequencesIt:
        "Regole aggiuntive di trasparenza; in UE (TTPA, da ott 2025) queste campagne non sono ammesse — Ally IT blocca la pubblicazione.",
      allySupport: "NEEDS_META_VERIFICATION",
      requiresCategoryCountry: true,
      easyModeSelectable: true,
    },
  ] as const;

export type SpecialAdCategorySelection = {
  status: SpecialAdCategorySelectionStatus;
  /** Graph enum values to send (empty when CONFIRMED_NONE). */
  categories: string[];
  source: SpecialAdCategorySource;
  confirmedAt: string | null;
  reasonCode: string | null;
  /**
   * Country codes for special_ad_category_country when required.
   * Derived from Ally geo country when available — never invented beyond known countryCode.
   */
  categoryCountryCodes: string[];
  /** Future AI Campaign Architect — always require user confirmation. */
  suggestedCategory: AllySpecialAdCategoryCode | null;
  suggestionReason: string | null;
  suggestionConfidence: number | null;
  requiresUserConfirmation: true;
  needsMetaVerification: string[];
};

export const EMPTY_SAC_SUGGESTION = {
  suggestedCategory: null as AllySpecialAdCategoryCode | null,
  suggestionReason: null as string | null,
  suggestionConfidence: null as number | null,
  requiresUserConfirmation: true as const,
};

const SELECTABLE = new Set(
  ALLY_SPECIAL_AD_CATEGORY_CATALOG.filter((c) => c.easyModeSelectable).map(
    (c) => c.graphValue,
  ),
);

export function isAllySelectableSpecialAdCategory(
  code: string,
): code is AllySpecialAdCategoryCode {
  return SELECTABLE.has(code as AllySpecialAdCategoryCode);
}

export function catalogEntryFor(
  code: string,
): SpecialAdCategoryCatalogEntry | null {
  return (
    ALLY_SPECIAL_AD_CATEGORY_CATALOG.find((c) => c.graphValue === code) ?? null
  );
}

export function etichettaSpecialAdCategoryEasy(code: string): string {
  if (code === "NONE" || code === "") return "Nessuna categoria speciale";
  if (code === "CREDIT") {
    return "Credito (deprecato — usa prodotti finanziari)";
  }
  const entry = catalogEntryFor(code);
  return entry?.labelIt ?? `Categoria non riconosciuta (${code})`;
}

/**
 * Normalize write decision → canonical SAC selection.
 * NONE kind = explicit user/import confirmation of empty array.
 */
export function selectionFromWriteDecision(input: {
  decision:
    | { kind: "NONE" }
    | { kind: "CATEGORIES"; categories: string[] }
    | { kind: "UNRESOLVED" };
  source?: SpecialAdCategorySource;
  countryCode?: string | null;
  confirmedAt?: string | null;
}): SpecialAdCategorySelection {
  const source = input.source ?? "USER";
  const country = (input.countryCode ?? "").trim().toUpperCase();
  const baseCountry = country.length === 2 ? [country] : [];

  if (input.decision.kind === "UNRESOLVED") {
    return {
      status: "UNRESOLVED",
      categories: [],
      source,
      confirmedAt: null,
      reasonCode: "SAC_UNRESOLVED",
      categoryCountryCodes: [],
      ...EMPTY_SAC_SUGGESTION,
      needsMetaVerification: [],
    };
  }

  if (input.decision.kind === "NONE") {
    return {
      status: "CONFIRMED_NONE",
      categories: [],
      source,
      confirmedAt: input.confirmedAt ?? null,
      reasonCode: "SAC_CONFIRMED_NONE",
      categoryCountryCodes: [],
      ...EMPTY_SAC_SUGGESTION,
      needsMetaVerification: [],
    };
  }

  const needsMetaVerification: string[] = [];
  const normalized: string[] = [];
  for (const raw of input.decision.categories) {
    const code = String(raw).trim().toUpperCase();
    if (!code) continue;
    if (code === "CREDIT") {
      // Deprecated — map forward for publish readiness, flag verification.
      normalized.push("FINANCIAL_PRODUCTS_SERVICES");
      needsMetaVerification.push(
        "CREDIT_DEPRECATED: mapped to FINANCIAL_PRODUCTS_SERVICES (Meta deprecated CREDIT 2025-01-14).",
      );
      continue;
    }
    if (code === "ONLINE_GAMBLING_AND_GAMING") {
      needsMetaVerification.push(
        "ONLINE_GAMBLING_AND_GAMING: present in some Graph enums but not offered in Ally Easy Mode.",
      );
      normalized.push(code);
      continue;
    }
    if (!isAllySelectableSpecialAdCategory(code) && code !== "NONE") {
      needsMetaVerification.push(
        `UNKNOWN_SAC:${code} — not in Ally verified Easy Mode catalog.`,
      );
      normalized.push(code);
      continue;
    }
    if (code !== "NONE") normalized.push(code);
  }

  const unique = [...new Set(normalized)];
  const hasUnknown = unique.some(
    (c) =>
      !isAllySelectableSpecialAdCategory(c) &&
      c !== "FINANCIAL_PRODUCTS_SERVICES",
  );
  // FINANCIAL is selectable; unknown others → NEEDS_META_VERIFICATION status
  const unknownOnly = unique.filter(
    (c) => !isAllySelectableSpecialAdCategory(c),
  );

  // Meta requires special_ad_category_country whenever any category is selected.
  const requiresCountry = unique.length > 0;

  if (
    unique.includes("ISSUES_ELECTIONS_POLITICS") &&
    (country === "IT" || country === "" || baseCountry.includes("IT"))
  ) {
    needsMetaVerification.push(
      "ISSUES_ELECTIONS_POLITICS_EU: social/political ads may be disallowed in the EU (TTPA) — verify before live publish.",
    );
  }

  let status: SpecialAdCategorySelectionStatus = "CONFIRMED_CATEGORY";
  if (unique.length === 0) {
    status = "CONFIRMED_NONE";
  } else if (unknownOnly.length > 0) {
    status = "NEEDS_META_VERIFICATION";
  } else if (
    unique.includes("ISSUES_ELECTIONS_POLITICS") &&
    catalogEntryFor("ISSUES_ELECTIONS_POLITICS")?.allySupport ===
      "NEEDS_META_VERIFICATION"
  ) {
    // Still selectable but flagged — publish blocked until verified policy for Ally IT.
    status = "NEEDS_META_VERIFICATION";
  }

  return {
    status,
    categories: unique,
    source,
    confirmedAt: input.confirmedAt ?? null,
    reasonCode:
      status === "CONFIRMED_NONE" ? "SAC_CONFIRMED_NONE" : "SAC_CONFIRMED_CATEGORY",
    categoryCountryCodes: requiresCountry ? baseCountry : [],
    ...EMPTY_SAC_SUGGESTION,
    needsMetaVerification,
  };
}

/** Import Meta special_ad_categories array → selection (never UNRESOLVED if Meta returned a value). */
export function selectionFromMetaImport(
  raw: unknown,
  countryCode?: string | null,
): SpecialAdCategorySelection {
  if (!Array.isArray(raw)) {
    return {
      status: "NEEDS_META_VERIFICATION",
      categories: [],
      source: "META_IMPORT",
      confirmedAt: null,
      reasonCode: "SAC_IMPORT_AMBIGUOUS",
      categoryCountryCodes: [],
      ...EMPTY_SAC_SUGGESTION,
      needsMetaVerification: [
        "IMPORT_SAC_NON_ARRAY: Graph special_ad_categories missing or not an array.",
      ],
    };
  }
  const cats = raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => x !== "NONE");

  if (cats.length === 0) {
    return selectionFromWriteDecision({
      decision: { kind: "NONE" },
      source: "META_IMPORT",
      countryCode,
    });
  }
  return selectionFromWriteDecision({
    decision: { kind: "CATEGORIES", categories: cats },
    source: "META_IMPORT",
    countryCode,
  });
}

/** Graph payload array: [] for NONE, otherwise category codes (never include NONE string). */
export function specialAdCategoriesGraphValue(
  selection: SpecialAdCategorySelection,
): string[] | null {
  if (selection.status === "UNRESOLVED") return null;
  if (selection.status === "CONFIRMED_NONE") return [];
  if (selection.categories.length === 0) return [];
  // Do not send deprecated CREDIT
  return selection.categories.filter((c) => c !== "CREDIT");
}

export function writeDecisionFromSelection(
  selection: SpecialAdCategorySelection,
):
  | { kind: "NONE" }
  | { kind: "CATEGORIES"; categories: string[] }
  | { kind: "UNRESOLVED" } {
  if (selection.status === "UNRESOLVED") return { kind: "UNRESOLVED" };
  if (selection.status === "CONFIRMED_NONE") return { kind: "NONE" };
  if (selection.status === "NEEDS_META_VERIFICATION") {
    if (selection.categories.length === 0) return { kind: "UNRESOLVED" };
    return {
      kind: "CATEGORIES",
      categories: selection.categories.filter((c) => c !== "CREDIT"),
    };
  }
  if (selection.categories.length === 0) return { kind: "NONE" };
  return {
    kind: "CATEGORIES",
    categories: selection.categories.filter((c) => c !== "CREDIT"),
  };
}

/**
 * Publish blockers for SAC (beyond UNRESOLVED handled elsewhere).
 */
export function evaluateSpecialAdCategoryPublishGates(input: {
  selection: SpecialAdCategorySelection;
  allyAudienceMode?: string | null;
  etaMin?: number | null;
  etaMax?: number | null;
}): {
  blockers: Array<{ code: string; messageIt: string }>;
  warnings: Array<{ code: string; messageIt: string }>;
} {
  const blockers: Array<{ code: string; messageIt: string }> = [];
  const warnings: Array<{ code: string; messageIt: string }> = [];

  if (input.selection.status === "UNRESOLVED") {
    blockers.push({
      code: "SPECIAL_AD_CATEGORY_REQUIRED",
      messageIt:
        "Prima di pubblicare devi confermare se questa campagna rientra in una categoria speciale.",
    });
    return { blockers, warnings };
  }

  if (input.selection.status === "NEEDS_META_VERIFICATION") {
    blockers.push({
      code: "SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION",
      messageIt:
        "La categoria speciale selezionata richiede verifica Meta aggiuntiva prima della pubblicazione Ally.",
    });
  }

  // Meta: when any special_ad_categories are selected, special_ad_category_country is required.
  if (
    input.selection.categories.length > 0 &&
    input.selection.categoryCountryCodes.length === 0
  ) {
    blockers.push({
      code: "SPECIAL_AD_CATEGORY_COUNTRY_REQUIRED",
      messageIt:
        "Per questa categoria speciale Meta richiede il paese della categoria: indica una zona/paese della campagna.",
    });
  }

  const restrictedAudienceCats = input.selection.categories.filter(
    (c) =>
      c === "HOUSING" ||
      c === "EMPLOYMENT" ||
      c === "FINANCIAL_PRODUCTS_SERVICES",
  );

  if (input.selection.categories.length > 0) {
    warnings.push({
      code: "SAC_AUDIENCE_RESTRICTIONS",
      messageIt:
        "Questa categoria modifica alcune opzioni di pubblico disponibili su Meta. Ally non rimuove in silenzio i tuoi vincoli di targeting.",
    });
  }

  // Ally does not yet rewrite targeting for SAC — honest PARTIAL support.
  if (restrictedAudienceCats.length > 0) {
    warnings.push({
      code: "SAC_TARGETING_PARTIAL",
      messageIt:
        "Ally applica Advantage+ Audience / età come nel percorso standard. Le restrizioni complete Meta per categorie speciali restano parziali in questo slice.",
    });

    if (input.allyAudienceMode === "MANUAL_AUDIENCE") {
      warnings.push({
        code: "SAC_MANUAL_TARGETING_PARTIAL",
        messageIt:
          "Con pubblico manuale e categoria speciale, Meta può rifiutare o limitare età/genere/interessi. Ally non riscrive il targeting in silenzio.",
      });
      const min = input.etaMin;
      const max = input.etaMax;
      if (
        (typeof min === "number" && min < 18) ||
        (typeof max === "number" && max < 18)
      ) {
        blockers.push({
          code: "SPECIAL_AD_CATEGORY_NEEDS_VERIFICATION",
          messageIt:
            "Fascia di età incompatibile con le restrizioni Meta per questa categoria speciale (minimo tipico 18 anni).",
        });
      }
    }
  }

  return { blockers, warnings };
}

/** Easy Mode picker value ↔ write decision (single category or NONE). */
export function decisionFromEasyModePickerValue(
  value: string,
):
  | { kind: "NONE" }
  | { kind: "CATEGORIES"; categories: string[] }
  | { kind: "UNRESOLVED" } {
  const v = (value ?? "").trim().toUpperCase();
  if (!v || v === "UNRESOLVED") return { kind: "UNRESOLVED" };
  if (v === "NONE") return { kind: "NONE" };
  if (isAllySelectableSpecialAdCategory(v)) {
    return { kind: "CATEGORIES", categories: [v] };
  }
  // Unknown value — do not invent NONE; keep unresolved / verification path.
  return { kind: "CATEGORIES", categories: [v] };
}

export type MetaWriteSacDecision =
  | { kind: "NONE" }
  | { kind: "CATEGORIES"; categories: string[] }
  | { kind: "UNRESOLVED" };

/**
 * Explicit user/import SAC decisions that may be written.
 * UNRESOLVED means "not provided" and must never overwrite NONE/CATEGORIES.
 */
export function isExplicitSpecialAdCategoriesDecision(
  d: MetaWriteSacDecision | null | undefined,
): d is { kind: "NONE" } | { kind: "CATEGORIES"; categories: string[] } {
  return d?.kind === "NONE" || d?.kind === "CATEGORIES";
}

/**
 * Merge incoming SAC with persisted canonical plan.
 * Same semantic as budget null-omit: UNRESOLVED = absence, not a wipe.
 */
export function mergeSpecialAdCategoriesDecision(input: {
  hydrate: boolean;
  incoming?: MetaWriteSacDecision | null;
  persisted?: MetaWriteSacDecision | null;
}): MetaWriteSacDecision {
  const incomingExplicit = isExplicitSpecialAdCategoriesDecision(input.incoming)
    ? input.incoming
    : null;
  const persistedExplicit = isExplicitSpecialAdCategoriesDecision(
    input.persisted,
  )
    ? input.persisted
    : null;

  if (input.hydrate) {
    // Prefer durable persisted confirmation; never invent NONE.
    return persistedExplicit ?? incomingExplicit ?? { kind: "UNRESOLVED" };
  }
  // Non-hydrate write-preview: explicit client decision wins; UNRESOLVED keeps persisted.
  return incomingExplicit ?? persistedExplicit ?? { kind: "UNRESOLVED" };
}

export function easyModePickerValueFromDecision(
  decision:
    | { kind: "NONE" }
    | { kind: "CATEGORIES"; categories: string[] }
    | { kind: "UNRESOLVED" },
): string {
  if (decision.kind === "NONE") return "NONE";
  if (decision.kind === "UNRESOLVED") return "UNRESOLVED";
  if (decision.categories.length === 0) return "NONE";
  return decision.categories[0]!;
}

/** Write decision from Meta import array (never UNRESOLVED when Meta returned a value). */
export function writeDecisionFromMetaImport(
  raw: unknown,
  countryCode?: string | null,
):
  | { kind: "NONE" }
  | { kind: "CATEGORIES"; categories: string[] }
  | { kind: "UNRESOLVED" } {
  return writeDecisionFromSelection(selectionFromMetaImport(raw, countryCode));
}
