/**
 * P0.5 — Destination URL / UTM tracking (canonical).
 * Deterministic. No Graph writes. Never silent overwrite of user UTMs.
 */

export type DestinationTrackingMode = "NONE" | "AUTO_UTM" | "CUSTOM";

export type DestinationTrackingSource = "USER" | "ALLY_RULE" | "META_IMPORT";

export type DestinationTrackingConfig = {
  mode: DestinationTrackingMode;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** Extra non-UTM query keys (preserved on import / custom). */
  customParameters: Record<string, string>;
  /** Base URL before Ally merges tags (may already include query). */
  baseDestinationUrl: string | null;
  /** Final link URL for creative link / CTA. */
  finalDestinationUrl: string | null;
  /**
   * Meta AdCreative url_tags — query string without leading `?`
   * (parameters Meta appends). Null when unused.
   */
  metaUrlTags: string | null;
  source: DestinationTrackingSource;
  /** Keys Ally wanted to set but left untouched (user already had them). */
  preservedUserKeys: string[];
  warningsIt: string[];
  valid: boolean;
  blockReasonCode: string | null;
  blockReasonIt: string | null;
  completeness: "FULL" | "PARTIAL" | "NONE";
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export function slugForUtm(raw: string | null | undefined, fallback: string): string {
  const s = (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return s || fallback;
}

function parseUrlLoose(
  raw: string,
):
  | { ok: true; url: URL; hash: string }
  | { ok: false; reason: "MALFORMED" } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "MALFORMED" };
  try {
    // Require absolute http(s)
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "MALFORMED" };
    }
    const hash = u.hash;
    return { ok: true, url: u, hash };
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
}

function paramsToObject(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    // First occurrence wins for duplicates (do not invent merge).
    if (!(k in out)) out[k] = v;
  }
  return out;
}

function objectToSearchParams(obj: Record<string, string>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v == null || v === "") continue;
    sp.set(key, v);
  }
  return sp;
}

/** Build Meta url_tags string (no leading ?). */
export function buildMetaUrlTags(params: Record<string, string>): string | null {
  const sp = objectToSearchParams(params);
  const s = sp.toString();
  return s.length > 0 ? s : null;
}

export function emptyDestinationTracking(
  source: DestinationTrackingSource = "ALLY_RULE",
): DestinationTrackingConfig {
  return {
    mode: "NONE",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    customParameters: {},
    baseDestinationUrl: null,
    finalDestinationUrl: null,
    metaUrlTags: null,
    source,
    preservedUserKeys: [],
    warningsIt: [],
    valid: true,
    blockReasonCode: null,
    blockReasonIt: null,
    completeness: "NONE",
  };
}

/**
 * Plan-level destination URL for write-preview / publish.
 * META_LEAD_FORM must never inherit clients.website — Form + Page are the destination.
 * WEBSITE (and other non-IF) keep the previous clients.website wiring.
 */
export function resolvePlanDestinationUrl(input: {
  destination: string | null | undefined;
  clientWebsite: string | null | undefined;
}): string | null {
  const dest = (input.destination ?? "").trim();
  if (dest === "META_LEAD_FORM") return null;
  return (input.clientWebsite ?? "").trim() || null;
}

/**
 * Resolve destination tracking for preview / publish.
 * Instant Form / non-website: mode forced NONE (no fake UTM requirement).
 * Non-website destinations never surface clients.website as creative link URL.
 */
