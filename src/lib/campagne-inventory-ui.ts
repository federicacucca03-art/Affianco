/**
 * Campagne inventory presentation — labels, filters, counts.
 * Canonical inventory authority remains Supabase / server loaders.
 * Does not change campaign persistence or Meta write surface.
 */

import type { Campagna } from "@/types/campagne";
import type { MetaCampaignMonitoringRow } from "@/lib/meta/meta-campaign-monitoring-row";
import { etichettaMetaObjectiveUtente } from "@/lib/meta/meta-ui-labels";

export type InventarioOrigine = "ALLY" | "META" | "ALLY_META";

export type InventarioStatoChiave =
  | "DRAFT"
  | "APPROVAL_PENDING"
  | "REVISION"
  | "APPROVED"
  | "META_ACTIVE"
  | "META_PAUSED"
  | "HISTORICAL"
  | "OTHER";

export type InventarioRiga = {
  id: string;
  title: string;
  clientName: string;
  objectiveLabel: string | null;
  periodLabel: string | null;
  /** Public origin label: Ally | Meta | Ally + Meta */
  sourceLabel: string;
  origine: InventarioOrigine;
  statoChiave: InventarioStatoChiave;
  statoLabel: string;
  href: string;
  ctaLabel: string;
  nextActionTitle: string | null;
  historical: boolean;
};

export function originLabelIt(origine: InventarioOrigine): string {
  if (origine === "ALLY_META") return "Ally + Meta";
  if (origine === "META") return "Meta";
  return "Ally";
}

/**
 * Ally workflow status only — never Meta delivery, never performance.
 *
 * Root cause of prior list conflict:
 * - meta line used etichettaStatusCampagna(DRAFT) → "Bozza"
 * - trailing badge used badgeReviewDaStatus(DRAFT) → "In Attesa"
 *
 * DRAFT without approvalToken → Bozza
 * DRAFT + approvalToken ≈ link issued → In attesa di approvazione
 */
export function resolveInventarioStatoNative(campagna: Campagna): {
  chiave: InventarioStatoChiave;
  label: string;
} {
  const s = (campagna.status ?? "").trim().toUpperCase();
  if (s === "APPROVED") {
    return { chiave: "APPROVED", label: "Approvata" };
  }
  if (s === "REVISION_REQUESTED") {
    return { chiave: "REVISION", label: "Revisione richiesta" };
  }
  if (s === "ACTIVE" || s === "RUNNING") {
    return { chiave: "APPROVED", label: "Approvata" };
  }
  if (s === "DRAFT" || !s) {
    if (campagna.approvalToken?.trim()) {
      return {
        chiave: "APPROVAL_PENDING",
        label: "In attesa di approvazione",
      };
    }
    return { chiave: "DRAFT", label: "Bozza" };
  }
  return { chiave: "OTHER", label: s };
}

/**
 * Meta delivery status only — never health / performance / CPL.
 * ACTIVE ≠ good. PAUSED ≠ bad performance.
 */
export function resolveInventarioStatoMeta(
  row: Pick<
    MetaCampaignMonitoringRow,
    "effectiveStatus" | "mode"
  >,
): {
  chiave: InventarioStatoChiave;
  label: string;
  historical: boolean;
} {
  const eff = (row.effectiveStatus ?? "").trim().toUpperCase();
  const historicalMode = row.mode === "HISTORICAL_REVIEW";

  if (eff === "ACTIVE") {
    return {
      chiave: "META_ACTIVE",
      label: "Attiva su Meta",
      historical: false,
    };
  }
  if (eff === "PAUSED") {
    return {
      chiave: "META_PAUSED",
      label: "In pausa su Meta",
      historical: true,
    };
  }
  if (eff === "ARCHIVED" || eff === "DELETED") {
    return {
      chiave: "HISTORICAL",
      label: "Archiviata su Meta",
      historical: true,
    };
  }
  if (historicalMode) {
    return {
      chiave: "HISTORICAL",
      label: "In pausa su Meta",
      historical: true,
    };
  }
  return {
    chiave: "META_ACTIVE",
    label: "Su Meta",
    historical: false,
  };
}

export function isMetaInventoryLinked(
  row: Pick<MetaCampaignMonitoringRow, "linkState" | "linkedCampaignId">,
): boolean {
  if (!row.linkedCampaignId?.trim()) return false;
  return (
    row.linkState === "LINKED" ||
    row.linkState === "LINKED_BUT_KPI_INCOMPATIBLE"
  );
}

/** Native ids that have a canonical Meta link (any monitoring mode). */
export function collectLinkedNativeIdsForInventory(
  metaRows: readonly Pick<
    MetaCampaignMonitoringRow,
    "linkState" | "linkedCampaignId"
  >[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of metaRows) {
    if (isMetaInventoryLinked(row) && row.linkedCampaignId) {
      ids.add(row.linkedCampaignId);
    }
  }
  return ids;
}

export function resolveInventarioCtaLabel(input: {
  origine: InventarioOrigine;
  statoChiave: InventarioStatoChiave;
}): string {
  if (input.origine === "META") return "Apri risultati";
  if (input.statoChiave === "DRAFT") return "Continua";
  if (input.statoChiave === "REVISION") return "Rivedi";
  return "Apri";
}

