import type { Campagna } from "@/types/campagne";
import { generaVariantiCopy } from "@/data/varianti-copy";
import { salvaAssetCampagnaLocale } from "@/data/campagne-assets-store";

/**
 * Se A/B/C mancano, le rigenera dal brief (e nome/città/settore).
 * Opzionalmente persiste in localStorage per le visite successive.
 */
export function assicuraVariantiCampagna(
  campagna: Campagna,
  opzioni?: { persistiLocale?: boolean },
): Campagna {
  const haA = Boolean(campagna.varianteA?.trim());
  const haB = Boolean(campagna.varianteB?.trim());
  const haC = Boolean(campagna.varianteC?.trim());
  if (haA && haB && haC) return campagna;

  const generate = generaVariantiCopy({
    settore: campagna.settore,
    nomeCliente: campagna.nomeCliente,
    citta: campagna.citta ?? "",
    elevatorPitch: campagna.elevatorPitch ?? "",
    objective: campagna.objective ?? "LEADS",
    frontEndOffer: campagna.frontEndOffer,
    targetType: campagna.targetType,
  });

  const aggiornata: Campagna = {
    ...campagna,
    varianteA: haA ? campagna.varianteA : generate[0].testo,
    varianteB: haB ? campagna.varianteB : generate[1].testo,
    varianteC: haC ? campagna.varianteC : generate[2].testo,
  };

  if (opzioni?.persistiLocale !== false) {
    salvaAssetCampagnaLocale(campagna.id, {
      varianteA: aggiornata.varianteA,
      varianteB: aggiornata.varianteB,
      varianteC: aggiornata.varianteC,
      elevatorPitch: campagna.elevatorPitch,
      settore: campagna.settore,
      citta: campagna.citta,
    });
  }

  return aggiornata;
}
