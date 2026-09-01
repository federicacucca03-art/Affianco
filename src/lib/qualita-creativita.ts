/**
 * Qualità deterministica Step 4 (formato / adattabilità Meta).
 * Calcolata al volo, non persistita. Nessuna AI, nessuna vision, nessun OCR.
 *
 * Debito separato (non in questo slice): i tag catalogo in curatedFormats.ts
 * («Alto CTR», «Longevità >60gg», «Conversione Diretta») restano copy di
 * prodotto, non guidance.
 */

import {
  aspectRatioMetaOk,
  aspectRatioOrizzontale,
  aspectRatioStoriesOk,
} from "@/lib/creativita";
import type { CampagnaObjective } from "@/types/campagne";

export type CreativeGuidanceLevel = "INFO" | "SUGGESTION" | "WARNING";

export type CreativeGuidanceItem = {
  id: string;
  level: CreativeGuidanceLevel;
  title: string;
  description: string;
  field: string;
  step: 4;
};

export type CreativeFormatSnapshot = {
  width: number;
  height: number;
  isVideo?: boolean;
};

export type QualitaCreativitaInput = {
  creativita: CreativeFormatSnapshot[];
  objective?: CampagnaObjective | null;
};

export const ID_CREATIVE_ASSET_ASSENTE = "creative-asset-assente";
export const ID_CREATIVE_RATIO_NON_IDEALE = "creative-ratio-non-ideale";
export const ID_CREATIVE_LANDSCAPE = "creative-landscape";
export const ID_CREATIVE_MANCA_9_16 = "creative-manca-9-16";

function isPercorsoLead(objective?: CampagnaObjective | null): boolean {
  return !objective || objective === "LEADS";
}

function immagini(assets: CreativeFormatSnapshot[]): CreativeFormatSnapshot[] {
  return assets.filter((a) => !a.isVideo);
}

/**
 * Allineato a pre-lancio: il video conta come copertura Stories/Reels.
 * Non duplica soglie: usa `aspectRatioStoriesOk`.
 */
export function assetHaFormatoStories(asset: CreativeFormatSnapshot): boolean {
  if (asset.isVideo) return true;
  return aspectRatioStoriesOk(asset.width, asset.height);
}

export function creativitaAssente(
  creativita: CreativeFormatSnapshot[],
  objective?: CampagnaObjective | null,
): boolean {
  return isPercorsoLead(objective) && creativita.length === 0;
}

export function mancaFormato916(creativita: CreativeFormatSnapshot[]): boolean {
  if (creativita.length === 0) return false;
  return !creativita.some(assetHaFormatoStories);
}

export function haFormatoOrizzontale(
  creativita: CreativeFormatSnapshot[],
): boolean {
  return immagini(creativita).some((a) =>
    aspectRatioOrizzontale(a.width, a.height),
  );
}

/**
 * Ratio fuori da 1:1 / 4:5 / 9:16, e non già coperto da landscape
 * (il landscape ha guidance dedicata).
 */
export function haRatioNonIdeale(
  creativita: CreativeFormatSnapshot[],
): boolean {
  return immagini(creativita).some((a) => {
    if (aspectRatioMetaOk(a.width, a.height)) return false;
    if (aspectRatioOrizzontale(a.width, a.height)) return false;
    return true;
  });
}

export function generaGuidanceCreativita(
  input: QualitaCreativitaInput,
): CreativeGuidanceItem[] {
  const assets = input.creativita ?? [];
  const items: CreativeGuidanceItem[] = [];

  if (creativitaAssente(assets, input.objective)) {
    items.push({
      id: ID_CREATIVE_ASSET_ASSENTE,
      level: "SUGGESTION",
      title: "Aggiungi una creatività.",
      description:
        "Puoi continuare, ma una creatività pronta rende la campagna più completa prima dell'esportazione.",
      field: "creativita",
      step: 4,
    });
  }

  if (haRatioNonIdeale(assets)) {
    items.push({
      id: ID_CREATIVE_RATIO_NON_IDEALE,
      level: "SUGGESTION",
      title: "Il formato può essere adattato meglio.",
      description:
        "Prepara una versione 1:1, 4:5 o 9:16 per ridurre i ritagli nei principali posizionamenti.",
      field: "creativita",
      step: 4,
    });
  }

  if (haFormatoOrizzontale(assets)) {
    items.push({
      id: ID_CREATIVE_LANDSCAPE,
      level: "SUGGESTION",
      title: "Il formato è molto orizzontale.",
      description:
        "Verifica di avere anche una versione adatta ai posizionamenti verticali e feed mobile.",
      field: "creativita",
      step: 4,
    });
  }

  if (mancaFormato916(assets)) {
    items.push({
      id: ID_CREATIVE_MANCA_9_16,
      level: "SUGGESTION",
      title: "Ti manca una versione verticale.",
      description:
        "Prepara anche un formato 9:16 per adattare la creatività a Stories e Reels.",
      field: "creativita",
      step: 4,
    });
  }

  return items;
}
