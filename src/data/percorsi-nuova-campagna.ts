import type { CampagnaObjective } from "@/types/campagne";
import { risolviSlugWizardStep1 } from "@/data/wizard-step1-config";
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

/** Rotta wizard canonica per obiettivo (niente alias di redirect). */
export function rottaWizardDaObjective(
  objective?: CampagnaObjective | null,
): string {
  const slug = risolviSlugWizardStep1("", objective ?? "LEADS");
  return `/campagne/nuova/${slug}`;
}

export function hrefModificaConfigurazione(
  campaignId: string,
  objective?: CampagnaObjective | null,
): string {
  const id = campaignId.trim();
  return `${rottaWizardDaObjective(objective)}?campaignId=${encodeURIComponent(id)}`;
}
