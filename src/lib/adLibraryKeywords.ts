import { risolviSettoreIntel } from "@/lib/sector-intel";

/** Keyword commerciali ad alta precisione per la Meta Ad Library (con virgolette incluse). */
const KEYWORD_BY_PRESET_ID: Record<string, string> = {
  "scuola-guida": "Autoscuola",
  dentista: "Studio Dentistico",
  implantologia: "Studio Dentistico",
  ortodonzia: "Studio Dentistico",
  ristrutturazioni: "Ristrutturazione Casa",
  edilizia: "Ristrutturazione Casa",
  infissi: "Ristrutturazione Casa",
  ristorante: "Prenota Tavolo",
  pizzeria: "Prenota Tavolo",
  trattoria: "Prenota Tavolo",
  palestra: "Abbonamento Palestra",
  crossfit: "Abbonamento Palestra",
  skincare: "Crema Viso",
  cosmetica: "Crema Viso",
};

const PATTERN_KEYWORD: { pattern: RegExp; keyword: string }[] = [
  { pattern: /scuol[aà]\s*guida|autoscuol|patente/i, keyword: "Autoscuola" },
  {
    pattern: /dentist|odontoiat|implantolog|ortodonz/i,
    keyword: "Studio Dentistico",
  },
  {
    pattern: /ristruttur|ediliz|infiss|idraul|elettricist|imbianc/i,
    keyword: "Ristrutturazione Casa",
  },
  {
    pattern: /ristor|pizzer|trattoria|bar\b|food|prenota\s*tavol/i,
    keyword: "Prenota Tavolo",
  },
  {
    pattern: /palestr|fitness|crossfit|personal\s*train|yoga|pilates/i,
    keyword: "Abbonamento Palestra",
  },
  {
    pattern: /skincare|crema\s*viso|cosmet|beauty\s*e-?commerce|dermo/i,
    keyword: "Crema Viso",
  },
];

function keywordDaPresetId(presetId: string): string | null {
  return KEYWORD_BY_PRESET_ID[presetId] ?? null;
}

function keywordDaPattern(settore: string): string | null {
  for (const { pattern, keyword } of PATTERN_KEYWORD) {
    if (pattern.test(settore)) return keyword;
  }
  return null;
}

/** Restituisce la keyword tra virgolette per la ricerca Meta Ad Library. */
export function keywordAdLibraryDaSettore(settore: string): string {
  const raw = settore.trim();
  if (!raw) return '"servizi locali"';

  const intel = risolviSettoreIntel(raw);
  if (intel) {
    const daPreset = keywordDaPresetId(intel.id);
    if (daPreset) return `"${daPreset}"`;
  }

  const daPattern = keywordDaPattern(raw);
  if (daPattern) return `"${daPattern}"`;

  return `"${raw}"`;
}

/** URL Meta Ad Library con annunci attivi e keyword specialistica. */
export function urlMetaAdLibraryDaSettore(settore: string): string {
  const q = encodeURIComponent(keywordAdLibraryDaSettore(settore));
  return `https://www.facebook.com/ads/library/?active_status=ACTIVE&ad_type=all&country=IT&media_type=all&q=${q}&search_type=keyword_unordered`;
}
