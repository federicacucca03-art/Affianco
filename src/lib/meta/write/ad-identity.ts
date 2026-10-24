/**
 * P0.5 — Facebook Page + Instagram identity (canonical).
 * Deterministic. No Graph writes. Never fabricate IG accounts.
 */

export type InstagramIdentityStatus =
  | "NONE_AVAILABLE"
  | "AVAILABLE"
  | "SELECTED"
  | "PAGE_ONLY"
  | "NEEDS_VERIFICATION"
  | "PERMISSION_REQUIRED"
  | "UNRESOLVED";

export type AdIdentitySource = "USER" | "ALLY_RULE" | "META_IMPORT";

export type AdIdentityConfig = {
  facebookPageId: string | null;
  facebookPageName: string | null;
  instagramIdentityStatus: InstagramIdentityStatus;
  /** Meta instagram_user_id for object_story_spec (not deprecated actor_id). */
  instagramUserId: string | null;
  instagramUsername: string | null;
  /** Eligible identities discovered for the selected Page (sanitized for UI). */
  eligibleIdentities: Array<{
    id: string;
    maskedId: string;
    username: string | null;
    available: boolean;
  }>;
  /** True when Ally recommended the single available identity (still editable). */
  recommendedAutomatically: boolean;
  source: AdIdentitySource;
  completeness: "FULL" | "PARTIAL" | "NONE";
  warningsIt: string[];
  valid: boolean;
  blockReasonCode: string | null;
  blockReasonIt: string | null;
};

export function emptyAdIdentity(
  source: AdIdentitySource = "ALLY_RULE",
): AdIdentityConfig {
  return {
    facebookPageId: null,
    facebookPageName: null,
    instagramIdentityStatus: "UNRESOLVED",
    instagramUserId: null,
    instagramUsername: null,
    eligibleIdentities: [],
    recommendedAutomatically: false,
    source,
    completeness: "NONE",
    warningsIt: [],
    valid: true,
    blockReasonCode: null,
    blockReasonIt: null,
  };
}

export type DiscoveredInstagramIdentity = {
  id: string;
  username: string | null;
  maskedId: string;
  available: boolean;
  pageId: string;
};

/**
 * Build / validate AdIdentityConfig from Page + discovery + user selection.
 */
