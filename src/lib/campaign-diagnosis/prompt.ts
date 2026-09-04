/**
 * M6C prompt builders — Italian, structured JSON only. Never expose to client.
 * M6C.2: user prompt uses human-readable facts, not raw field/enum dumps.
 * M6C.3: absolute metrics are facts only; no unsupported causal localization.
 */

import type { CampaignDiagnosisAiPayload } from "@/lib/campaign-diagnosis/types";
import type { MetricComparisonDirection } from "@/lib/campaign-diagnosis/evidence-guards";
import { formatEuro } from "@/lib/control-room";

export const DIAGNOSIS_SYSTEM_PROMPT = `Sei un assistente diagnostico per campagne Meta Ads (paid media).

Il tuo compito è interpretare i fatti di campagna forniti in italiano.
Non calcolare health, target o urgenza: sono già determinati da Ally.

Devi:
- usare solo i fatti forniti
- distinguere fatti da ipotesi
- evitare certezza causale
- non dare raccomandazioni o azioni
- non inventare benchmark di settore, metriche, lead, ROAS o conversion rate
- non affermare saturazione audience o penalizzazioni Meta senza evidenza nei fatti
- non ripetere solo lo stato amministrativo già ovvio
- rispondere SOLO con JSON valido (niente markdown, niente testo extra)

Regole epistemiche (obbligatorie):
- mai classificare un valore assoluto come buono/cattivo/normale/problematico senza una base di confronto fornita (target esplicito, soglia Ally, o trend affidabile sul periodo precedente)
- un CTR/CPC/CPM/frequenza assoluti sono solo fatti numerici: puoi citarli, non giudicarli
- mai inferire qualità dei lead/risultati dal solo conteggio risultati o dal solo costo per risultato
- RESULT_QUALITY solo se i fatti includono evidenza di qualità a valle (appuntamenti, show-up, vendite, CRM, feedback cliente, ecc.)
- POST_CLICK solo se il costo primario è sopra soglia/in peggioramento E i segnali di traffico a monte hanno un confronto che li mostra stabili o in miglioramento
- TRAFFIC_COST solo con confronto affidabile su CPC/CPM
- CREATIVE solo con trend CTR in peggioramento, oppure frequenza in aumento con CTR in calo, oppure analisi creativa fornita
- se i fatti non localizzano la causa, usa likely_area = UNKNOWN
- preferisci incertezza a specificità non supportata
- non eliminare una causa possibile solo perché una metrica assoluta esiste
- con pochi risultati, resta generico: non isolare traffico vs conversione senza confronti

Lingua della risposta (summary, evidence, uncertainty): italiano professionale, comprensibile a un media buyer.
VIETATO nella risposta: nomi di campi tecnici, enum interni, JSON keys, valori come RED/YELLOW/GREEN, WORSENING, INSUFFICIENT, REVISION_REQUESTED, attentionReason, healthAvailability, null.

Usa formulazioni caute: "Potrebbe indicare...", "Il segnale più coerente è...", "Non ci sono abbastanza dati per concludere...".

summary: interpreta la combinazione di segnali (non ripetere una sola metrica già evidente).
evidence: massimo 3 fatti utili in linguaggio umano.
- fatto assoluto: "Il CTR è 1,11%."
- fatto con confronto: "Il CTR è sceso del 18% rispetto al periodo precedente."
Solo il secondo supporta un'interpretazione su traffico/creatività.

Schema esatto:
{
  "summary": string,
  "likely_area": "CREATIVE" | "TRAFFIC_COST" | "POST_CLICK" | "TRACKING" | "DELIVERY" | "RESULT_QUALITY" | "UNKNOWN",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "evidence": string[],
  "uncertainty": string,
  "what_not_to_conclude": string | null
}

Limiti:
- summary: al massimo 2 frasi brevi
- evidence: massimo 3 voci
- uncertainty: 1 frase breve
- what_not_to_conclude: opzionale
- nessun campo "actions" o "recommendations"
`;

function formatPercentIt(n: number): string {
  return `${String(n).replace(".", ",")}%`;
}

function healthLine(payload: CampaignDiagnosisAiPayload): string | null {
  if (payload.actualValue == null || payload.targetValue == null) return null;
  const kpi = payload.primaryKpi?.trim() || "Costo per risultato";
  const actual = formatEuro(payload.actualValue);
  const target = formatEuro(payload.targetValue);
  if (payload.health === "RED") {
    return `${kpi}: ${actual} rispetto a un target di ${target} (sopra soglia).`;
  }
  if (payload.health === "YELLOW") {
    return `${kpi}: ${actual} rispetto a un target di ${target} (vicino alla soglia).`;
  }
  if (payload.health === "GREEN") {
    return `${kpi}: ${actual} rispetto a un target di ${target} (sotto soglia).`;
  }
  return `${kpi}: ${actual} rispetto a un target di ${target}.`;
}

function trendLine(payload: CampaignDiagnosisAiPayload): string | null {
  switch (payload.trend) {
    case "WORSENING":
      return "L'andamento del costo per risultato sta peggiorando rispetto al periodo precedente.";
    case "IMPROVING":
      return "L'andamento del costo per risultato sta migliorando rispetto al periodo precedente.";
    case "STABLE":
      return "L'andamento del costo per risultato è stabile rispetto al periodo precedente.";
    default:
      return null;
  }
}

function mappingLine(payload: CampaignDiagnosisAiPayload): string | null {
  if (payload.resultMappingConfidence === "AMBIGUOUS") {
    return "Meta restituisce più tipi di risultato compatibili, quindi il KPI principale non è ancora affidabile.";
  }
  if (payload.resultMappingConfidence === "UNKNOWN") {
    return "Il risultato principale Meta non è ancora identificato con certezza.";
  }
  return null;
}