export function resolveDestinationTracking(input: {
  destination: string | null | undefined;
  destinationUrl: string | null | undefined;
  mode?: DestinationTrackingMode | null;
  /** Explicit overrides (CUSTOM) or AUTO seed. */
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  customParameters?: Record<string, string> | null;
  campaignName?: string | null;
  creativeLabel?: string | null;
  source?: DestinationTrackingSource;
}): DestinationTrackingConfig {
  const source = input.source ?? "ALLY_RULE";
  const dest = (input.destination ?? "").trim();
  const isWebsite = dest === "WEBSITE";

  if (!isWebsite) {
    const base = emptyDestinationTracking(source);
    // Defense in depth: never pass a site URL into Instant Form / non-website tracking.
    base.baseDestinationUrl = null;
    base.finalDestinationUrl = null;
    base.mode = "NONE";
    base.completeness = "NONE";
    return base;
  }

  const rawUrl = (input.destinationUrl ?? "").trim();
  if (!rawUrl) {
    return {
      ...emptyDestinationTracking(source),
      mode: input.mode === "CUSTOM" ? "CUSTOM" : input.mode === "NONE" ? "NONE" : "AUTO_UTM",
      valid: false,
      blockReasonCode: "MISSING_DESTINATION_URL",
      blockReasonIt: "Indica l’URL di destinazione del sito.",
      completeness: "NONE",
    };
  }

  const parsed = parseUrlLoose(rawUrl);
  if (!parsed.ok) {
    return {
      ...emptyDestinationTracking(source),
      mode: input.mode ?? "AUTO_UTM",
      baseDestinationUrl: rawUrl,
      valid: false,
      blockReasonCode: "MALFORMED_DESTINATION_URL",
      blockReasonIt:
        "L’URL di destinazione non è valido. Usa un indirizzo http o https completo.",
      completeness: "NONE",
    };
  }

  const existing = paramsToObject(parsed.url.searchParams);
  const existingUtm: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
  for (const k of UTM_KEYS) {
    if (existing[k] != null && existing[k] !== "") existingUtm[k] = existing[k]!;
  }

  let mode: DestinationTrackingMode =
    input.mode === "NONE" || input.mode === "CUSTOM" || input.mode === "AUTO_UTM"
      ? input.mode
      : "AUTO_UTM";

  // Default Easy recommendation: AUTO_UTM when website + valid URL.
  if (input.mode == null || input.mode === undefined) {
    mode = "AUTO_UTM";
  }

  const warningsIt: string[] = [];
  const preservedUserKeys: string[] = [];
  const allyDesired: Record<string, string> = {};

  if (mode === "NONE") {
    const final = new URL(parsed.url.toString());
    final.hash = parsed.hash;
    return {
      mode: "NONE",
      utmSource: existingUtm.utm_source ?? null,
      utmMedium: existingUtm.utm_medium ?? null,
      utmCampaign: existingUtm.utm_campaign ?? null,
      utmContent: existingUtm.utm_content ?? null,
      utmTerm: existingUtm.utm_term ?? null,
      customParameters: Object.fromEntries(
        Object.entries(existing).filter(
          ([k]) => !(UTM_KEYS as readonly string[]).includes(k),
        ),
      ),
      baseDestinationUrl: rawUrl,
      finalDestinationUrl: final.toString(),
      metaUrlTags: null,
      source,
      preservedUserKeys: [],
      warningsIt:
        Object.keys(existingUtm).length > 0
          ? [
              "L’URL contiene già parametri UTM; con tracciamento disattivato Ally non li modifica.",
            ]
          : [],
      valid: true,
      blockReasonCode: null,
      blockReasonIt: null,
      completeness:
        Object.keys(existingUtm).length > 0 ? "PARTIAL" : "NONE",
    };
  }

  if (mode === "AUTO_UTM") {
    allyDesired.utm_source = "meta";
    allyDesired.utm_medium = "paid_social";
    allyDesired.utm_campaign = slugForUtm(input.campaignName, "ally_campaign");
    allyDesired.utm_content = slugForUtm(input.creativeLabel, "ally_ad");
  } else {
    // CUSTOM — only set provided non-empty values
    if ((input.utmSource ?? "").trim())
      allyDesired.utm_source = input.utmSource!.trim();
    if ((input.utmMedium ?? "").trim())
      allyDesired.utm_medium = input.utmMedium!.trim();
    if ((input.utmCampaign ?? "").trim())
      allyDesired.utm_campaign = input.utmCampaign!.trim();
    if ((input.utmContent ?? "").trim())
      allyDesired.utm_content = input.utmContent!.trim();
    if ((input.utmTerm ?? "").trim())
      allyDesired.utm_term = input.utmTerm!.trim();
    if (input.customParameters) {
      for (const [k, v] of Object.entries(input.customParameters)) {
        if (k && v != null && String(v).trim()) allyDesired[k] = String(v).trim();
      }
    }
  }

  const merged: Record<string, string> = { ...existing };
  for (const [k, v] of Object.entries(allyDesired)) {
    if (!v) continue;
    if (merged[k] != null && merged[k] !== "" && merged[k] !== v) {
      // Never silently overwrite user-defined values.
      preservedUserKeys.push(k);
      warningsIt.push(
        `Parametro «${k}» già presente nell’URL: Ally lo lascia invariato (valore utente ha priorità).`,
      );
      continue;
    }
    if (merged[k] == null || merged[k] === "") {
      merged[k] = v;
    }
  }

  const finalUrl = new URL(parsed.url.toString());
  // Rebuild search from merged (sorted keys for stability)
  const sp = objectToSearchParams(merged);
  finalUrl.search = sp.toString() ? `?${sp.toString()}` : "";
  finalUrl.hash = parsed.hash;

  // url_tags = only Ally-added / tracking params Meta can append.
  // Prefer embedding in link for predictability; also expose metaUrlTags for Graph.
  const tagsOnly: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    if (merged[k] && !existingUtm[k]) tagsOnly[k] = merged[k]!;
    else if (merged[k] && mode === "CUSTOM" && allyDesired[k] === merged[k]) {
      tagsOnly[k] = merged[k]!;
    }
  }
  // When we merged into final URL, url_tags optional — set to full UTM set for Meta.
  for (const k of UTM_KEYS) {
    if (merged[k]) tagsOnly[k] = merged[k]!;
  }

  const completeness: DestinationTrackingConfig["completeness"] =
    merged.utm_source && merged.utm_medium && merged.utm_campaign
      ? "FULL"
      : Object.keys(merged).some((k) =>
            (UTM_KEYS as readonly string[]).includes(k),
          )
        ? "PARTIAL"
        : "NONE";

  return {
    mode,
    utmSource: merged.utm_source ?? null,
    utmMedium: merged.utm_medium ?? null,
    utmCampaign: merged.utm_campaign ?? null,
    utmContent: merged.utm_content ?? null,
    utmTerm: merged.utm_term ?? null,
    customParameters: Object.fromEntries(
      Object.entries(merged).filter(
        ([k]) => !(UTM_KEYS as readonly string[]).includes(k),
      ),
    ),
    baseDestinationUrl: rawUrl,
    finalDestinationUrl: finalUrl.toString(),
    metaUrlTags: buildMetaUrlTags(tagsOnly),
    source,
    preservedUserKeys,
    warningsIt,
    valid: true,
    blockReasonCode: null,
    blockReasonIt: null,
    completeness,
  };
}

