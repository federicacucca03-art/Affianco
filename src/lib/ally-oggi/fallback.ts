/**
 * M9.1B — deterministic Ally oggi fallback (no AI).
 * Communicates workspace awareness + performance/config notes.
 */

import {
  ALLY_OGGI_MAX_CONFIGURATION,
  ALLY_OGGI_MAX_PRIORITY,
  ALLY_OGGI_MAX_WATCH,
  type AllyOggiBrief,
  type AllyOggiBriefContext,
  type AllyOggiBriefItem,
  type AllyOggiCampaignFact,
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

  const parts: string[] = [];
  if (ws.draftCampaigns === 1) parts.push("1 da completare");
  else if (ws.draftCampaigns > 1) parts.push(`${ws.draftCampaigns} da completare`);

  if (ws.revisionRequestedCampaigns === 1) parts.push("1 in revisione");
  else if (ws.revisionRequestedCampaigns > 1) {
    parts.push(`${ws.revisionRequestedCampaigns} in revisione`);
  }

  if (ws.configurationRequiredCampaigns === 1) {
    parts.push("1 da configurare");
  } else if (ws.configurationRequiredCampaigns > 1) {
    parts.push(`${ws.configurationRequiredCampaigns} da configurare`);
  }

  if (ws.insufficientDataCampaigns === 1) {
    parts.push("1 con dati insufficienti");
  } else if (ws.insufficientDataCampaigns > 1) {
    parts.push(`${ws.insufficientDataCampaigns} con dati insufficienti`);
  }

  if (ws.monitorableCampaigns === 1) parts.push("1 monitorabile");
  else if (ws.monitorableCampaigns > 1) {
    parts.push(`${ws.monitorableCampaigns} monitorabili`);
  }

  const perfAttn = priorityFacts.length;

  const headline =
    perfAttn > 0
      ? "Ecco cosa richiederebbe attenzione oggi."
      : ws.revisionRequestedCampaigns > 0 || ws.draftCampaigns > 0
        ? "Nessuna urgenza di performance; c’è lavoro di workflow."
        : ws.configurationRequiredCampaigns > 0
          ? "Nessuna criticità di performance, ma c’è da configurare."
          : "Non vedo criticità operative oggi.";

  let summary: string;
  if (ws.totalWorkspaceCampaigns === 0) {
    summary = "Non ci sono ancora campagne nel workspace.";
  } else {
    const head = `Hai ${pluralCampagne(ws.totalWorkspaceCampaigns)} nel workspace.`;
    const detail = parts.length > 0 ? ` ${parts.join(" · ")}.` : "";
    const noPerf =
      perfAttn === 0 &&
      context.counts.critical === 0 &&
      priorityFacts.length === 0
        ? " Oggi non vedo urgenze di performance."
        : "";
    summary = `${head}${detail}${noPerf}`.replace(/\s+/g, " ").trim();
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