export type InventarioSummary = {
  totale: number;
  bozze: number;
  inRevisione: number;
  approvate: number;
  inAttesaApprovazione: number;
  meta: number;
  allyMeta: number;
  storico: number;
};

export function buildInventarioSummary(
  rows: readonly InventarioRiga[],
): InventarioSummary {
  const active = rows.filter((r) => !r.historical);
  return {
    totale: rows.length,
    bozze: active.filter((r) => r.statoChiave === "DRAFT").length,
    inRevisione: active.filter((r) => r.statoChiave === "REVISION").length,
    approvate: active.filter((r) => r.statoChiave === "APPROVED").length,
    inAttesaApprovazione: active.filter(
      (r) => r.statoChiave === "APPROVAL_PENDING",
    ).length,
    meta: rows.filter((r) => r.origine === "META").length,
    allyMeta: rows.filter((r) => r.origine === "ALLY_META").length,
    storico: rows.filter((r) => r.historical).length,
  };
}

export function filterInventarioRighe(
  rows: readonly InventarioRiga[],
  input: {
    query: string;
    cliente: string;
    stato: string;
    origine: string;
  },
): InventarioRiga[] {
  const q = input.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (input.origine === "ALLY" && r.origine !== "ALLY") return false;
    if (input.origine === "META" && r.origine !== "META") return false;
    if (input.origine === "ALLY_META" && r.origine !== "ALLY_META") return false;
    if (input.cliente && r.clientName !== input.cliente) return false;
    if (input.stato === "DRAFT" && r.statoChiave !== "DRAFT") return false;
    if (input.stato === "REVISION" && r.statoChiave !== "REVISION") return false;
    if (input.stato === "APPROVED" && r.statoChiave !== "APPROVED") return false;
    if (
      input.stato === "APPROVAL_PENDING" &&
      r.statoChiave !== "APPROVAL_PENDING"
    ) {
      return false;
    }
    if (input.stato === "META_ACTIVE" && r.statoChiave !== "META_ACTIVE") {
      return false;
    }
    if (input.stato === "META_PAUSED" && r.statoChiave !== "META_PAUSED") {
      return false;
    }
    if (input.stato === "HISTORICAL" && !r.historical) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      (r.objectiveLabel?.toLowerCase().includes(q) ?? false) ||
      r.sourceLabel.toLowerCase().includes(q) ||
      r.statoLabel.toLowerCase().includes(q)
    );
  });
}

export type InventarioBuildNativeInput = {
  campagna: Campagna;
  linkedToMeta: boolean;
  nextActionTitle: string | null;
  objectiveLabel: string | null;
  periodLabel: string | null;
};

export type InventarioBuildMetaInput = {
  row: MetaCampaignMonitoringRow;
  nextActionTitle: string | null;
};

/**
 * Unified inventory rows from Ally-native + Meta-imported sources.
 * Linked pairs → one row (Ally + Meta) when the native campaign still exists.
 * Similar names without a canonical link stay separate.
 */
export function buildInventarioRighe(input: {
  native: InventarioBuildNativeInput[];
  meta: InventarioBuildMetaInput[];
}): InventarioRiga[] {
  const nativeIds = new Set(
    input.native
      .map((n) => n.campagna.id)
      .filter((id): id is string => Boolean(id)),
  );

  const rows: InventarioRiga[] = [];

  for (const n of input.native) {
    const id = n.campagna.id;
    if (!id) continue;
    const stato = resolveInventarioStatoNative(n.campagna);
    const origine: InventarioOrigine = n.linkedToMeta ? "ALLY_META" : "ALLY";
    rows.push({
      id: `native-${id}`,
      title:
        n.campagna.nomeCampagna?.trim() || n.campagna.nomeCliente,
      clientName: n.campagna.nomeCliente,
      objectiveLabel: n.objectiveLabel,
      periodLabel: n.periodLabel,
      sourceLabel: originLabelIt(origine),
      origine,
      statoChiave: stato.chiave,
      statoLabel: stato.label,
      href: `/campagne/${id}`,
      ctaLabel: resolveInventarioCtaLabel({
        origine,
        statoChiave: stato.chiave,
      }),
      nextActionTitle: n.nextActionTitle,
      historical: false,
    });
  }

  for (const m of input.meta) {
    const row = m.row;
    if (
      isMetaInventoryLinked(row) &&
      row.linkedCampaignId &&
      nativeIds.has(row.linkedCampaignId)
    ) {
      // Canonical link: keep the Ally management row only.
      continue;
    }
    const statoM = resolveInventarioStatoMeta(row);
    const origine: InventarioOrigine = "META";
    rows.push({
      id: `meta-${row.id}`,
      title: row.name,
      clientName: row.clientName,
      objectiveLabel: etichettaMetaObjectiveUtente(row.rawObjective),
      periodLabel: null,
      sourceLabel: originLabelIt(origine),
      origine,
      statoChiave: statoM.chiave,
      statoLabel: statoM.label,
      href: `/risultati?campaignId=${encodeURIComponent(row.id)}`,
      ctaLabel: resolveInventarioCtaLabel({
        origine,
        statoChiave: statoM.chiave,
      }),
      nextActionTitle: m.nextActionTitle,
      historical: statoM.historical,
    });
  }

  return rows;
}
