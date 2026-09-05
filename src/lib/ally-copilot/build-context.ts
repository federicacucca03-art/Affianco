/**
 * M9.2 — pure builders for Ally campaign copilot context.
 */

import { isSmallSample } from "@/lib/campaign-next-action";
import type { CampaignDiagnosisAiPayload } from "@/lib/campaign-diagnosis/types";
import type {
  AllyCampaignCopilotContext,
  AllyCopilotHistoryTurn,
  AllyCopilotSource,
} from "@/lib/ally-copilot/types";
import { ALLY_COPILOT_MAX_INPUT_CHARS } from "@/lib/ally-copilot/types";
import { buildAllyCopilotUserPrompt } from "@/lib/ally-copilot/prompt";

export type AllyCopilotIdentityInput = {
  campaignId: string;
  source: AllyCopilotSource;
  clientName: string;
  campaignName: string;
  href: string;
  linkedNativeId: string | null;
  citta: string | null;
  copyVariants: string[];
  headline: string | null;
  configurationKind: string | null;
  nextActionType: string | null;
  nextActionTitle: string | null;
  nextActionHref: string | null;
};

/** Merge diagnosis whitelist + identity into compact copilot context. */
export function buildAllyCampaignCopilotContext(input: {
  identity: AllyCopilotIdentityInput;
  payload: CampaignDiagnosisAiPayload;
}): AllyCampaignCopilotContext {
  const { identity, payload } = input;
  const results = payload.metrics.results;
  return {
    identity: {
      campaignId: identity.campaignId,
      source: identity.source,
      clientName: identity.clientName.slice(0, 120),
      campaignName: identity.campaignName.slice(0, 160),
      objective: payload.objective,
      href: identity.href,
    },
    workflow: {
      status: payload.status,
      attentionState: payload.attentionState,
      urgencyLevel: payload.urgencyLevel,
      configurationKind: identity.configurationKind,
      attentionReason: payload.attentionReason.slice(0, 280),
    },
    planning: {
      settore: payload.campaignPlan.settore,
      citta: identity.citta,
      audienceHint: payload.campaignPlan.audienceHint,
      offer: payload.campaignPlan.offer,
      dailyBudget: payload.economics.dailyBudget,
      copyVariants: identity.copyVariants
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((v) => v.slice(0, 280)),
      headline: identity.headline ? identity.headline.slice(0, 160) : null,
      creativeFormatHint: payload.creativeContext.formatHint,
      hasCreativeAsset: payload.creativeContext.hasCreativeAsset,
    },
    economics: {
      maxSustainableCpa: payload.economics.maxSustainableCpa,
      targetMargin: payload.economics.targetMargin,
      targetValue: payload.targetValue,
      primaryKpi: payload.primaryKpi,
    },
    performance: {
      spend: payload.metrics.spend,
      results,
      impressions: payload.metrics.impressions,
      linkClicks: payload.metrics.linkClicks,
      ctr: payload.metrics.ctr,
      cpc: payload.metrics.cpc,
      cpm: payload.metrics.cpm,
      frequency: payload.metrics.frequency,
      actualValue: payload.actualValue,
      health: payload.health,
      trend: payload.trend,
      smallSample: isSmallSample(results),
      hasDownstreamQualityEvidence: payload.hasDownstreamQualityEvidence,
      hasCreativeAnalysisEvidence: payload.hasCreativeAnalysisEvidence,
      comparisons: {
        ctr: payload.comparisons.ctr,
        cpc: payload.comparisons.cpc,
        cpm: payload.comparisons.cpm,
        frequency: payload.comparisons.frequency,
      },
    },
    decision: {
      nextActionType: identity.nextActionType,
      nextActionTitle: identity.nextActionTitle,
      nextActionHref: identity.nextActionHref,
    },
    linkedNativeId: identity.linkedNativeId,
  };
}

