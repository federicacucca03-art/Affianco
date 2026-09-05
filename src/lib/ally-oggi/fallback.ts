/**
 * M9.1D — deterministic Ally oggi fallback (no AI).
 * Workspace awareness + performance/config notes.
 * Entity-aware: do not count the same campaign as multiple workload items.
 */

import {
  ALLY_OGGI_MAX_CONFIGURATION,
  ALLY_OGGI_MAX_PRIORITY,
  ALLY_OGGI_MAX_WATCH,
  type AllyOggiBrief,
  type AllyOggiBriefContext,
  type AllyOggiBriefItem,
  type AllyOggiCampaignFact,
  type AllyOggiWorkspaceSummary,
} from "@/lib/ally-oggi/types";

function itemFromFact(
  fact: AllyOggiCampaignFact,
  sentence: string,
): AllyOggiBriefItem {
  return {
    campaignId: fact.campaignId,
    source: fact.source,
    title: `${fact.clientName} · ${fact.campaignName}`,
    sentence,
    recommendedHref: fact.href,
  };
}

function prioritySentence(f: AllyOggiCampaignFact): string {
  if (f.smallSample) {
    return "Campione ancora piccolo: conviene attendere altri risultati prima di intervenire.";
  }
  if (f.attentionState === "CRITICAL") {
    return f.nextActionTitle
      ? `${f.nextActionTitle}.`
      : "Richiede attenzione prioritaria.";
  }
  if (f.attentionState === "NEEDS_ATTENTION") {
    return f.nextActionTitle
      ? `${f.nextActionTitle}.`
      : "Merita un controllo operativo oggi.";
  }
  return f.nextActionTitle ?? "Da controllare.";
}

function watchSentence(f: AllyOggiCampaignFact): string {
  if (f.attentionState === "INSUFFICIENT_DATA" || f.smallSample) {
    return "Sta ancora raccogliendo dati: non la modificherei ora.";
  }
  if (f.attentionState === "MONITOR") {
    return "Da tenere d’occhio, senza interventi immediati.";
  }
  return "In monitoraggio.";
}

function configSentence(f: AllyOggiCampaignFact): string {
  switch (f.configurationKind) {
    case "ACTIVE_MISSING_TARGET":
      return "Non è ancora valutabile perché manca la soglia.";
    case "RESULT_MAPPING":
      return "Serve indicare quale risultato monitorare.";
    case "ACTIVE_MISSING_RESULTS":
      return "È approvata ma non ancora valutabile: mancano i risultati.";
    case "DRAFT":
      return "Campagna ancora in bozza: completa la configurazione.";
    default:
      return "Serve completare la configurazione prima di valutarla.";
  }
}

function pluralCampagne(n: number): string {
  return n === 1 ? "1 campagna" : `${n} campagne`;
}

function buildHeadline(
  ws: AllyOggiWorkspaceSummary,
  perfAttn: number,
): string {
  if (perfAttn > 0) {
    return "Ecco cosa richiederebbe attenzione oggi.";
  }
  if (ws.totalWorkspaceCampaigns === 0) {
    return "Nessuna campagna da valutare.";
  }
  if (
    ws.draftCampaigns > 0 ||
    ws.revisionRequestedCampaigns > 0 ||
    ws.configurationRequiredCampaigns > 0
  ) {
    return "Nessuna urgenza da valutare";
  }
  return "Non vedo criticità operative oggi.";
}

/**
 * One coherent situation string — never "1 da completare · 1 da configurare"
 * for the same preparation campaign.
 */
