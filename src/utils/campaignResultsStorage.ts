import type { SavedCampaignResult } from "@/types/screenshot-analysis";

const STORAGE_KEY = "saved_campaign_results";

function storageDisponibile(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function nuovoId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `diag-${Date.now()}-${rand}`;
}

export function getSavedCampaignResults(): SavedCampaignResult[] {
  if (!storageDisponibile()) return [];
  try {
    const grezzo = window.localStorage.getItem(STORAGE_KEY);
    if (!grezzo) return [];
    const parsed = JSON.parse(grezzo) as SavedCampaignResult[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) =>
      (b.salvatoIl ?? "").localeCompare(a.salvatoIl ?? ""),
    );
  } catch {
    return [];
  }
}

export function saveCampaignResult(
  input: Omit<SavedCampaignResult, "id" | "salvatoIl"> & {
    id?: string;
    salvatoIl?: string;
  },
): SavedCampaignResult {
  const record: SavedCampaignResult = {
    ...input,
    id: input.id ?? nuovoId(),
    salvatoIl: input.salvatoIl ?? new Date().toISOString(),
  };
  if (!storageDisponibile()) return record;
  try {
    const lista = getSavedCampaignResults().filter((r) => r.id !== record.id);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([record, ...lista]),
    );
  } catch {
    // Ignora errori quota / private mode.
  }
  return record;
}
