import type { Campagna, CampagnaObjective } from "@/types/campagne";
import { etichettaStatusCampagna, normalizzaObjective } from "@/types/campagne";
import type { CampaignCheck } from "@/lib/campaign-checks-db";
import { etichettaStatoOperativo } from "@/components/risultati/ControlRoomOverview";
import { hrefModificaConfigurazione } from "@/data/percorsi-nuova-campagna";
import { nomeCampagnaCard } from "@/components/risultati/ControlRoomOverview";

export type AttentionCategory =
  | "RED"
  | "REVISION_REQUESTED"
  | "YELLOW"
  | "INSUFFICIENT"
  | "NO_CHECK"
  | "DRAFT";

export type AttentionItem = {
  campaignId: string;
  clientName: string;
  campaignName: string;
  objective: CampagnaObjective;
  category: AttentionCategory;
  priority: number;
  statusLabel: string;
  nextAction: string;
  lastCheckAt: string | null;
  href: string;
};

export type GiornoAttivita = {
  chiave: string;
  data: Date;
  count: number;
  isToday: boolean;
  lettera: string;
};

export type AttivitaSettimana = {
  campagneControllate: number;
  totaleCheck: number;
  giorni: GiornoAttivita[];
};

const LETTERE_GIORNO_IT = ["D", "L", "M", "M", "G", "V", "S"] as const;

const PRIORITA: Record<AttentionCategory, number> = {
  RED: 1,
  REVISION_REQUESTED: 2,
  YELLOW: 3,
  INSUFFICIENT: 4,
  NO_CHECK: 5,
  DRAFT: 6,
};

function statusNorm(campagna: Campagna): string {
  return (campagna.status ?? "").toUpperCase();
}

function categoriaAttenzione(
  campagna: Campagna,
  check: CampaignCheck | null,
): AttentionCategory | null {
  const status = statusNorm(campagna);
  if (check?.healthStatus === "RED") return "RED";
  if (status === "REVISION_REQUESTED") return "REVISION_REQUESTED";
  if (check?.healthStatus === "YELLOW") return "YELLOW";
  if (check?.healthStatus === "INSUFFICIENT") return "INSUFFICIENT";
  if (!check) return "NO_CHECK";
  if (status === "DRAFT" || !status) return "DRAFT";
  return null;
}

function nextActionPer(
  category: AttentionCategory,
  check: CampaignCheck | null,
): string {
  switch (category) {
    case "RED": {
      const testo = check?.actions[0]?.text?.trim();
      return testo || "Rivedi i risultati della campagna.";
    }
    case "YELLOW":
      return "Controlla l'andamento.";
    case "INSUFFICIENT":
      return "Raccogli altri dati.";
    case "REVISION_REQUESTED":
      return "Rivedi la richiesta del cliente.";
    case "NO_CHECK":
      return "Inserisci i primi risultati.";
    case "DRAFT":
      return "Continua la configurazione.";
  }
}

function statusLabelPer(
  category: AttentionCategory,
  check: CampaignCheck | null,
): string {
  switch (category) {
    case "RED":
    case "YELLOW":
    case "INSUFFICIENT":
      return etichettaStatoOperativo(check?.healthStatus ?? null, Boolean(check));
    case "REVISION_REQUESTED":
      return "Revisione richiesta";
    case "NO_CHECK":
      return "Mai controllata";
    case "DRAFT":
      return "Bozza";
  }
}

function hrefAttenzione(
  category: AttentionCategory,
  campagna: Campagna,
): string {
  if (category === "REVISION_REQUESTED") {
    return `/campagne/${campagna.id}`;
  }
  if (category === "DRAFT") {
    return hrefModificaConfigurazione(
      campagna.id,
      normalizzaObjective(campagna.objective),
    );
  }
  return `/risultati?campaignId=${encodeURIComponent(campagna.id)}`;
}

