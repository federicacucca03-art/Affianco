/**
 * M5C — explicit Meta ↔ Ally link: KPI compatibility + target precedence.
 * Pure. No DB writes. No Meta API. No native check history writes.
 */

import { resolveThresholdFromCampaign } from "@/lib/control-room";
import { PURCHASE_ACTION_TYPES } from "@/lib/meta/insight-actions";
import { mapMetaObjectiveToAffianco } from "@/lib/meta/campaign-objective";
import type { MetaMonitoringKpi } from "@/lib/meta/campaign-target";
import {
  normalizzaObjective,
  type Campagna,
  type CampagnaObjective,
} from "@/types/campagne";

export type MetaTargetSource = "LINKED_AFFIANCO" | "META_EXPLICIT" | "NONE";

export type MetaCampaignLinkState =
  | "UNLINKED"
  | "LINKED"
  | "LINKED_BUT_KPI_INCOMPATIBLE"
  | "LINKED_CAMPAIGN_MISSING";

export type NativeCampaignLinkOption = {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  objectiveLabel: string;
  statusLabel: string;
};

export type MetaCampaignLinkResult = {
  metaCampaignId: string;
  affiancoCampaignId: string | null;
  linkedCampaignName: string | null;
  options: NativeCampaignLinkOption[];
};

export type LinkedAffiancoCampaignSnapshot = {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  maxSustainableCpa: number | null;
  estimatedCpm: number | null;
  targetMargin: number | null;
  bookingServiceValue: number | null;
  showUpRate: number | null;
  averageOrderValue: number | null;
  productMargin: number | null;
  averageReceipt: number | null;
  storeMargin: number | null;
  recoveryValue: number | null;
  recoveryMargin: number | null;
};

const CONFIDENT_LEADS_OBJECTIVES = new Set(["LEADS", "OUTCOME_LEADS"]);
const CPM_COMPATIBLE_META = new Set([
  "BRAND_AWARENESS",
  "REACH",
  "OUTCOME_AWARENESS",
  "AWARENESS",
]);
const PURCHASE_RESULTS = new Set<string>(PURCHASE_ACTION_TYPES);

export type LinkedTargetResolution = {
  linkState: MetaCampaignLinkState;
  targetSource: MetaTargetSource;
  primaryKpi: MetaMonitoringKpi | null;
  targetValue: number | null;
  linkedCampaignId: string | null;
  linkedCampaignName: string | null;
  /** Stored Meta-only target — never deleted on link. */
  storedPrimaryKpi: MetaMonitoringKpi | null;
  storedTargetValue: number | null;
  nativeThresholdSource: string | null;
};

function snapshotToCampagna(
  snap: LinkedAffiancoCampaignSnapshot,
): Campagna {
  return {
    id: snap.id,
    nomeCliente: "",
    iniziali: "",
    stato: snap.status ?? "",
    giudizio: "Va bene",
    objective: normalizzaObjective(snap.objective),
    nomeCampagna: snap.name,
    maxSustainableCpa: snap.maxSustainableCpa ?? undefined,
    estimatedCpm: snap.estimatedCpm ?? undefined,
    targetMargin: snap.targetMargin ?? undefined,
    bookingServiceValue: snap.bookingServiceValue ?? undefined,
    showUpRate: snap.showUpRate ?? undefined,
    averageOrderValue: snap.averageOrderValue ?? undefined,
    productMargin: snap.productMargin ?? undefined,
    averageReceipt: snap.averageReceipt ?? undefined,
    storeMargin: snap.storeMargin ?? undefined,
    recoveryValue: snap.recoveryValue ?? undefined,
    recoveryMargin: snap.recoveryMargin ?? undefined,
  };
}

function metaObjectiveUpper(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().toUpperCase();
}

function hasConfidentPurchaseResults(
  resultMappingConfidence: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null | undefined,
  primaryResultType: string | null | undefined,
): boolean {
  if (resultMappingConfidence !== "CONFIDENT") return false;
  const t = (primaryResultType ?? "").trim().toLowerCase();
  return PURCHASE_RESULTS.has(t);
}

/**
 * Semantic compatibility for inheriting a native threshold.
 * Uncertain / inferred objectives → not compatible.
 * Threshold presence is checked separately (missing threshold ≠ incompatible KPI).
 */