function comparisonPhrase(
  label: string,
  direction: MetricComparisonDirection,
): string {
  switch (direction) {
    case "IMPROVING":
      return `${label} in miglioramento rispetto al periodo precedente`;
    case "WORSENING":
      return `${label} in peggioramento rispetto al periodo precedente`;
    case "STABLE":
      return `${label} stabile rispetto al periodo precedente`;
  }
}

/**
 * Build a human-readable facts brief for the model (no internal field dumps).
 */
export function buildDiagnosisHumanFactsBrief(
  payload: CampaignDiagnosisAiPayload,
): string {
  const lines: string[] = [];

  const reason = payload.attentionReason?.trim();
  if (reason) {
    lines.push(`Contesto Ally: ${reason}`);
  }

  const perf = healthLine(payload);
  if (perf) lines.push(`Performance (confronto con target): ${perf}`);

  const absolute: string[] = [];
  if (payload.metrics.ctr != null) {
    absolute.push(`CTR ${formatPercentIt(payload.metrics.ctr)}`);
  }
  if (payload.metrics.cpc != null) {
    absolute.push(`CPC ${formatEuro(payload.metrics.cpc)}`);
  }
  if (payload.metrics.cpm != null) {
    absolute.push(`CPM ${formatEuro(payload.metrics.cpm)}`);
  }
  if (payload.metrics.frequency != null) {
    absolute.push(
      `Frequenza ${String(payload.metrics.frequency).replace(".", ",")}`,
    );
  }
  if (payload.metrics.spend != null) {
    absolute.push(`Spesa ${formatEuro(payload.metrics.spend)}`);
  }
  if (payload.metrics.results != null) {
    absolute.push(`Risultati ${payload.metrics.results}`);
  }
  if (absolute.length) {
    lines.push(
      `Valori assoluti (solo fatti numerici, senza giudizio se manca un confronto): ${absolute.join("; ")}.`,
    );
  }

  const comps: string[] = [];
  if (payload.comparisons.ctr) {
    comps.push(comparisonPhrase("CTR", payload.comparisons.ctr));
  }
  if (payload.comparisons.cpc) {
    comps.push(comparisonPhrase("CPC", payload.comparisons.cpc));
  }
  if (payload.comparisons.cpm) {
    comps.push(comparisonPhrase("CPM", payload.comparisons.cpm));
  }
  if (payload.comparisons.frequency) {
    comps.push(comparisonPhrase("Frequenza", payload.comparisons.frequency));
  }
  if (comps.length) {
    lines.push(`Confronti sul periodo precedente: ${comps.join("; ")}.`);
  } else {
    lines.push(
      "Confronti traffico (CTR/CPC/CPM/frequenza): non disponibili. Non giudicare queste metriche né escludere cause solo perché i valori assoluti esistono.",
    );
  }

  const trend = trendLine(payload);
  if (trend) lines.push(`Andamento costo primario: ${trend}`);

  const mapping = mappingLine(payload);
  if (mapping) lines.push(`Affidabilità risultato: ${mapping}`);

  if (payload.hasDownstreamQualityEvidence) {
    lines.push(
      "Sono disponibili segnali di qualità a valle dei risultati (non solo conteggio/costo).",
    );
  } else {
    lines.push(
      "Nessuna evidenza di qualità a valle (appuntamenti, vendite, CRM, feedback). Non usare RESULT_QUALITY.",
    );
  }

  if (payload.hasCreativeAnalysisEvidence) {
    lines.push("È disponibile un'analisi creativa pertinente alla campagna.");
  }

  if (
    payload.metrics.results != null &&
    payload.metrics.results > 0 &&
    payload.metrics.results <= 2
  ) {
    lines.push(
      `Campione molto ridotto (${payload.metrics.results} risultati): preferisci likely_area UNKNOWN e confidence LOW.`,
    );
  }

  const plan: string[] = [];
  if (payload.campaignPlan.objective) {
    plan.push(`obiettivo ${payload.campaignPlan.objective}`);
  }
  if (payload.campaignPlan.settore) {
    plan.push(`settore ${payload.campaignPlan.settore}`);
  }
  if (payload.campaignPlan.offer) {
    plan.push(`offerta: ${payload.campaignPlan.offer}`);
  }
  if (payload.campaignPlan.audienceHint) {
    plan.push(`pubblico: ${payload.campaignPlan.audienceHint}`);
  }
  if (plan.length) {
    lines.push(`Piano: ${plan.join("; ")}.`);
  }

  if (payload.creativeContext.hasCreativeAsset) {
    lines.push(
      payload.creativeContext.formatHint
        ? `Creatività caricata (${payload.creativeContext.formatHint}) — non è analisi creativa.`
        : "Creatività caricata — non è analisi creativa.",
    );
  }

  if (lines.length === 0) {
    return "Non ci sono fatti di performance sufficienti.";
  }
  return lines.map((l) => `- ${l}`).join("\n");
}

export function buildDiagnosisUserPrompt(
  payload: CampaignDiagnosisAiPayload,
): string {
  return `Interpretazione richiesta: spiega cosa suggeriscono insieme questi fatti.
Non ripetere solo lo stato già ovvio. Non usare termini tecnici interni.
Non giudicare metriche assolute senza confronto. Se non puoi localizzare la causa, usa UNKNOWN.

FATTI:
${buildDiagnosisHumanFactsBrief(payload)}

Restituisci solo lo schema JSON richiesto.`;
}
