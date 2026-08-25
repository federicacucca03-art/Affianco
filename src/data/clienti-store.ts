import type { BozzaCampagnaOnboarding, Cliente } from "@/types/clienti";
import { getClients, saveClient } from "@/utils/clientStorage";

const BOZZA_KEY = "affianco-bozza-campagna";

export function leggiClienti(): Cliente[] {
  return getClients();
}

export function aggiungiCliente(cliente: Omit<Cliente, "id">): Cliente {
  return saveClient(cliente);
}

export function salvaBozzaOnboarding(bozza: BozzaCampagnaOnboarding) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BOZZA_KEY, JSON.stringify(bozza));
  } catch {
    // Ignora errori di storage.
  }
}

export function leggiBozzaOnboarding(): BozzaCampagnaOnboarding | null {
  if (typeof window === "undefined") return null;
  try {
    const grezzo = window.sessionStorage.getItem(BOZZA_KEY);
    if (!grezzo) return null;
    return JSON.parse(grezzo) as BozzaCampagnaOnboarding;
  } catch {
    return null;
  }
}
