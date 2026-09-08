/**
 * Validazione input e parsing output per analyze-creative.
 * Nessuna chiamata Anthropic. Nessun log del payload immagine.
 */

export const MIME_IMMAGINE_CONSENTITI = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type MimeImmagineConsentito =
  (typeof MIME_IMMAGINE_CONSENTITI)[number];

/** Limite byte decodificati (~8 MB), sotto i tetti tipici vision. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const RELEVANCE_VALUES = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
] as const;

export type CreativeRelevance = (typeof RELEVANCE_VALUES)[number];

export const SEMANTIC_STATUS_VALUES = [
  "MATCH",
  "POSSIBLE_MISMATCH",
  "CLEAR_MISMATCH",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type CreativeSemanticStatusVision =
  (typeof SEMANTIC_STATUS_VALUES)[number];

export const SEMANTIC_CONFIDENCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

export type CreativeSemanticConfidenceVision =
  (typeof SEMANTIC_CONFIDENCE_VALUES)[number];

export type CreativeVisionAnalysis = {
  relevance: CreativeRelevance;
  relevanceReason: string | null;
  visibleText: string[];
  /** M9.3D — structured semantic fit (optional for backward compat). */
  semanticStatus?: CreativeSemanticStatusVision;
  confidence?: CreativeSemanticConfidenceVision;
  creativeSummary?: string | null;
  campaignContextSummary?: string | null;
  evidence?: string[];
};

export const VISION_UNKNOWN: CreativeVisionAnalysis = {
  relevance: "UNKNOWN",
  relevanceReason: null,
  visibleText: [],
  semanticStatus: "INSUFFICIENT_EVIDENCE",
  confidence: "LOW",
  creativeSummary: null,
  campaignContextSummary: null,
  evidence: [],
};

export type ImageParseOk = {
  ok: true;
  mime: MimeImmagineConsentito;
  base64: string;
  byteLength: number;
};

export type ImageParseErr = {
  ok: false;
  status: 400;
  error: string;
};

const DATA_URL_RE =
  /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=\s]+)$/i;

export function isMimeImmagineConsentito(
  mime: string,
): mime is MimeImmagineConsentito {
  const n = mime.toLowerCase();
  return n === "image/jpeg" || n === "image/png" || n === "image/webp";
}

function isMimeConsentito(mime: string): mime is MimeImmagineConsentito {
  return isMimeImmagineConsentito(mime);
}

/** Magic bytes: JPEG / PNG / WebP. GIF e altri restano null. */
export function mimeImmagineDaBytes(
  bytes: Uint8Array,
): MimeImmagineConsentito | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Data URL jpeg/png/webp da bytes (blob o signed URL già fetchati).
 * Non accetta URL. Non logga.
 */
export function dataUrlDaBytesImmagine(
  bytes: Uint8Array,
  fallbackMime?: string,
): string | null {
  const mime =
    mimeImmagineDaBytes(bytes) ??
    (fallbackMime && isMimeImmagineConsentito(fallbackMime)
      ? fallbackMime.toLowerCase()
      : null);
  if (!mime) return null;
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

function byteLengthBase64(b64: string): number {
  const pulito = b64.replace(/\s/g, "");
  const padding = pulito.endsWith("==") ? 2 : pulito.endsWith("=") ? 1 : 0;
  return Math.floor((pulito.length * 3) / 4) - padding;
}

/**
 * Accetta solo data URL image jpeg/png/webp. Rifiuta URL http(s) e path.
 */
export function parseDataUrlImmagine(image: unknown): ImageParseOk | ImageParseErr {
  if (typeof image !== "string" || !image.trim()) {
    return { ok: false, status: 400, error: "Immagine mancante." };
  }
  const raw = image.trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    return {
      ok: false,
      status: 400,
      error: "Invia l'immagine come data URL, non come link.",
    };
  }
  if (!raw.toLowerCase().startsWith("data:")) {
    return {
      ok: false,
      status: 400,
      error: "Formato immagine non valido. Usa un data URL.",
    };
  }
  const match = DATA_URL_RE.exec(raw);
  if (!match) {
    const mimeGuess = raw.slice(5, raw.indexOf(";")).toLowerCase();
    if (mimeGuess.startsWith("image/") && !isMimeConsentito(mimeGuess)) {
      return {
        ok: false,
        status: 400,
        error: "Formato non supportato. Usa JPEG, PNG o WebP.",
      };
    }
    return {
      ok: false,
      status: 400,
      error: "Formato immagine non valido. Usa un data URL JPEG, PNG o WebP.",
    };
  }
  const mime = match[1]!.toLowerCase() as MimeImmagineConsentito;
  const base64 = match[2]!.replace(/\s/g, "");
  if (!base64) {
    return { ok: false, status: 400, error: "Immagine vuota." };
  }
  const byteLength = byteLengthBase64(base64);
  if (byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 400,
      error: "L'immagine è troppo grande. Usa un file più piccolo (max 8 MB).",
    };
  }
  return { ok: true, mime, base64, byteLength };
}

