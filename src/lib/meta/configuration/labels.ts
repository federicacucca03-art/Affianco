/**
 * M10D — Italian labels for Meta configuration enums.
 * Unknown values → safe fallback; raw kept only as secondary detail.
 */

export function etichettaOptimizationGoal(raw: string | null): string {
  if (!raw) return "Non disponibile";
  const key = raw.toUpperCase();
  const map: Record<string, string> = {
    LEAD_GENERATION: "Generazione contatti",
    OFFSITE_CONVERSIONS: "Conversioni sul sito",
    LINK_CLICKS: "Click sul link",
    LANDING_PAGE_VIEWS: "Visualizzazioni della pagina di destinazione",
    IMPRESSIONS: "Impression",
    REACH: "Copertura",
    POST_ENGAGEMENT: "Interazioni con i post",
    PAGE_LIKES: "Mi piace sulla Pagina",
    EVENT_RESPONSES: "Risposte all'evento",
    APP_INSTALLS: "Installazioni app",
    VALUE: "Valore",
    THRUPLAY: "ThruPlay",
    QUALITY_LEAD: "Lead di qualità",
    CONVERSATIONS: "Conversazioni",
  };
  return map[key] ?? `Strategia non riconosciuta (${raw})`;
}

export function etichettaBillingEvent(raw: string | null): string {
  if (!raw) return "Non disponibile";
  const key = raw.toUpperCase();
  const map: Record<string, string> = {
    IMPRESSIONS: "Impression",
    LINK_CLICKS: "Click sul link",
    POST_ENGAGEMENT: "Interazioni",
    PAGE_LIKES: "Mi piace",
    THRUPLAY: "ThruPlay",
    APP_INSTALLS: "Installazioni app",
  };
  return map[key] ?? `Evento non riconosciuto (${raw})`;
}

export function etichettaBidStrategy(raw: string | null): string {
  if (!raw) return "Non disponibile";
  const key = raw.toUpperCase();
  const map: Record<string, string> = {
    LOWEST_COST_WITHOUT_CAP: "Costo più basso",
    LOWEST_COST_WITH_BID_CAP: "Bid cap",
    COST_CAP: "Cost cap",
    LOWEST_COST_WITH_MIN_ROAS: "ROAS minimo",
  };
  return map[key] ?? `Strategia non riconosciuta (${raw})`;
}

export function etichettaBuyingType(raw: string | null): string {
  if (!raw) return "Non disponibile";
  const key = raw.toUpperCase();
  if (key === "AUCTION") return "Asta";
  if (key === "RESERVED") return "Prenotata";
  return `Tipo non riconosciuto (${raw})`;
}

export function etichettaDestinationType(raw: string | null): string {
  if (!raw) return "Non disponibile";
  const key = raw.toUpperCase();
  const map: Record<string, string> = {
    WEBSITE: "Sito web",
    APP: "App",
    MESSENGER: "Messenger",
    INSTAGRAM_DIRECT: "Instagram Direct",
    WHATSAPP: "WhatsApp",
    PHONE_CALL: "Chiamata",
    ON_AD: "Sull'inserzione",
    ON_PAGE: "Sulla Pagina",
    ON_EVENT: "Sull'evento",
    ON_VIDEO: "Sul video",
    ON_POST: "Sul post",
  };
  return map[key] ?? `Destinazione non riconosciuta (${raw})`;
}

export function etichettaBudgetKind(
  kind: "DAILY" | "LIFETIME" | "NONE" | "UNKNOWN",
): string {
  switch (kind) {
    case "DAILY":
      return "Budget giornaliero";
    case "LIFETIME":
      return "Budget lifetime";
    case "NONE":
      return "Nessun budget a questo livello";
    default:
      return "Budget non disponibile";
  }
}

export function etichettaBudgetLevel(
  level: "CAMPAIGN" | "AD_SET" | "UNKNOWN",
): string {
  switch (level) {
    case "CAMPAIGN":
      return "A livello campagna";
    case "AD_SET":
      return "A livello gruppo di inserzioni";
    default:
      return "Livello budget non determinato";
  }
}