export function resolveLinkedKpiCompatibility(input: {
  nativeObjective: CampagnaObjective;
  nativeThreshold: number | null;
  nativeThresholdSource: string | null;
  metaRawObjective: string | null | undefined;
  resultMappingConfidence?: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null;
  primaryResultType?: string | null;
}): {
  compatible: boolean;
  primaryKpi: MetaMonitoringKpi | null;
} {
  const semantic = resolveLinkedKpiSemantics(input);
  if (!semantic.compatible || !semantic.primaryKpi) {
    return { compatible: false, primaryKpi: null };
  }
  if (input.nativeThreshold == null || input.nativeThreshold <= 0) {
    return { compatible: false, primaryKpi: semantic.primaryKpi };
  }
  if (
    semantic.primaryKpi === "CPL" &&
    input.nativeThresholdSource !== "max_sustainable_cpa"
  ) {
    return { compatible: false, primaryKpi: null };
  }
  if (
    semantic.primaryKpi === "CPM" &&
    input.nativeThresholdSource !== "estimated_cpm_planned"
  ) {
    return { compatible: false, primaryKpi: null };
  }
  if (
    semantic.primaryKpi === "CPA" &&
    input.nativeThresholdSource !== "max_sustainable_cpa"
  ) {
    return { compatible: false, primaryKpi: null };
  }
  return { compatible: true, primaryKpi: semantic.primaryKpi };
}

/** Objective / result semantics only — no threshold required. */
export function resolveLinkedKpiSemantics(input: {
  nativeObjective: CampagnaObjective;
  metaRawObjective: string | null | undefined;
  resultMappingConfidence?: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null;
  primaryResultType?: string | null;
}): {
  compatible: boolean;
  primaryKpi: MetaMonitoringKpi | null;
} {
  const metaObj = metaObjectiveUpper(input.metaRawObjective);
  const mapped = mapMetaObjectiveToAffianco(input.metaRawObjective);

  if (input.nativeObjective === "LEADS") {
    if (!metaObj || !CONFIDENT_LEADS_OBJECTIVES.has(metaObj)) {
      return { compatible: false, primaryKpi: null };
    }
    if (mapped.mappingConfidence !== "CONFIDENT") {
      return { compatible: false, primaryKpi: null };
    }
    return { compatible: true, primaryKpi: "CPL" };
  }

  if (input.nativeObjective === "AWARENESS") {
    if (!metaObj || !CPM_COMPATIBLE_META.has(metaObj)) {
      return { compatible: false, primaryKpi: null };
    }
    return { compatible: true, primaryKpi: "CPM" };
  }

  if (input.nativeObjective === "ECOMMERCE") {
    if (
      !hasConfidentPurchaseResults(
        input.resultMappingConfidence,
        input.primaryResultType,
      )
    ) {
      return { compatible: false, primaryKpi: null };
    }
    return { compatible: true, primaryKpi: "CPA" };
  }

  // BOOKINGS / IN_STORE / RETARGETING: never infer from Meta objective alone.
  return { compatible: false, primaryKpi: null };
}

