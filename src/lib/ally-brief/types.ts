/**
 * M9.3A — Ally brief → campaign proposal types.
 * Proposal only; no DB persistence of inferred fields.
 */

import type {
  CampagnaObjective,
  TargetAgeBand,
  TargetType,
} from "@/types/campagne";

export const ALLY_BRIEF_MAX_CHARS = 6_000;
/** Room for full structured field map; 1200 truncated mid-JSON in production. */
export const ALLY_BRIEF_MAX_TOKENS = 4_096;
export const ALLY_BRIEF_TIMEOUT_MS = 25_000;
export const ALLY_BRIEF_SESSION_KEY = "affianco-ally-brief-proposal-v1";

/** Friendly Italian copy for complete brief failures (single source). */
export const ALLY_BRIEF_FAILURE_MESSAGE =
  "Non riesco a preparare la configurazione in questo momento. Puoi riprovare o continuare manualmente.";

export type AllyBriefFailureCode =
  | "CONFIG"
  | "ANTHROPIC"
  | "PARSE"
  | "EMPTY"
  | "TIMEOUT"
  | "NOT_MEANINGFUL";

export type AllyBriefProvenance =
  | "EXISTING"
  | "EXPLICIT"
  | "INFERRED"
  | "WEBSITE"
  | "MISSING";

export type AllyBriefConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

/** Canonical wizard keys Ally may propose in M9.3A. */
export type AllyBriefFieldId =
  | "nomeCliente"
  | "settore"
  | "objective"
  | "frontEndOffer"
  | "elevatorPitch"
  | "citta"
  | "raggioKm"
  | "etaMin"
  | "etaMax"
  | "targetType"
  | "targetAge"
  | "budgetGiornaliero"
  | "sitoWeb"
  | "scontrinoMedio"
  | "tassoConversione"
  | "productMargin"
  | "targetMargin"
  | "maxSustainableCpa"
  | "pageId"
  | "formId"
  | "marketingAngle";

export type AllyBriefFieldValue = string | number | null;

export type AllyBriefField = {
  id: AllyBriefFieldId;
  label: string;
  value: AllyBriefFieldValue;
  provenance: AllyBriefProvenance;
  confidence: AllyBriefConfidence;
  /** Short note for review (e.g. conflict). */
  note: string | null;
};

export type AllyBriefExistingClientContext = {
  id: string;
  nome: string;
  settore: string | null;
  citta: string | null;
  sitoWeb: string | null;
  note: string | null;
  targetType: TargetType | null;
  targetAge: TargetAgeBand | null;
};

export type AllyBriefProposal = {
  summary: string;
  fields: AllyBriefField[];
  missingInformation: string[];
  assumptions: string[];
  /** Matched existing client id when reused (never created here). */
  matchedClienteId: string | null;
  fromAi: boolean;
};

export type AllyBriefRunResult =
  | {
      ok: true;
      proposal: AllyBriefProposal;
      aiCalls: 1;
      /** Soft website enrichment status for UI (null = no website attempted). */
      websiteStatus: "ok" | "unavailable" | "blocked" | "skipped" | null;
      websiteWarning: string | null;
    }
  | {
      ok: false;
      code: AllyBriefFailureCode;
      aiCalls: 0 | 1;
      websiteStatus?: "ok" | "unavailable" | "blocked" | "skipped" | null;
      websiteWarning?: string | null;
    };

/** Session payload after user accepts review (temporary setup state). */
export type AllyBriefAcceptedPayload = {
  version: 1;
  brief: string;
  acceptedAt: string;
  objective: CampagnaObjective;
  matchedClienteId: string | null;
  values: Partial<Record<AllyBriefFieldId, AllyBriefFieldValue>>;
};

export const ALLY_BRIEF_FIELD_LABELS: Record<AllyBriefFieldId, string> = {
  nomeCliente: "Cliente",
  settore: "Settore",
  objective: "Obiettivo",
  frontEndOffer: "Offerta",
  elevatorPitch: "Brief / contesto",
  citta: "Città",
  raggioKm: "Raggio (km)",
  etaMin: "Età minima",
  etaMax: "Età massima",
  targetType: "Tipo target",
  targetAge: "Fascia età",
  budgetGiornaliero: "Budget giornaliero",
  sitoWeb: "Sito web",
  scontrinoMedio: "Ticket / scontrino",
  tassoConversione: "Conversione lead→cliente (%)",
  productMargin: "Margine prodotto (%)",
  targetMargin: "Margine obiettivo (%)",
  maxSustainableCpa: "Soglia sostenibile",
  pageId: "Pagina Facebook",
  formId: "Modulo contatti",
  marketingAngle: "Angolo messaggio",
};

export function provenanceLabelIt(p: AllyBriefProvenance): string {
  switch (p) {
    case "EXISTING":
      return "Già in Ally";
    case "EXPLICIT":
      return "Dal brief";
    case "INFERRED":
      return "Proposto da Ally";
    case "WEBSITE":
      return "Dal sito";
    case "MISSING":
      return "Da completare";
  }
}

export const OBJECTIVES_CANONICI: CampagnaObjective[] = [
  "LEADS",
  "BOOKINGS",
  "ECOMMERCE",
  "IN_STORE",
  "RETARGETING",
  "AWARENESS",
];

export function objectiveLabelIt(o: CampagnaObjective): string {
  switch (o) {
    case "LEADS":
      return "Più richieste di contatto";
    case "BOOKINGS":
      return "Più prenotazioni";
    case "ECOMMERCE":
      return "Vendite online";
    case "IN_STORE":
      return "Traffico in negozio";
    case "RETARGETING":
      return "Recupero / retargeting";
    case "AWARENESS":
      return "Apertura / awareness";
  }
}