/** Import / read-back from Meta creative link + url_tags. Never invent UTM names. */
export function destinationTrackingFromMetaImport(input: {
  linkUrl?: string | null;
  urlTags?: string | null;
}): DestinationTrackingConfig {
  const link = (input.linkUrl ?? "").trim();
  const tags = (input.urlTags ?? "").trim();
  if (!link && !tags) {
    return {
      ...emptyDestinationTracking("META_IMPORT"),
      completeness: "NONE",
    };
  }

  const customParameters: Record<string, string> = {};
  const utm: Record<string, string> = {};

  if (tags) {
    const sp = new URLSearchParams(
      tags.startsWith("?") ? tags.slice(1) : tags,
    );
    for (const [k, v] of sp.entries()) {
      if ((UTM_KEYS as readonly string[]).includes(k)) utm[k] = v;
      else if (k) customParameters[k] = v;
    }
  }

  let base = link || null;
  if (link) {
    const parsed = parseUrlLoose(link);
    if (parsed.ok) {
      const existing = paramsToObject(parsed.url.searchParams);
      for (const [k, v] of Object.entries(existing)) {
        if ((UTM_KEYS as readonly string[]).includes(k)) {
          if (!utm[k]) utm[k] = v;
        } else if (!(k in customParameters)) {
          customParameters[k] = v;
        }
      }
      base = link;
    }
  }

  const hasUtm = UTM_KEYS.some((k) => utm[k]);
  const mode: DestinationTrackingMode = hasUtm ? "CUSTOM" : "NONE";

  // Rebuild final URL if we have a parseable link
  let finalDestinationUrl = base;
  let valid = true;
  let blockReasonCode: string | null = null;
  let blockReasonIt: string | null = null;
  if (base) {
    const resolved = resolveDestinationTracking({
      destination: "WEBSITE",
      destinationUrl: base,
      mode: "NONE",
      source: "META_IMPORT",
    });
    if (!resolved.valid && resolved.blockReasonCode === "MALFORMED_DESTINATION_URL") {
      valid = false;
      blockReasonCode = resolved.blockReasonCode;
      blockReasonIt = resolved.blockReasonIt;
    } else {
      finalDestinationUrl = resolved.finalDestinationUrl;
    }
  }

  return {
    mode,
    utmSource: utm.utm_source ?? null,
    utmMedium: utm.utm_medium ?? null,
    utmCampaign: utm.utm_campaign ?? null,
    utmContent: utm.utm_content ?? null,
    utmTerm: utm.utm_term ?? null,
    customParameters,
    baseDestinationUrl: base,
    finalDestinationUrl,
    metaUrlTags: tags
      ? tags.startsWith("?")
        ? tags.slice(1)
        : tags
      : buildMetaUrlTags(utm),
    source: "META_IMPORT",
    preservedUserKeys: [],
    warningsIt: [],
    valid,
    blockReasonCode,
    blockReasonIt,
    completeness: hasUtm
      ? utm.utm_source && utm.utm_medium && utm.utm_campaign
        ? "FULL"
        : "PARTIAL"
      : Object.keys(customParameters).length > 0
        ? "PARTIAL"
        : "NONE",
  };
}

