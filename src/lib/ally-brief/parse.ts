/**
 * M9.3A — validate AI brief JSON + merge existing client + deterministic CPA.
 */

import {
  calculateMaxSustainableCpl,
  calculateMaxSustainableBookingCpa,
  calculateEcommerceCpaMax,
  calculateMaxSustainableInStoreCpa,
} from "@/lib/benchmarks";
import type { CampagnaObjective, TargetAgeBand, TargetType } from "@/types/campagne";
import {
  ALLY_BRIEF_FIELD_LABELS,
  OBJECTIVES_CANONICI,
  type AllyBriefConfidence,
  type AllyBriefExistingClientContext,
  type AllyBriefField,
  type AllyBriefFieldId,
  type AllyBriefFieldValue,
  type AllyBriefProposal,
  type AllyBriefProvenance,
} from "@/lib/ally-brief/types";
import { WEBSITE_FORBIDDEN_FIELD_IDS } from "@/lib/ally-brief/website-safety";
import { canonicalizeAllyBriefSettore } from "@/lib/settore-canonico";

const FIELD_IDS = Object.keys(ALLY_BRIEF_FIELD_LABELS) as AllyBriefFieldId[];

const UNSAFE_ECONOMICS: AllyBriefFieldId[] = [
  "scontrinoMedio",
  "tassoConversione",
  "productMargin",
  "targetMargin",
  "maxSustainableCpa",
];

const META_IDS: AllyBriefFieldId[] = ["pageId", "formId"];

function extractJsonObject(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    if (start < 0) throw new Error("JSON non valido");
    const candidate = trimmed.slice(start);
    try {
      return JSON.parse(candidate);
    } catch {
      // Truncation only: drop incomplete trailing property, close braces.
      // Never invent field values / never keep partial string facts.
      const repaired = repairTruncatedJson(candidate);
      if (!repaired) throw new Error("JSON non valido");
      const parsed = JSON.parse(repaired) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("JSON non valido");
      }
      return parsed;
    }
  }
}

/**
 * Structural truncation repair only.
 * - Drops incomplete trailing keys/values (never completes partial strings as facts)
 * - Closes unmatched { [ only
 * Returns null if nothing safe remains.
 */
export function repairTruncatedJson(raw: string): string | null {
  let s = raw.trim();
  if (!s.startsWith("{")) return null;

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;
  /** Index of last comma between top-level field properties (safe cut). */
  let lastSafeCut = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") braces += 1;
    else if (ch === "}") braces -= 1;
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets -= 1;
    else if (ch === ",") {
      // Last complete property separator at any nesting depth.
      lastSafeCut = i;
    }
  }

  if (inString || /,\s*"[^"]*"\s*:\s*$/.test(s) || /:\s*$/.test(s)) {
    if (lastSafeCut <= 0) return null;
    s = s.slice(0, lastSafeCut).replace(/,\s*$/, "");
  } else {
    s = s.replace(/,\s*"[^"]*"\s*:\s*$/, "");
    s = s.replace(/,\s*$/, "");
  }

  braces = 0;
  brackets = 0;
  inString = false;
  escape = false;
  for (const ch of s) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") braces += 1;
    else if (ch === "}") braces -= 1;
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets -= 1;
  }
  // Must not still be inside a string — closing it would invent a value.
  if (inString) return null;
  if (braces < 1) return null;

  while (brackets > 0) {
    s += "]";
    brackets -= 1;
  }
  while (braces > 0) {
    s += "}";
    braces -= 1;
  }
  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}

function asProvenance(raw: unknown): AllyBriefProvenance {
  if (
    raw === "EXISTING" ||
    raw === "EXPLICIT" ||
    raw === "INFERRED" ||
    raw === "WEBSITE" ||
    raw === "MISSING"
  ) {
    return raw;
  }
  return "MISSING";
}

function asConfidence(raw: unknown): AllyBriefConfidence {
  if (
    raw === "HIGH" ||
    raw === "MEDIUM" ||
    raw === "LOW" ||
    raw === "UNKNOWN"
  ) {
    return raw;
  }
  return "UNKNOWN";
}

function asString(raw: unknown, max = 280): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function asNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asObjective(raw: unknown): CampagnaObjective | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase().replace("INSTORE", "IN_STORE");
  if ((OBJECTIVES_CANONICI as string[]).includes(u)) {
    return u as CampagnaObjective;
  }
  return null;
}

