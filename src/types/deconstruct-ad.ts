export type CopioneAdattato = {
  titoloVisual: string;
  scriptVideo: string;
  istruzioniPerCliente: string;
};

export type DeconstructAdResult = {
  hookVisivo: string;
  angoloPsicologico: string;
  strutturaCopy: string;
  copioneAdattato: CopioneAdattato;
};

export type DeconstructAdBody = {
  image: string;
  nomeAzienda?: string;
  settore?: string;
  offerta?: string;
  targetCpl?: number;
};