export function estimateAllyCopilotInputChars(
  context: AllyCampaignCopilotContext,
  question: string,
  history: AllyCopilotHistoryTurn[] | number,
): number {
  if (typeof history === "number") {
    return (
      JSON.stringify(context).length +
      question.length +
      history * 220
    );
  }
  return buildAllyCopilotUserPrompt({ context, question, history }).length;
}

/**
 * Fit prompt under soft ceiling without sacrificing the current question
 * or critical canonical facts (identity / workflow / economics / performance / decision).
 *
 * Truncation order:
 * 1. drop oldest conversational history turns
 * 2. trim low-value optional planning text (copy variants, long offer/audience/headline)
 * 3. never drop question, identity, workflow, economics targets, performance, or decision
 */
export function fitAllyCopilotInput(input: {
  context: AllyCampaignCopilotContext;
  question: string;
  history: AllyCopilotHistoryTurn[];
  maxChars?: number;
}): {
  context: AllyCampaignCopilotContext;
  question: string;
  history: AllyCopilotHistoryTurn[];
  droppedHistoryTurns: number;
  trimmedPlanning: boolean;
} {
  const maxChars = input.maxChars ?? ALLY_COPILOT_MAX_INPUT_CHARS;
  const question = input.question;
  let history = [...input.history];
  let context: AllyCampaignCopilotContext = {
    ...input.context,
    planning: { ...input.context.planning },
    identity: { ...input.context.identity },
    workflow: { ...input.context.workflow },
    economics: { ...input.context.economics },
    performance: {
      ...input.context.performance,
      comparisons: { ...input.context.performance.comparisons },
    },
    decision: { ...input.context.decision },
  };
  let droppedHistoryTurns = 0;
  let trimmedPlanning = false;

  const size = () => estimateAllyCopilotInputChars(context, question, history);

  while (size() > maxChars && history.length > 0) {
    history = history.slice(1);
    droppedHistoryTurns += 1;
  }

  if (size() > maxChars) {
    const planning = { ...context.planning };
    if (planning.copyVariants.length > 0) {
      planning.copyVariants = [];
      trimmedPlanning = true;
    }
    if (planning.offer && planning.offer.length > 80) {
      planning.offer = `${planning.offer.slice(0, 80)}…`;
      trimmedPlanning = true;
    }
    if (planning.audienceHint && planning.audienceHint.length > 80) {
      planning.audienceHint = `${planning.audienceHint.slice(0, 80)}…`;
      trimmedPlanning = true;
    }
    if (planning.headline && planning.headline.length > 80) {
      planning.headline = `${planning.headline.slice(0, 80)}…`;
      trimmedPlanning = true;
    }
    context = { ...context, planning };
  }

  // Soft soft-fail: still never strip question or canonical decision/performance facts.
  return {
    context,
    question,
    history,
    droppedHistoryTurns,
    trimmedPlanning,
  };
}

export function assertAllyCopilotContextBounded(
  context: AllyCampaignCopilotContext,
  question: string,
  history: AllyCopilotHistoryTurn[] | number,
): void {
  const n = estimateAllyCopilotInputChars(context, question, history);
  if (n > ALLY_COPILOT_MAX_INPUT_CHARS * 2) {
    throw new Error("Contesto copilot troppo grande.");
  }
}

const FORBIDDEN = [
  "access_token",
  "authorization",
  "api_key",
  "apikey",
  "service_role",
  "approval_token",
  "password",
  "bearer ",
  "encrypted",
  "refresh_token",
];

export function assertAllyCopilotPayloadSafe(
  context: AllyCampaignCopilotContext,
): void {
  const blob = JSON.stringify(context).toLowerCase();
  for (const f of FORBIDDEN) {
    if (blob.includes(f)) {
      throw new Error(`Contesto copilot contiene campo vietato: ${f}`);
    }
  }
  if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(blob)) {
    throw new Error("Contesto copilot non deve includere email.");
  }
}
