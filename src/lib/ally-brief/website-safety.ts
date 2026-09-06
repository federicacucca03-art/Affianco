/**
 * M9.3B — Public website URL safety (pure, no network).
 * Used by website-context fetch and verification scripts.
 */

/** Max extracted text chars sent to Anthropic (website context only). */
export const ALLY_BRIEF_WEBSITE_CONTEXT_MAX_CHARS = 8_000;
export const ALLY_BRIEF_WEBSITE_FETCH_TIMEOUT_MS = 7_000;
export const ALLY_BRIEF_WEBSITE_MAX_BYTES = 512 * 1024;
export const ALLY_BRIEF_WEBSITE_MAX_REDIRECTS = 3;

export const ALLY_BRIEF_WEBSITE_UNAVAILABLE_MESSAGE =
  "Non sono riuscito a leggere il sito. Ho preparato la configurazione usando il brief.";

export const ALLY_BRIEF_WEBSITE_BLOCKED_MESSAGE =
  "Questo indirizzo non può essere analizzato. Inserisci un sito web pubblico.";

export type WebsiteUrlValidation =
  | { ok: true; href: string; hostname: string }
  | {
      ok: false;
      reason: "invalid" | "protocol" | "credentials" | "port" | "private";
    };

export type DnsRecord = { address: string; family: number };

export type PinPublicAddressResult =
  | { ok: true; address: string; family: 4 | 6 }
  | { ok: false; reason: "empty" | "private" };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const oct = Number(p);
    if (oct > 255) return null;
    n = (n << 8) + oct;
  }
  return n >>> 0;
}

/** Map ::ffff:IPv4 / ::ffff:xxxx:yyyy → dotted IPv4. */
export function unwrapIpv4Mapped(address: string): string | null {
  const a = address.trim().toLowerCase();
  const dotted = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted?.[1]) return dotted[1];
  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

/** True if address is loopback / private / link-local / non-routable. */
export function isNonPublicIpAddress(address: string): boolean {
  const raw = address.trim().toLowerCase();
  if (!raw) return true;

  const mapped = unwrapIpv4Mapped(raw);
  if (mapped) return isNonPublicIpAddress(mapped);

  // Strip zone id (fe80::1%eth0)
  const a = raw.split("%")[0] ?? raw;

  if (a.includes(":")) {
    if (a === "::1" || a === "::") return true;
    if (a.startsWith("fc") || a.startsWith("fd")) return true;
    if (
      a.startsWith("fe8") ||
      a.startsWith("fe9") ||
      a.startsWith("fea") ||
      a.startsWith("feb")
    ) {
      return true;
    }
    if (a.startsWith("ff")) return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(a)) return true;
    if (/^fe[89ab][0-9a-f]:/i.test(a)) return true;
    return false;
  }

  const n = ipv4ToInt(a);
  if (n == null) return true;

  if ((n >>> 24) === 0) return true;
  if ((n >>> 24) === 127) return true;
  if ((n >>> 24) === 10) return true;
  if ((n >>> 24) === 172 && ((n >>> 16) & 0xf0) === 16) return true;
  if ((n >>> 24) === 192 && ((n >>> 16) & 0xff) === 168) return true;
  if ((n >>> 24) === 169 && ((n >>> 16) & 0xff) === 254) return true;
  if ((n >>> 24) === 100 && ((n >>> 16) & 0xc0) === 64) return true;
  if ((n >>> 28) === 0xe) return true;
  if ((n >>> 28) === 0xf) return true;

  return false;
}

/**
 * Conservative pin: if ANY resolved address is non-public → reject.
 * Otherwise pin the first public address for the actual TCP/TLS connect.
 */
export function pinPublicAddressOrReject(
  records: DnsRecord[],
): PinPublicAddressResult {
  if (!records.length) return { ok: false, reason: "empty" };
  for (const r of records) {
    if (isNonPublicIpAddress(r.address)) {
      return { ok: false, reason: "private" };
    }
  }
  const first = records[0]!;
  const family: 4 | 6 = first.family === 6 ? 6 : 4;
  return { ok: true, address: first.address, family };
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (h.endsWith(".lan") || h.endsWith(".home") || h.endsWith(".corp")) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) {
    return isNonPublicIpAddress(h);
  }
  return false;
}

/**
 * Validate a user-supplied website URL before any network I/O.
 * Accepts bare domains (adds https://). Port policy: 80/443 only.
 */
export function validatePublicWebsiteUrl(raw: string): WebsiteUrlValidation {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) {
    return { ok: false, reason: "invalid" };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, reason: "invalid" };
  }

  let href = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
    href = `https://${href}`;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  url.hash = "";

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "protocol" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials" };
  }

  const port = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 80;
  if (port !== 80 && port !== 443) {
    return { ok: false, reason: "port" };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname.includes("..")) {
    return { ok: false, reason: "invalid" };
  }
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: "private" };
  }

  if (!hostname.includes(".") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    href: url.href,
    hostname,
  };
}

/** Allowed Content-Type for homepage enrichment. */
export function isAllowedWebsiteContentType(ct: string | null): boolean {
  const c = (ct ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (!c) return false;
  if (c === "text/html" || c === "application/xhtml+xml") return true;
  return false;
}

/**
 * Stream body with a hard byte cap (bytes as delivered on the Node response
 * stream after transport decoding).
 *
 * When the response exceeds maxBytes:
 * - stop reading immediately (destroy stream — do not buffer the rest)
 * - keep only the first maxBytes for HTML extraction (Wix/etc. bloat)
 * - never grow memory beyond maxBytes
 *
 * Callers must treat `truncated: true` as partial HTML and extract from it.
 */
export async function readStreamWithByteLimit(
  stream: NodeJS.ReadableStream,
  maxBytes: number,
): Promise<{ bytes: number; text: string; truncated: boolean }> {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  try {
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      if (total + buf.byteLength > maxBytes) {
        const take = maxBytes - total;
        if (take > 0) chunks.push(buf.subarray(0, take));
        total = maxBytes;
        truncated = true;
        const destroyable = stream as unknown as {
          destroy?: (e?: Error) => void;
        };
        destroyable.destroy?.();
        break;
      }
      chunks.push(buf);
      total += buf.byteLength;
    }
  } catch (err) {
    // destroy() mid-iteration may surface as stream error; keep truncated bytes.
    if (!truncated) throw err;
  }
  const merged = Buffer.concat(chunks, total);
  return {
    bytes: merged.byteLength,
    text: merged.toString("utf8"),
    truncated,
  };
}

/** Internal failure classes for server logs (never shown in UI copy). */
export type WebsiteFetchFailureClass =
  | "INVALID_URL"
  | "PRIVATE_TARGET"
  | "DNS_FAILURE"
  | "CONNECT_FAILURE"
  | "TLS_FAILURE"
  | "HTTP_ERROR"
  | "UNSUPPORTED_CONTENT"
  | "TOO_LARGE"
  | "TIMEOUT"
  | "EXTRACTION_FAILURE"
  | "REDIRECTS"
  | "NETWORK";

/** Fields that must never receive WEBSITE provenance values. */
export const WEBSITE_FORBIDDEN_FIELD_IDS = [
  "budgetGiornaliero",
  "raggioKm",
  "etaMin",
  "etaMax",
  "targetAge",
  "objective",
  "scontrinoMedio",
  "tassoConversione",
  "productMargin",
  "targetMargin",
  "maxSustainableCpa",
  "pageId",
  "formId",
] as const;