function buildSituationDetail(
  ws: AllyOggiWorkspaceSummary,
  perfAttn: number,
  hasPerformanceFacts: boolean,
): string {
  const total = ws.totalWorkspaceCampaigns;

  // Pure preparation / no performance facts (e.g. drafts & revisions only).
  if (!hasPerformanceFacts && ws.monitorableCampaigns === 0) {
    if (total === 1 && ws.draftCampaigns === 1) {
      return "È ancora in bozza, quindi non ci sono ancora dati di performance da analizzare.";
    }
    if (total === 1 && ws.revisionRequestedCampaigns === 1) {
      return "È in revisione con il cliente: non è ancora il momento di valutare i risultati.";
    }
    if (ws.draftCampaigns === total && total > 1) {
      return "Sono ancora in bozza, quindi non ci sono ancora dati di performance da analizzare.";
    }
    if (ws.revisionRequestedCampaigns === total && total > 1) {
      return "Sono in revisione con i clienti: non è ancora il momento di valutare i risultati.";
    }
    if (ws.draftCampaigns > 0 && ws.revisionRequestedCampaigns > 0) {
      const draftBit =
        ws.draftCampaigns === 1
          ? "1 è ancora in bozza"
          : `${ws.draftCampaigns} sono ancora in bozza`;
      const revBit =
        ws.revisionRequestedCampaigns === 1
          ? "1 è in revisione"
          : `${ws.revisionRequestedCampaigns} sono in revisione`;
      return `${draftBit} e ${revBit}: non ci sono ancora dati di performance da analizzare.`;
    }
    if (ws.draftCampaigns > 0) {
      return ws.draftCampaigns === 1
        ? "1 è ancora in bozza, quindi non ci sono ancora dati di performance da analizzare."
        : `${ws.draftCampaigns} sono ancora in bozza, quindi non ci sono ancora dati di performance da analizzare.`;
    }
    if (ws.revisionRequestedCampaigns > 0) {
      return ws.revisionRequestedCampaigns === 1
        ? "1 è in revisione: non è ancora il momento di valutare i risultati."
        : `${ws.revisionRequestedCampaigns} sono in revisione: non è ancora il momento di valutare i risultati.`;
    }
    // Config gaps without draft status (approved/meta missing target, etc.)
    if (ws.configurationRequiredCampaigns > 0) {
      return ws.configurationRequiredCampaigns === 1
        ? "Serve ancora un passaggio di configurazione prima di poterla valutare."
        : `${ws.configurationRequiredCampaigns} richiedono ancora un passaggio di configurazione prima di poterle valutare.`;
    }
    return "Non ci sono ancora dati di performance da analizzare.";
  }

  // Mixed / performance-aware: entity clauses without double-counting draft+config.
  const clauses: string[] = [];
  if (perfAttn === 1) clauses.push("Una richiede attenzione");
  else if (perfAttn > 1) clauses.push(`${perfAttn} richiedono attenzione`);

  if (ws.draftCampaigns === 1) clauses.push("1 è ancora in preparazione");
  else if (ws.draftCampaigns > 1) {
    clauses.push(`${ws.draftCampaigns} sono ancora in preparazione`);
  }

  if (ws.revisionRequestedCampaigns === 1) clauses.push("1 è in revisione");
  else if (ws.revisionRequestedCampaigns > 1) {
    clauses.push(`${ws.revisionRequestedCampaigns} sono in revisione`);
  }

  // Config required only when not already explained by drafts (same campaign overlap).
  if (ws.draftCampaigns === 0 && ws.configurationRequiredCampaigns > 0) {
    if (ws.configurationRequiredCampaigns === 1) {
      clauses.push("1 va ancora configurata");
    } else {
      clauses.push(
        `${ws.configurationRequiredCampaigns} vanno ancora configurate`,
      );
    }
  }

  if (
    ws.insufficientDataCampaigns === 1 &&
    perfAttn === 0 &&
    ws.draftCampaigns === 0
  ) {
    clauses.push("1 ha ancora pochi dati");
  } else if (
    ws.insufficientDataCampaigns > 1 &&
    perfAttn === 0 &&
    ws.draftCampaigns === 0
  ) {
    clauses.push(`${ws.insufficientDataCampaigns} hanno ancora pochi dati`);
  }

  if (
    clauses.length === 0 &&
    ws.monitorableCampaigns > 0 &&
    perfAttn === 0
  ) {
    return ws.monitorableCampaigns === 1
      ? "1 è monitorabile e al momento non vedo urgenze."
      : `${ws.monitorableCampaigns} sono monitorabili e al momento non vedo urgenze.`;
  }

  if (clauses.length === 0) return "";
  return `${clauses.join(", ")}.`;
}

export function buildAllyOggiFallback(
  context: AllyOggiBriefContext,
): AllyOggiBrief {
  const ws = context.workspace;
  const priorityFacts = context.campaigns.filter(
    (c) =>
      c.attentionState === "CRITICAL" ||
      c.attentionState === "NEEDS_ATTENTION",
  );
  const watchFacts = context.campaigns.filter(
    (c) =>
      c.attentionState === "MONITOR" ||
      c.attentionState === "INSUFFICIENT_DATA",
  );
  const configFacts = context.campaigns.filter(
    (c) => c.attentionState === "CONFIGURATION_REQUIRED",
  );

  const priorityItems = priorityFacts
    .slice(0, ALLY_OGGI_MAX_PRIORITY)
    .map((f) => itemFromFact(f, prioritySentence(f)));
  const watchItems = watchFacts
    .slice(0, ALLY_OGGI_MAX_WATCH)
    .map((f) => itemFromFact(f, watchSentence(f)));
  const configurationItems = configFacts
    .slice(0, ALLY_OGGI_MAX_CONFIGURATION)
    .map((f) => itemFromFact(f, configSentence(f)));

  const perfAttn = priorityFacts.length;
  const headline = buildHeadline(ws, perfAttn);

  let summary: string;
  if (ws.totalWorkspaceCampaigns === 0) {
    summary = "Non ci sono ancora campagne nel workspace.";
  } else {
    const head = `Hai ${pluralCampagne(ws.totalWorkspaceCampaigns)} nel workspace.`;
    const detail = buildSituationDetail(
      ws,
      perfAttn,
      context.campaigns.length > 0,
    );
    summary = detail
      ? `${head} ${detail}`.replace(/\s+/g, " ").trim()
      : head;
  }

  return {
    headline,
    summary,
    priorityItems,
    watchItems,
    configurationItems,
    closingNote:
      perfAttn === 0 &&
      ws.configurationRequiredCampaigns === 0 &&
      ws.draftCampaigns === 0 &&
      ws.revisionRequestedCampaigns === 0
        ? "Puoi riprendere dalle campagne in monitoraggio quando vuoi."
        : null,
    fromAi: false,
  };
}