export function resolveLinkedMonitoringTarget(input: {
  affiancoCampaignId: string | null | undefined;
  linkedCampaign: LinkedAffiancoCampaignSnapshot | null;
  metaRawObjective: string | null | undefined;
  storedPrimaryKpi: MetaMonitoringKpi | null;
  storedTargetValue: number | null;
  resultMappingConfidence?: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | null;
  primaryResultType?: string | null;
}): LinkedTargetResolution {
  const storedPrimaryKpi = input.storedPrimaryKpi;
  const storedTargetValue = input.storedTargetValue;
  const linkedId = input.affiancoCampaignId ?? null;

  const metaExplicit =
    storedPrimaryKpi &&
    storedPrimaryKpi !== "NONE" &&
    storedTargetValue != null &&
    storedTargetValue > 0
      ? { primaryKpi: storedPrimaryKpi, targetValue: storedTargetValue }
      : storedPrimaryKpi === "NONE"
        ? { primaryKpi: "NONE" as const, targetValue: null }
        : null;

  function fromMetaExplicit(
    linkState: MetaCampaignLinkState,
    linkedCampaignId: string | null,
    linkedCampaignName: string | null,
  ): LinkedTargetResolution {
    if (metaExplicit && metaExplicit.primaryKpi === "NONE") {
      return {
        linkState,
        targetSource: "NONE",
        primaryKpi: "NONE",
        targetValue: null,
        linkedCampaignId,
        linkedCampaignName,
        storedPrimaryKpi,
        storedTargetValue,
        nativeThresholdSource: null,
      };
    }
    if (metaExplicit) {
      return {
        linkState,
        targetSource: "META_EXPLICIT",
        primaryKpi: metaExplicit.primaryKpi,
        targetValue: metaExplicit.targetValue,
        linkedCampaignId,
        linkedCampaignName,
        storedPrimaryKpi,
        storedTargetValue,
        nativeThresholdSource: null,
      };
    }
    return {
      linkState,
      targetSource: "NONE",
      primaryKpi: null,
      targetValue: null,
      linkedCampaignId,
      linkedCampaignName,
      storedPrimaryKpi,
      storedTargetValue,
      nativeThresholdSource: null,
    };
  }

  if (!linkedId) {
    return fromMetaExplicit("UNLINKED", null, null);
  }

  if (!input.linkedCampaign || input.linkedCampaign.id !== linkedId) {
    return fromMetaExplicit("LINKED_CAMPAIGN_MISSING", linkedId, null);
  }

  const campagna = snapshotToCampagna(input.linkedCampaign);
  const objective = normalizzaObjective(input.linkedCampaign.objective);
  const resolved = resolveThresholdFromCampaign(campagna, objective);
  const semantic = resolveLinkedKpiSemantics({
    nativeObjective: objective,
    metaRawObjective: input.metaRawObjective,
    resultMappingConfidence: input.resultMappingConfidence,
    primaryResultType: input.primaryResultType,
  });
  const compat = resolveLinkedKpiCompatibility({
    nativeObjective: objective,
    nativeThreshold: resolved.threshold,
    nativeThresholdSource: resolved.source,
    metaRawObjective: input.metaRawObjective,
    resultMappingConfidence: input.resultMappingConfidence,
    primaryResultType: input.primaryResultType,
  });

  if (compat.compatible && compat.primaryKpi && resolved.threshold != null) {
    return {
      linkState: "LINKED",
      targetSource: "LINKED_AFFIANCO",
      primaryKpi: compat.primaryKpi,
      targetValue: resolved.threshold,
      linkedCampaignId: linkedId,
      linkedCampaignName: input.linkedCampaign.name,
      storedPrimaryKpi,
      storedTargetValue,
      nativeThresholdSource: resolved.source,
    };
  }

  if (!semantic.compatible) {
    return {
      linkState: "LINKED_BUT_KPI_INCOMPATIBLE",
      targetSource: "NONE",
      primaryKpi: null,
      targetValue: null,
      linkedCampaignId: linkedId,
      linkedCampaignName: input.linkedCampaign.name,
      storedPrimaryKpi,
      storedTargetValue,
      nativeThresholdSource: resolved.source,
    };
  }

  // Semantically compatible but no reusable native threshold → Meta explicit.
  return {
    ...fromMetaExplicit("LINKED", linkedId, input.linkedCampaign.name),
    nativeThresholdSource: resolved.source,
  };
}

export function isValidCampaignLinkOwnership(input: {
  authUserId: string;
  requestedClientId: string;
  metaUserId: string;
  metaClientId: string;
  nativeUserId: string | null;
  nativeClientId: string | null;
}): boolean {
  return (
    input.authUserId === input.metaUserId &&
    input.authUserId === input.nativeUserId &&
    input.requestedClientId === input.metaClientId &&
    input.requestedClientId === input.nativeClientId &&
    input.nativeClientId != null &&
    input.nativeUserId != null
  );
}

export function etichettaObjectiveBreve(objective: string | null | undefined): string {
  switch (normalizzaObjective(objective)) {
    case "LEADS":
      return "Lead";
    case "BOOKINGS":
      return "Prenotazioni";
    case "ECOMMERCE":
      return "E-commerce";
    case "IN_STORE":
      return "Negozio";
    case "RETARGETING":
      return "Retargeting";
    case "AWARENESS":
      return "Awareness";
    default:
      return "Lead";
  }
}