export function parseDestinationTrackingConfig(
  raw: unknown,
): DestinationTrackingConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mode = o.mode;
  if (mode !== "NONE" && mode !== "AUTO_UTM" && mode !== "CUSTOM") return null;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const custom =
    o.customParameters && typeof o.customParameters === "object"
      ? Object.fromEntries(
          Object.entries(o.customParameters as Record<string, unknown>)
            .filter(
              ([k, v]) => typeof k === "string" && typeof v === "string",
            )
            .map(([k, v]) => [k, String(v)]),
        )
      : {};
  return {
    mode,
    utmSource: str(o.utmSource),
    utmMedium: str(o.utmMedium),
    utmCampaign: str(o.utmCampaign),
    utmContent: str(o.utmContent),
    utmTerm: str(o.utmTerm),
    customParameters: custom,
    baseDestinationUrl: str(o.baseDestinationUrl),
    finalDestinationUrl: str(o.finalDestinationUrl),
    metaUrlTags: str(o.metaUrlTags),
    source:
      o.source === "USER" || o.source === "META_IMPORT" || o.source === "ALLY_RULE"
        ? o.source
        : "USER",
    preservedUserKeys: Array.isArray(o.preservedUserKeys)
      ? o.preservedUserKeys.filter((x): x is string => typeof x === "string")
      : [],
    warningsIt: Array.isArray(o.warningsIt)
      ? o.warningsIt.filter((x): x is string => typeof x === "string")
      : [],
    valid: o.valid !== false,
    blockReasonCode: str(o.blockReasonCode),
    blockReasonIt: str(o.blockReasonIt),
    completeness:
      o.completeness === "FULL" ||
      o.completeness === "PARTIAL" ||
      o.completeness === "NONE"
        ? o.completeness
        : "NONE",
  };
}

export function etichettaDestinationTrackingMode(
  mode: DestinationTrackingMode,
): string {
  switch (mode) {
    case "AUTO_UTM":
      return "UTM automatici";
    case "CUSTOM":
      return "Personalizzato";
    case "NONE":
    default:
      return "Nessuno";
  }
}
