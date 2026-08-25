import type { TargetAgeBand, TargetType } from "@/types/campagne";

export type SettoreCliente =
  | "Dentista"
  | "Estetista"
  | "Palestra"
  | "Ristorante"
  | "Artigiano/Attività Locale"
  | "Servizi locali / Agenzia / Broker";

export type Cliente = {
  id: string;
  nome: string;
  settore: string;
  citta: string;
  targetType?: TargetType;
  targetAge?: TargetAgeBand;
  sitoWeb?: string;
  note?: string;
  storicoCampagne?: string[];
  preferito?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BozzaCampagnaOnboarding = {
  clienteId: string;
  nomeCliente: string;
  nomeCampagna: string;
  settore: string;
  citta: string;
  sitoWeb?: string;
  note?: string;
  targetType?: TargetType;
  targetAge?: TargetAgeBand;
};

export const SETTORI: SettoreCliente[] = [
  "Dentista",
  "Estetista",
  "Palestra",
  "Ristorante",
  "Artigiano/Attività Locale",
  "Servizi locali / Agenzia / Broker",
];

export const clientiMock: Cliente[] = [
  {
    id: "rossi",
    nome: "Studio Dentistico Rossi",
    settore: "Dentista",
    citta: "Roma",
  },
  {
    id: "kinesis",
    nome: "Palestra Kinesis",
    settore: "Palestra",
    citta: "Milano",
  },
];
