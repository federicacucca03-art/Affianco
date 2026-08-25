import type { CampagnaObjective, TargetAgeBand, TargetType } from "@/types/campagne";
import type { Cliente } from "@/types/clienti";

const CLIENTS_KEY = "affianco-client-memory-v1";
const CAMPAIGNS_KEY = "affianco-campaign-memory-v1";
const LEGACY_CLIENTS_KEY = "affianco-clienti";

export type ClientData = {
  id?: string;
  nome: string;
  settore?: string;
  citta?: string;
  targetType?: TargetType;
  targetAge?: TargetAgeBand;
  sitoWeb?: string;
  note?: string;
  storicoCampagne?: string[];
  preferito?: boolean;
};

export type CampaignData = {
  id?: string;
  clientId?: string | null;
  nomeCliente: string;
  nomeCampagna?: string;
  objective?: CampagnaObjective;
  settore?: string;
  citta?: string;
  status?: string;
  dataCreazione?: string;
  frontEndOffer?: string;
};

export type SavedCampaign = {
  id: string;
  clientId: string | null;
  nomeCliente: string;
  nomeCampagna: string;
  objective: CampagnaObjective;
  settore: string;
  citta: string;
  status: string;
  dataCreazione: string;
  frontEndOffer: string;
};

function storageDisponibile(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function leggiJson<T>(chiave: string, fallback: T): T {
  if (!storageDisponibile()) return fallback;
  try {
    const grezzo = window.localStorage.getItem(chiave);
    if (!grezzo) return fallback;
    return JSON.parse(grezzo) as T;
  } catch {
    return fallback;
  }
}

function scriviJson(chiave: string, valore: unknown): boolean {
  if (!storageDisponibile()) return false;
  try {
    window.localStorage.setItem(chiave, JSON.stringify(valore));
    return true;
  } catch {
    return false;
  }
}

function nuovoId(prefisso: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefisso}-${Date.now()}-${rand}`;
}

function normalizzaNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ");
}

function migraClientiLegacy(): Cliente[] {
  const legacy = leggiJson<Cliente[]>(LEGACY_CLIENTS_KEY, []);
  if (!Array.isArray(legacy) || legacy.length === 0) return [];
  const ora = new Date().toISOString();
  return legacy
    .filter((c) => c && typeof c.nome === "string" && c.nome.trim())
    .map((c) => ({
      id: c.id || nuovoId("cliente"),
      nome: c.nome.trim(),
      settore: (c.settore ?? "").trim(),
      citta: (c.citta ?? "").trim(),
      targetType: c.targetType,
      targetAge: c.targetAge,
      sitoWeb: c.sitoWeb ?? "",
      note: c.note ?? "",
      storicoCampagne: Array.isArray(c.storicoCampagne)
        ? c.storicoCampagne
        : [],
      preferito: c.preferito ?? true,
      createdAt: c.createdAt ?? ora,
      updatedAt: c.updatedAt ?? ora,
    }));
}

function leggiClientiInterni(): Cliente[] {
  const attuali = leggiJson<Cliente[]>(CLIENTS_KEY, []);
  if (Array.isArray(attuali) && attuali.length > 0) return attuali;
  const migrati = migraClientiLegacy();
  if (migrati.length > 0) scriviJson(CLIENTS_KEY, migrati);
  return migrati;
}

/** Lista clienti salvati (localStorage, vuota in SSR). */
export function getClients(): Cliente[] {
  return leggiClientiInterni().sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

export function getClientById(id: string): Cliente | null {
  return getClients().find((c) => c.id === id) ?? null;
}

/**
 * Salva o aggiorna una scheda cliente.
 * Match: id esplicito, altrimenti stesso nome (case-insensitive).
 */
export function saveClient(clientData: ClientData): Cliente {
  const ora = new Date().toISOString();
  const lista = leggiClientiInterni();
  const nome = (clientData.nome ?? "").trim();
  const idEsplicito = clientData.id?.trim();
  const indice = lista.findIndex((c) =>
    idEsplicito
      ? c.id === idEsplicito
      : normalizzaNome(c.nome) === normalizzaNome(nome),
  );

  if (indice >= 0) {
    const precedente = lista[indice];
    const aggiornato: Cliente = {
      ...precedente,
      nome: nome || precedente.nome,
      settore: clientData.settore ?? precedente.settore,
      citta: clientData.citta ?? precedente.citta,
      targetType: clientData.targetType ?? precedente.targetType,
      targetAge: clientData.targetAge ?? precedente.targetAge,
      sitoWeb: clientData.sitoWeb ?? precedente.sitoWeb,
      note: clientData.note ?? precedente.note,
      storicoCampagne: clientData.storicoCampagne ?? precedente.storicoCampagne,
      preferito: clientData.preferito ?? precedente.preferito ?? true,
      updatedAt: ora,
    };
    const prossima = [...lista];
    prossima[indice] = aggiornato;
    scriviJson(CLIENTS_KEY, prossima);
    return aggiornato;
  }

  const nuovo: Cliente = {
    id: idEsplicito || nuovoId("cliente"),
    nome: nome || "Nuovo cliente",
    settore: (clientData.settore ?? "").trim(),
    citta: (clientData.citta ?? "").trim(),
    targetType: clientData.targetType ?? "B2C",
    targetAge: clientData.targetAge ?? "25-50",
    sitoWeb: (clientData.sitoWeb ?? "").trim(),
    note: (clientData.note ?? "").trim(),
    storicoCampagne: clientData.storicoCampagne ?? [],
    preferito: clientData.preferito ?? true,
    createdAt: ora,
    updatedAt: ora,
  };
  scriviJson(CLIENTS_KEY, [nuovo, ...lista]);
  return nuovo;
}

function leggiCampagneInterne(): SavedCampaign[] {
  const grezzo = leggiJson<SavedCampaign[]>(CAMPAIGNS_KEY, []);
  if (!Array.isArray(grezzo)) return [];
  return grezzo.filter((c) => c && typeof c.id === "string");
}

/** Storico campagne create in app (localStorage). */
export function getCampaigns(): SavedCampaign[] {
  return leggiCampagneInterne().sort((a, b) =>
    (b.dataCreazione ?? "").localeCompare(a.dataCreazione ?? ""),
  );
}

/** Salva la campagna e la collega allo storico del cliente. */
export function saveCampaign(campaignData: CampaignData): SavedCampaign {
  const ora = new Date().toISOString();
  const lista = leggiCampagneInterne();
  const id = campaignData.id?.trim() || nuovoId("campagna");
  const record: SavedCampaign = {
    id,
    clientId: campaignData.clientId ?? null,
    nomeCliente: (campaignData.nomeCliente ?? "").trim() || "Nuovo cliente",
    nomeCampagna:
      (campaignData.nomeCampagna ?? "").trim() ||
      `${campaignData.nomeCliente} - Campagna`,
    objective: campaignData.objective ?? "LEADS",
    settore: (campaignData.settore ?? "").trim(),
    citta: (campaignData.citta ?? "").trim(),
    status: (campaignData.status ?? "DRAFT").trim() || "DRAFT",
    dataCreazione: campaignData.dataCreazione ?? ora,
    frontEndOffer: (campaignData.frontEndOffer ?? "").trim(),
  };

  const indice = lista.findIndex((c) => c.id === record.id);
  const prossima =
    indice >= 0
      ? lista.map((c, i) => (i === indice ? record : c))
      : [record, ...lista];
  scriviJson(CAMPAIGNS_KEY, prossima);

  if (record.clientId) {
    const cliente = getClientById(record.clientId);
    if (cliente) {
      const storico = new Set(cliente.storicoCampagne ?? []);
      storico.add(record.id);
      saveClient({
        ...cliente,
        storicoCampagne: [...storico],
      });
    }
  }

  return record;
}

export function cercaClienti(query: string, limite = 8): Cliente[] {
  const q = query.trim().toLowerCase();
  const tutti = getClients();
  if (!q) return tutti.slice(0, limite);
  return tutti
    .filter((c) => {
      const corpus = `${c.nome} ${c.settore} ${c.citta}`.toLowerCase();
      return corpus.includes(q);
    })
    .slice(0, limite);
}
