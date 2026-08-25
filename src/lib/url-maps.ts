/**
 * Riconosce URL di mappe / indicazioni (Google, Apple, Bing).
 * Fail-safe: URL ambigui → false (trattarli come landing generica).
 * Uso previsto: solo fork CTA AWARENESS (non altri objective).
 */
export function isUrlMapsIndicazioni(url: string | null | undefined): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;

  let host = "";
  let path = "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {
    return false;
  }

  if (host === "maps.app.goo.gl" || host.endsWith(".maps.app.goo.gl")) {
    return true;
  }
  if (host === "goo.gl" && path.startsWith("/maps")) {
    return true;
  }
  if (host === "maps.apple.com" || host.endsWith(".maps.apple.com")) {
    return true;
  }
  if (
    (host === "bing.com" || host.endsWith(".bing.com")) &&
    path.includes("/maps")
  ) {
    return true;
  }
  if (host === "maps.google.com" || host.startsWith("maps.google.")) {
    return true;
  }
  if (
    (host === "google.com" || host.endsWith(".google.com")) &&
    path.includes("/maps")
  ) {
    return true;
  }

  return false;
}
