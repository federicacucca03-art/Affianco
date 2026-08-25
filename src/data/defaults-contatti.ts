import type { ConfigurazioneContatti } from "@/types/campagne";
import { generaVariantiCopy } from "@/data/varianti-copy";

export function meseAnnoCorrente(data = new Date()): string {
  const grezzo = data.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
  return grezzo.charAt(0).toUpperCase() + grezzo.slice(1);
}

export function nomeCampagnaContatti(
  nomeCliente: string,
  data = new Date(),
): string {
  const cliente = nomeCliente.trim() || "Nome cliente";
  return `${cliente} - Richieste Contatto - ${meseAnnoCorrente(data)}`;
}

export function nomeCampagnaPrenotazioni(
  nomeCliente: string,
  data = new Date(),
): string {
  const cliente = nomeCliente.trim() || "Nome cliente";
  return `${cliente} - Prenotazioni - ${meseAnnoCorrente(data)}`;
}

export function nomeCampagnaEcommerce(
  nomeCliente: string,
  data = new Date(),
): string {
  const cliente = nomeCliente.trim() || "Nome cliente";
  return `${cliente} - Vendite Online - ${meseAnnoCorrente(data)}`;
}

export function nomeCampagnaInStore(
  nomeCliente: string,
  data = new Date(),
): string {
  const cliente = nomeCliente.trim() || "Nome cliente";
  return `${cliente} - Traffico Negozio - ${meseAnnoCorrente(data)}`;
}

export function nomeCampagnaRetargeting(
  nomeCliente: string,
  data = new Date(),
): string {
  const cliente = nomeCliente.trim() || "Nome cliente";
  return `${cliente} - Retargeting / Recupero - ${meseAnnoCorrente(data)}`;
}

export function nomeCampagnaAwareness(
  nomeCliente: string,
  data = new Date(),
): string {
  const cliente = nomeCliente.trim() || "Nome cliente";
  return `${cliente} - Apertura / Lancio - ${meseAnnoCorrente(data)}`;
}

const variantiDefault = generaVariantiCopy("servizi locali", "", "");

export const defaultConfigurazioneContatti: ConfigurazioneContatti = {
  nomeCliente: "",
  nomeCampagna: nomeCampagnaContatti(""),
  budgetGiornaliero: 20,
  cboAttivo: true,
  raggioKm: 15,
  etaMin: 30,
  etaMax: 65,
  genere: "Tutti",
  targetingBroad: true,
  posizionamentiAdvantage: true,
  varianteA: variantiDefault[0].testo,
  varianteB: variantiDefault[1].testo,
  varianteC: variantiDefault[2].testo,
  titoloAnnuncio: "",
  scontrinoMedio: 0,
  tassoConversionePercent: 10,
};

export { stimaBenchmark } from "@/data/benchmarks";
