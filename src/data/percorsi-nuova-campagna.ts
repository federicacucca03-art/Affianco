import type { SituazioneId } from "@/types/campagne";

/** Rotte `/campagne/nuova/...` per ogni scheda situazione. */
export const ROTTE_NUOVA_CAMPAGNA: Record<SituazioneId, string> = {
  contatti: "/campagne/nuova/richieste-contatto",
  prenotazioni: "/campagne/nuova/prenotazioni",
  vendite: "/campagne/nuova/vendite",
  negozio: "/campagne/nuova/instore",
  recupero: "/campagne/nuova/retargeting",
  apertura: "/campagne/nuova/apertura",
};
