import type { CampagnaObjective } from "@/types/campagne";

export type CreativitaRuolo =
  | "principale"
  | "variante2"
  | "variante3"
  | "variante4"
  | "variante5";

/** Formato creativo dedicato E-commerce (Passo 4). */
export type EcommerceCreativoFormato = "SINGLE" | "CAROUSEL" | "VIDEO";

export type CreativitaAsset = {
  id: string;
  /** Object URL o data URL per anteprima. */
  url: string;
  nomeFile: string;
  width: number;
  height: number;
  ruolo: CreativitaRuolo;
  /** true se aspect ratio non è ottimale (1:1, 4:5 o 9:16). */
  avvisoFormato: boolean;
  /** true se formato landscape / orizzontale (es. 16:9). */
  formatoOrizzontale: boolean;
  /** true se asset video (UGC / unboxing). */
  isVideo?: boolean;
};

/** Metadata persistibile (senza blob). */
export type CreativitaMeta = {
  id: string;
  nomeFile: string;
  width: number;
  height: number;
  ruolo: CreativitaRuolo;
  avvisoFormato: boolean;
  formatoOrizzontale?: boolean;
  isVideo?: boolean;
  /** Path privato in Supabase Storage (signed URL generato server-side). */
  storagePath?: string;
};

export const ETICHETTE_CREATIVITA: Record<CreativitaRuolo, string> = {
  principale: "Creatività 1 — Principale",
  variante2: "Creatività 2 — Variante",
  variante3: "Creatività 3 — Variante",
  variante4: "Creatività 4 — Variante",
  variante5: "Creatività 5 — Variante",
};

export const ETICHETTE_CREATIVITA_BOOKINGS: Record<CreativitaRuolo, string> = {
  principale: "Foto 1 — Principale",
  variante2: "Foto 2 — Variante Staff",
  variante3: "Foto 3 — Variante Struttura",
  variante4: "Foto 4 — Extra",
  variante5: "Foto 5 — Extra",
};

export const ETICHETTE_CREATIVITA_ECOMMERCE_CAROSELLO: Record<
  CreativitaRuolo,
  string
> = {
  principale: "Scheda 1 — Prodotto",
  variante2: "Scheda 2 — Prodotto",
  variante3: "Scheda 3 — Prodotto",
  variante4: "Scheda 4 — Prodotto",
  variante5: "Scheda 5 — Prodotto",
};

export const RUOLI_IN_ORDINE: CreativitaRuolo[] = [
  "principale",
  "variante2",
  "variante3",
  "variante4",
  "variante5",
];

const TOLLERANZA_QUADRATO = 0.08;
const TOLLERANZA_STORIES = 0.05;
const TOLLERANZA_45 = 0.06;
const RATIO_STORIES = 9 / 16;
const RATIO_45 = 4 / 5;
/** Soglia landscape: ratio > 1.25 (16:9 ≈ 1.78). */
const SOGLIA_ORIZZONTALE = 1.25;

function usaFormatiAvanzati(objective?: CampagnaObjective): boolean {
  return (
    objective === "ECOMMERCE" ||
    objective === "IN_STORE" ||
    objective === "RETARGETING" ||
    objective === "AWARENESS"
  );
}

export function etichetteCreativitaPerObiettivo(
  objective?: CampagnaObjective,
  formatoEcommerce?: EcommerceCreativoFormato,
): Record<CreativitaRuolo, string> {
  if (objective === "ECOMMERCE" && formatoEcommerce === "CAROUSEL") {
    return ETICHETTE_CREATIVITA_ECOMMERCE_CAROSELLO;
  }
  if (objective === "BOOKINGS") return ETICHETTE_CREATIVITA_BOOKINGS;
  if (objective === "ECOMMERCE") {
    return {
      ...ETICHETTE_CREATIVITA,
      principale: "Creatività 1 — Prodotto Hero",
      variante2: "Creatività 2 — Variante",
      variante3: "Creatività 3 — Variante",
    };
  }
  return ETICHETTE_CREATIVITA;
}

/** Limite upload in base a obiettivo / formato e-commerce. */
export function maxCreativitaPerContesto(
  objective?: CampagnaObjective,
  formatoEcommerce?: EcommerceCreativoFormato,
): number {
  if (usaFormatiAvanzati(objective)) {
    if (formatoEcommerce === "CAROUSEL") return 5;
    if (formatoEcommerce === "VIDEO") return 1;
    return 3;
  }
  return 3;
}

export function minCreativitaPerContesto(
  objective?: CampagnaObjective,
  formatoEcommerce?: EcommerceCreativoFormato,
): number {
  if (usaFormatiAvanzati(objective) && formatoEcommerce === "CAROUSEL") {
    return 3;
  }
  return 1;
}

/**
 * true se il formato è accettabile (1:1, 4:5 Feed o 9:16 Stories/Reels).
 */
export function aspectRatioMetaOk(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  const isQuadrato = Math.abs(ratio - 1) <= TOLLERANZA_QUADRATO;
  const isStories = Math.abs(ratio - RATIO_STORIES) <= TOLLERANZA_STORIES;
  const is45 = Math.abs(ratio - RATIO_45) <= TOLLERANZA_45;
  return isQuadrato || isStories || is45;
}

/** true se l'immagine è in formato landscape (es. 16:9). */
export function aspectRatioOrizzontale(width: number, height: number): boolean {
  if (!width || !height) return false;
  return width / height > SOGLIA_ORIZZONTALE;
}

export function analizzaFormatoImmagine(
  width: number,
  height: number,
): { ok: boolean; orizzontale: boolean } {
  const orizzontale = aspectRatioOrizzontale(width, height);
  const ok = aspectRatioMetaOk(width, height);
  return { ok, orizzontale };
}

export function leggiDimensioniImmagine(
  file: File,
): Promise<{ width: number; height: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        url,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere l'immagine."));
    };
    img.src = url;
  });
}

export function prossimoRuolo(
  esistenti: { ruolo: CreativitaRuolo }[],
  maxRuoli: number = 3,
): CreativitaRuolo | null {
  const disponibili = RUOLI_IN_ORDINE.slice(0, Math.max(1, Math.min(5, maxRuoli)));
  for (const ruolo of disponibili) {
    if (!esistenti.some((c) => c.ruolo === ruolo)) return ruolo;
  }
  return null;
}

export function creativitaToMeta(lista: CreativitaAsset[]): CreativitaMeta[] {
  return lista.map((c) => ({
    id: c.id,
    nomeFile: c.nomeFile,
    width: c.width,
    height: c.height,
    ruolo: c.ruolo,
    avvisoFormato: c.avvisoFormato,
    formatoOrizzontale: c.formatoOrizzontale,
    isVideo: c.isVideo,
  }));
}

/** Dimensioni video (thumbnail frame non sempre disponibile → 1080×1080 nominali). */
export function leggiDimensioniVideo(
  file: File,
): Promise<{ width: number; height: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth || 1080,
        height: video.videoHeight || 1080,
        url,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere il video."));
    };
    video.src = url;
  });
}
