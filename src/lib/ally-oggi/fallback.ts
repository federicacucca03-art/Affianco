/**
 * M9.1 — deterministic Ally oggi fallback (no AI).
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
      return "Servono i primi risultati per valutarla.";
    case "DRAFT":
      return "Campagna ancora in bozza: completa la configurazione.";
    default:
      return "Serve completare la configurazione prima di valutarla.";
  }
}

export function buildAllyOggiFallback(
  context: AllyOggiBriefContext,
): AllyOggiBrief {
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
  const attn =
    context.counts.critical + context.counts.needsAttention;
  if (attn === 1) {
    parts.push("1 campagna richiede attenzione");
  } else if (attn > 1) {
    parts.push(`${attn} campagne richiedono attenzione`);
  }
  const monitor =
    context.counts.monitor + context.counts.insufficientData;
  if (monitor === 1) {
    parts.push("1 da monitorare");
  } else if (monitor > 1) {
    parts.push(`${monitor} da monitorare`);
  }
  if (context.counts.configurationRequired === 1) {
    parts.push("1 da configurare");
  } else if (context.counts.configurationRequired > 1) {
    parts.push(
      `${context.counts.configurationRequired} da configurare`,
    );
  }

  const headline =
    attn > 0
      ? "Ecco cosa richiederebbe attenzione oggi."
      : context.counts.configurationRequired > 0
        ? "Nessuna criticità operativa, ma c’è da configurare."
        : "Non vedo criticità operative oggi.";

  const summary =
    context.totalMonitored === 0
      ? "Non ci sono ancora campagne da sintetizzare."
      : parts.length > 0
        ? `Ho controllato ${context.totalMonitored} campagne. ${parts.join(" · ")}.`
        : `Ho controllato ${context.totalMonitored} campagne. Tutto stabile per ora.`;

  return {
    headline,
    summary,
    priorityItems,
    watchItems,
    configurationItems,
    closingNote:
      attn === 0 && context.counts.configurationRequired === 0
        ? "Puoi riprendere dalle campagne in monitoraggio quando vuoi."
        : null,
    fromAi: false,
  };
}