function isRelevance(v: unknown): v is CreativeRelevance {
  return (
    v === "HIGH" || v === "MEDIUM" || v === "LOW" || v === "UNKNOWN"
  );
}

function isSemanticStatus(v: unknown): v is CreativeSemanticStatusVision {
  return (
    v === "MATCH" ||
    v === "POSSIBLE_MISMATCH" ||
    v === "CLEAR_MISMATCH" ||
    v === "INSUFFICIENT_EVIDENCE"
  );
}

function isSemanticConfidence(
  v: unknown,
): v is CreativeSemanticConfidenceVision {
  return v === "LOW" || v === "MEDIUM" || v === "HIGH";
}

function pulisciReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return null;
  return t.slice(0, 220);
}

function pulisciShort(raw: unknown, max = 180): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return null;
  return t.slice(0, max);
}

function pulisciVisibleText(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().replace(/\s+/g, " ");
    if (!t) continue;
    out.push(t.slice(0, 200));
    if (out.length >= 20) break;
  }
  return out;
}

function pulisciEvidence(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().replace(/\s+/g, " ");
    if (!t) continue;
    out.push(t.slice(0, 160));
    if (out.length >= 3) break;
  }
  return out;
}

/** Map semanticStatus → legacy relevance for P1B guidance. */
export function relevanceFromParsedSemantic(
  status: CreativeSemanticStatusVision | undefined,
  fallback: CreativeRelevance,
): CreativeRelevance {
  if (!status) return fallback;
  if (status === "MATCH") return "HIGH";
  if (status === "POSSIBLE_MISMATCH") return "MEDIUM";
  if (status === "CLEAR_MISMATCH") return "LOW";
  return "UNKNOWN";
}

export function parseCreativeVisionAnalysis(
  testo: string,
): CreativeVisionAnalysis {
  try {
    const pulito = testo
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const inizio = pulito.indexOf("{");
    const fine = pulito.lastIndexOf("}");
    if (inizio < 0 || fine <= inizio) return { ...VISION_UNKNOWN };
    const parsed = JSON.parse(pulito.slice(inizio, fine + 1)) as Record<
      string,
      unknown
    >;

    const semanticStatus = isSemanticStatus(parsed.semanticStatus)
      ? parsed.semanticStatus
      : isSemanticStatus(parsed.status)
        ? parsed.status
        : undefined;
    const confidence = isSemanticConfidence(parsed.confidence)
      ? parsed.confidence
      : undefined;

    let relevance: CreativeRelevance | undefined = isRelevance(parsed.relevance)
      ? parsed.relevance
      : undefined;
    if (!relevance && semanticStatus) {
      relevance = relevanceFromParsedSemantic(semanticStatus, "UNKNOWN");
    }
    if (!relevance) return { ...VISION_UNKNOWN };

    const reason =
      pulisciReason(parsed.relevanceReason) ??
      pulisciReason(parsed.reason);

    return {
      relevance,
      relevanceReason: reason,
      visibleText: pulisciVisibleText(parsed.visibleText),
      semanticStatus:
        semanticStatus ??
        (relevance === "HIGH"
          ? "MATCH"
          : relevance === "MEDIUM"
            ? "POSSIBLE_MISMATCH"
            : relevance === "LOW"
              ? "CLEAR_MISMATCH"
              : "INSUFFICIENT_EVIDENCE"),
      confidence:
        confidence ??
        (relevance === "HIGH"
          ? "HIGH"
          : relevance === "LOW"
            ? "MEDIUM"
            : relevance === "MEDIUM"
              ? "MEDIUM"
              : "LOW"),
      creativeSummary: pulisciShort(parsed.creativeSummary),
      campaignContextSummary: pulisciShort(parsed.campaignContextSummary),
      evidence: pulisciEvidence(parsed.evidence),
    };
  } catch {
    return { ...VISION_UNKNOWN };
  }
}
