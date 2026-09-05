/**
 * M9.2 — deterministic suggested questions (0 AI calls).
 */

import type { AllyCampaignCopilotContext } from "@/lib/ally-copilot/types";

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * 3–4 contextual suggestions from canonical workflow/performance state.
 * Pure — no AI.
 */
export function buildAllyCopilotSuggestions(
  context: AllyCampaignCopilotContext,
): string[] {
  const status = (context.workflow.status ?? "").toUpperCase();
  const attention = context.workflow.attentionState;
  const config = context.workflow.configurationKind;
  const small = context.performance.smallSample;
  const hasPerf =
    context.performance.results != null ||
    context.performance.spend != null ||
    context.performance.actualValue != null;

  if (attention === "CONFIGURATION_REQUIRED" && config !== "DRAFT") {
    return uniq([
      "Cosa devo configurare?",
      "Perché Ally non può valutarla?",
      "Quando potrò giudicare i risultati?",
    ]).slice(0, 4);
  }

  if (status === "DRAFT" || config === "DRAFT") {
    return uniq([
      "Cosa manca prima del lancio?",
      "Cosa manca perché Ally possa monitorarla bene?",
      "La campagna è pronta per Meta?",
      "Cosa testeresti per primo?",
    ]).slice(0, 4);
  }

  if (status === "REVISION_REQUESTED") {
    return uniq([
      "Cosa dovrei sistemare per la revisione?",
      "Qual è il prossimo passo dopo le modifiche?",
      "Cosa manca prima di rimandare in approvazione?",
    ]).slice(0, 4);
  }

  if (attention === "INSUFFICIENT_DATA" || small) {
    return uniq([
      "Aspetteresti ancora?",
      "Quanti dati mancano per decidere?",
      "Cosa dovrei osservare nel frattempo?",
      "Interverresti già ora?",
    ]).slice(0, 4);
  }

  if (attention === "CRITICAL" || attention === "NEEDS_ATTENTION") {
    return uniq([
      "Perché richiede attenzione?",
      "Aspetteresti ancora o interverresti?",
      "Cosa faresti per prima?",
      "Il costo per risultato è ancora sostenibile?",
    ]).slice(0, 4);
  }

  if (attention === "STABLE" || attention === "MONITOR") {
    return uniq([
      "Come sta andando?",
      "C'è qualcosa da ottimizzare?",
      "Cosa guarderesti per prima?",
      "Cambieresti qualcosa ora?",
    ]).slice(0, 4);
  }

  if (!hasPerf) {
    return uniq([
      "Cosa manca prima del lancio?",
      "La campagna è pronta per Meta?",
      "Cosa testeresti per primo?",
    ]).slice(0, 4);
  }

  return uniq([
    "Come sta andando questa campagna?",
    "Cosa faresti come prossimo passo?",
    "C'è abbastanza contesto per decidere?",
  ]).slice(0, 4);
}
