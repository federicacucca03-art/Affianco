/**
 * M9.3B — Pure HTML → bounded text extraction (no network, no server-only).
 */

import { ALLY_BRIEF_WEBSITE_CONTEXT_MAX_CHARS } from "@/lib/ally-brief/website-safety";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : "";
    });
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function pickMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`,
      "i",
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    if (v?.trim()) return collapseWs(decodeHtmlEntities(v));
  }
  return null;
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  const t = collapseWs(decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "")));
  return t || null;
}

function pickHeadings(html: string, tag: "h1" | "h2", limit: number): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const t = collapseWs(decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")));
    if (t && t.length > 1) out.push(t.slice(0, 200));
  }
  return out;
}

/**
 * Strip scripts/styles/noise and extract bounded visible-ish text.
 * Pure HTML string processing — no browser, no JS execution.
 */
export function extractVisibleTextFromHtml(
  html: string,
  maxChars = ALLY_BRIEF_WEBSITE_CONTEXT_MAX_CHARS,
): {
  title: string | null;
  description: string | null;
  text: string;
} {
  const title = pickTitle(html);
  const description =
    pickMeta(html, ["description", "og:description", "twitter:description"]) ??
    null;

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ");

  const h1 = pickHeadings(body, "h1", 4);
  const h2 = pickHeadings(body, "h2", 8);

  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const bodyText = collapseWs(decodeHtmlEntities(body));

  const parts: string[] = [];
  if (title) parts.push(`Title: ${title}`);
  if (description) parts.push(`Description: ${description}`);
  if (h1.length) parts.push(`H1: ${h1.join(" | ")}`);
  if (h2.length) parts.push(`H2: ${h2.join(" | ")}`);
  if (bodyText) parts.push(`Body: ${bodyText}`);

  let text = parts.join("\n");
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
  }

  return { title, description, text };
}