export function derivaAttenzione(
  campagne: Campagna[],
  ultimi: Map<string, CampaignCheck>,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const campagna of campagne) {
    if (!campagna.id) continue;
    const check = ultimi.get(campagna.id) ?? null;
    const category = categoriaAttenzione(campagna, check);
    if (!category) continue;
    items.push({
      campaignId: campagna.id,
      clientName: campagna.nomeCliente,
      campaignName: nomeCampagnaCard(campagna),
      objective: normalizzaObjective(campagna.objective),
      category,
      priority: PRIORITA[category],
      statusLabel: statusLabelPer(category, check),
      nextAction: nextActionPer(category, check),
      lastCheckAt: check?.createdAt ?? null,
      href: hrefAttenzione(category, campagna),
    });
  }
  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const da = a.lastCheckAt ?? "";
    const db = b.lastCheckAt ?? "";
    if (da && db && da !== db) return db.localeCompare(da);
    return a.clientName.localeCompare(b.clientName, "it");
  });
}

export function campagneInRevisione(campagne: Campagna[]): Campagna[] {
  return campagne.filter(
    (c) => statusNorm(c) === "REVISION_REQUESTED",
  );
}

/** Inizio del giorno locale di `giorni` giorni fa incluso oggi (finestra di 7 → 6 giorni fa). */
export function isoInizioFinestraGiorni(
  giorni: number,
  now: Date = new Date(),
): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, giorni - 1));
  return d.toISOString();
}

export function chiaveGiornoLocale(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function etichettaAriaBarraAttivita(data: Date, count: number): string {
  const quando = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  }).format(data);
  const cosa =
    count === 1 ? "1 campagna controllata" : `${count} campagne controllate`;
  return `${quando}: ${cosa}`;
}

/** Quota altezza barra (0 se count=0). max giornaliero = 1. */
export function quotaAltezzaBarraAttivita(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return count / max;
}

export function aggregaAttivitaSettimana(
  checks: CampaignCheck[],
  now: Date = new Date(),
): AttivitaSettimana {
  const n = 7;
  const oggi = new Date(now);
  oggi.setHours(0, 0, 0, 0);

  const giorni: GiornoAttivita[] = [];
  const indice = new Map<string, number>();

  for (let i = n - 1; i >= 0; i -= 1) {
    const data = new Date(oggi);
    data.setDate(oggi.getDate() - i);
    data.setHours(0, 0, 0, 0);
    const chiave = chiaveGiornoLocale(data);
    indice.set(chiave, giorni.length);
    giorni.push({
      chiave,
      data,
      count: 0,
      isToday: i === 0,
      lettera: LETTERE_GIORNO_IT[data.getDay()],
    });
  }

  const idsPerGiorno = giorni.map(() => new Set<string>());
  const campagne = new Set<string>();
  let totaleCheck = 0;

  for (const check of checks) {
    const t = new Date(check.createdAt);
    if (Number.isNaN(t.getTime())) continue;
    const idx = indice.get(chiaveGiornoLocale(t));
    if (idx === undefined) continue;
    totaleCheck += 1;
    idsPerGiorno[idx].add(check.campaignId);
    campagne.add(check.campaignId);
  }

  return {
    campagneControllate: campagne.size,
    totaleCheck,
    giorni: giorni.map((g, i) => ({ ...g, count: idsPerGiorno[i].size })),
  };
}

export function pillGestione(campagna: Campagna, check: CampaignCheck | null): {
  kind: "ok" | "watch" | "critico" | "pending" | "info";
  label: string;
} {
  const status = statusNorm(campagna);
  if (status === "REVISION_REQUESTED") {
    return { kind: "critico", label: "Revisione richiesta" };
  }
  if (check) {
    return {
      kind:
        check.healthStatus === "GREEN"
          ? "ok"
          : check.healthStatus === "YELLOW"
            ? "watch"
            : check.healthStatus === "RED"
              ? "critico"
              : "pending",
      label: etichettaStatoOperativo(check.healthStatus, true),
    };
  }
  if (status === "APPROVED") {
    return { kind: "ok", label: "Approvata" };
  }
  if (status === "DRAFT" || !status) {
    return { kind: "pending", label: "Bozza" };
  }
  const etichetta = etichettaStatusCampagna(status);
  if (etichetta === "Attiva") {
    return { kind: "info", label: "In gestione" };
  }
  return { kind: "info", label: etichetta };
}