export function resolveAdIdentity(input: {
  facebookPageId: string | null | undefined;
  facebookPageName?: string | null;
  /** User/persisted selection (instagram_user_id). */
  selectedInstagramUserId?: string | null;
  /** Explicit PAGE_ONLY choice. */
  preferPageOnly?: boolean;
  discovered?: DiscoveredInstagramIdentity[] | null;
  discoveryEmptyReason?:
    | "NONE"
    | "NO_ACCOUNTS"
    | "PERMISSION"
    | "PAGE_INVALID"
    | "UNCHECKED"
    | null;
  source?: AdIdentitySource;
}): AdIdentityConfig {
  const source = input.source ?? "USER";
  const pageId = (input.facebookPageId ?? "").trim() || null;
  const pageName = (input.facebookPageName ?? "").trim() || null;
  const selected = (input.selectedInstagramUserId ?? "").trim() || null;
  const discovered = (input.discovered ?? []).filter((d) => d.available !== false);
  const eligible = discovered.map((d) => ({
    id: d.id,
    maskedId: d.maskedId,
    username: d.username,
    available: d.available !== false,
  }));

  if (!pageId) {
    return {
      ...emptyAdIdentity(source),
      facebookPageName: pageName,
      instagramIdentityStatus: "UNRESOLVED",
      valid: false,
      blockReasonCode: "MISSING_PAGE",
      blockReasonIt: "Indica la Pagina Facebook.",
      completeness: "NONE",
    };
  }

  if (input.discoveryEmptyReason === "PERMISSION") {
    return {
      facebookPageId: pageId,
      facebookPageName: pageName,
      instagramIdentityStatus: "PERMISSION_REQUIRED",
      instagramUserId: null,
      instagramUsername: null,
      eligibleIdentities: [],
      recommendedAutomatically: false,
      source,
      completeness: "NONE",
      warningsIt: [
        "Instagram non disponibile. La campagna può essere pubblicata usando solo la Pagina Facebook.",
      ],
      valid: true, // Page-only still allowed
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }

  if (input.preferPageOnly === true) {
    return {
      facebookPageId: pageId,
      facebookPageName: pageName,
      instagramIdentityStatus: "PAGE_ONLY",
      instagramUserId: null,
      instagramUsername: null,
      eligibleIdentities: eligible,
      recommendedAutomatically: false,
      source,
      completeness: "PARTIAL",
      warningsIt:
        eligible.length > 0
          ? [
              "Hai scelto solo Facebook. I posizionamenti Instagram potrebbero usare l’identità Pagina se Meta lo consente.",
            ]
          : [],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }

  if (selected) {
    const hit = eligible.find((e) => e.id === selected);
    if (eligible.length > 0 && !hit) {
      return {
        facebookPageId: pageId,
        facebookPageName: pageName,
        instagramIdentityStatus: "NEEDS_VERIFICATION",
        instagramUserId: selected,
        instagramUsername: null,
        eligibleIdentities: eligible,
        recommendedAutomatically: false,
        source,
        completeness: "PARTIAL",
        warningsIt: [],
        valid: false,
        blockReasonCode: "IG_PAGE_MISMATCH",
        blockReasonIt:
          "L’account Instagram selezionato non appartiene alla Pagina Facebook scelta.",
      };
    }
    return {
      facebookPageId: pageId,
      facebookPageName: pageName,
      instagramIdentityStatus: "SELECTED",
      instagramUserId: selected,
      instagramUsername: hit?.username ?? null,
      eligibleIdentities: eligible,
      recommendedAutomatically: false,
      source,
      completeness: hit?.username ? "FULL" : "PARTIAL",
      warningsIt: [],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }

  // No selection yet
  if (input.discoveryEmptyReason === "UNCHECKED" || input.discovered == null) {
    return {
      facebookPageId: pageId,
      facebookPageName: pageName,
      instagramIdentityStatus: "UNRESOLVED",
      instagramUserId: null,
      instagramUsername: null,
      eligibleIdentities: eligible,
      recommendedAutomatically: false,
      source,
      completeness: "PARTIAL",
      warningsIt: [],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }

  if (eligible.length === 0) {
    return {
      facebookPageId: pageId,
      facebookPageName: pageName,
      instagramIdentityStatus: "NONE_AVAILABLE",
      instagramUserId: null,
      instagramUsername: null,
      eligibleIdentities: [],
      recommendedAutomatically: false,
      source,
      completeness: "PARTIAL",
      warningsIt: [
        "Nessun account Instagram collegato a questa Pagina. Ally pubblicherà con identità Facebook dove Meta lo consente.",
      ],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }

  if (eligible.length === 1) {
    const only = eligible[0]!;
    return {
      facebookPageId: pageId,
      facebookPageName: pageName,
      instagramIdentityStatus: "SELECTED",
      instagramUserId: only.id,
      instagramUsername: only.username,
      eligibleIdentities: eligible,
      recommendedAutomatically: true,
      source: source === "META_IMPORT" ? source : "ALLY_RULE",
      completeness: only.username ? "FULL" : "PARTIAL",
      warningsIt: [
        "Ally propone l’unico account Instagram collegato alla Pagina. Puoi cambiarlo.",
      ],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }

  // Multiple — no silent selection
  return {
    facebookPageId: pageId,
    facebookPageName: pageName,
    instagramIdentityStatus: "AVAILABLE",
    instagramUserId: null,
    instagramUsername: null,
    eligibleIdentities: eligible,
    recommendedAutomatically: false,
    source,
    completeness: "PARTIAL",
    warningsIt: [
      "Ci sono più account Instagram collegati. Selezionane uno oppure usa solo Facebook.",
    ],
    valid: false,
    blockReasonCode: "MISSING_INSTAGRAM_SELECTION",
    blockReasonIt:
      "Seleziona l’account Instagram da usare, oppure conferma solo Facebook.",
  };
}

/** Import Instagram identity from Meta creative (never invent username from id). */
export function adIdentityFromMetaImport(input: {
  pageId?: string | null;
  pageName?: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
}): AdIdentityConfig {
  const pageId = (input.pageId ?? "").trim() || null;
  const igId = (input.instagramUserId ?? "").trim() || null;
  const igUser = (input.instagramUsername ?? "").trim() || null;
  if (!pageId && !igId) {
    return { ...emptyAdIdentity("META_IMPORT"), completeness: "NONE" };
  }
  if (igId) {
    return {
      facebookPageId: pageId,
      facebookPageName: (input.pageName ?? "").trim() || null,
      instagramIdentityStatus: "SELECTED",
      instagramUserId: igId,
      instagramUsername: igUser, // only if provided — never invent
      eligibleIdentities: igId
        ? [
            {
              id: igId,
              maskedId: igId.length > 6 ? `…${igId.slice(-4)}` : igId,
              username: igUser,
              available: true,
            },
          ]
        : [],
      recommendedAutomatically: false,
      source: "META_IMPORT",
      completeness: igUser ? "FULL" : "PARTIAL",
      warningsIt: [],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
    };
  }
  return {
    facebookPageId: pageId,
    facebookPageName: (input.pageName ?? "").trim() || null,
    instagramIdentityStatus: "PAGE_ONLY",
    instagramUserId: null,
    instagramUsername: null,
    eligibleIdentities: [],
    recommendedAutomatically: false,
    source: "META_IMPORT",
    completeness: "PARTIAL",
    warningsIt: [],
    valid: true,
    blockReasonCode: null,
    blockReasonIt: null,
  };
}

export function parseAdIdentityConfig(raw: unknown): AdIdentityConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.instagramIdentityStatus;
  const allowed: InstagramIdentityStatus[] = [
    "NONE_AVAILABLE",
    "AVAILABLE",
    "SELECTED",
    "PAGE_ONLY",
    "NEEDS_VERIFICATION",
    "PERMISSION_REQUIRED",
    "UNRESOLVED",
  ];
  if (typeof status !== "string" || !allowed.includes(status as InstagramIdentityStatus)) {
    return null;
  }
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  return {
    facebookPageId: str(o.facebookPageId),
    facebookPageName: str(o.facebookPageName),
    instagramIdentityStatus: status as InstagramIdentityStatus,
    instagramUserId: str(o.instagramUserId),
    instagramUsername: str(o.instagramUsername),
    eligibleIdentities: Array.isArray(o.eligibleIdentities)
      ? o.eligibleIdentities
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((x) => ({
            id: String(x.id ?? ""),
            maskedId: String(x.maskedId ?? ""),
            username: str(x.username),
            available: x.available !== false,
          }))
          .filter((x) => x.id)
      : [],
    recommendedAutomatically: o.recommendedAutomatically === true,
    source:
      o.source === "USER" || o.source === "META_IMPORT" || o.source === "ALLY_RULE"
        ? o.source
        : "USER",
    completeness:
      o.completeness === "FULL" ||
      o.completeness === "PARTIAL" ||
      o.completeness === "NONE"
        ? o.completeness
        : "NONE",
    warningsIt: Array.isArray(o.warningsIt)
      ? o.warningsIt.filter((x): x is string => typeof x === "string")
      : [],
    valid: o.valid !== false,
    blockReasonCode: str(o.blockReasonCode),
    blockReasonIt: str(o.blockReasonIt),
  };
}

export function etichettaInstagramIdentity(cfg: AdIdentityConfig): string {
  if (cfg.instagramUsername) return `@${cfg.instagramUsername.replace(/^@/, "")}`;
  if (cfg.instagramIdentityStatus === "PAGE_ONLY") return "Solo Facebook";
  if (cfg.instagramIdentityStatus === "NONE_AVAILABLE") return "Non collegata";
  if (cfg.instagramIdentityStatus === "PERMISSION_REQUIRED")
    return "Permesso richiesto";
  if (cfg.instagramIdentityStatus === "AVAILABLE") return "Da selezionare";
  if (cfg.instagramIdentityStatus === "SELECTED" && cfg.instagramUserId)
    return "Account selezionato";
  if (cfg.instagramIdentityStatus === "NEEDS_VERIFICATION")
    return "Da verificare";
  return "Non collegata";
}