export function etichettaPlacementMode(
  mode: "AUTOMATIC" | "MANUAL" | "UNKNOWN" | "UNAVAILABLE",
): string {
  switch (mode) {
    case "AUTOMATIC":
      return "Automatica Meta";
    case "MANUAL":
      return "Manuale";
    case "UNAVAILABLE":
      return "Configurazione posizionamenti non disponibile";
    default:
      return "Posizionamenti non determinabili";
  }
}

/** Meta budgets are minor units (cents for EUR). */
export function metaBudgetMinorToMajor(minor: number | null): number | null {
  if (minor == null || !Number.isFinite(minor) || minor <= 0) return null;
  return Math.round(minor) / 100;
}

/** Amount only — no daily/lifetime suffix. */
export function formatMetaBudgetAmountIt(minor: number | null): string {
  const major = metaBudgetMinorToMajor(minor);
  if (major == null) return "Non disponibile";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(major);
}

export function formatMetaBudgetIt(
  minor: number | null,
  kind: "DAILY" | "LIFETIME" | "NONE" | "UNKNOWN",
): string {
  const money = formatMetaBudgetAmountIt(minor);
  if (money === "Non disponibile") {
    if (kind === "NONE") return "Nessun budget a questo livello";
    return "Non disponibile";
  }
  if (kind === "DAILY") return `${money} / giorno`;
  // Lifetime / total: natural Italian amount without awkward "lifetime" suffix.
  return money;
}

/**
 * Meta `is_adset_budget_sharing_enabled` = Ad Set Budget Sharing (ABO partial share),
 * NOT Advantage Campaign Budget / CBO. Use this label only for that field.
 */
export function etichettaAdsetBudgetSharing(value: boolean | null): string {
  if (value == null) return "Non disponibile";
  return value ? "Attiva" : "Non attiva";
}

/**
 * Empty array from Meta → Nessuna. Missing/null → Non disponibile.
 * Do not conflate NONE with UNKNOWN.
 */
export function etichettaSpecialAdCategories(
  raw: unknown,
  value: string[] | null,
): string {
  if (Array.isArray(raw) && raw.length === 0) return "Nessuna";
  if (value && value.length > 0) return value.join(", ");
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((x) => (typeof x === "string" ? x : null))
      .filter((x): x is string => Boolean(x))
      .join(", ");
  }
  return "Non disponibile";
}

/** Human-readable IT datetime in Europe/Rome — does not mutate stored ISO. */
export function formatMetaConfigDateTimeIt(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

/**
 * attribution_spec → professional Italian.
 * Only click-through windows we actually have — never invent view-through.
 */
export function formatAttributionSpecIt(spec: unknown): {
  primary: string;
  technical: string | null;
} {
  if (!Array.isArray(spec) || spec.length === 0) {
    return { primary: "Non disponibile", technical: null };
  }
  const click = spec.find((row) => {
    if (!row || typeof row !== "object") return false;
    const event = String(
      (row as { event_type?: unknown }).event_type ?? "",
    ).toUpperCase();
    return event === "CLICK_THROUGH";
  }) as { event_type?: string; window_days?: unknown } | undefined;

  if (click) {
    const daysRaw = click.window_days;
    const days =
      typeof daysRaw === "number"
        ? daysRaw
        : typeof daysRaw === "string"
          ? Number(daysRaw)
          : NaN;
    if (Number.isFinite(days) && days > 0) {
      const primary =
        days === 1 ? "1 giorno dal clic" : `${days} giorni dal clic`;
      return {
        primary,
        technical: `CLICK_THROUGH · ${days} day${days === 1 ? "" : "s"}`,
      };
    }
    return {
      primary: "Attribuzione al clic",
      technical: "CLICK_THROUGH",
    };
  }

  return {
    primary: "Configurata su Meta",
    technical: null,
  };
}
