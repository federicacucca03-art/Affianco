import type { Campagna } from "@/types/campagne";

function inizialiDaNome(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "??";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return `${parti[0][0]}${parti[parti.length - 1][0]}`.toUpperCase();
}

export type DatiLancioCampagna = {
  nomeCliente: string;
  nomeCampagna?: string;
  settore?: string;
  citta?: string;
  budgetGiornaliero?: number;
  scontrinoMedio?: number;
  tassoConversionePercent?: number;
};

/** @deprecated Preferisci salvaCampagnaCompleta / leggiCampagneDaSupabase. */
export function aggiungiCampagnaLanciata(
  dati: DatiLancioCampagna | string,
): Campagna {
  const payload = typeof dati === "string" ? { nomeCliente: dati } : dati;
  const nome = payload.nomeCliente.trim() || "Nuovo cliente";
  const oggi = new Date();

  return {
    id: `locale-${Date.now()}`,
    nomeCliente: nome,
    iniziali: inizialiDaNome(nome),
    stato: "Attiva da oggi · 0 contatti",
    giudizio: "Ancora presto",
    nomeCampagna:
      payload.nomeCampagna?.trim() || `${nome} - Richieste Contatto`,
    settore: payload.settore,
    citta: payload.citta,
    budgetGiornaliero: payload.budgetGiornaliero,
    dataLancio: oggi.toISOString(),
    scontrinoMedio: payload.scontrinoMedio,
    tassoConversionePercent: payload.tassoConversionePercent,
  };
}

/** Giorni di attività dalla data di lancio o dallo stato testuale. */
export function giorniAttiviDaCampagna(campagna: Campagna): number {
  if (campagna.dataLancio) {
    const lancio = new Date(campagna.dataLancio).getTime();
    if (Number.isFinite(lancio)) {
      const diff = Date.now() - lancio;
      return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }
  }

  const match = campagna.stato.match(/(\d+)\s*giorn/i);
  if (match) return Number(match[1]) || 0;
  if (/oggi/i.test(campagna.stato)) return 0;
  return 3;
}
