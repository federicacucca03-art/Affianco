import { supabase } from "@/lib/supabase";

export type CampaignLogEventType =
  | "CREATED"
  | "APPROVED"
  | "EXPORTED"
  | "METRICS_UPDATED"
  | "DIAGNOSIS_CHANGED"
  | "NOTE_ADDED"
  | "UPDATED";

export type CampaignLog = {
  id: string;
  campaignId: string;
  eventType: CampaignLogEventType;
  title: string;
  description: string;
  createdAt: string;
};

type CampaignLogRow = {
  id: string;
  campaign_id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
};

const STORAGE_KEY = "affianco.campaign_logs.v1";

const EVENTI_VALIDI: CampaignLogEventType[] = [
  "CREATED",
  "APPROVED",
  "EXPORTED",
  "METRICS_UPDATED",
  "DIAGNOSIS_CHANGED",
  "NOTE_ADDED",
  "UPDATED",
];

function isEventType(valore: string): valore is CampaignLogEventType {
  return EVENTI_VALIDI.includes(valore as CampaignLogEventType);
}

function mappaDaRow(row: CampaignLogRow): CampaignLog | null {
  if (!isEventType(row.event_type)) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description ?? "",
    createdAt: row.created_at,
  };
}

function leggiLocaleAll(): Record<string, CampaignLog[]> {
  if (typeof window === "undefined") return {};
  try {
    const grezzo = window.localStorage.getItem(STORAGE_KEY);
    if (!grezzo) return {};
    const parsed = JSON.parse(grezzo) as Record<string, CampaignLog[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function salvaLocaleAll(mappa: Record<string, CampaignLog[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mappa));
  } catch {
    // Quota o privacy mode: ignora.
  }
}

function aggiungiLocale(log: CampaignLog) {
  const mappa = leggiLocaleAll();
  const lista = mappa[log.campaignId] ?? [];
  if (lista.some((l) => l.id === log.id)) return;
  mappa[log.campaignId] = [log, ...lista];
  salvaLocaleAll(mappa);
}

function leggiLocale(campaignId: string): CampaignLog[] {
  return leggiLocaleAll()[campaignId] ?? [];
}

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function unisciLog(
  remoti: CampaignLog[],
  locali: CampaignLog[],
): CampaignLog[] {
  const byId = new Map<string, CampaignLog>();
  for (const log of [...remoti, ...locali]) {
    byId.set(log.id, log);
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export type NuovoCampaignLog = {
  campaignId: string;
  eventType: CampaignLogEventType;
  title: string;
  description?: string;
};

/** Registra un evento nel diario (Supabase + fallback locale). */
export async function registraEventoCampagna(
  input: NuovoCampaignLog,
): Promise<CampaignLog> {
  const description = (input.description ?? "").trim();
  const title = input.title.trim();
  const locale: CampaignLog = {
    id: nuovoId(),
    campaignId: input.campaignId,
    eventType: input.eventType,
    title,
    description,
    createdAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("campaign_logs")
      .insert({
        campaign_id: input.campaignId,
        event_type: input.eventType,
        title,
        description: description || null,
      })
      .select("id, campaign_id, event_type, title, description, created_at")
      .single();

    if (!error && data) {
      const mappato = mappaDaRow(data as CampaignLogRow);
      if (mappato) {
        aggiungiLocale(mappato);
        return mappato;
      }
    }
  } catch {
    // Fallback locale sotto.
  }

  aggiungiLocale(locale);
  return locale;
}

/** Carica il diario cronologico (più recente prima). */
export async function leggiLogCampagna(
  campaignId: string,
): Promise<CampaignLog[]> {
  const locali = leggiLocale(campaignId);
  try {
    const { data, error } = await supabase
      .from("campaign_logs")
      .select("id, campaign_id, event_type, title, description, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const remoti = (data as CampaignLogRow[])
        .map(mappaDaRow)
        .filter((l): l is CampaignLog => Boolean(l));
      const uniti = unisciLog(remoti, locali);
      // Allinea cache locale alla vista unificata.
      const mappa = leggiLocaleAll();
      mappa[campaignId] = uniti;
      salvaLocaleAll(mappa);
      return uniti;
    }
  } catch {
    // Usa solo locale.
  }
  return [...locali].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function etichettaEvento(tipo: CampaignLogEventType): string {
  switch (tipo) {
    case "CREATED":
      return "Creazione";
    case "APPROVED":
      return "Approvazione";
    case "EXPORTED":
      return "Export Meta";
    case "METRICS_UPDATED":
      return "Metriche";
    case "DIAGNOSIS_CHANGED":
      return "Diagnosi";
    case "NOTE_ADDED":
      return "Nota";
    case "UPDATED":
      return "Aggiornamento";
    default:
      return "Evento";
  }
}

export function emojiEvento(tipo: CampaignLogEventType): string {
  switch (tipo) {
    case "CREATED":
      return "🆕";
    case "APPROVED":
      return "✅";
    case "EXPORTED":
      return "🚀";
    case "METRICS_UPDATED":
      return "📊";
    case "DIAGNOSIS_CHANGED":
      return "🩺";
    case "NOTE_ADDED":
      return "📝";
    case "UPDATED":
      return "✏️";
    default:
      return "•";
  }
}

export function stileBadgeEvento(tipo: CampaignLogEventType): string {
  switch (tipo) {
    case "CREATED":
      return "bg-[#E8F0FE] text-[#3B6EA5]";
    case "APPROVED":
      return "bg-[#E8F5EE] text-[#3D8B57]";
    case "EXPORTED":
      return "bg-[#E8F1FB] text-[#3A5A7A]";
    case "METRICS_UPDATED":
      return "bg-[#FFF6E5] text-[#9A6700]";
    case "DIAGNOSIS_CHANGED":
      return "bg-[#FFF0F0] text-[#C45C5C]";
    case "NOTE_ADDED":
      return "bg-[var(--surface-hover)] text-[var(--ink)]";
    case "UPDATED":
      return "bg-[#F3EEFF] text-[#5B4B8A]";
    default:
      return "bg-[var(--surface-hover)] text-[var(--ink-muted)]";
  }
}

export function formatDataOraLog(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Testo sintetico da inviare al cliente (trasparenza lavoro svolto). */
export function generaTestoStoricoAttivita(opzioni: {
  nomeCliente: string;
  nomeCampagna: string;
  logs: CampaignLog[];
}): string {
  const nome = opzioni.nomeCliente.trim() || "Cliente";
  const campagna = opzioni.nomeCampagna.trim() || "la campagna";
  const logs = [...opzioni.logs].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  if (logs.length === 0) {
    return (
      `Ciao ${nome}! 👋\n` +
      `Ecco lo storico attività sulla campagna ${campagna}:\n` +
      `• Ancora nessun evento registrato.`
    );
  }

  const righe = logs.map((log) => {
    const quando = formatDataOraLog(log.createdAt);
    const desc = log.description.trim()
      ? `\n  ${log.description.trim()}`
      : "";
    return `• ${quando} — ${emojiEvento(log.eventType)} ${log.title}${desc}`;
  });

  return (
    `Ciao ${nome}! 👋\n` +
    `Ecco lo storico attività sulla campagna ${campagna} — trasparenza su tutto il lavoro svolto:\n\n` +
    righe.join("\n\n") +
    `\n\nResto a disposizione per qualsiasi dubbio.`
  );
}

/** Helper: log creazione wizard. */
export async function logCampagnaCreata(campaignId: string) {
  return registraEventoCampagna({
    campaignId,
    eventType: "CREATED",
    title: "Campagna creata",
    description: "Campagna configurata nel Wizard a 6 step",
  });
}

/** Helper: log approvazione cliente. */
export async function logCampagnaApprovata(campaignId: string) {
  return registraEventoCampagna({
    campaignId,
    eventType: "APPROVED",
    title: "Approvazione ricevuta",
    description:
      "Approvazione ricevuta dal cliente via link /approvazione/[token]",
  });
}

/** Helper: log export Meta. */
export async function logCampagnaEsportata(campaignId: string) {
  return registraEventoCampagna({
    campaignId,
    eventType: "EXPORTED",
    title: "Export Meta completato",
    description: "Campagna pronta esportata per Meta Ads Manager",
  });
}

/** Helper: log modifica configurazione (edit mode). */
export async function logCampagnaAggiornata(input: {
  campaignId: string;
  title: string;
  description?: string;
}) {
  return registraEventoCampagna({
    campaignId: input.campaignId,
    eventType: "UPDATED",
    title: input.title,
    description: input.description,
  });
}

export function etichettaSemaforoDiagnosi(
  verdict: string,
  badgeLabel?: string,
): string {
  if (verdict === "good") return "🟢 VERDE";
  if (verdict === "alert") return "🔴 ROSSO";
  if (verdict === "learning" || verdict === "warning") return "🟡 GIALLO";
  return badgeLabel ? `🟡 ${badgeLabel}` : "🟡 GIALLO";
}
