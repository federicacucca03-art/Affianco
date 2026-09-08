import type { TargetAgeBand, TargetType } from "@/types/campagne";
import {
  SETTORI_PRESETS,
  SETTORE_ALTRO_LABEL,
} from "@/data/settoriPresets";

/** Client sector is a display string: canonical catalog label, Altro, or legacy free-text. */
export type SettoreCliente = string;

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

/**
 * Onboarding select options — derived from the authoritative catalog only.
 * Not an independent taxonomy.
 */
export const SETTORI: string[] = [
  ...SETTORI_PRESETS.filter((p) => !p.id.startsWith("macro-")).map((p) => p.nome),
  SETTORE_ALTRO_LABEL,
];

export const clientiMock: Cliente[] = [
  {
    id: "rossi",
    nome: "Studio Dentistico Rossi",
    settore: "Studio dentistico",
    citta: "Roma",
  },
  {
    id: "kinesis",
    nome: "Palestra Kinesis",
    settore: "Palestra",
    citta: "Milano",
  },
];