function asTargetType(raw: unknown): TargetType | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toUpperCase();
  if (u === "B2C" || u === "B2B") return u;
  return null;
}

function asTargetAge(raw: unknown): TargetAgeBand | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "18-35" || t === "25-50" || t === "35-65+" || t === "all") {
    return t;
  }
  return null;
}

function emptyField(id: AllyBriefFieldId): AllyBriefField {
  return {
    id,
    label: ALLY_BRIEF_FIELD_LABELS[id],
    value: null,
    provenance: "MISSING",
    confidence: "UNKNOWN",
    note: null,
  };
}

function normalizeClientIdentity(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact generic business descriptors — never a client identity. */
const GENERIC_CLIENT_DESCRIPTORS = new Set([
  "studio dentistico",
  "clinica dentale",
  "dentista",
  "odontoiatra",
  "palestra",
  "agenzia immobiliare",
  "immobiliare",
  "azienda",
  "azienda b2b",
  "business",
  "attivita",
  "ecommerce",
  "e-commerce",
  "negozio",
  "negozio di scarpe",
  "ristorante",
  "centro estetico",
  "bar",
  "hotel",
  "studio",
  "clinica",
  "centro medico",
  "locale",
  "servizi",
]);

const CATEGORY_PREFIX =
  /^(studio|centro|agenzia|negozio|clinica|hotel|palestra|ristorante|bar|ecommerce|e-commerce)\b/;

const SECTOR_OR_PRODUCT_TOKEN =
  /^(dentistico|dentale|odontoiatrico|odontoiatra|immobiliare|estetico|medico|fitness|yoga|scarpe|running|b2b|industriale|industriali|abbigliamento|prodotti|servizi)$/;

/**
 * Conservative client-identity gate.
 * Prefer MISSING over promoting a business type / sector phrase to a client name.
 * EXISTING provenance is trusted separately (owned client row).
 */
export function isPlausibleClientIdentity(
  raw: string | null | undefined,
): boolean {
  if (typeof raw !== "string") return false;
  const n = normalizeClientIdentity(raw);
  if (n.length < 2) return false;
  if (GENERIC_CLIENT_DESCRIPTORS.has(n)) return false;
  if (
    /^(dentista|palestra|ristorante|negozio|azienda|ecommerce|immobiliare|bar|hotel|clinica|studio|attivita)$/.test(
      n,
    )
  ) {
    return false;
  }

  // Descriptive phrases that start with a generic org type and never name the brand.
  if (
    /^(azienda|negozio|ecommerce|e-commerce|attivita|business)\b/.test(n) &&
    /\b(che\s+vende|che\s+offre|di\s+\w+|b2b)\b/.test(n)
  ) {
    return false;
  }

  if (CATEGORY_PREFIX.test(n)) {
    let rest = n.replace(CATEGORY_PREFIX, "").trim();
    rest = rest.replace(/^di\s+/, "").trim();
    if (!rest) return false;
    // "palestra a milano" / "studio a roma" — location only, not a name.
    if (/^a\s+\w[\w'-]*$/.test(rest)) return false;
    if (SECTOR_OR_PRODUCT_TOKEN.test(rest)) return false;
    // "studio dentistico" already covered; "studio dentistico aurora" keeps "aurora".
    const withoutSectorAdj = rest
      .replace(
        /^(dentistico|dentale|odontoiatrico|immobiliare|estetico|medico|fitness)\s+/,
        "",
      )
      .trim();
    if (!withoutSectorAdj || SECTOR_OR_PRODUCT_TOKEN.test(withoutSectorAdj)) {
      return false;
    }
    if (/^a\s+\w[\w'-]*$/.test(withoutSectorAdj)) return false;
    return withoutSectorAdj.length >= 2;
  }

  return true;
}

function coerceValue(
  id: AllyBriefFieldId,
  raw: unknown,
): AllyBriefFieldValue {
  switch (id) {
    case "objective":
      return asObjective(raw);
    case "targetType":
      return asTargetType(raw);
    case "targetAge":
      return asTargetAge(raw);
    case "raggioKm":
    case "etaMin":
    case "etaMax":
    case "budgetGiornaliero":
    case "scontrinoMedio":
    case "tassoConversione":
    case "productMargin":
    case "targetMargin":
    case "maxSustainableCpa":
      return asNumber(raw);
    default:
      return asString(raw, id === "elevatorPitch" ? 2000 : 280);
  }
}

function stripUnsafeInventions(field: AllyBriefField): AllyBriefField {
  if (META_IDS.includes(field.id)) {
    // Never accept Meta identifiers from the model (even if labeled explicit).
    return {
      ...field,
      value: null,
      provenance: "MISSING",
      confidence: "UNKNOWN",
      note: field.note,
    };
  }
  if (
    (WEBSITE_FORBIDDEN_FIELD_IDS as readonly string[]).includes(field.id) &&
    field.provenance === "WEBSITE"
  ) {
    return {
      ...field,
      value: null,
      provenance: "MISSING",
      confidence: "UNKNOWN",
      note: field.note ?? "Non derivabile dal sito",
    };
  }
  if (field.id === "nomeCliente" && field.provenance !== "EXISTING") {
    const raw =
      typeof field.value === "string" ? field.value : null;
    if (raw && !isPlausibleClientIdentity(raw)) {
      return {
        ...field,
        value: null,
        provenance: "MISSING",
        confidence: "UNKNOWN",
        note:
          field.note ??
          "Tipo attività / descrizione, non identità cliente",
      };
    }
  }
  if (
    UNSAFE_ECONOMICS.includes(field.id) &&
    (field.provenance === "INFERRED" || field.provenance === "WEBSITE")
  ) {
    return {
      ...field,
      value: null,
      provenance: "MISSING",
      confidence: "UNKNOWN",
      note: "Non inventato: serve conferma esplicita",
    };
  }
  if (field.provenance === "INFERRED" && field.confidence === "LOW") {
    return {
      ...field,
      value: null,
      provenance: "MISSING",
      confidence: "LOW",
      note: field.note ?? "Inferenza troppo debole",
    };
  }
  return field;
}

function mergeExistingClient(
  fields: AllyBriefField[],
  existing: AllyBriefExistingClientContext | null,
): AllyBriefField[] {
  if (!existing) return fields;
  const byId = new Map(fields.map((f) => [f.id, f]));

  function preferExisting(
    id: AllyBriefFieldId,
    value: AllyBriefFieldValue,
  ) {
    if (value == null || value === "") return;
    const cur = byId.get(id) ?? emptyField(id);
    if (cur.provenance === "EXPLICIT" && cur.value != null) {
      // Campaign-level brief wins; flag conflict if different
      if (String(cur.value).toLowerCase() !== String(value).toLowerCase()) {
        byId.set(id, {
          ...cur,
          note:
            cur.note ??
            `Brief diverso dal cliente esistente (${String(value)})`,
        });
      }
      return;
    }
    // EXISTING overwrites WEBSITE / INFERRED / MISSING (client inventory wins over site scrape)
    if (
      cur.provenance === "INFERRED" ||
      cur.provenance === "WEBSITE" ||
      cur.provenance === "MISSING" ||
      cur.value == null
    ) {
      byId.set(id, {
        ...cur,
        value,
        provenance: "EXISTING",
        confidence: "HIGH",
        note: cur.note,
      });
    }
  }

  preferExisting("nomeCliente", existing.nome);
  preferExisting("settore", existing.settore);
  preferExisting("citta", existing.citta);
  preferExisting("sitoWeb", existing.sitoWeb);
  preferExisting("elevatorPitch", existing.note);
  preferExisting("targetType", existing.targetType);
  preferExisting("targetAge", existing.targetAge);

  return FIELD_IDS.map((id) => byId.get(id) ?? emptyField(id));
}

function tryDeterministicSustainableCpa(
  fields: AllyBriefField[],
): AllyBriefField {
  const get = (id: AllyBriefFieldId) => fields.find((f) => f.id === id);
  const objective = get("objective")?.value as CampagnaObjective | null;
  const ticket = asNumber(get("scontrinoMedio")?.value);
  const conv = asNumber(get("tassoConversione")?.value);
  const margin = asNumber(get("productMargin")?.value);
  const targetMargin = asNumber(get("targetMargin")?.value) ?? 50;
  const ticketProv = get("scontrinoMedio")?.provenance;
  const convProv = get("tassoConversione")?.provenance;
  const marginProv = get("productMargin")?.provenance;

  const economicsOk = (p: AllyBriefProvenance | undefined) =>
    p === "EXPLICIT" || p === "EXISTING";

  let value: number | null = null;
  if (
    objective === "LEADS" &&
    ticket != null &&
    conv != null &&
    economicsOk(ticketProv) &&
    economicsOk(convProv)
  ) {
    value = calculateMaxSustainableCpl(ticket, conv, targetMargin);
  } else if (
    objective === "BOOKINGS" &&
    ticket != null &&
    conv != null &&
    economicsOk(ticketProv) &&
    economicsOk(convProv)
  ) {
    value = calculateMaxSustainableBookingCpa(ticket, conv, targetMargin);
  } else if (
    objective === "ECOMMERCE" &&
    ticket != null &&
    margin != null &&
    economicsOk(ticketProv) &&
    economicsOk(marginProv)
  ) {
    value = calculateEcommerceCpaMax(ticket, margin, 0);
  } else if (
    objective === "IN_STORE" &&
    ticket != null &&
    margin != null &&
    economicsOk(ticketProv) &&
    economicsOk(marginProv)
  ) {
    value = calculateMaxSustainableInStoreCpa(ticket, margin, targetMargin);
  }

  if (value != null && Number.isFinite(value) && value > 0) {
    return {
      id: "maxSustainableCpa",
      label: ALLY_BRIEF_FIELD_LABELS.maxSustainableCpa,
      value: Math.round(value * 100) / 100,
      provenance: "EXPLICIT",
      confidence: "HIGH",
      note: "Calcolato con la formula Ally (non inventato dall'AI)",
    };
  }

  return {
    id: "maxSustainableCpa",
    label: ALLY_BRIEF_FIELD_LABELS.maxSustainableCpa,
    value: null,
    provenance: "MISSING",
    confidence: "UNKNOWN",
    note: "Servono ticket e conversione/margine espliciti per calcolarla",
  };
}

function buildMissingList(fields: AllyBriefField[]): string[] {
  const important: AllyBriefFieldId[] = [
    "nomeCliente",
    "objective",
    "frontEndOffer",
    "citta",
    "budgetGiornaliero",
    "maxSustainableCpa",
    "pageId",
    "formId",
  ];
  return important
    .filter((id) => {
      const f = fields.find((x) => x.id === id);
      return !f || f.provenance === "MISSING" || f.value == null;
    })
    .map((id) => ALLY_BRIEF_FIELD_LABELS[id]);
}

export function parseAllyBriefProposal(
  raw: string,
  existing: AllyBriefExistingClientContext | null,
  options?: {
    /** User-typed website URL → inject as EXPLICIT sitoWeb (Dal brief). */
    userWebsiteUrl?: string | null;
    /** Site-only (empty brief): do not invent campaign objective/audience/budget. */
    siteOnly?: boolean;
  },
): AllyBriefProposal {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const rawFields =
    parsed.fields && typeof parsed.fields === "object"
      ? (parsed.fields as Record<string, unknown>)
      : {};

  let fields: AllyBriefField[] = FIELD_IDS.map((id) => {
    const cell = rawFields[id];
    if (!cell || typeof cell !== "object") return emptyField(id);
    const o = cell as Record<string, unknown>;
    let provenance = asProvenance(o.provenance);
    let value = coerceValue(id, o.value);
    if (value == null) provenance = "MISSING";
    if (provenance === "MISSING") value = null;
    return stripUnsafeInventions({
      id,
      label: ALLY_BRIEF_FIELD_LABELS[id],
      value,
      provenance,
      confidence: asConfidence(o.confidence),
      note: asString(o.note, 160),
    });
  });

  // Brief EXPLICIT must not be silently overwritten by WEBSITE in the same payload:
  // already enforced by AI rules; server also drops WEBSITE on forbidden ids above.

  fields = mergeExistingClient(fields, existing);

  // M9.3C — canonical settore only (catalog label or Altro). Free-form → pitch.
  let discardedSettoreText: string | null = null;
  fields = fields.map((f) => {
    if (f.id !== "settore" || f.value == null || typeof f.value !== "string") {
      return f;
    }
    if (f.provenance === "EXISTING") return f;
    const canon = canonicalizeAllyBriefSettore(f.value, f.provenance);
    if (canon.discardedFreeForm && canon.discardedFreeForm !== canon.value) {
      discardedSettoreText = canon.discardedFreeForm;
    }
    if (canon.value === f.value) return f;
    return {
      ...f,
      value: canon.value,
      note: canon.note ?? f.note,
    };
  });

  if (discardedSettoreText) {
    fields = fields.map((f) => {
      if (f.id !== "elevatorPitch") return f;
      if (f.value != null && String(f.value).trim()) return f;
      return {
        ...f,
        value: discardedSettoreText!.slice(0, 2000),
        provenance: f.provenance === "MISSING" ? "EXPLICIT" : f.provenance,
        confidence: f.confidence === "UNKNOWN" ? "HIGH" : f.confidence,
        note: f.note ?? "Descrizione business dal brief (settore → Altro)",
      };
    });
  }

  const userUrl = options?.userWebsiteUrl?.trim();
  if (userUrl) {
    fields = fields.map((f) => {
      if (f.id !== "sitoWeb") return f;
      // User-supplied URL is brief/input EXPLICIT — never label "Dal sito".
      if (f.provenance === "EXPLICIT" && f.value != null) return f;
      if (f.provenance === "EXISTING" && f.value != null) return f;
      return {
        ...f,
        value: userUrl.slice(0, 280),
        provenance: "EXPLICIT",
        confidence: "HIGH",
        note: f.note,
      };
    });
  }

  if (options?.siteOnly) {
    const siteOnlyBlock: AllyBriefFieldId[] = [
      "objective",
      "budgetGiornaliero",
      "raggioKm",
      "etaMin",
      "etaMax",
      "targetAge",
      ...UNSAFE_ECONOMICS,
    ];
    fields = fields.map((f) => {
      if (!siteOnlyBlock.includes(f.id)) return f;
      if (f.provenance === "EXPLICIT" || f.provenance === "EXISTING") return f;
      return {
        ...f,
        value: null,
        provenance: "MISSING",
        confidence: "UNKNOWN",
        note: f.note ?? "Serve conferma nel brief (solo sito)",
      };
    });
  }

  const cpa = tryDeterministicSustainableCpa(fields);
  fields = fields.map((f) => (f.id === "maxSustainableCpa" ? cpa : f));

  const assumptions = Array.isArray(parsed.assumptions)
    ? parsed.assumptions
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const missingFromModel = Array.isArray(parsed.missing_information)
    ? parsed.missing_information
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const missingInformation = [
    ...new Set([...buildMissingList(fields), ...missingFromModel]),
  ].slice(0, 10);

  return {
    summary:
      asString(parsed.summary, 400) ??
      "Ho preparato una prima configurazione da rivedere.",
    fields,
    missingInformation,
    assumptions,
    matchedClienteId: existing?.id ?? null,
    fromAi: true,
  };
}

export function buildAllyBriefFallbackProposal(
  brief: string,
  existing: AllyBriefExistingClientContext | null,
): AllyBriefProposal {
  const fields = mergeExistingClient(
    FIELD_IDS.map((id) => emptyField(id)),
    existing,
  );
  if (brief.trim()) {
    const pitch = fields.find((f) => f.id === "elevatorPitch");
    if (pitch && pitch.provenance === "MISSING") {
      pitch.value = brief.trim().slice(0, 2000);
      pitch.provenance = "EXPLICIT";
      pitch.confidence = "HIGH";
    }
  }
  return {
    summary:
      "Non riesco a preparare la configurazione in questo momento. Puoi riprovare o continuare manualmente.",
    fields,
    missingInformation: buildMissingList(fields),
    assumptions: [],
    matchedClienteId: existing?.id ?? null,
    fromAi: false,
  };
}

/** Pure helpers exported for tests. */
export function assertNoInventedEconomics(fields: AllyBriefField[]): boolean {
  return fields.every((f) => {
    if (!UNSAFE_ECONOMICS.includes(f.id)) return true;
    if (
      (f.provenance === "INFERRED" || f.provenance === "WEBSITE") &&
      f.value != null
    ) {
      return false;
    }
    return true;
  });
}

export function assertNoInventedMetaIds(fields: AllyBriefField[]): boolean {
  return fields.every((f) => {
    if (!META_IDS.includes(f.id)) return true;
    return f.value == null && f.provenance === "MISSING";
  });
}

/**
 * Valid proposal for review/accept:
 * AI-sourced + at least 2 normalized fields with value
 * (EXPLICIT / INFERRED / EXISTING). All-MISSING is NOT valid.
 */
export function isMeaningfulAllyBriefProposal(
  proposal: AllyBriefProposal,
): boolean {
  if (!proposal.fromAi) return false;
  const usable = proposal.fields.filter(
    (f) =>
      f.value != null &&
      f.value !== "" &&
      (f.provenance === "EXPLICIT" ||
        f.provenance === "INFERRED" ||
        f.provenance === "EXISTING" ||
        f.provenance === "WEBSITE"),
  );
  return usable.length >= 2;
}
