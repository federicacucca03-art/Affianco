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

export type AttivitaSettimana = {
  campagneControllate: number;
  totaleCheck: number;
  perGiorno: number[];
};

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

export function aggregaAttivitaSettimana(
  checks: CampaignCheck[],
  now: Date = new Date(),
): AttivitaSettimana {
  const n = 7;
  const perGiorno = Array.from({ length: n }, () => 0);
  const campagne = new Set<string>();
  const inizioOggi = new Date(now);
  inizioOggi.setHours(0, 0, 0, 0);

  for (const check of checks) {
    const t = new Date(check.createdAt);
    if (Number.isNaN(t.getTime())) continue;
    const inizioCheck = new Date(t);
    inizioCheck.setHours(0, 0, 0, 0);
    const diffGiorni = Math.round(
      (inizioOggi.getTime() - inizioCheck.getTime()) / 86_400_000,
    );
    if (diffGiorni < 0 || diffGiorni >= n) continue;
    perGiorno[n - 1 - diffGiorni] += 1;
    campagne.add(check.campaignId);
  }

  return {
    campagneControllate: campagne.size,
    totaleCheck: perGiorno.reduce((a, b) => a + b, 0),
    perGiorno,
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
