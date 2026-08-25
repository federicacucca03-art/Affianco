import type { CampagnaObjective } from "@/types/campagne";

export type FaseApprendimento = "in_corso" | "completata" | "limitata";

export type VerdettoScreenshot =
  | "ottimo"
  | "in_target"
  | "fuori_target"
  | "dati_insufficienti";

export type ScreenshotAnalysisResult = {
  spesaTotale: number;
  risultati: number;
  tipoRisultato: string;
  costoPerRisultato: number;
  ctr: number;
  frequenza: number;
  cpm: number;
  roas: number | null;
  faseApprendimento: FaseApprendimento;
  verdetto: VerdettoScreenshot;
  spiegazioneSostenibilita: string;
  azioniConsigliate: string[];
};

export type SavedCampaignResult = {
  id: string;
  campagnaId: string | null;
  nomeCampagna: string;
  nomeCliente: string;
  obiettivo: CampagnaObjective;
  settore: string;
  targetCpl: number;
  giorniAttiva: number;
  analisi: ScreenshotAnalysisResult;
  salvatoIl: string;
};

export type AnalyzeScreenshotBody = {
  image: string;
  targetCpl?: number;
  obiettivo?: string;
  settore?: string;
  giorniAttiva?: number;
  nomeCampagna?: string;
  nomeCliente?: string;
};
